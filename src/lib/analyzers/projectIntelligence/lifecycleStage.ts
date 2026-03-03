/**
 * Lifecycle Stage Detection
 * 
 * Detects which phase the project is in based on:
 * - Ghost model ratio
 * - Entries per model average
 * - Draft ratio
 * - Content velocity trends
 * 
 * Stages:
 * - Modeling: Schema setup, few entries
 * - Early Content: Testing content creation
 * - Growth: Actively building content
 * - Production: Live, stable operations
 * - Maintenance: Low activity, updates only
 */

import {
  LifecycleStage,
  LifecycleAnalysis,
  Evidence,
  ConfidenceLevel,
  ProjectIntelligenceInput,
} from './types';

// Detection thresholds
const THRESHOLDS = {
  GHOST_RATIO_HIGH: 0.4,      // >40% ghost = modeling phase
  GHOST_RATIO_LOW: 0.1,       // <10% ghost = production ready
  ENTRIES_PER_MODEL_LOW: 5,   // <5 = early stage
  ENTRIES_PER_MODEL_MED: 20,  // <20 = early content
  DRAFT_RATIO_HIGH: 0.4,      // >40% drafts = early content
  DRAFT_RATIO_LOW: 0.15,      // <15% drafts = production
  TOTAL_ENTRIES_MIN: 50,      // Need 50+ for growth stage
  TOTAL_ENTRIES_HIGH: 500,    // 500+ suggests mature project
};

