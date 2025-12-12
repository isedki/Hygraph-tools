// Core Hygraph Schema Types
export interface HygraphField {
  name: string;
  type: string;
  isRequired?: boolean;
  isList?: boolean;
  isUnique?: boolean;
  description?: string;
  relatedModel?: string;
  enumValues?: string[];
}

export interface HygraphModel {
  name: string;
  apiId: string;
  pluralApiId: string;
  fields: HygraphField[];
  isComponent?: boolean;
  isSystem?: boolean;
}

export interface HygraphTaxonomy {
  name: string;
  apiId: string;
  nodeCount?: number;
  usedInModels: string[];
}

export interface HygraphSchema {
  models: HygraphModel[];
  enums: { name: string; values: string[] }[];
  components: HygraphModel[];
  taxonomies: HygraphTaxonomy[];
}

// Audit Issue Types
export type IssueSeverity = 'critical' | 'warning' | 'info';
export type IssueCategory = 
  | 'schema' 
  | 'component' 
  | 'content' 
  | 'editorial' 
  | 'seo' 
  | 'performance' 
  | 'best-practices'
  | 'governance';

export interface AuditIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  affectedItems: string[];
  score?: number;
}

// Audit Results
export interface CategoryScore {
  category: IssueCategory;
  score: number;
  maxScore: number;
  issues: AuditIssue[];
}

export interface SchemaAnalysis {
  modelCount: number;
  componentCount: number;
  enumCount: number;
  totalFields: number;
  fieldTypeDistribution: Record<string, number>;
  relationCount: number;
  twoWayReferences: [string, string][]; // Bidirectional relations - a Hygraph FEATURE
  circularRelations: string[][]; // True cycles with 3+ nodes - potential issue
  maxNestingDepth: number;
  deepNestingPaths: string[][];
  orphanModels: string[];
}

export interface ComponentAnalysis {
  components: {
    name: string;
    usedInModels: string[];
    fieldCount: number;
    nestingDepth: number;
  }[];
  unusedComponents: string[];
  duplicateFieldPatterns: {
    fields: string[];
    foundInModels: string[];
    recommendation: string;
  }[];
  reuseScore: number;
}

export interface ContentAnalysis {
  modelEntryCounts: Record<string, { draft: number; published: number }>;
  totalEntries: number;
  draftRatio: number;
  emptyModels: string[];
  contentFreshness: {
    lastWeek: number;
    lastMonth: number;
    last3Months: number;
    older: number;
  };
  orphanAssets: number;
  totalAssets: number;
}

export interface EditorialAnalysis {
  modelComplexity: {
    model: string;
    fieldCount: number;
    requiredFields: number;
    relationCount: number;
    complexityScore: number;
  }[];
  averageFieldsPerModel: number;
  averageRequiredRatio: number;
  localizationBurden: {
    model: string;
    localizedFields: number;
    localeCount: number;
    totalFieldsToManage: number;
  }[];
}

export interface SEOAnalysis {
  modelsWithSEO: string[];
  modelsWithoutSEO: string[];
  seoFieldCoverage: number;
  slugFieldPresence: {
    model: string;
    hasSlug: boolean;
    slugField?: string;
  }[];
  duplicateSlugs: { model: string; slug: string; count: number }[];
  assetsWithoutAlt: number;
  totalAssets: number;
  altTextCoverage: number;
  ogFieldsPresent: boolean;
  richTextHeadingIssues: {
    model: string;
    field: string;
    issue: string;
  }[];
}

export interface PerformanceAnalysis {
  queryDepthRisks: {
    path: string[];
    depth: number;
    recommendation: string;
  }[];
  largeCollections: {
    model: string;
    count: number;
    recommendation: string;
  }[];
  heavyModels: {
    model: string;
    fieldCount: number;
    estimatedPayloadKB: number;
  }[];
  circularRelationRisks: string[][];
  componentNestingDepth: {
    component: string;
    depth: number;
  }[];
}

export interface BestPracticesAnalysis {
  namingConventionIssues: {
    item: string;
    currentName: string;
    issue: string;
    suggestion: string;
  }[];
  missingUniqueConstraints: {
    model: string;
    field: string;
    reason: string;
  }[];
  enumSuggestions: {
    model: string;
    field: string;
    distinctValues: string[];
    suggestion: string;
  }[];
  missingValidation: {
    model: string;
    field: string;
    suggestion: string;
  }[];
}

