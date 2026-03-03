/**
 * Schema Health Analysis
 * 
 * Calculates an objective health score (0-100) based on:
 * - Naming Consistency (25%) - Are models named consistently?
 * - Ghost Models (25%) - Are there unused models?
 * - Component Reuse (20%) - Are components used efficiently?
 * - Relation Hygiene (15%) - Are relations bidirectional?
 * - Complexity Balance (15%) - Are models reasonably sized?
 * 
 * Note: Documentation coverage is not available in the current data structure
 */

import {
  SchemaHealthAnalysis,
  SchemaHealthBreakdown,
  ConfidenceLevel,
  ProjectIntelligenceInput,
} from './types';

// Metric weights
const WEIGHTS = {
  NAMING_CONSISTENCY: 0.25,
  GHOST_MODELS: 0.25,
  COMPONENT_REUSE: 0.20,
  RELATION_HYGIENE: 0.15,
  COMPLEXITY_BALANCE: 0.15,
};

type NamingConvention = 'snake_case' | 'camelCase' | 'PascalCase' | 'Title Case' | 'mixed' | 'unknown';

/**
 * Detect naming convention of a string
 */
function detectNamingConvention(name: string): NamingConvention {
  if (!name || name.length === 0) return 'unknown';
  
  // snake_case: lowercase with underscores
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
    return 'snake_case';
  }
  
  // camelCase: starts lowercase, has uppercase
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
    return 'camelCase';
  }
  
  // PascalCase: starts uppercase, no spaces
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    return 'PascalCase';
  }
  
  // Title Case: words separated by spaces, each capitalized
  if (/^[A-Z][a-z]*([ ][A-Z][a-z]*)*$/.test(name)) {
    return 'Title Case';
  }
  
  return 'mixed';
}

/**
 * Analyze naming consistency across models
 */
function analyzeNamingConsistency(
  input: ProjectIntelligenceInput
): SchemaHealthBreakdown['namingConsistency'] {
  // Get model names from modelComplexity + ghostModels
  const modelNames: string[] = [
    ...input.modelComplexity.map(m => m.model),
    ...input.ghostModels.map(g => g.model),
  ];
  
  if (modelNames.length === 0) {
    return {
      score: 100,
      dominant: 'unknown',
      details: 'No models to analyze',
    };
  }
  
  // Count conventions
  const conventions: Record<NamingConvention, number> = {
    'snake_case': 0,
    'camelCase': 0,
    'PascalCase': 0,
    'Title Case': 0,
    'mixed': 0,
    'unknown': 0,
  };
  
  for (const name of modelNames) {
    const convention = detectNamingConvention(name);
    conventions[convention]++;
  }
  
  // Find dominant convention
  let dominant: NamingConvention = 'unknown';
  let maxCount = 0;
  for (const [conv, count] of Object.entries(conventions)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = conv as NamingConvention;
    }
  }
  
  // Calculate consistency score
  const consistencyRatio = maxCount / modelNames.length;
  const score = Math.round(consistencyRatio * 100);
  
  const inconsistentCount = modelNames.length - maxCount;
  const details = inconsistentCount > 0
    ? `${maxCount}/${modelNames.length} models use ${dominant} (${inconsistentCount} inconsistent)`
    : `All ${modelNames.length} models use ${dominant}`;
  
  return {
    score,
    dominant,
    details,
  };
}

/**
 * Analyze ghost models
 */
function analyzeGhostModels(
  input: ProjectIntelligenceInput
): SchemaHealthBreakdown['ghostModels'] {
  const ghostCount = input.ghostModels.length;
  const totalModels = input.contentDistribution.length + ghostCount;
  
  const ghostRatio = totalModels > 0 ? ghostCount / totalModels : 0;
  // Invert: 0 ghost = 100 score, high ghost = low score
  const score = Math.round((1 - ghostRatio) * 100);
  
  return {
    score,
    ghostCount,
    totalModels,
    ghostNames: input.ghostModels.map(g => g.model),
  };
}

/**
 * Analyze component reuse
 */
function analyzeComponentReuse(
  input: ProjectIntelligenceInput
): SchemaHealthBreakdown['componentReuse'] {
  const components = input.components;
  
  if (components.length === 0) {
    return {
      score: 100, // No components = no problem
      reusedComponents: 0,
      totalComponents: 0,
      details: 'No components defined',
    };
  }
  
  // Count components used in 2+ models
  const reusedComponents = components.filter(c => c.usedInModels.length >= 2).length;
  const unusedCount = input.unusedComponents.length;
  
  // Score: reward reuse, penalize unused
  const reuseRatio = reusedComponents / components.length;
  const unusedRatio = unusedCount / components.length;
  
  // Score formula: 50% for having reuse, 50% for no unused
  const score = Math.round((reuseRatio * 50) + ((1 - unusedRatio) * 50));
  
  let details = '';
  if (reusedComponents > 0) {
    details = `${reusedComponents}/${components.length} components reused in 2+ models`;
  }
  if (unusedCount > 0) {
    details += details ? `, ${unusedCount} unused` : `${unusedCount} unused components`;
  }
  if (!details) {
    details = `${components.length} components defined`;
  }
  
  return {
    score,
    reusedComponents,
    totalComponents: components.length,
    details,
  };
}

