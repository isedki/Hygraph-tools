import { GraphQLClient } from 'graphql-request';
import type { 
  HygraphSchema, 
  ContentFreshnessAnalysis, 
  FreshnessThresholds, 
  ModelFreshness 
} from '../types';
import { fetchFreshnessData } from '../hygraph/introspection';

// System types to exclude
const SYSTEM_TYPES = new Set(['Asset', 'RichText', 'Location', 'Color', 'RGBA']);

// Default thresholds (in days)
export const DEFAULT_FRESHNESS_THRESHOLDS: FreshnessThresholds = {
  fresh: 30,    // Updated in last 30 days
  aging: 90,    // Updated in last 90 days
  stale: 180,   // Updated in last 180 days
  dormant: 365  // Not updated in over a year
};

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function categorizeEntry(
  updatedAt: Date,
  now: Date,
  thresholds: FreshnessThresholds
): 'fresh' | 'aging' | 'stale' | 'dormant' {
  const daysSinceUpdate = daysBetween(now, updatedAt);
  
  if (daysSinceUpdate <= thresholds.fresh) return 'fresh';
  if (daysSinceUpdate <= thresholds.aging) return 'aging';
  if (daysSinceUpdate <= thresholds.stale) return 'stale';
  return 'dormant';
}

export async function analyzeContentFreshness(
  client: GraphQLClient,
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>,
  thresholds: FreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS
): Promise<ContentFreshnessAnalysis> {
  const now = new Date();
  const modelFreshness: ModelFreshness[] = [];
  const staleContentAlert: { model: string; staleCount: number; percentage: number }[] = [];
  const recommendations: string[] = [];
  
  // Aggregate counters for overall freshness
  let totalEntries = 0;
  let totalFresh = 0;
  let totalAging = 0;
  let totalStale = 0;
  let totalDormant = 0;
  
  // Analyze each model
  for (const model of schema.models) {
    if (model.isSystem || SYSTEM_TYPES.has(model.name)) continue;
    
    // Skip models with no entries
    const entryCount = entryCounts[model.name];
    if (!entryCount || entryCount.draft === 0) continue;
    
    try {
      // Fetch freshness data
      const freshnessData = await fetchFreshnessData(client, model, 500);
      
      if (freshnessData.length === 0) continue;
      
      let fresh = 0;
      let aging = 0;
      let stale = 0;
      let dormant = 0;
      let totalAgeDays = 0;
      let newestEntry: Date | null = null;
      let oldestEntry: Date | null = null;
      
      for (const entry of freshnessData) {
        const updatedAt = new Date(entry.updatedAt);
        
        // Track newest and oldest
        if (!newestEntry || updatedAt > newestEntry) {
          newestEntry = updatedAt;
        }
        if (!oldestEntry || updatedAt < oldestEntry) {
          oldestEntry = updatedAt;
        }
        
        // Calculate age
        const age = daysBetween(now, updatedAt);
        totalAgeDays += age;
        
        // Categorize
        const category = categorizeEntry(updatedAt, now, thresholds);
        switch (category) {
          case 'fresh': fresh++; break;
          case 'aging': aging++; break;
          case 'stale': stale++; break;
          case 'dormant': dormant++; break;
        }
      }
      
      const modelTotal = freshnessData.length;
      const avgAgeDays = Math.round(totalAgeDays / modelTotal);
      
      modelFreshness.push({
        model: model.name,
        totalEntries: modelTotal,
        fresh,
        aging,
        stale,
        dormant,
        avgAgeDays,
        newestEntry,
        oldestEntry
      });
      
      // Update totals
      totalEntries += modelTotal;
      totalFresh += fresh;
      totalAging += aging;
      totalStale += stale;
      totalDormant += dormant;
      
      // Check for stale content alerts (>50% stale or dormant)
      const stalePercentage = Math.round(((stale + dormant) / modelTotal) * 100);
      if (stalePercentage > 50) {
        staleContentAlert.push({
          model: model.name,
          staleCount: stale + dormant,
          percentage: stalePercentage
        });
      }
      
    } catch {
      // Skip models we can't analyze
    }
  }
  
  // Sort model freshness by average age (oldest first)
  modelFreshness.sort((a, b) => b.avgAgeDays - a.avgAgeDays);
  
  // Sort alerts by percentage
  staleContentAlert.sort((a, b) => b.percentage - a.percentage);
  
  // Calculate overall percentages
  const freshPercentage = totalEntries > 0 ? Math.round((totalFresh / totalEntries) * 100) : 0;
  const stalePercentage = totalEntries > 0 ? Math.round((totalStale / totalEntries) * 100) : 0;
  const dormantPercentage = totalEntries > 0 ? Math.round((totalDormant / totalEntries) * 100) : 0;
  
  // Calculate overall freshness score
  // Formula: weighted average (fresh=100, aging=70, stale=30, dormant=0)
  let overallScore = 0;
  if (totalEntries > 0) {
    overallScore = Math.round(
      (totalFresh * 100 + totalAging * 70 + totalStale * 30 + totalDormant * 0) / totalEntries
    );
  }
  
  // Generate recommendations
  if (dormantPercentage > 20) {
    recommendations.push(
      `${dormantPercentage}% of content hasn't been updated in over ${thresholds.dormant} days. Schedule a comprehensive content review.`
    );
  }
  
  if (stalePercentage > 30) {
    recommendations.push(
      `${stalePercentage}% of content is stale (not updated in ${thresholds.stale}+ days). Consider implementing content refresh cycles.`
    );
  }
  
  if (staleContentAlert.length > 0) {
    const alertModels = staleContentAlert.slice(0, 3).map(a => a.model).join(', ');
    recommendations.push(
      `${staleContentAlert.length} model(s) have majority stale content: ${alertModels}. Prioritize reviewing these models.`
    );
  }
  
  if (freshPercentage > 70) {
    recommendations.push(
      'Good content freshness! Most content has been updated recently. Maintain this momentum.'
    );
  }
  
  const highVelocityModels = modelFreshness.filter(m => 
    m.totalEntries > 10 && (m.fresh / m.totalEntries) > 0.8
  );
  if (highVelocityModels.length > 0) {
    const names = highVelocityModels.slice(0, 3).map(m => m.model).join(', ');
    recommendations.push(
      `High-velocity models (${names}) have most content recently updated. Good editorial activity!`
    );
  }
  
  if (totalEntries === 0) {
    recommendations.push('No content available to analyze freshness.');
  }
  
  return {
    thresholds,
    modelFreshness,
    overallFreshness: {
      score: overallScore,
      totalEntries,
      freshPercentage,
      stalePercentage,
      dormantPercentage
    },
    staleContentAlert,
    recommendations
  };
}