export interface ArchitectureAnalysis {
  enumAnalysis: {
    totalEnums: number;
    singleValueEnums: { name: string; value: string }[];
    unusedEnums: string[];
    duplicateEnumValues: { value: string; foundIn: string[]; recommendation: string }[];
    potentialEnumOverlap: { enums: string[]; sharedValues: string[]; recommendation: string }[];
    enumsAsPageTypes: string[];
  };
  variantAnalysis: {
    customVariantModels: { name: string; baseModel: string; fields: string[]; issue: string }[];
    shouldUseHygraphVariants: boolean;
    recommendation: string;
  };
  layoutContentSeparation: {
    layoutModels: string[];
    contentModels: string[];
    mixedModels: { name: string; layoutFields: string[]; contentFields: string[]; recommendation: string }[];
    separationScore: number;
  };
  componentVsModel: {
    modelsCouldBeComponents: { name: string; reason: string; recommendation: string }[];
    componentsAreModels: string[];
    properComponents: string[];
  };
  multitenantAnalysis: {
    hasMultitenantPattern: boolean;
    tenantIdentifiers: string[];
    usingEnumsForTenants: boolean;
    recommendation: string;
  };
  blockAnalysis: {
    blockModels: string[];
    duplicateBlockPatterns: { blocks: string[]; sharedFields: string[]; recommendation: string }[];
    shouldConsolidate: boolean;
  };
}

// Architecture Types
export type ArchitectureType = 
  | 'ecommerce'
  | 'marketing-site'
  | 'multi-brand'
  | 'multi-tenant'
  | 'multi-region'
  | 'blog-publication'
  | 'saas-docs'
  | 'portfolio-showcase'
  | 'event-platform'
  | 'mixed-unknown';

export interface ContentStrategyAnalysis {
  detectedArchitecture: {
    primary: ArchitectureType;
    confidence: number;
    signals: string[];
    allDetected: { type: ArchitectureType; confidence: number; signals: string[] }[];
  };
  architectureFit: {
    score: number;
    strengths: string[];
    issues: { issue: string; recommendation: string; priority: 'high' | 'medium' | 'low' }[];
  };
  modelUsage: {
    activeModels: { name: string; usage: string; entryCount: number }[];
    underutilizedModels: { name: string; reason: string; suggestion: string }[];
    overloadedModels: { name: string; fieldCount: number; suggestion: string }[];
    duplicateModels: { models: string[]; sharedFields: string[]; recommendation: string }[];
  };
  componentStrategy: {
    wellDesigned: string[];
    missingComponents: { description: string; affectedModels: string[]; recommendation: string }[];
    overEngineered: { name: string; reason: string; suggestion: string }[];
    componentReuseRate: number;
  };
  editorialExperience: {
    score: number;
    editorFriendlyModels: string[];
    complexModels: { name: string; issues: string[]; simplification: string }[];
    contentDiscoverability: 'excellent' | 'good' | 'needs-work' | 'poor';
    recommendations: string[];
  };
  deepNesting: {
    problematicPaths: { path: string[]; depth: number; issue: string; solution: string }[];
    recommendedFlattening: { current: string; proposed: string; benefit: string }[];
  };
  duplicationPatterns: {
    fieldDuplication: { fields: string[]; foundIn: string[]; recommendation: string }[];
    modelDuplication: { models: string[]; sharedFields: string[]; recommendation: string }[];
    enumDuplication: { enums: string[]; recommendation: string }[];
  };
}

export interface GovernanceAnalysis {
  // Structure & Organization
  pageVsContentType: {
    duplicatePatterns: {
      models: string[];
      sharedFields: string[];
      recommendation: string;
    }[];
    monolithicModels: string[];
  };
  fieldCountAnalysis: {
    model: string;
    totalFields: number;
    oneOffFields: string[];
    repeatingPatterns: string[];
  }[];
  versionedModels: {
    baseName: string;
    versions: string[];
    recommendation: string;
  }[];
  
  // Reusability
  templateFlexibility: {
    rigidModels: string[];
    flexibleModels: string[];
    score: number;
  };
  
  // Localization
  localizationAnalysis: {
    hasLocalization: boolean;
    localizedModels: string[];
    localeCount: number;
    inconsistentLocalization: string[];
  };
  
  // Workflow
  stageUsage: {
    usingStages: boolean;
    draftCount: number;
    publishedCount: number;
    stageRatio: number;
  };
  
  // Editor Experience
  editorExperience: {
    complexModels: string[];
    wellOrganizedModels: string[];
    modelsNeedingHelpText: string[];
    score: number;
  };
}

// Strategic Audit Report - Senior Content Strategist Style
export type OverallAssessment = 'excellent' | 'good' | 'needs-attention' | 'critical';
export type EffortLevel = 'low' | 'medium' | 'high';
export type EditorialEfficiency = 'streamlined' | 'manageable' | 'cumbersome' | 'frustrating';
export type ContentMaturity = 'basic' | 'intermediate' | 'advanced';
export type GovernanceReadiness = 'ready' | 'needs-work' | 'missing';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Priority = 'high' | 'medium' | 'low';

// ============================================
// NEW: Data-Driven Strategic Recommendations
// ============================================
export interface StrategicRecommendationMetric {
  label: string;
  value: number | string;
}