/**
 * Analyze relation hygiene using two-way references
 */
function analyzeRelationHygiene(
  input: ProjectIntelligenceInput
): SchemaHealthBreakdown['relationHygiene'] {
  const totalRelations = input.schemaCounts.relationCount;
  const bidirectionalCount = input.twoWayReferences.length;
  
  if (totalRelations === 0) {
    return {
      score: 100,
      bidirectionalCount: 0,
      totalRelations: 0,
      details: 'No relations defined',
    };
  }
  
  // Each two-way reference represents 2 relations
  const bidirectionalRelations = bidirectionalCount * 2;
  const ratio = Math.min(1, bidirectionalRelations / totalRelations);
  const score = Math.round(ratio * 100);
  
  const details = `${bidirectionalCount} bidirectional relation pairs (${totalRelations} total relations)`;
  
  return {
    score,
    bidirectionalCount,
    totalRelations,
    details,
  };
}

/**
 * Analyze complexity balance (are models reasonably sized?)
 */
function analyzeComplexityBalance(
  input: ProjectIntelligenceInput
): { score: number; details: string } {
  const complexities = input.modelComplexity;
  
  if (complexities.length === 0) {
    return { score: 100, details: 'No model complexity data' };
  }
  
  // Ideal: 5-15 fields per model
  const idealMin = 5;
  const idealMax = 15;
  
  let balanced = 0;
  let tooSimple = 0;
  let tooComplex = 0;
  
  for (const model of complexities) {
    if (model.fieldCount < idealMin) {
      tooSimple++;
    } else if (model.fieldCount > idealMax) {
      tooComplex++;
    } else {
      balanced++;
    }
  }
  
  const balanceRatio = balanced / complexities.length;
  const score = Math.round(balanceRatio * 100);
  
  const details = `${balanced}/${complexities.length} models have 5-15 fields (${tooSimple} too simple, ${tooComplex} too complex)`;
  
  return { score, details };
}

/**
 * Main schema health analysis
 */
export function analyzeSchemaHealth(input: ProjectIntelligenceInput): SchemaHealthAnalysis {
  // Calculate each metric
  const namingConsistency = analyzeNamingConsistency(input);
  const ghostModels = analyzeGhostModels(input);
  const componentReuse = analyzeComponentReuse(input);
  const relationHygiene = analyzeRelationHygiene(input);
  const complexityBalance = analyzeComplexityBalance(input);
  
  // Build breakdown with documentation placeholder
  const breakdown: SchemaHealthBreakdown = {
    namingConsistency,
    documentation: {
      score: 50, // Unknown - not available in data
      fieldsWithDescriptions: 0,
      totalFields: input.schemaCounts.totalFields,
      details: 'Documentation data not available in audit',
    },
    ghostModels,
    componentReuse,
    relationHygiene,
  };
  
  // Calculate weighted overall score (excluding documentation, redistributing weight)
  const adjustedWeights = {
    naming: 0.30,
    ghost: 0.30,
    component: 0.20,
    relation: 0.20,
  };
  
  const score = Math.round(
    (namingConsistency.score * adjustedWeights.naming) +
    (ghostModels.score * adjustedWeights.ghost) +
    (componentReuse.score * adjustedWeights.component) +
    (relationHygiene.score * adjustedWeights.relation)
  );
  
  // Determine confidence (schema data is always exact)
  const confidence: ConfidenceLevel = 'high';
  
  // Find top issue (lowest scoring metric)
  const metrics = [
    { name: 'Naming consistency', score: namingConsistency.score, fix: 'Standardize model naming convention' },
    { name: 'Ghost models', score: ghostModels.score, fix: `Remove ${ghostModels.ghostCount} unused models` },
    { name: 'Component reuse', score: componentReuse.score, fix: 'Review and consolidate components' },
    { name: 'Relation hygiene', score: relationHygiene.score, fix: 'Add reverse relations where missing' },
    { name: 'Complexity balance', score: complexityBalance.score, fix: 'Simplify over-complex models' },
  ];
  
  metrics.sort((a, b) => a.score - b.score);
  const topIssue = metrics[0].score < 100 ? `${metrics[0].name} (${metrics[0].score}%)` : 'No major issues';
  const quickWin = metrics[0].score < 100 ? metrics[0].fix : 'Schema is well-maintained';
  
  // Build recommendations
  const recommendations: string[] = [];
  for (const metric of metrics) {
    if (metric.score < 80) {
      recommendations.push(metric.fix);
    }
  }
  
  return {
    score,
    confidence,
    breakdown,
    topIssue,
    quickWin,
    recommendations,
  };
}

/**
 * Get health score color/status
 */
export function getHealthStatus(score: number): { color: string; label: string } {
  if (score >= 80) return { color: 'green', label: 'Healthy' };
  if (score >= 60) return { color: 'yellow', label: 'Fair' };
  if (score >= 40) return { color: 'orange', label: 'Needs Work' };
  return { color: 'red', label: 'Poor' };
}