export function analyzeLifecycleStage(input: ProjectIntelligenceInput): LifecycleAnalysis {
  const evidence: Evidence[] = [];
  
  // Calculate key metrics
  const totalModels = input.contentDistribution.length;
  const totalEntries = input.contentDistribution.reduce((sum, cd) => sum + cd.total, 0);
  const totalDrafts = input.contentDistribution.reduce((sum, cd) => sum + cd.draft, 0);
  const ghostCount = input.ghostModels.length;
  
  const entriesPerModel = totalModels > 0 ? totalEntries / totalModels : 0;
  const ghostModelRatio = totalModels > 0 ? ghostCount / (totalModels + ghostCount) : 0;
  const draftRatio = totalEntries > 0 ? totalDrafts / totalEntries : 0;
  
  // Velocity trend (simplified - would need historical data for real trend)
  // For now, use average days since update as proxy (lower = more active)
  const avgDays = input.freshness?.avgDaysSinceUpdate ?? 90;
  const velocityTrend = avgDays <= 30 ? 1.5 : avgDays <= 90 ? 1.0 : 0.5;
  
  const metrics = {
    totalEntries,
    totalModels: totalModels + ghostCount,
    entriesPerModel: Math.round(entriesPerModel * 10) / 10,
    ghostModelRatio: Math.round(ghostModelRatio * 100) / 100,
    draftRatio: Math.round(draftRatio * 100) / 100,
    velocityTrend: Math.round(velocityTrend * 100) / 100,
  };
  
  // Detect stage using deterministic rules
  let stage: LifecycleStage;
  let confidence: ConfidenceLevel = 'high';
  
  // Rule 1: Modeling stage
  if (ghostModelRatio > THRESHOLDS.GHOST_RATIO_HIGH && entriesPerModel < THRESHOLDS.ENTRIES_PER_MODEL_LOW) {
    stage = 'modeling';
    evidence.push({
      type: 'ghost_ratio',
      description: `${Math.round(ghostModelRatio * 100)}% of models have no entries`,
      value: ghostModelRatio,
      direction: 'supports',
    });
    evidence.push({
      type: 'entries_per_model',
      description: `Only ${entriesPerModel.toFixed(1)} entries per model on average`,
      value: entriesPerModel,
      direction: 'supports',
    });
  }
  // Rule 2: Early content stage
  else if (draftRatio > THRESHOLDS.DRAFT_RATIO_HIGH && entriesPerModel < THRESHOLDS.ENTRIES_PER_MODEL_MED) {
    stage = 'early-content';
    evidence.push({
      type: 'draft_ratio',
      description: `${Math.round(draftRatio * 100)}% of entries are drafts`,
      value: draftRatio,
      direction: 'supports',
    });
    evidence.push({
      type: 'entries_per_model',
      description: `${entriesPerModel.toFixed(1)} entries per model (still building)`,
      value: entriesPerModel,
      direction: 'supports',
    });
  }
  // Rule 3: Growth stage
  else if (velocityTrend > 1.0 && totalEntries > THRESHOLDS.TOTAL_ENTRIES_MIN) {
    stage = 'growth';
    evidence.push({
      type: 'velocity',
      description: `Content velocity is increasing (${Math.round(velocityTrend * 100)}% trend)`,
      value: velocityTrend,
      direction: 'supports',
    });
    evidence.push({
      type: 'total_entries',
      description: `${totalEntries.toLocaleString()} entries created`,
      value: totalEntries,
      direction: 'supports',
    });
  }
  // Rule 4: Production stage
  else if (draftRatio < THRESHOLDS.DRAFT_RATIO_LOW && ghostModelRatio < THRESHOLDS.GHOST_RATIO_LOW) {
    stage = 'production';
    evidence.push({
      type: 'draft_ratio',
      description: `Only ${Math.round(draftRatio * 100)}% drafts (content is published)`,
      value: draftRatio,
      direction: 'supports',
    });
    evidence.push({
      type: 'ghost_ratio',
      description: `Only ${Math.round(ghostModelRatio * 100)}% unused models`,
      value: ghostModelRatio,
      direction: 'supports',
    });
  }
  // Rule 5: Maintenance stage
  else if (totalEntries > THRESHOLDS.TOTAL_ENTRIES_HIGH && velocityTrend < 0.8) {
    stage = 'maintenance';
    evidence.push({
      type: 'total_entries',
      description: `${totalEntries.toLocaleString()} entries (mature content base)`,
      value: totalEntries,
      direction: 'supports',
    });
    evidence.push({
      type: 'velocity',
      description: `Low activity trend (${Math.round(velocityTrend * 100)}%)`,
      value: velocityTrend,
      direction: 'supports',
    });
  }
  // Default: Growth (most common)
  else {
    stage = 'growth';
    confidence = 'medium';
    evidence.push({
      type: 'default',
      description: 'Metrics suggest active development',
      value: 'mixed signals',
      direction: 'supports',
    });
  }
  
  // Add counter-evidence where applicable
  if (stage === 'production' && ghostCount > 0) {
    evidence.push({
      type: 'ghost_models',
      description: `${ghostCount} ghost model${ghostCount > 1 ? 's' : ''} still exist`,
      value: ghostCount,
      direction: 'contradicts',
    });
  }
  
  if (stage === 'growth' && draftRatio > 0.3) {
    evidence.push({
      type: 'draft_ratio',
      description: `${Math.round(draftRatio * 100)}% drafts is relatively high`,
      value: draftRatio,
      direction: 'contradicts',
    });
  }
  
  // Determine production readiness
  const readyForProduction = 
    draftRatio < THRESHOLDS.DRAFT_RATIO_LOW &&
    ghostModelRatio < THRESHOLDS.GHOST_RATIO_LOW &&
    totalEntries > THRESHOLDS.TOTAL_ENTRIES_MIN;
  
  // Build blockers list
  const blockers: string[] = [];
  if (draftRatio >= THRESHOLDS.DRAFT_RATIO_LOW) {
    blockers.push(`Reduce draft ratio from ${Math.round(draftRatio * 100)}% to <15%`);
  }
  if (ghostModelRatio >= THRESHOLDS.GHOST_RATIO_LOW) {
    blockers.push(`Clean up ${ghostCount} ghost model${ghostCount > 1 ? 's' : ''}`);
  }
  if (totalEntries < THRESHOLDS.TOTAL_ENTRIES_MIN) {
    blockers.push(`Create more content (${totalEntries} → 50+ entries)`);
  }
  
  // Next milestone
  let nextMilestone: string;
  switch (stage) {
    case 'modeling':
      nextMilestone = 'Start creating content in your models';
      break;
    case 'early-content':
      nextMilestone = 'Publish drafts and validate content workflows';
      break;
    case 'growth':
      nextMilestone = 'Stabilize and prepare for production launch';
      break;
    case 'production':
      nextMilestone = 'Maintain content freshness and quality';
      break;
    case 'maintenance':
      nextMilestone = 'Consider content refresh or new features';
      break;
  }
  
  return {
    stage,
    confidence,
    evidence,
    metrics,
    readyForProduction,
    blockers,
    nextMilestone,
  };
}

/**
 * Get human-readable stage name
 */
export function getStageDisplayName(stage: LifecycleStage): string {
  const names: Record<LifecycleStage, string> = {
    'modeling': 'Modeling',
    'early-content': 'Early Content',
    'growth': 'Growth',
    'production': 'Production',
    'maintenance': 'Maintenance',
  };
  return names[stage];
}

/**
 * Get stage description
 */
export function getStageDescription(stage: LifecycleStage): string {
  const descriptions: Record<LifecycleStage, string> = {
    'modeling': 'Building schema structure, minimal content',
    'early-content': 'Testing content creation workflows',
    'growth': 'Actively building and publishing content',
    'production': 'Live and stable, regular operations',
    'maintenance': 'Mature project, occasional updates',
  };
  return descriptions[stage];
}

