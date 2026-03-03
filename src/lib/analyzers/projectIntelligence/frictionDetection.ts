/**
 * Friction Detection
 * 
 * Identifies where users are struggling based on behavioral signals:
 * - Content friction: High draft ratios, abandoned entries
 * - Schema friction: Unused components, over-engineered models
 * - Feature friction: Abandoned localization, unused relations
 * - Workflow friction: Duplicates, orphaned references
 * 
 * Each signal includes:
 * - Severity (critical/high/medium/low)
 * - Evidence (what data supports this)
 * - Likely cause (what's probably happening)
 * - Recommendation (how to fix it)
 * - Estimated waste ($ impact)
 */

import {
  FrictionSignal,
  FrictionAnalysis,
  FrictionSeverity,
  FrictionCategory,
  Evidence,
  ConfidenceLevel,
  ProjectIntelligenceInput,
} from './types';

// Thresholds for friction detection
const THRESHOLDS = {
  DRAFT_RATIO_HIGH: 0.5,        // >50% drafts = friction
  DRAFT_RATIO_VERY_HIGH: 0.7,   // >70% drafts = severe friction
  ABANDONED_DAYS: 30,           // Drafts older than 30 days
  OVERENGINEERED_FIELDS: 15,    // Models with 15+ fields
  OVERENGINEERED_ENTRIES: 10,   // But fewer than 10 entries
  MIN_ENTRIES_FOR_CHECK: 5,     // Need 5+ entries to check ratios
  LOCALE_FILL_RATIO: 0.2,       // <20% fill = abandoned localization
};

// Cost estimates (per item, in dollars at $50/hr)
const COST_ESTIMATES = {
  DRAFT_ENTRY: 5,          // ~6 min of wasted effort per stalled draft
  GHOST_MODEL_SETUP: 100,  // ~2 hours to set up a model
  UNUSED_COMPONENT: 25,    // ~30 min to create a component
  OVERENGINEERED_FIELD: 10, // ~12 min per unnecessary field
};

/**
 * Detect high draft ratio friction
 */
function detectDraftBottleneck(
  input: ProjectIntelligenceInput
): FrictionSignal | null {
  const modelsWithHighDrafts = input.contentDistribution.filter(cd => {
    if (cd.total < THRESHOLDS.MIN_ENTRIES_FOR_CHECK) return false;
    const draftRatio = cd.draft / cd.total;
    return draftRatio > THRESHOLDS.DRAFT_RATIO_HIGH;
  });
  
  if (modelsWithHighDrafts.length === 0) return null;
  
  // Find the worst offender
  const worst = modelsWithHighDrafts.reduce((max, cd) => {
    const ratio = cd.draft / cd.total;
    const maxRatio = max.draft / max.total;
    return ratio > maxRatio ? cd : max;
  });
  
  const worstRatio = worst.draft / worst.total;
  const severity: FrictionSeverity = worstRatio > THRESHOLDS.DRAFT_RATIO_VERY_HIGH ? 'high' : 'medium';
  
  const totalStalledDrafts = modelsWithHighDrafts.reduce((sum, cd) => sum + cd.draft, 0);
  const estimatedWaste = totalStalledDrafts * COST_ESTIMATES.DRAFT_ENTRY;
  
  const evidence: Evidence[] = modelsWithHighDrafts.slice(0, 3).map(cd => ({
    type: 'draft_ratio',
    description: `${cd.model}: ${cd.draft}/${cd.total} drafts (${Math.round((cd.draft / cd.total) * 100)}%)`,
    value: cd.draft / cd.total,
    direction: 'supports' as const,
  }));
  
  return {
    id: 'draft-bottleneck',
    category: 'content',
    name: 'Draft Bottleneck',
    severity,
    confidence: 'high',
    description: `${modelsWithHighDrafts.length} model(s) have >50% drafts, suggesting content is getting stuck`,
    affectedModels: modelsWithHighDrafts.map(cd => cd.model),
    dataPoints: modelsWithHighDrafts.length,
    evidence,
    likelyCause: 'Content requires information that\'s hard to obtain, or approval workflow is slow',
    impact: `~$${estimatedWaste} in stalled content efforts`,
    recommendation: 'Review required fields - consider making some optional, or add workflow notes',
    estimatedWaste,
    fixEffort: 'easy',
  };
}

/**
 * Detect unused components
 */