export interface StrategicRecommendation {
  id: string;
  title: string;
  finding: string; // Data-driven finding, e.g., "3 field patterns duplicated across 8 models"
  recommendation: string;
  impact: string; // Business/editor impact
  metrics: StrategicRecommendationMetric[];
  priority: Priority;
  effort: EffortLevel;
  category: 'editor-experience' | 'scalability' | 'content-strategy' | 'governance';
}

// ============================================
// NEW: Score Breakdown for Transparency
// ============================================
export interface ScoreContribution {
  reason: string;
  value: number; // positive = bonus, negative = penalty
  details?: string; // e.g., "3 models affected: Article, Page, Post"
}

export interface ScoreBreakdown {
  finalScore: number;
  baseScore: number; // Always 100 for issue-driven approach
  contributions: ScoreContribution[];
  formula?: string; // Human-readable formula explanation
}

export interface DimensionScore {
  score: number;
  assessment: string;
  breakdown: ScoreContribution[];
}

// ============================================
// NEW: Content Maturity & Operational Readiness
// ============================================
export interface ContentMaturityAssessment {
  level: 1 | 2 | 3 | 4 | 5;
  label: 'Chaotic' | 'Reactive' | 'Defined' | 'Managed' | 'Optimized';
  narrative: string;
  dimensions: {
    structure: DimensionScore;
    reuse: DimensionScore;
    governance: DimensionScore;
    scalability: DimensionScore;
  };
  overallBreakdown: ScoreBreakdown;
  nextLevelActions: string[];
}

export interface OmnichannelIndicator {
  score: number;
  breakdown: ScoreContribution[];
  examples?: string[];
  issues?: string[];
  recommendations?: string[];
  considerations?: string[];
}

export interface OmnichannelReadiness {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  readinessLabel: 'Not Ready' | 'Partially Ready' | 'Channel Ready' | 'Optimized';
  narrative: string;
  channels: {
    web: { ready: boolean; gaps: string[] };
    mobile: { ready: boolean; gaps: string[] };
    email: { ready: boolean; gaps: string[] };
    headless: { ready: boolean; gaps: string[] };
  };
  indicators: {
    presentationFreeContent: OmnichannelIndicator;
    semanticStructure: OmnichannelIndicator;
    assetFlexibility: OmnichannelIndicator;
    apiDesign: OmnichannelIndicator;
  };
}

export interface VelocityCalculation {
  component: string;
  value: number;
  contribution: number; // minutes added
  formula: string; // e.g., "32 fields × 0.25 min = 8 min"
}

export interface ModelVelocityBreakdown {
  model: string;
  estimatedMinutes: number;
  calculation: VelocityCalculation[];
  factors: string[];
  formulaSummary: string; // e.g., "Base (3) + Fields (8) + Required (4) + Relations (2) = 17 min"
}

export interface EditorialVelocityEstimate {
  averageTimeToPublish: string;
  narrative: string;
  formulaExplanation: string; // Global explanation of the formula
  modelComplexityBreakdown: ModelVelocityBreakdown[];
  bottlenecks: { model: string; issue: string; timeCost: string }[];
  velocityTips: string[];
}

export interface PermissionModelReview {
  assessment: 'well-defined' | 'needs-attention' | 'at-risk';
  narrative: string;
  observations: {
    sensitiveModels: string[];
    highFieldCountModels: string[];
    suggestedRoles: { role: string; access: string; models: string[] }[];
  };
  risks: { risk: string; impact: string; mitigation: string }[];
  recommendations: string[];
}

export interface LocalizationAssessment {
  readiness: 'none' | 'basic' | 'structured' | 'advanced';
  narrative: string;
  coverage: {
    localizedModels: number;
    totalContentModels: number;
    localeCount: number;
    localizedFieldsRatio: number;
  };
  gaps: { issue: string; impact: string; recommendation: string }[];
  strengths: string[];
  workflowConsiderations: string[];
}

export interface PersonalizationReadiness {
  level: 'none' | 'basic' | 'intermediate' | 'advanced';
  narrative: string;
  capabilities: {
    audienceSegmentation: { ready: boolean; fields: string[] };
    contextualContent: { ready: boolean; fields: string[] };
    abTesting: { ready: boolean; fields: string[] };
    dynamicContent: { ready: boolean; fields: string[] };
  };
  enablers: string[];
  gaps: string[];
  implementationPath: string[];
}

// ============================================
// NEW: Schema Strengths Analysis
// ============================================
export interface SchemaStrength {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: 'architecture' | 'components' | 'taxonomy' | 'forms' | 'seo' | 'workflow' | 'scalability';
  examples?: string[];
}

export interface StrengthsAnalysis {
  strengths: SchemaStrength[];
  architectureHighlights: string[];
  componentHighlights: string[];
  taxonomyHighlights: string[];
}

// ============================================
// NEW: Model Deep Dive Analysis
// ============================================
export interface ModelFieldRecommendation {
  field: string;
  currentState: string;
  recommendation: string;
  priority: Priority;
}

