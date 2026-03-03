import { GraphQLClient } from 'graphql-request';
import type { 
  HygraphSchema, 
  ContentFreshnessAnalysis,
  ModelActivity
} from '../types';

// System types to exclude
const SYSTEM_TYPES = new Set(['Asset', 'RichText', 'Location', 'Color', 'RGBA']);

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Fetches the most recent updatedAt for a model (single entry, ordered by updatedAt DESC)
 */
async function fetchLastUpdated(
  client: GraphQLClient,
  pluralApiId: string
): Promise<Date | null> {
  // Try multiple query approaches for compatibility
  const queriesToTry = [
    `query { ${pluralApiId}(first: 1, orderBy: updatedAt_DESC, stage: DRAFT) { updatedAt } }`,
    `query { ${pluralApiId}(first: 1, orderBy: updatedAt_DESC) { updatedAt } }`,
    `query { ${pluralApiId}(first: 1, orderBy: createdAt_DESC, stage: DRAFT) { createdAt } }`,
    `query { ${pluralApiId}(first: 1, orderBy: createdAt_DESC) { createdAt } }`,
  ];

  for (const query of queriesToTry) {
    try {
      const result = await client.request<Record<string, { updatedAt?: string; createdAt?: string }[]>>(query);
      const entries = result[pluralApiId];
      if (entries && entries.length > 0) {
        const dateStr = entries[0].updatedAt || entries[0].createdAt;
        if (dateStr) {
          return new Date(dateStr);
        }
      }
    } catch {
      // Try next query
    }
  }

  return null;
}

export async function analyzeContentFreshness(
  client: GraphQLClient,
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): Promise<ContentFreshnessAnalysis> {
  const now = new Date();
  const models: ModelActivity[] = [];

  // Get all models with content
  const modelsToAnalyze = schema.models
    .filter(m => !m.isSystem && !SYSTEM_TYPES.has(m.name))
    .filter(m => {
      const entryCount = entryCounts[m.name];
      return entryCount && (entryCount.draft > 0 || entryCount.published > 0);
    })
    // Sort by total entries (highest first)
    .sort((a, b) => {
      const aCount = (entryCounts[a.name]?.draft || 0) + (entryCounts[a.name]?.published || 0);
      const bCount = (entryCounts[b.name]?.draft || 0) + (entryCounts[b.name]?.published || 0);
      return bCount - aCount;
    });

  // Analyze each model - just get the last updated date
  for (const model of modelsToAnalyze) {
    try {
      const lastUpdated = await fetchLastUpdated(client, model.pluralApiId);
      const totalEntries = (entryCounts[model.name]?.draft || 0) + (entryCounts[model.name]?.published || 0);
      
      models.push({
        model: model.name,
        totalEntries,
        lastUpdated,
        daysSinceUpdate: lastUpdated ? daysBetween(now, lastUpdated) : -1,
      });
    } catch {
      // Skip models we can't analyze
      const totalEntries = (entryCounts[model.name]?.draft || 0) + (entryCounts[model.name]?.published || 0);
      models.push({
        model: model.name,
        totalEntries,
        lastUpdated: null,
        daysSinceUpdate: -1,
      });
    }
  }

  // Sort by days since update (most recent first, unknown at end)
  models.sort((a, b) => {
    if (a.daysSinceUpdate === -1 && b.daysSinceUpdate === -1) return 0;
    if (a.daysSinceUpdate === -1) return 1;
    if (b.daysSinceUpdate === -1) return -1;
    return a.daysSinceUpdate - b.daysSinceUpdate;
  });

  return {
    models,
    analyzedAt: now,
  };
}
