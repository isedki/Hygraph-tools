/**
 * Content Readiness Analysis
 * 
 * Classifies content as test/experimental vs production-ready based on:
 * - Naming patterns (test, demo, lorem, sample, etc.)
 * - Draft status
 * - Entry count per model
 * - Field completion
 * 
 * Provides actionable cleanup recommendations.
 */

import {
  ContentReadinessAnalysis,
  ConfidenceLevel,
  ProjectIntelligenceInput,
} from './types';

// Test content detection patterns
const TEST_PATTERNS = [
  /\btest\b/i,
  /\bdemo\b/i,
  /\blorem\b/i,
  /\bsample\b/i,
  /\bexample\b/i,
  /\bdummy\b/i,
  /\bfoo\b/i,
  /\bbar\b/i,
  /\basdf\b/i,
  /\bxxx\b/i,
  /\bplaceholder\b/i,
  /\btmp\b/i,
  /\btemp\b/i,
  /\bfake\b/i,
  /^test$/i,
  /^untitled$/i,
  /^new\s*(post|page|entry|item)$/i,
];

// Scoring weights
const WEIGHTS = {
  TEST_NAME: 3,      // Name contains test patterns
  DRAFT_STATUS: 2,   // Is a draft
  LOW_ENTRY_COUNT: 1, // Model has few entries
  SHORT_TITLE: 1,    // Title is very short (<10 chars)
  PUBLISHED: 2,      // Is published
  HIGH_ENTRY_COUNT: 2, // Model has many entries (>20)
  COMPLETE_FIELDS: 1,  // Required fields filled
};

interface ScoredEntry {
  model: string;
  id: string;
  title: string;
  productionScore: number;
  experimentalScore: number;
  signals: string[];
  isTest: boolean;
}

/**
 * Check if a string matches test patterns
 */
function containsTestPattern(text: string): { matches: boolean; patterns: string[] } {
  const matchedPatterns: string[] = [];
  
  for (const pattern of TEST_PATTERNS) {
    if (pattern.test(text)) {
      matchedPatterns.push(pattern.source.replace(/\\b/g, '').replace(/\^|\$/g, ''));
    }
  }
  
  return {
    matches: matchedPatterns.length > 0,
    patterns: matchedPatterns,
  };
}

/**
 * Score a single entry for production vs experimental
 */
function scoreEntry(
  entry: { title?: string; isDraft: boolean },
  modelEntryCount: number
): ScoredEntry {
  let productionScore = 0;
  let experimentalScore = 0;
  const signals: string[] = [];
  
  const title = entry.title || '';
  
  // Check for test patterns in title
  const testCheck = containsTestPattern(title);
  if (testCheck.matches) {
    experimentalScore += WEIGHTS.TEST_NAME;
    signals.push(`Name contains "${testCheck.patterns.join(', ')}"`);
  }
  
  // Draft status
  if (entry.isDraft) {
    experimentalScore += WEIGHTS.DRAFT_STATUS;
    signals.push('Draft status');
  } else {
    productionScore += WEIGHTS.PUBLISHED;
  }
  
  // Model entry count
  if (modelEntryCount < 5) {
    experimentalScore += WEIGHTS.LOW_ENTRY_COUNT;
    signals.push('Low entry count in model');
  } else if (modelEntryCount > 20) {
    productionScore += WEIGHTS.HIGH_ENTRY_COUNT;
  }
  
  // Title length
  if (title.length > 0 && title.length < 10) {
    experimentalScore += WEIGHTS.SHORT_TITLE;
    signals.push('Very short title');
  }
  
  // Calculate if it's test content
  const totalScore = productionScore + experimentalScore;
  const isTest = totalScore > 0 && (experimentalScore / totalScore) > 0.5;
  
  return {
    model: '',  // Will be set by caller
    id: '',     // Will be set by caller
    title,
    productionScore,
    experimentalScore,
    signals,
    isTest,
  };
}

/**
 * Analyze content readiness based on content distribution data
 * Note: This is a simplified version that works with aggregate data
 * For full analysis, you'd need to query actual entries
 */
export function analyzeContentReadiness(
  input: ProjectIntelligenceInput,
  sampledEntries?: { model: string; id: string; title: string; isDraft: boolean }[]
): ContentReadinessAnalysis {
  // If we have sampled entries, do detailed analysis
  if (sampledEntries && sampledEntries.length > 0) {
    return analyzeWithSamples(input, sampledEntries);
  }
  
  // Otherwise, estimate based on aggregate data
  return estimateFromAggregates(input);
}

/**
 * Full analysis with actual sampled entries
 */