export interface ModelDeepDive {
  modelName: string;
  purpose: string;
  importance: 'critical' | 'important' | 'supporting';
  entryCount: number;
  fieldCount: number;
  strengths: string[];
  recommendations: ModelFieldRecommendation[];
  requiredFieldsSuggestions: string[];
  validationSuggestions: { field: string; validation: string }[];
  relationshipNotes: string[];
}

export interface ModelDeepDiveAnalysis {
  criticalModels: ModelDeepDive[];
  supportingModels: ModelDeepDive[];
  configModels: ModelDeepDive[];
}

// ============================================
// NEW: Enhanced Enum Analysis with Purpose
// ============================================
export interface EnumPurpose {
  name: string;
  values: string[];
  category: 'styling' | 'layout' | 'content-type' | 'business-logic' | 'tenancy' | 'status' | 'other';
  purpose: string;
  usedInModels: string[];
  usageCount: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
}

export interface EnumOverviewAnalysis {
  totalEnums: number;
  enumsByCategory: {
    styling: EnumPurpose[];
    layout: EnumPurpose[];
    contentType: EnumPurpose[];
    businessLogic: EnumPurpose[];
    tenancy: EnumPurpose[];
    status: EnumPurpose[];
    other: EnumPurpose[];
  };
  architecturalEnums: EnumPurpose[];
  healthSummary: {
    healthy: number;
    warning: number;
    critical: number;
  };
  overallAssessment: string;
}

// ============================================
// NEW: Naming Convention Analysis
// ============================================
export interface NamingPattern {
  pattern: string;
  examples: string[];
  status: 'consistent' | 'inconsistent' | 'needs-attention';
  recommendation?: string;
}

export interface NamingConventionAnalysis {
  modelNaming: NamingPattern;
  fieldNaming: NamingPattern;
  componentNaming: NamingPattern;
  enumNaming: NamingPattern;
  systemFieldsConsistency: NamingPattern;
  prefixPatterns: { prefix: string; usedIn: string[]; consistent: boolean }[];
  suggestedStandards: {
    models: string;
    fields: string;
    components: string;
    enums: string;
    booleans: string;
    dates: string;
    references: string;
  };
  issues: { item: string; current: string; issue: string; suggestion: string }[];
}

// ============================================
// NEW: Component Reusability Deep Analysis
// ============================================
export interface ComponentVariantGroup {
  baseName: string;
  variants: string[];
  sharedFields: string[];
  uniqueFields: Record<string, string[]>;
  consolidationRecommendation: string;
  shouldConsolidate: boolean;
  effort: EffortLevel;
}

export interface ComponentReusabilityAnalysis {
  wellDesignedComponents: {
    name: string;
    usedInModels: string[];
    fieldCount: number;
    reuseScore: number;
  }[];
  variantGroups: ComponentVariantGroup[];
  duplicationOpportunities: {
    description: string;
    affectedModels: string[];
    potentialComponent: string;
    sharedFields: string[];
    recommendation: string;
  }[];
  unusedComponents: string[];
  overEngineeredComponents: { name: string; reason: string; suggestion: string }[];
}

// ============================================
// NEW: Relationship Graph Analysis
// ============================================
export interface RelationshipNode {
  id: string;
  name: string;
  type: 'model' | 'component' | 'enum';
  entryCount?: number;
  fieldCount: number;
  importance: 'core' | 'supporting' | 'config' | 'utility';
  description?: string;
}

export interface RelationshipEdge {
  from: string;
  to: string;
  type: 'reference' | 'component' | 'enum' | 'bidirectional';
  fieldName: string;
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface RelationshipCluster {
  name: string;
  description: string;
  models: string[];
  centralModel?: string;
}

export interface RelationshipGraphAnalysis {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  clusters: RelationshipCluster[];
  coreModels: string[];
  orphanedModels: string[];
  hubModels: { model: string; connectionCount: number }[];
}

// ============================================
// NEW: Implementation Roadmap
// ============================================
export interface RoadmapTask {
  id: string;
  task: string;
  description: string;
  effort: EffortLevel;
  impact: string;
  affectedItems: string[];
  dependencies?: string[];
  completed?: boolean;
}

export interface RoadmapPhase {
  phase: number;
  name: string;
  duration: string;
  description: string;
  tasks: RoadmapTask[];
}

export interface ImplementationRoadmap {
  phases: RoadmapPhase[];
  quickWins: RoadmapTask[];
  maintenanceTasks: RoadmapTask[];
  totalEstimatedEffort: string;
}

// ============================================
// ENHANCED: Strategic Finding
// ============================================
export interface StrategicFinding {
  id: string;
  headline: string;
  situation: string;
  impact: string;
  recommendation: string;
  effort: EffortLevel;
  businessValue: EffortLevel;
  category: 'editorial' | 'reusability' | 'performance' | 'governance' | 'architecture' | 'naming' | 'validation';
  affectedItems?: string[];
  examples?: string[];
}

export interface ActionItem {
  action: string;
  effort: EffortLevel;
  impact: string;
  affectedModels?: string[];
}

// ============================================
// ENHANCED: Strategic Audit Report
// ============================================
export interface StrategicAuditReport {
  // Narrative executive summary
  executiveSummary: {
    overallAssessment: OverallAssessment;
    narrativeSummary: string; // NEW: Full paragraph narrative
    headline: string;
    subheadline: string;
    keyFindings: string[];
    quickWins: string[];
    strategicRecommendations: string[];
    metrics: {
      models: number;
      customModels: number;
      systemModels: number;
      components: number;
      enums: number;
      contentEntries: number;
      reuseScore: number;
    };
  };
  
