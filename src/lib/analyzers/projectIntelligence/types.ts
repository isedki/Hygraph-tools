/**
 * Project Intelligence Types
 * 
 * Comprehensive type definitions for project analysis including:
 * - Lifecycle Stage
 * - Content Readiness
 * - Schema Health
 * - Friction Detection
 * - Top Contributors
 */

// =============================================================================
// Core Types
// =============================================================================

export type LifecycleStage = 'modeling' | 'early-content' | 'growth' | 'production' | 'maintenance';

export type FrictionSeverity = 'critical' | 'high' | 'medium' | 'low';

export type FrictionCategory = 'content' | 'schema' | 'feature' | 'workflow';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// =============================================================================
// Evidence & Credibility
// =============================================================================

export interface Evidence {
  type: string;
  description: string;
  value: string | number;
  direction: 'supports' | 'contradicts';
}

export interface SampledMetric<T> {
  value: T;
  sampleSize: number;
  populationSize: number;
  marginOfError: number;      // e.g., 0.08 = ±8%
  confidenceLevel: number;    // e.g., 0.95 = 95%
  isExact: boolean;           // true if 100% sampled
}

// =============================================================================
// Lifecycle Stage
// =============================================================================

export interface LifecycleAnalysis {
  stage: LifecycleStage;
  confidence: ConfidenceLevel;
  evidence: Evidence[];
  
  // Key metrics used for detection
  metrics: {
    totalEntries: number;
    totalModels: number;
    entriesPerModel: number;
    ghostModelRatio: number;
    draftRatio: number;
    velocityTrend: number; // >1 = increasing, <1 = decreasing
  };
  
  // Actionable output
  readyForProduction: boolean;
  blockers: string[];
  nextMilestone: string;
}

// =============================================================================
// Content Readiness
// =============================================================================

export interface TestContentEntry {
  model: string;
  id: string;
  title: string;
  signals: string[]; // What made it look like test content
}

export interface ContentReadinessAnalysis {
  productionPercent: number;
  confidence: ConfidenceLevel;
  
  // Breakdown
  totalAnalyzed: number;
  productionCount: number;
  testCount: number;
  
  // Test content details
  testEntriesByModel: {
    model: string;
    count: number;
    examples: string[];
    signals: string[];
  }[];
  
  // Actionable
  cleanupTimeEstimate: string;
  recommendations: string[];
}

// =============================================================================
// Schema Health
// =============================================================================

export interface SchemaHealthBreakdown {
  namingConsistency: {
    score: number;
    dominant: string; // 'snake_case' | 'camelCase' | 'TitleCase' | 'mixed'
    details: string;
  };
  documentation: {
    score: number;
    fieldsWithDescriptions: number;
    totalFields: number;
    details: string;
  };
  ghostModels: {
    score: number;
    ghostCount: number;
    totalModels: number;
    ghostNames: string[];
  };
  componentReuse: {
    score: number;
    reusedComponents: number;
    totalComponents: number;
    details: string;
  };
  relationHygiene: {
    score: number;
    bidirectionalCount: number;
    totalRelations: number;
    details: string;
  };
}

export interface SchemaHealthAnalysis {
  score: number; // 0-100
  confidence: ConfidenceLevel;
  breakdown: SchemaHealthBreakdown;
  
  // Actionable
  topIssue: string;
  quickWin: string;
  recommendations: string[];
}

// =============================================================================
// Friction Detection
// =============================================================================

export interface FrictionSignal {
  id: string;
  category: FrictionCategory;
  name: string;
  severity: FrictionSeverity;
  confidence: ConfidenceLevel;
  
  // Evidence
  description: string;
  affectedModels: string[];
  dataPoints: number;
  evidence: Evidence[];
  
  // Context
  likelyCause: string;
  impact: string;
  
  // Actionable
  recommendation: string;
  estimatedWaste?: number; // $ value
  fixEffort: 'trivial' | 'easy' | 'moderate' | 'significant';
}

export interface FrictionAnalysis {
  score: number; // 0-100, lower = more friction (inverted for display)
  totalSignals: number;
  
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  
  signals: FrictionSignal[];
  topRecommendation: FrictionSignal | null;
  estimatedTotalWaste: number;
}

// =============================================================================
// Top Contributors
// =============================================================================

export interface ContributorFocusArea {
  model: string;
  count: number;
  percentage: number;
}

export interface ContributorLastActivity {
  entryTitle: string;
  model: string;
  action: 'created' | 'updated';
  date: string;
  daysAgo: number;
}

export interface Contributor {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  
  // Activity stats
  totalEntries: number;
  entriesCreated: number;
  entriesUpdated: number;
  
  // Focus areas (top 3 models)
  focusAreas: ContributorFocusArea[];
  
  // Recent work
  lastActivity: ContributorLastActivity | null;
  
  // Activity timeline (last 12 weeks)
  weeklyActivity: number[];
}

export interface TopContributorsAnalysis {
  period: '3months';
  scannedAt: string;
  
  // Summary
  totalContributors: number;
  totalEntries: number;
  
  // Top 3
  top3: Contributor[];
  
  // Activity pattern
  peakDay?: string;
  activityPattern: 'weekday' | 'weekend' | 'mixed' | 'unknown';
}

// =============================================================================
// Complete Project Intelligence
// =============================================================================

export interface ProjectIntelligence {
  version: string;
  analyzedAt: string;
  
  // Core analyses
  lifecycle: LifecycleAnalysis;
  contentReadiness: ContentReadinessAnalysis;
  schemaHealth: SchemaHealthAnalysis;
  friction: FrictionAnalysis;
  
  // Optional (requires scan)
  contributors?: TopContributorsAnalysis;
  
  // Summary
  quickActions: string[];
  executiveSummary: string;
}

// =============================================================================
// Analysis Input Types
// =============================================================================

export interface ProjectIntelligenceInput {
  // Schema counts (from SchemaAnalysis)
  schemaCounts: {
    modelCount: number;
    componentCount: number;
    enumCount: number;
    totalFields: number;
    relationCount: number;
    maxNestingDepth: number;
  };
  
  // Two-way references from schema
  twoWayReferences: [string, string][];
  
  // Components (from ComponentAnalysis)
  components: {
    name: string;
    usedInModels: string[];
    fieldCount: number;
    nestingDepth: number;
  }[];
  
  // Unused components
  unusedComponents: string[];
  
  // Locales (from localization burden or default)
  locales: string[];
  
  // Content distribution (from comprehensiveAssessment)
  contentDistribution: {
    model: string;
    total: number;
    draft: number;
    published: number;
  }[];
  
  // Ghost models (from insights.contentAdoption)
  ghostModels: {
    model: string;
    fieldCount: number;
  }[];
  
  // Model complexity (from editorial.modelComplexity)
  modelComplexity: {
    model: string;
    fieldCount: number;
    requiredFields: number;
    relationCount: number;
    complexityScore: number;
  }[];
  
  // Content freshness (optional) - simplified to average days since update
  freshness?: {
    avgDaysSinceUpdate: number;
  };
}

