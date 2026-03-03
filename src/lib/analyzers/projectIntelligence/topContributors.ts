/**
 * Top Contributors Analysis
 * 
 * Identifies the most active contributors by querying createdBy/updatedBy
 * fields from entries. Shows:
 * - Top 3 contributors
 * - Their focus areas (which models they work on)
 * - Recent activity
 * - Weekly activity timeline
 */

import { GraphQLClient } from 'graphql-request';
import {
  TopContributorsAnalysis,
  Contributor,
  ContributorFocusArea,
  ContributorLastActivity,
} from './types';

interface RawEntry {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
    picture?: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email?: string;
  };
}

interface ContributorAccumulator {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  entriesCreated: number;
  entriesUpdated: number;
  modelActivity: Record<string, number>; // model -> count
  lastActivity: ContributorLastActivity | null;
  weeklyActivity: Record<string, number>; // week key -> count
}

/**
 * Calculate days ago from a date string
 */
function daysAgo(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get week key for a date (e.g., "2024-W01")
 */
function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get last 12 week keys
 */
function getLast12Weeks(): string[] {
  const weeks: string[] = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - (i * 7));
    weeks.push(getWeekKey(date.toISOString()));
  }
  
  return weeks;
}

/**
 * Build GraphQL query for a model's entries with creator info
 */
function buildModelQuery(modelApiId: string, since: string): string {
  // Convert to plural API ID (simple heuristic)
  const pluralApiId = modelApiId.charAt(0).toLowerCase() + modelApiId.slice(1) + 's';
  
  return `
    ${pluralApiId}(
      where: { updatedAt_gte: "${since}" }
      first: 500
      orderBy: updatedAt_DESC
    ) {
      id
      createdAt
      updatedAt
      createdBy {
        id
        name
        email
        picture
      }
      updatedBy {
        id
        name
        email
      }
    }
  `;
}

/**
 * Scan for top contributors
 */
export async function scanTopContributors(
  endpoint: string,
  token: string,
  modelNames: string[]
): Promise<TopContributorsAnalysis> {
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  // Calculate 3 months ago
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const since = threeMonthsAgo.toISOString();
  
  // Accumulate contributor data
  const contributorMap: Record<string, ContributorAccumulator> = {};
  let totalEntries = 0;
  let successfulQueries = 0;
  
  console.log(`[TopContributors] Scanning ${modelNames.length} models since ${since}`);
  
  // Query each model (batch if possible, otherwise sequential)
  for (const modelName of modelNames) {
    try {
      // Convert to plural API ID - handle common patterns
      let pluralApiId = modelName.charAt(0).toLowerCase() + modelName.slice(1);
      // Simple pluralization
      if (pluralApiId.endsWith('y')) {
        pluralApiId = pluralApiId.slice(0, -1) + 'ies';
      } else if (pluralApiId.endsWith('s') || pluralApiId.endsWith('x') || pluralApiId.endsWith('ch') || pluralApiId.endsWith('sh')) {
        pluralApiId = pluralApiId + 'es';
      } else {
        pluralApiId = pluralApiId + 's';
      }
      
      // Query with minimal fields - only id and name are guaranteed on createdBy
      const query = `
        query GetContributorActivity {
          ${pluralApiId}(
            where: { updatedAt_gte: "${since}" }
            first: 100
            orderBy: updatedAt_DESC
          ) {
            id
            createdAt
            updatedAt
            createdBy {
              id
              name
            }
          }
        }
      `;
      
      console.log(`[TopContributors] Querying ${modelName} (${pluralApiId})...`);
      
      const response = await client.request<Record<string, RawEntry[]>>(query);
      const entries = response[pluralApiId] || [];
      
      console.log(`[TopContributors] Got ${entries.length} entries from ${modelName}`);
      successfulQueries++;
      
      for (const entry of entries) {
        totalEntries++;
        
        // Process creator
        if (entry.createdBy) {
          const contributor = getOrCreateContributor(contributorMap, entry.createdBy);
          contributor.entriesCreated++;
          contributor.modelActivity[modelName] = (contributor.modelActivity[modelName] || 0) + 1;
          
          const weekKey = getWeekKey(entry.createdAt);
          contributor.weeklyActivity[weekKey] = (contributor.weeklyActivity[weekKey] || 0) + 1;
          
          // Update last activity if more recent
          const entryDaysAgo = daysAgo(entry.createdAt);
          if (!contributor.lastActivity || entryDaysAgo < contributor.lastActivity.daysAgo) {
            contributor.lastActivity = {
              entryTitle: entry.title || entry.id,
              model: modelName,
              action: 'created',
              date: entry.createdAt,
              daysAgo: entryDaysAgo,
            };
          }
        }
        
        // Note: updatedBy is often the same as createdBy, so we skip it for simplicity
      }
    } catch (err) {
      // Model might not have createdBy fields exposed, or query structure is different
      // Continue with other models
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[TopContributors] Could not query ${modelName}:`, errorMessage);
    }
  }
  
  console.log(`[TopContributors] Completed: ${successfulQueries}/${modelNames.length} models, ${totalEntries} entries, ${Object.keys(contributorMap).length} contributors`);
  
  // Convert to Contributor array and sort by total activity
  const contributors: Contributor[] = Object.values(contributorMap).map(acc => {
    const totalEntries = acc.entriesCreated + acc.entriesUpdated;
    
    // Calculate focus areas (top 3 models)
    const focusAreas: ContributorFocusArea[] = Object.entries(acc.modelActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([model, count]) => ({
        model,
        count,
        percentage: Math.round((count / totalEntries) * 100),
      }));
    
    // Build weekly activity array (last 12 weeks)
    const last12Weeks = getLast12Weeks();
    const weeklyActivity = last12Weeks.map(week => acc.weeklyActivity[week] || 0);
    
    return {
      id: acc.id,
      name: acc.name,
      email: acc.email,
      picture: acc.picture,
      totalEntries,
      entriesCreated: acc.entriesCreated,
      entriesUpdated: acc.entriesUpdated,
      focusAreas,
      lastActivity: acc.lastActivity,
      weeklyActivity,
    };
  });
  
  // Sort by total activity and get top 3
  contributors.sort((a, b) => b.totalEntries - a.totalEntries);
  const top3 = contributors.slice(0, 3);
  
  // Determine activity pattern
  let weekdayCount = 0;
  let weekendCount = 0;
  // This would need actual day-of-week data to calculate properly
  // For now, assume weekday-focused
  const activityPattern = 'weekday' as const;
  
  return {
    period: '3months',
    scannedAt: new Date().toISOString(),
    totalContributors: contributors.length,
    totalEntries,
    top3,
    activityPattern,
  };
}

/**
 * Get or create contributor accumulator
 */
function getOrCreateContributor(
  map: Record<string, ContributorAccumulator>,
  user: { id: string; name: string; email?: string; picture?: string }
): ContributorAccumulator {
  if (!map[user.id]) {
    map[user.id] = {
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      entriesCreated: 0,
      entriesUpdated: 0,
      modelActivity: {},
      lastActivity: null,
      weeklyActivity: {},
    };
  }
  return map[user.id];
}

/**
 * Format contributor for display
 */
export function formatContributor(contributor: Contributor): string {
  const focusModels = contributor.focusAreas.map(f => f.model).join(', ');
  const lastActivityStr = contributor.lastActivity
    ? `${contributor.lastActivity.daysAgo} days ago`
    : 'Unknown';
  
  return `${contributor.name} (${contributor.totalEntries} entries) - Focus: ${focusModels} - Last active: ${lastActivityStr}`;
}