  // Schema overview with narrative
  schemaOverview: {
    modelsNarrative: string;
    componentsNarrative: string;
    enumsNarrative: string;
  };
  
  // Strengths section
  strengths: StrengthsAnalysis;
  
  // Areas for improvement (findings)
  areasForImprovement: {
    namingConventions: {
      summary: string;
      issues: NamingConventionAnalysis['issues'];
      priority: Priority;
      effort: EffortLevel;
    };
    documentation: {
      summary: string;
      modelsNeedingDescriptions: string[];
      fieldsNeedingDescriptions: { model: string; fields: string[] }[];
      priority: Priority;
      effort: EffortLevel;
    };
    validation: {
      summary: string;
      missingRequired: { model: string; fields: string[] }[];
      missingUnique: { model: string; field: string; reason: string }[];
      missingPatterns: { model: string; field: string; suggestion: string }[];
      priority: Priority;
      effort: EffortLevel;
    };
    componentReusability: {
      summary: string;
      variantGroups: ComponentVariantGroup[];
      priority: Priority;
      effort: EffortLevel;
    };
    localization: {
      summary: string;
      recommendations: string[];
      priority: Priority;
      effort: EffortLevel;
    };
    referenceCardinality: {
      summary: string;
      reviewNeeded: { model: string; field: string; current: string; suggestion: string }[];
      priority: Priority;
      effort: EffortLevel;
    };
  };
  
  // Specific model recommendations
  modelRecommendations: ModelDeepDiveAnalysis;
  
  // Enum overview
  enumOverview: EnumOverviewAnalysis;
  
  // Relationship visualization data
  relationshipGraph: RelationshipGraphAnalysis;
  
  useCaseAnalysis: {
    detectedUseCase: string;
    useCaseIcon: string;
    fitScore: number;
    fitAssessment: string;
    strengths: { finding: string; businessImpact: string }[];
    gaps: { finding: string; businessImpact: string; recommendation: string }[];
  };
  
  editorialExperience: {
    efficiency: EditorialEfficiency;
    editorPersona: string;
    painPoints: { issue: string; impact: string; solution: string }[];
    positives: string[];
    overallAssessment: string;
    velocityEstimate: EditorialVelocityEstimate;
  };
  
  contentStrategy: {
    maturity: ContentMaturity;
    maturityDescription: string;
    contentMaturityAssessment: ContentMaturityAssessment;
    reusabilityScore: number;
    reusabilityAssessment: string;
    scalabilityAssessment: string;
    governanceReadiness: GovernanceReadiness;
    governanceNotes: string;
    omnichannelReadiness: OmnichannelReadiness;
    personalizationReadiness: PersonalizationReadiness;
  };

  governance: {
    permissionModelReview: PermissionModelReview;
    localizationAssessment: LocalizationAssessment;
  };
  
  performanceConsiderations: {
    overallRisk: RiskLevel;
    riskAssessment: string;
    queryOptimization: string[];
    indexRecommendations: string[];
    cacheStrategy: string[];
    potentialBottlenecks: { issue: string; impact: string }[];
    optimizationOpportunities: string[];
  };
  
  // Implementation roadmap
  implementationRoadmap: ImplementationRoadmap;
  
  // Legacy action plan (keep for compatibility)
  actionPlan: {
    immediate: ActionItem[];
    shortTerm: ActionItem[];
    longTerm: ActionItem[];
  };
  
  // Data-driven strategic recommendations with metrics
  strategicRecommendations: StrategicRecommendation[];
  