function analyzeWithSamples(
  input: ProjectIntelligenceInput,
  sampledEntries: { model: string; id: string; title: string; isDraft: boolean }[]
): ContentReadinessAnalysis {
  // Build entry count lookup
  const entryCountByModel: Record<string, number> = {};
  for (const cd of input.contentDistribution) {
    entryCountByModel[cd.model] = cd.total;
  }
  
  // Score each entry
  const scoredEntries: ScoredEntry[] = sampledEntries.map(entry => {
    const modelCount = entryCountByModel[entry.model] || 0;
    const scored = scoreEntry(entry, modelCount);
    return {
      ...scored,
      model: entry.model,
      id: entry.id,
    };
  });
  
  // Categorize
  const testEntries = scoredEntries.filter(e => e.isTest);
  const productionEntries = scoredEntries.filter(e => !e.isTest);
  
  const productionPercent = scoredEntries.length > 0
    ? Math.round((productionEntries.length / scoredEntries.length) * 100)
    : 100;
  
  // Group test entries by model
  const testByModel: Record<string, ScoredEntry[]> = {};
  for (const entry of testEntries) {
    if (!testByModel[entry.model]) {
      testByModel[entry.model] = [];
    }
    testByModel[entry.model].push(entry);
  }
  
  const testEntriesByModel = Object.entries(testByModel).map(([model, entries]) => {
    // Collect unique signals
    const allSignals = new Set<string>();
    entries.forEach(e => e.signals.forEach(s => allSignals.add(s)));
    
    return {
      model,
      count: entries.length,
      examples: entries.slice(0, 3).map(e => e.title || e.id),
      signals: Array.from(allSignals),
    };
  }).sort((a, b) => b.count - a.count);
  
  // Estimate cleanup time (5 minutes per test entry)
  const cleanupMinutes = testEntries.length * 5;
  const cleanupTimeEstimate = cleanupMinutes < 60
    ? `~${cleanupMinutes} minutes`
    : `~${Math.round(cleanupMinutes / 60)} hours`;
  
  // Build recommendations
  const recommendations: string[] = [];
  if (testEntries.length > 0) {
    recommendations.push(`Clean up ${testEntries.length} test entries before launch`);
  }
  if (testByModel['TestModel'] || testByModel['Test']) {
    recommendations.push('Consider deleting test-specific models entirely');
  }
  if (productionPercent < 80) {
    recommendations.push('Review entries with placeholder names');
  }
  
  // Determine confidence
  let confidence: ConfidenceLevel = 'high';
  if (sampledEntries.length < 50) {
    confidence = 'medium';
  }
  if (sampledEntries.length < 20) {
    confidence = 'low';
  }
  
  return {
    productionPercent,
    confidence,
    totalAnalyzed: scoredEntries.length,
    productionCount: productionEntries.length,
    testCount: testEntries.length,
    testEntriesByModel,
    cleanupTimeEstimate,
    recommendations,
  };
}

/**
 * Estimate readiness from aggregate data only (no samples)
 */
function estimateFromAggregates(input: ProjectIntelligenceInput): ContentReadinessAnalysis {
  const totalEntries = input.contentDistribution.reduce((sum, cd) => sum + cd.total, 0);
  const totalDrafts = input.contentDistribution.reduce((sum, cd) => sum + cd.draft, 0);
  
  // Models with test-like names
  const testModels = input.contentDistribution.filter(cd => {
    const check = containsTestPattern(cd.model);
    return check.matches;
  });
  
  const testModelEntries = testModels.reduce((sum, cd) => sum + cd.total, 0);
  
  // Estimate: drafts + test model entries = potentially test content
  const estimatedTestCount = Math.min(totalDrafts + testModelEntries, totalEntries);
  const productionPercent = totalEntries > 0
    ? Math.round(((totalEntries - estimatedTestCount) / totalEntries) * 100)
    : 100;
  
  // Build test entries by model from available data
  const testEntriesByModel = testModels.map(cd => ({
    model: cd.model,
    count: cd.total,
    examples: [],
    signals: ['Model name suggests test content'],
  }));
  
  // Add models with high draft ratio
  const highDraftModels = input.contentDistribution.filter(cd => {
    const draftRatio = cd.total > 0 ? cd.draft / cd.total : 0;
    return draftRatio > 0.5 && cd.draft > 3;
  });
  
  for (const cd of highDraftModels) {
    if (!testEntriesByModel.find(t => t.model === cd.model)) {
      testEntriesByModel.push({
        model: cd.model,
        count: cd.draft,
        examples: [],
        signals: [`High draft ratio (${Math.round((cd.draft / cd.total) * 100)}%)`],
      });
    }
  }
  
  const cleanupMinutes = estimatedTestCount * 5;
  const cleanupTimeEstimate = cleanupMinutes < 60
    ? `~${cleanupMinutes} minutes`
    : `~${Math.round(cleanupMinutes / 60)} hours`;
  
  const recommendations: string[] = [];
  if (testModels.length > 0) {
    recommendations.push(`Review ${testModels.length} model(s) with test-like names`);
  }
  if (totalDrafts > totalEntries * 0.3) {
    recommendations.push('High draft ratio - review and publish or delete');
  }
  
  return {
    productionPercent,
    confidence: 'low', // Estimate only
    totalAnalyzed: totalEntries,
    productionCount: totalEntries - estimatedTestCount,
    testCount: estimatedTestCount,
    testEntriesByModel,
    cleanupTimeEstimate,
    recommendations,
  };
}

/**
 * Check if a model name looks like a test model
 */
export function isTestModelName(modelName: string): boolean {
  return containsTestPattern(modelName).matches;
}

