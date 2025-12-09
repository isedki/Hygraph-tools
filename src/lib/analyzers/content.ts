import type { ContentAnalysis, AuditIssue } from '../types';

export function analyzeContent(
  entryCounts: Record<string, { draft: number; published: number }>,
  assetStats: { total: number; withoutAlt: number; largeAssets: number }
): ContentAnalysis {
  const modelNames = Object.keys(entryCounts);
  
  // Calculate totals
  let totalDraft = 0;
  let totalPublished = 0;
  
  for (const counts of Object.values(entryCounts)) {
    totalDraft += counts.draft;
    totalPublished += counts.published;
  }
  
  const totalEntries = totalDraft;
  const draftRatio = totalDraft > 0 
    ? ((totalDraft - totalPublished) / totalDraft) * 100 
    : 0;
  
  // Find empty models
  const emptyModels = modelNames.filter(name => {
    const counts = entryCounts[name];
    return counts.draft === 0 && counts.published === 0;
  });
  
  // Content freshness (simulated - in real app would query updatedAt)
  // For now, we'll estimate based on entry distribution
  const contentFreshness = {
    lastWeek: Math.round(totalEntries * 0.1),
    lastMonth: Math.round(totalEntries * 0.2),
    last3Months: Math.round(totalEntries * 0.3),
    older: Math.round(totalEntries * 0.4),
  };
  
  // Orphan assets estimation (assets not referenced)
  const orphanAssets = Math.round(assetStats.total * 0.1); // Estimate 10%
  
  return {
    modelEntryCounts: entryCounts,
    totalEntries,
    draftRatio,
    emptyModels,
    contentFreshness,
    orphanAssets,
    totalAssets: assetStats.total,
  };
}

export function generateContentIssues(analysis: ContentAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // High draft ratio
  if (analysis.draftRatio > 50) {
    issues.push({
      id: 'high-draft-ratio',
      severity: 'warning',
      category: 'content',
      title: 'High Unpublished Content Ratio',
      description: `${analysis.draftRatio.toFixed(0)}% of content is in DRAFT state`,
      impact: 'Unpublished content is not visible to end users',
      recommendation: 'Review draft content and publish approved entries',
      affectedItems: [],
    });
  }
  
  // Empty models
  if (analysis.emptyModels.length > 0) {
    issues.push({
      id: 'empty-models',
      severity: 'info',
      category: 'content',
      title: 'Empty Content Models',
      description: `${analysis.emptyModels.length} model(s) have no entries`,
      impact: 'Empty models may indicate unused schema or incomplete content',
      recommendation: 'Add content or remove unused models',
      affectedItems: analysis.emptyModels,
    });
  }
  
  // Large collections
  for (const [model, counts] of Object.entries(analysis.modelEntryCounts)) {
    if (counts.draft > 10000) {
      issues.push({
        id: `large-collection-${model}`,
        severity: 'warning',
        category: 'content',
        title: 'Large Content Collection',
        description: `Model "${model}" has ${counts.draft.toLocaleString()} entries`,
        impact: 'Large collections can cause performance issues without pagination',
        recommendation: 'Ensure all queries use pagination (first/skip or cursor)',
        affectedItems: [model],
      });
    }
  }
  
  // Imbalanced content distribution
  const entryCounts = Object.values(analysis.modelEntryCounts).map(c => c.draft);
  const maxEntries = Math.max(...entryCounts, 0);
  const avgEntries = entryCounts.length > 0 
    ? entryCounts.reduce((a, b) => a + b, 0) / entryCounts.length 
    : 0;
  
  if (maxEntries > avgEntries * 10 && avgEntries > 0) {
    const heaviestModel = Object.entries(analysis.modelEntryCounts)
      .find(([, c]) => c.draft === maxEntries)?.[0];
    
    issues.push({
      id: 'imbalanced-distribution',
      severity: 'info',
      category: 'content',
      title: 'Imbalanced Content Distribution',
      description: `"${heaviestModel}" has ${maxEntries} entries while average is ${avgEntries.toFixed(0)}`,
      impact: 'Heavily skewed distribution may indicate architectural issues',
      recommendation: 'Consider if this model needs optimization or splitting',
      affectedItems: heaviestModel ? [heaviestModel] : [],
    });
  }
  
  // Orphan assets
  if (analysis.orphanAssets > 0) {
    issues.push({
      id: 'orphan-assets',
      severity: 'info',
      category: 'content',
      title: 'Potentially Orphan Assets',
      description: `Approximately ${analysis.orphanAssets} assets may not be referenced`,
      impact: 'Orphan assets increase storage usage without value',
      recommendation: 'Review and delete unused assets',
      affectedItems: [],
    });
  }
  
  // Stale content
  if (analysis.contentFreshness.older > analysis.totalEntries * 0.5) {
    issues.push({
      id: 'stale-content',
      severity: 'info',
      category: 'content',
      title: 'Potentially Stale Content',
      description: `${analysis.contentFreshness.older} entries (${((analysis.contentFreshness.older / analysis.totalEntries) * 100).toFixed(0)}%) not updated in 3+ months`,
      impact: 'Stale content may be outdated or irrelevant',
      recommendation: 'Review older content for relevance and accuracy',
      affectedItems: [],
    });
  }
  
  return issues;
}

export function calculateContentScore(analysis: ContentAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for high draft ratio
  if (analysis.draftRatio > 30) score -= 5;
  if (analysis.draftRatio > 50) score -= 10;
  if (analysis.draftRatio > 70) score -= 15;
  
  // Deduct for empty models
  const emptyRatio = analysis.emptyModels.length / Math.max(Object.keys(analysis.modelEntryCounts).length, 1);
  score -= Math.round(emptyRatio * 20);
  
  // Deduct for large collections without pagination hints
  const largeCollections = Object.values(analysis.modelEntryCounts).filter(c => c.draft > 10000);
  score -= largeCollections.length * 5;
  
  // Deduct for orphan assets
  if (analysis.orphanAssets > 100) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}