  findings: StrategicFinding[];
}

// Structural Observations (consultant-style insights)
export interface StructuralObservation {
  text: string;
  type: 'architecture' | 'issue' | 'pattern' | 'info';
  severity?: 'high' | 'medium' | 'low';
}

// ============================================
// NEW: Insights Tab Types
// ============================================

// Payload Efficiency Analysis
export interface PayloadFieldBreakdown {
  field: string;
  type: string;
  bytes: number;
  percentage: number;
  isHeavy: boolean;
}

export interface PayloadEstimate {
  model: string;
  estimatedBytes: number;
  estimatedKB: number;
  fieldBreakdown: PayloadFieldBreakdown[];
  riskLevel: 'low' | 'medium' | 'high';
  heavyFields: string[];
  recommendations: string[];
}

export interface PayloadEfficiencyAnalysis {
  estimates: PayloadEstimate[];
  heavyModels: { model: string; kb: number; reason: string }[];
  avgPayloadKB: number;
  totalModelsAnalyzed: number;
  recommendations: string[];
  overallScore: number;
}

// Content Adoption Analysis
export interface GhostModel {
  model: string;
  fieldCount: number;
  hasRelations: boolean;
  createdFor?: string;
}

export interface AdoptionCategory {
  model: string;
  entries: number;
  published: number;
  draftOnly: number;
  fieldCount: number;
}

export interface ContentAdoptionAnalysis {
  ghostModels: GhostModel[];
  underutilized: AdoptionCategory[];
  lowAdoption: AdoptionCategory[];
  healthy: AdoptionCategory[];
  highVolume: AdoptionCategory[];
  adoptionRate: number;
  totalModels: number;
  modelsWithContent: number;
  distribution: {
    ghost: number;
    underutilized: number;
    lowAdoption: number;
    healthy: number;
    highVolume: number;
  };
  recommendations: string[];
  overallScore: number;
}

// SEO Readiness Assessment
export interface SEOReadinessAssessment {
  metaFieldCoverage: CheckpointResult;
  slugConsistency: CheckpointResult;
  socialSharing: CheckpointResult;
  structuredData: CheckpointResult;
  altTextCoverage: CheckpointResult;
  overallScore: number;
}

// ============================================
// NEW: Rich Text Usage Analysis
// ============================================
export interface RichTextUsageAnalysis {
  modelsWithRichText: { model: string; fields: string[] }[];
  absoluteUrls: { model: string; field: string; urls: string[]; count: number }[];
  embeddedImages: { model: string; field: string; count: number; recommendation: string }[];
  linkAnalysis: {
    staticLinks: { model: string; field: string; count: number }[];
    referenceLinks: { model: string; field: string; count: number }[];
    ctaPatterns: { model: string; field: string; pattern: string }[];
  };
  recommendations: string[];
  overallScore: number;
}

// ============================================
// NEW: Empty Field Analysis
// ============================================
export interface FieldFillRate {
  model: string;
  field: string;
  fillRate: number; // 0-100%
  sampleSize: number;
  isEmpty: number;
  isFilled: number;
  isRequired: boolean;
}

export interface EmptyFieldAnalysis {
  fieldFillRates: FieldFillRate[];
  rarelyUsedFields: { model: string; field: string; fillRate: number }[];  // <20%
  dataQualityIssues: { model: string; field: string; fillRate: number }[]; // required but <80%
  unusedOptionalFields: { model: string; field: string }[];                // 0% fill
  modelSummary: { model: string; avgFillRate: number; fieldCount: number }[];
  overallDataQuality: number; // 0-100
  recommendations: string[];
}

// ============================================
// NEW: Content Freshness Analysis
// ============================================
export interface FreshnessThresholds {
  fresh: number;      // days (default 30)
  aging: number;      // days (default 90)
  stale: number;      // days (default 180)
  dormant: number;    // days (default 365)
}

export interface ModelFreshness {
  model: string;
  totalEntries: number;
  fresh: number;      // updated within fresh threshold
  aging: number;      // updated within aging threshold
  stale: number;      // updated within stale threshold
  dormant: number;    // older than dormant threshold
  avgAgeDays: number;
  newestEntry: Date | null;
  oldestEntry: Date | null;
}

export interface ContentFreshnessAnalysis {
  thresholds: FreshnessThresholds;
  modelFreshness: ModelFreshness[];
  overallFreshness: {
    score: number;           // 0-100
    totalEntries: number;
    freshPercentage: number;
    stalePercentage: number;
    dormantPercentage: number;
  };
  staleContentAlert: { model: string; staleCount: number; percentage: number }[];
  recommendations: string[];
}

// ============================================
// NEW: Caching & Performance Enhancement Types
// ============================================
export interface CachingReadiness {
  modelsWithUniqueId: { model: string; field: string }[];
  modelsWithoutUniqueId: string[];
  cacheKeyRecommendations: { model: string; suggestion: string }[];
  overallScore: number;
}

export interface EnumTaxonomyRecommendation {
  model: string;
  field: string;
  currentType: string;
  distinctValues: string[];
  recommendation: 'enum' | 'taxonomy' | 'keep';
  reason: string;
}

export interface EnhancedPerformanceAnalysis {
  cachingReadiness: CachingReadiness;
  enumTaxonomyRecommendations: EnumTaxonomyRecommendation[];
}

// Combined Insights
export interface InsightsAnalysis {
  payloadEfficiency: PayloadEfficiencyAnalysis;
  contentAdoption: ContentAdoptionAnalysis;
  seoReadiness: SEOReadinessAssessment;
  richTextUsage?: RichTextUsageAnalysis;
  emptyFields?: EmptyFieldAnalysis;
  contentFreshness?: ContentFreshnessAnalysis;
  enhancedPerformance?: EnhancedPerformanceAnalysis;
}

export interface AuditResult {
  connectionInfo: {
    endpoint: string;
    connectedAt: Date;
  };
  overallScore: number;
  categoryScores: CategoryScore[];
  schema: SchemaAnalysis;
  components: ComponentAnalysis;
  content: ContentAnalysis;
  editorial: EditorialAnalysis;
  seo: SEOAnalysis;
  performance: PerformanceAnalysis;
  bestPractices: BestPracticesAnalysis;
  governance: GovernanceAnalysis;
  architecture: ArchitectureAnalysis;
  contentStrategy: ContentStrategyAnalysis;
  strategicReport: StrategicAuditReport;
  allIssues: AuditIssue[];
  // NEW: Comprehensive checkpoint-based assessment
  comprehensiveAssessment: ComprehensiveAssessment;
  // NEW: Structural observations (high-level architectural insights)
  structuralObservations: StructuralObservation[];
  // NEW: Insights (payload, adoption, SEO readiness)
  insights: InsightsAnalysis;
}

// ============================================
// NEW: Checkpoint-Based Assessment Types
// ============================================
export type CheckpointStatus = 'good' | 'warning' | 'issue';

export interface CheckpointResult {
  status: CheckpointStatus;
  title: string;
  findings: string[];
  examples: {
    items?: string[];
    details?: string;
    sharedFields?: string[];
    uniqueToFirst?: string[];
    uniqueToSecond?: string[];
  }[];
  actionItems: string[];
}

// ============================================
// Structure & Organization Assessment
// ============================================
export interface StructureAssessment {
  // 11 Core Checkpoints
  distinctContentTypes: CheckpointResult;
  pageVsContentSeparation: CheckpointResult;
  redundantModels: CheckpointResult;
  overlappingModels: CheckpointResult;
  fieldNaming: CheckpointResult;
  componentUsage: CheckpointResult;
  componentReordering: CheckpointResult;
  rteUsage: CheckpointResult;
  localization: CheckpointResult;
  recursiveChains: CheckpointResult;
  assetCentralization: CheckpointResult;
  