function detectUnusedComponents(
  input: ProjectIntelligenceInput
): FrictionSignal | null {
  const unusedComponents = input.unusedComponents;
  
  if (unusedComponents.length === 0) return null;
  
  const severity: FrictionSeverity = unusedComponents.length >= 5 ? 'medium' : 'low';
  const estimatedWaste = unusedComponents.length * COST_ESTIMATES.UNUSED_COMPONENT;
  
  const evidence: Evidence[] = unusedComponents.slice(0, 5).map(name => ({
    type: 'unused_component',
    description: `"${name}" is defined but not used in any model`,
    value: name,
    direction: 'supports' as const,
  }));
  
  return {
    id: 'unused-components',
    category: 'schema',
    name: 'Unused Components',
    severity,
    confidence: 'high',
    description: `${unusedComponents.length} component(s) were created but never used`,
    affectedModels: [],
    dataPoints: unusedComponents.length,
    evidence,
    likelyCause: 'Components were created for planned features that weren\'t implemented, or approach changed',
    impact: 'Schema clutter, confusion for editors',
    recommendation: 'Delete unused components or integrate them into models',
    estimatedWaste,
    fixEffort: 'trivial',
  };
}

/**
 * Detect ghost models (models with 0 entries)
 */
function detectGhostModels(
  input: ProjectIntelligenceInput
): FrictionSignal | null {
  const ghostModels = input.ghostModels;
  
  if (ghostModels.length === 0) return null;
  
  const severity: FrictionSeverity = ghostModels.length >= 3 ? 'medium' : 'low';
  const estimatedWaste = ghostModels.length * COST_ESTIMATES.GHOST_MODEL_SETUP;
  
  const evidence: Evidence[] = ghostModels.slice(0, 5).map(g => ({
    type: 'ghost_model',
    description: `"${g.model}" has ${g.fieldCount} fields but 0 entries`,
    value: g.model,
    direction: 'supports' as const,
  }));
  
  return {
    id: 'ghost-models',
    category: 'schema',
    name: 'Ghost Models',
    severity,
    confidence: 'high',
    description: `${ghostModels.length} model(s) have been set up but never used`,
    affectedModels: ghostModels.map(g => g.model),
    dataPoints: ghostModels.length,
    evidence,
    likelyCause: 'Models were created for planned content that was never produced',
    impact: `~$${estimatedWaste} in unused setup effort`,
    recommendation: 'Archive or delete unused models to simplify schema',
    estimatedWaste,
    fixEffort: 'easy',
  };
}

/**
 * Detect over-engineered models (many fields, few entries)
 */
function detectOverEngineeredModels(
  input: ProjectIntelligenceInput
): FrictionSignal | null {
  const overEngineered = input.modelComplexity.filter(mc => {
    const contentEntry = input.contentDistribution.find(cd => cd.model === mc.model);
    const entryCount = contentEntry?.total || 0;
    
    return mc.fieldCount > THRESHOLDS.OVERENGINEERED_FIELDS && 
           entryCount < THRESHOLDS.OVERENGINEERED_ENTRIES &&
           entryCount > 0; // Has some entries, just not many
  });
  
  if (overEngineered.length === 0) return null;
  
  const severity: FrictionSeverity = overEngineered.length >= 3 ? 'medium' : 'low';
  
  // Calculate wasted fields
  const wastedFields = overEngineered.reduce((sum, mc) => {
    return sum + Math.max(0, mc.fieldCount - 10); // Assume 10 fields is reasonable
  }, 0);
  const estimatedWaste = wastedFields * COST_ESTIMATES.OVERENGINEERED_FIELD;
  
  const evidence: Evidence[] = overEngineered.slice(0, 3).map(mc => {
    const contentEntry = input.contentDistribution.find(cd => cd.model === mc.model);
    return {
      type: 'overengineered',
      description: `"${mc.model}" has ${mc.fieldCount} fields but only ${contentEntry?.total || 0} entries`,
      value: mc.fieldCount,
      direction: 'supports' as const,
    };
  });
  
  return {
    id: 'overengineered-models',
    category: 'schema',
    name: 'Over-Engineered Models',
    severity,
    confidence: 'medium',
    description: `${overEngineered.length} model(s) have complex schemas but low content volume`,
    affectedModels: overEngineered.map(mc => mc.model),
    dataPoints: overEngineered.length,
    evidence,
    likelyCause: 'Schema was designed for anticipated complexity that didn\'t materialize',
    impact: `~$${estimatedWaste} in unnecessary field setup`,
    recommendation: 'Simplify these models by removing unused fields',
    estimatedWaste,
    fixEffort: 'moderate',
  };
}

/**
 * Detect abandoned localization
 */
