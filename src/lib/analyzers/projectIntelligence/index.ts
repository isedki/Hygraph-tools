/**
 * Project Intelligence Orchestrator
 * 
 * Combines all analyzers to produce a comprehensive project profile:
 * - Lifecycle Stage
 * - Content Readiness
 * - Schema Health
 * - Friction Detection
 * - Top Contributors (optional, requires separate scan)
 */

import { AuditResult } from '../../types';
import {
  ProjectIntelligence,
  ProjectIntelligenceInput,
  TopContributorsAnalysis,
} from './types';

import { analyzeLifecycleStage, getStageDisplayName, getStageDescription } from './lifecycleStage';
import { analyzeContentReadiness } from './contentReadiness';
import { analyzeSchemaHealth, getHealthStatus } from './schemaHealth';
import { analyzeFriction, getFrictionStatus } from './frictionDetection';
import { scanTopContributors } from './topContributors';

// Re-export types and utilities
export * from './types';
export { getStageDisplayName, getStageDescription } from './lifecycleStage';
export { getHealthStatus } from './schemaHealth';
export { getFrictionStatus } from './frictionDetection';
export { scanTopContributors } from './topContributors';
export {
  calculateSampleSize,
  createSampledMetric,
  getConfidenceLabel,
} from './sampling';

/**
 * Convert AuditResult to ProjectIntelligenceInput
 */
export function prepareInput(result: AuditResult): ProjectIntelligenceInput {
  // Schema counts
  const schemaCounts = {
    modelCount: result.schema.modelCount,
    componentCount: result.schema.componentCount,
    enumCount: result.schema.enumCount,
    totalFields: result.schema.totalFields,
    relationCount: result.schema.relationCount,
    maxNestingDepth: result.schema.maxNestingDepth,
  };
  
  // Two-way references
  const twoWayReferences = result.schema.twoWayReferences || [];
  
  // Components from ComponentAnalysis
  const components = result.components?.components || [];
  
  // Unused components
  const unusedComponents = result.components?.unusedComponents || [];
  
  // Get locales from localization burden or default
  const locales = result.editorial?.localizationBurden?.[0]?.localeCount > 1
    ? Array.from({ length: result.editorial.localizationBurden[0].localeCount }, (_, i) => `locale_${i + 1}`)
    : ['en'];
  
  // Get content distribution
  const contentDistribution = result.comprehensiveAssessment?.contentArchitecture?.contentDistribution || [];
  
  // Get ghost models
  const ghostModels = result.insights?.contentAdoption?.ghostModels || [];
  
  // Get model complexity
  const modelComplexity = result.editorial?.modelComplexity || [];
  
  // Get freshness data - calculate average days since update
  const freshness = result.insights?.contentFreshness?.models?.length ? {
    avgDaysSinceUpdate: result.insights.contentFreshness.models
      .filter(m => m.daysSinceUpdate >= 0)
      .reduce((sum, m, _, arr) => sum + m.daysSinceUpdate / arr.length, 0) || 180,
  } : undefined;
  
  return {
    schemaCounts,
    twoWayReferences,
    components,
    unusedComponents,
    locales,
    contentDistribution,
    ghostModels,
    modelComplexity,
    freshness,
  };
}

/**
 * Run all Project Intelligence analyzers
 */
export function analyzeProjectIntelligence(result: AuditResult): ProjectIntelligence {
  const input = prepareInput(result);
  
  // Run all analyzers
  const lifecycle = analyzeLifecycleStage(input);
  const contentReadiness = analyzeContentReadiness(input);
  const schemaHealth = analyzeSchemaHealth(input);
  const friction = analyzeFriction(input);
  
  // Build quick actions
  const quickActions: string[] = [];
  
  // From lifecycle
  if (lifecycle.blockers.length > 0) {
    quickActions.push(lifecycle.blockers[0]);
  }
  
  // From content readiness
  if (contentReadiness.testCount > 0) {
    quickActions.push(`Clean up ${contentReadiness.testCount} test entries (${contentReadiness.cleanupTimeEstimate})`);
  }
  
  // From schema health
  if (schemaHealth.score < 80 && schemaHealth.quickWin !== 'Schema is well-maintained') {
    quickActions.push(schemaHealth.quickWin);
  }
  
  // From friction
  if (friction.topRecommendation) {
    quickActions.push(friction.topRecommendation.recommendation);
  }
  
  // Build executive summary
  const executiveSummary = buildExecutiveSummary(lifecycle, contentReadiness, schemaHealth, friction);
  
  return {
    version: '1.0',
    analyzedAt: new Date().toISOString(),
    lifecycle,
    contentReadiness,
    schemaHealth,
    friction,
    quickActions: quickActions.slice(0, 5), // Top 5 actions
    executiveSummary,
  };
}

/**
 * Build executive summary narrative
 */
function buildExecutiveSummary(
  lifecycle: ProjectIntelligence['lifecycle'],
  contentReadiness: ProjectIntelligence['contentReadiness'],
  schemaHealth: ProjectIntelligence['schemaHealth'],
  friction: ProjectIntelligence['friction']
): string {
  const stage = getStageDisplayName(lifecycle.stage);
  const stageDesc = getStageDescription(lifecycle.stage);
  const healthStatus = getHealthStatus(schemaHealth.score);
  const frictionStatus = getFrictionStatus(friction.score);
  
  let summary = `This is a ${stage.toLowerCase()}-stage project (${stageDesc.toLowerCase()}). `;
  
  // Content readiness
  if (contentReadiness.productionPercent >= 90) {
    summary += `Content is ${contentReadiness.productionPercent}% production-ready. `;
  } else if (contentReadiness.productionPercent >= 70) {
    summary += `Content is ${contentReadiness.productionPercent}% production-ready with ${contentReadiness.testCount} test entries to clean up. `;
  } else {
    summary += `Only ${contentReadiness.productionPercent}% of content is production-ready - significant cleanup needed. `;
  }
  
  // Schema health
  summary += `Schema health is ${healthStatus.label.toLowerCase()} (${schemaHealth.score}/100). `;
  
  // Friction
  if (friction.totalSignals === 0) {
    summary += 'No friction signals detected - workflows appear smooth.';
  } else if (friction.score >= 80) {
    summary += `${frictionStatus.label} with ${friction.totalSignals} minor issue${friction.totalSignals > 1 ? 's' : ''} identified.`;
  } else {
    summary += `${frictionStatus.label} detected - ${friction.totalSignals} issue${friction.totalSignals > 1 ? 's' : ''} may be slowing down content creation.`;
  }
  
  // Add waste estimate if significant
  if (friction.estimatedTotalWaste > 100) {
    summary += ` Estimated waste: ~$${friction.estimatedTotalWaste.toLocaleString()}.`;
  }
  
  return summary;
}

/**
 * Scan for top contributors (separate async operation)
 */
export async function scanContributors(
  endpoint: string,
  token: string,
  result: AuditResult
): Promise<TopContributorsAnalysis> {
  // Get model names that have content
  const modelNames = result.comprehensiveAssessment?.contentArchitecture?.contentDistribution
    ?.filter(cd => cd.total > 0)
    ?.map(cd => cd.model) || [];
  
  return scanTopContributors(endpoint, token, modelNames);
}