  // Enum Analysis (integrated)
  enumAnalysis: {
    singleValueEnums: CheckpointResult;
    oversizedEnums: CheckpointResult;
    enumBasedTenancy: CheckpointResult;
    duplicateEnums: CheckpointResult;
    unusedEnums: CheckpointResult;
  };
}

// ============================================
// Content Architecture Assessment
// ============================================
export interface TaxonomyModel {
  name: string;
  type: 'category' | 'tag' | 'topic' | 'type' | 'other';
  entryCount: number;
  isEnumBased: boolean;
  referencedBy: string[];
  isNativeTaxonomy?: boolean; // True if this is a Hygraph native taxonomy
}

export interface HierarchySupport {
  model: string;
  selfRefField: string;
  supportsNesting: boolean;
  maxDepthEstimate: number;
}

export interface ContentDistributionEntry {
  model: string;
  draft: number;
  published: number;
  total: number;
  percentage: number;
}

export interface FacetedFilteringAssessment {
  score: number;
  status: CheckpointStatus;
  filterableFields: {
    model: string;
    field: string;
    type: 'enum' | 'reference' | 'boolean';
  }[];
  gaps: string[];
  recommendations: string[];
}

export interface ContentArchitectureAssessment {
  taxonomyModels: TaxonomyModel[];
  taxonomySummary: CheckpointResult;
  hierarchySupport: HierarchySupport[];
  hierarchySummary: CheckpointResult;
  contentDistribution: ContentDistributionEntry[];
  navigationReadiness: CheckpointResult;
  facetedFiltering: FacetedFilteringAssessment;
}

// ============================================
// Reusability Assessment
// ============================================
export interface ContentPresentationField {
  name: string;
  type: string;
  category: 'content' | 'presentation' | 'config';
  reason: string;
}

export interface LeakyModel {
  model: string;
  fields: ContentPresentationField[];
  contentCount: number;
  presentationCount: number;
  configCount: number;
}

export interface ReusabilityAssessment {
  sharedContent: CheckpointResult;
  sharedComponents: CheckpointResult;
  layoutFlexibility: CheckpointResult;
  contentVsPresentation: {
    status: CheckpointStatus;
    leakyModels: LeakyModel[];
    overallLeakageScore: number;
    worstOffenders: string[];
  };
  reuseScore: number;
  reuseScoreBreakdown: ScoreContribution[];
}

// ============================================
// Performance Assessment (NEW TAB)
// ============================================
export interface NestedComponentInfo {
  component: string;
  depth: number;
  path: string[];
  parentModels: string[];
}

export interface NestedModelInfo {
  model: string;
  depth: number;
  path: string[];
  queryComplexity: 'low' | 'medium' | 'high';
}

export interface HugeModelInfo {
  model: string;
  fieldCount: number;
  threshold: number;
  recommendation: string;
}

export interface MissingRequiredFieldInfo {
  model: string;
  suggestedRequired: string[];
  reason: string;
}

export interface PerformanceAssessment {
  nestedComponents: {
    status: CheckpointStatus;
    findings: string[];
    items: NestedComponentInfo[];
    actionItems: string[];
  };
  nestedModels: {
    status: CheckpointStatus;
    findings: string[];
    items: NestedModelInfo[];
    actionItems: string[];
  };
  hugeModels: {
    status: CheckpointStatus;
    findings: string[];
    items: HugeModelInfo[];
    actionItems: string[];
  };
  missingRequiredFields: {
    status: CheckpointStatus;
    findings: string[];
    items: MissingRequiredFieldInfo[];
    actionItems: string[];
  };
  deepQueryPaths: CheckpointResult;
  recursiveChains: CheckpointResult;
  overallScore: number;
}

// ============================================
// Enhanced Relationships Assessment
// ============================================
export interface ReferenceCorrectnessIssue {
  model: string;
  field: string;
  targetModel: string;
  issue: 'broken_reference' | 'nullable_key_reference' | 'missing_reverse_relation';
  suggestion: string;
}

export interface RelationshipsAssessment {
  referenceCorrectness: CheckpointResult & {
    issues: ReferenceCorrectnessIssue[];
  };
  circularReferences: CheckpointResult & {
    cycles: string[][];
    bidirectionalPairs: [string, string][];
  };
  nestedVsLinked: CheckpointResult & {
    shouldBeSplit: { model: string; fieldCount: number; suggestion: string }[];
  };
  queryCost: CheckpointResult & {
    highCostPaths: { path: string[]; depth: number; estimatedCost: 'low' | 'medium' | 'high' }[];
  };
}

// ============================================
// Duplicates Assessment
// ============================================
export interface DuplicateEnumGroup {
  enums: string[];
  sharedValues: string[];
  recommendation: string;
}

export interface DuplicateComponentGroup {
  components: string[];
  similarity: number;
  sharedFields: string[];
  uniqueFields: Record<string, string[]>;
  recommendation: string;
}

export interface DuplicateModelGroup {
  models: string[];
  similarity: number;
  sharedFields: string[];
  reason: string;
  recommendation: string;
}

export interface BooleanShowHideField {
  model: string;
  field: string;
  pattern: 'show' | 'hide' | 'enable' | 'disable' | 'is';
}

export interface DuplicatesAssessment {
  enums: {
    status: CheckpointStatus;
    groups: DuplicateEnumGroup[];
    actionItems: string[];
  };
  components: {
    status: CheckpointStatus;
    groups: DuplicateComponentGroup[];
    actionItems: string[];
  };
  models: {
    status: CheckpointStatus;
    groups: DuplicateModelGroup[];
    actionItems: string[];
  };
  booleanShowHide: {
    status: CheckpointStatus;
    fields: BooleanShowHideField[];
    actionItems: string[];
  };
}

// ============================================
// Comprehensive Audit Result Extension
// ============================================
export interface ComprehensiveAssessment {
  structure: StructureAssessment;
  contentArchitecture: ContentArchitectureAssessment;
  reusability: ReusabilityAssessment;
  performance: PerformanceAssessment;
  relationships: RelationshipsAssessment;
  duplicates: DuplicatesAssessment;
}

// GraphQL Introspection Types
export interface IntrospectionField {
  name: string;
  type: {
    kind: string;
    name: string | null;
    ofType?: {
      kind: string;
      name: string | null;
      ofType?: {
        kind: string;
        name: string | null;
      };
    };
  };
  args?: { name: string; type: { name: string } }[];
}

export interface IntrospectionType {
  kind: string;
  name: string;
  fields?: IntrospectionField[];
  enumValues?: { name: string }[];
  inputFields?: IntrospectionField[];
  possibleTypes?: { name: string }[];
}

export interface IntrospectionResult {
  __schema: {
    types: IntrospectionType[];
    queryType: { name: string };
    mutationType: { name: string } | null;
  };
}

// ============================================
// Duplicate Entry Detection Types
// ============================================

export interface DuplicateEntry {
  id: string;
  [key: string]: unknown;
}

export interface DuplicateGroup {
  matchKey: string;
  matchedFields: string[];
  entries: DuplicateEntry[];
}

export interface DuplicateCheckResult {
  model: string;
  totalEntries: number;
  duplicateGroups: DuplicateGroup[];
  analyzedFields: string[];
  timestamp: Date;
}