function detectAbandonedLocalization(
  input: ProjectIntelligenceInput
): FrictionSignal | null {
  const locales = input.locales;
  
  // Need at least 2 locales to check for abandonment
  if (locales.length < 2) return null;
  
  // This would need actual locale data to be accurate
  // For now, we flag if multiple locales exist but could check fill rates
  // This is a simplified detection - real implementation would query locale-specific data
  
  // Check if there are signs of abandoned i18n based on schema setup
  const hasI18nSetup = locales.length >= 2;
  if (!hasI18nSetup) return null;
  
  // We'll return a low-confidence signal to prompt investigation
  return {
    id: 'localization-review',
    category: 'feature',
    name: 'Localization Setup',
    severity: 'low',
    confidence: 'low',
    description: `${locales.length} locales configured - verify translations are being maintained`,
    affectedModels: [],
    dataPoints: locales.length,
    evidence: [{
      type: 'locale_count',
      description: `Locales configured: ${locales.join(', ')}`,
      value: locales.length,
      direction: 'supports',
    }],
    likelyCause: 'Localization may have been set up but not fully implemented',
    impact: 'Potential inconsistency in multi-language content',
    recommendation: 'Audit translation coverage - either commit to i18n or simplify to single locale',
    fixEffort: 'moderate',
  };
}

/**
 * Detect deep nesting that may cause friction
 */
function detectDeepNesting(
  input: ProjectIntelligenceInput
): FrictionSignal | null {
  const maxNesting = input.schemaCounts.maxNestingDepth;
  
  // Only flag if max nesting is very deep (>3 levels)
  if (maxNesting <= 3) return null;
  
  // Find components with deep nesting
  const deepComponents = input.components.filter(c => c.nestingDepth > 3);
  
  const evidence: Evidence[] = [{
    type: 'deep_nesting',
    description: `Maximum nesting depth is ${maxNesting} levels`,
    value: maxNesting,
    direction: 'supports' as const,
  }];
  
  if (deepComponents.length > 0) {
    deepComponents.slice(0, 3).forEach(c => {
      evidence.push({
        type: 'deep_component',
        description: `Component "${c.name}" has nesting depth of ${c.nestingDepth}`,
        value: c.nestingDepth,
        direction: 'supports' as const,
      });
    });
  }
  
  return {
    id: 'deep-nesting',
    category: 'schema',
    name: 'Deep Nesting',
    severity: 'low',
    confidence: 'high',
    description: `Schema has deep nesting (${maxNesting} levels max)`,
    affectedModels: deepComponents.map(c => c.name),
    dataPoints: deepComponents.length + 1,
    evidence,
    likelyCause: 'Complex content structures that may be hard for editors to navigate',
    impact: 'Editor confusion, slower content creation',
    recommendation: 'Consider flattening deeply nested structures',
    fixEffort: 'significant',
  };
}

/**
 * Main friction analysis
 */
export function analyzeFriction(input: ProjectIntelligenceInput): FrictionAnalysis {
  // Run all detectors
  const detectors = [
    detectDraftBottleneck,
    detectUnusedComponents,
    detectGhostModels,
    detectOverEngineeredModels,
    detectAbandonedLocalization,
    detectDeepNesting,
  ];
  
  const signals: FrictionSignal[] = [];
  
  for (const detector of detectors) {
    const signal = detector(input);
    if (signal) {
      signals.push(signal);
    }
  }
  
  // Sort by severity
  const severityOrder: Record<FrictionSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  // Count by severity
  const bySeverity = {
    critical: signals.filter(s => s.severity === 'critical').length,
    high: signals.filter(s => s.severity === 'high').length,
    medium: signals.filter(s => s.severity === 'medium').length,
    low: signals.filter(s => s.severity === 'low').length,
  };
  
  // Calculate total waste
  const estimatedTotalWaste = signals.reduce((sum, s) => sum + (s.estimatedWaste || 0), 0);
  
  // Calculate friction score (0-100, lower = more friction)
  // Start at 100, subtract based on severity
  let score = 100;
  score -= bySeverity.critical * 25;
  score -= bySeverity.high * 15;
  score -= bySeverity.medium * 8;
  score -= bySeverity.low * 3;
  score = Math.max(0, score);
  
  // Top recommendation is the highest severity signal
  const topRecommendation = signals.length > 0 ? signals[0] : null;
  
  return {
    score,
    totalSignals: signals.length,
    bySeverity,
    signals,
    topRecommendation,
    estimatedTotalWaste,
  };
}

/**
 * Get friction status label
 */
export function getFrictionStatus(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Low Friction', color: 'green' };
  if (score >= 60) return { label: 'Some Friction', color: 'yellow' };
  if (score >= 40) return { label: 'Moderate Friction', color: 'orange' };
  return { label: 'High Friction', color: 'red' };
}

