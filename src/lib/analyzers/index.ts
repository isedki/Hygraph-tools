import { GraphQLClient } from 'graphql-request';
import type { 
  AuditResult, 
  CategoryScore, 
  AuditIssue,
  HygraphSchema,
  ComprehensiveAssessment,
  InsightsAnalysis,
} from '../types';
import { fetchSchema, fetchEntityCounts, fetchAssetStats } from '../hygraph/introspection';
import { analyzeSchema, generateSchemaIssues, calculateSchemaScore } from './schema';
import { analyzeComponents, generateComponentIssues, calculateComponentScore } from './components';
import { analyzeContent, generateContentIssues, calculateContentScore } from './content';
import { analyzeEditorial, generateEditorialIssues, calculateEditorialScore } from './editorial';
import { analyzeSEO, generateSEOIssues, calculateSEOScore, analyzeSEOReadiness } from './seo';
import { analyzePerformance, generatePerformanceIssues, calculatePerformanceScore } from './performance';
import { analyzeBestPractices, generateBestPracticesIssues, calculateBestPracticesScore } from './bestPractices';
import { analyzeGovernance, generateGovernanceIssues, calculateGovernanceScore } from './governance';
import { analyzeArchitecture, generateArchitectureIssues, calculateArchitectureScore } from './architecture';
import { analyzeContentStrategy, generateContentStrategyIssues, calculateContentStrategyScore } from './contentStrategy';
import { generateStrategicReport } from './strategicReport';
import { analyzeEnumArchitecture, generateEnumArchitectureIssues } from './enumArchitecture';

// New comprehensive assessment analyzers
import { analyzeStructureOrganization } from './structureOrganization';
import { analyzeContentArchitecture } from './contentArchitecture';
import { analyzeReusability } from './reusability';
import { analyzePerformanceAssessment } from './performanceAssessment';
import { analyzeRelationshipsAssessment } from './relationshipsAssessment';
import { analyzeDuplicates } from './duplicates';
import { analyzeStructuralObservations } from './structuralObservations';

// NEW: Insights analyzers
import { analyzePayloadEfficiency } from './payloadEfficiency';
import { analyzeContentAdoption } from './contentAdoption';

// NEW: Content health analyzers
import { analyzeRichTextUsage } from './richTextAnalysis';
import { analyzeEmptyFields } from './emptyFieldAnalysis';
import { analyzeContentFreshness, DEFAULT_FRESHNESS_THRESHOLDS } from './contentFreshness';
import { analyzeEnhancedPerformance } from './enhancedPerformance';
import type {
  RichTextUsageAnalysis,
  EmptyFieldAnalysis,
  ContentFreshnessAnalysis,
  EnhancedPerformanceAnalysis,
} from '../types';

// Default fallbacks for deep analyzers (in case of errors)
function getDefaultRichTextUsage(): RichTextUsageAnalysis {
  return {
    modelsWithRichText: [],
    absoluteUrls: [],
    embeddedImages: [],
    linkAnalysis: { staticLinks: [], referenceLinks: [], ctaPatterns: [] },
    recommendations: ['Rich text analysis skipped due to an error.'],
    overallScore: 100,
  };
}

function getDefaultEmptyFields(): EmptyFieldAnalysis {
  return {
    fieldFillRates: [],
    rarelyUsedFields: [],
    dataQualityIssues: [],
    unusedOptionalFields: [],
    modelSummary: [],
    overallDataQuality: 100,
    recommendations: ['Empty field analysis skipped due to an error.'],
  };
}

function getDefaultContentFreshness(): ContentFreshnessAnalysis {
  return {
    thresholds: DEFAULT_FRESHNESS_THRESHOLDS,
    modelFreshness: [],
    overallFreshness: {
      score: 100,
      totalEntries: 0,
      freshPercentage: 0,
      stalePercentage: 0,
      dormantPercentage: 0,
    },
    staleContentAlert: [],
    recommendations: ['Content freshness analysis skipped due to an error.'],
  };
}

function getDefaultEnhancedPerformance(): EnhancedPerformanceAnalysis {
  return {
    cachingReadiness: {
      modelsWithUniqueId: [],
      modelsWithoutUniqueId: [],
      cacheKeyRecommendations: [],
      overallScore: 100,
    },
    enumTaxonomyRecommendations: [],
  };
}

export async function runFullAudit(
  client: GraphQLClient,
  endpoint: string
): Promise<AuditResult> {
  console.log('[Audit] Starting audit...');
  
  // Step 1: Fetch schema via introspection
  console.log('[Audit] Step 1: Fetching schema...');
  const schema: HygraphSchema = await fetchSchema(client);
  console.log(`[Audit] Schema fetched: ${schema.models.length} models, ${schema.components.length} components`);
  
  // Step 2: Fetch entity counts for each model
  console.log('[Audit] Step 2: Fetching entity counts...');
  const entryCounts = await fetchEntityCounts(client, schema.models);
  console.log('[Audit] Entity counts fetched');
  
  // Step 3: Fetch asset statistics
  console.log('[Audit] Step 3: Fetching asset stats...');
  const assetStats = await fetchAssetStats(client);
  console.log('[Audit] Asset stats fetched');
  
  // Step 4: Run all analyzers (with logging)
  console.log('[Audit] Step 4: Running analyzers...');
  
  console.log('[Audit] - analyzeSchema');
  const schemaAnalysis = analyzeSchema(schema, entryCounts);
  
  console.log('[Audit] - analyzeComponents');
  const componentAnalysis = analyzeComponents(schema);
  
  console.log('[Audit] - analyzeContent');
  const contentAnalysis = analyzeContent(entryCounts, assetStats);
  
  console.log('[Audit] - analyzeEditorial');
  const editorialAnalysis = analyzeEditorial(schema);
  
  console.log('[Audit] - analyzeSEO');
  const seoAnalysis = analyzeSEO(schema, assetStats);
  
  console.log('[Audit] - analyzePerformance');
  const performanceAnalysis = analyzePerformance(schema, schemaAnalysis, entryCounts, assetStats);
  
  console.log('[Audit] - analyzeBestPractices');
  const bestPracticesAnalysis = analyzeBestPractices(schema);
  
  console.log('[Audit] - analyzeGovernance');
  const governanceAnalysis = analyzeGovernance(schema, contentAnalysis);
  
  console.log('[Audit] - analyzeArchitecture');
  const architectureAnalysis = analyzeArchitecture(schema);
  
  console.log('[Audit] - analyzeContentStrategy');
  const contentStrategyAnalysis = analyzeContentStrategy(schema, entryCounts);
  
  console.log('[Audit] - analyzeEnumArchitecture');
  const enumArchitectureAnalysis = analyzeEnumArchitecture(schema);
  
  // Step 4b: Run comprehensive assessment analyzers
  console.log('[Audit] Step 4b: Running comprehensive assessment...');
  
  console.log('[Audit] - analyzeStructureOrganization');
  const structureAssessment = analyzeStructureOrganization(schema, entryCounts);
  
  console.log('[Audit] - analyzeContentArchitecture');
  const contentArchitectureAssessment = analyzeContentArchitecture(schema, entryCounts);
  
  console.log('[Audit] - analyzeReusability');
  const reusabilityAssessment = analyzeReusability(schema, entryCounts);
  
  console.log('[Audit] - analyzePerformanceAssessment');
  const performanceAssessmentResult = analyzePerformanceAssessment(schema, entryCounts);
  
  console.log('[Audit] - analyzeRelationshipsAssessment');
  const relationshipsAssessment = analyzeRelationshipsAssessment(schema, entryCounts);
  
  console.log('[Audit] - analyzeDuplicates');
  const duplicatesAssessment = analyzeDuplicates(schema);
  
  // Build comprehensive assessment
  const comprehensiveAssessment: ComprehensiveAssessment = {
    structure: structureAssessment,
    contentArchitecture: contentArchitectureAssessment,
    reusability: reusabilityAssessment,
    performance: performanceAssessmentResult,
    relationships: relationshipsAssessment,
    duplicates: duplicatesAssessment,
  };
  
  // Step 5: Generate issues for each category
  console.log('[Audit] Step 5: Generating issues...');
  const schemaIssues = generateSchemaIssues(schemaAnalysis);
  const componentIssues = generateComponentIssues(componentAnalysis);
  const contentIssues = generateContentIssues(contentAnalysis);
  const editorialIssues = generateEditorialIssues(editorialAnalysis);
  const seoIssues = generateSEOIssues(seoAnalysis);
  const performanceIssues = generatePerformanceIssues(performanceAnalysis, assetStats);
  const bestPracticesIssues = generateBestPracticesIssues(bestPracticesAnalysis);
  const governanceIssues = generateGovernanceIssues(governanceAnalysis);
  const architectureIssues = generateArchitectureIssues(architectureAnalysis);
  const contentStrategyIssues = generateContentStrategyIssues(contentStrategyAnalysis);
  const enumArchitectureIssues = generateEnumArchitectureIssues(enumArchitectureAnalysis);
  console.log('[Audit] Issues generated');
  
  // Step 6: Calculate scores
  const schemaScore = calculateSchemaScore(schemaAnalysis, schemaIssues);
  const componentScore = calculateComponentScore(componentAnalysis, componentIssues);
  const contentScore = calculateContentScore(contentAnalysis, contentIssues);
  const editorialScore = calculateEditorialScore(editorialAnalysis, editorialIssues);
  const seoScore = calculateSEOScore(seoAnalysis, seoIssues);
  const performanceScore = calculatePerformanceScore(performanceAnalysis, performanceIssues);
  const bestPracticesScore = calculateBestPracticesScore(bestPracticesAnalysis, bestPracticesIssues);
  const governanceScore = calculateGovernanceScore(governanceAnalysis, governanceIssues);
  const architectureScore = calculateArchitectureScore(architectureAnalysis);
  const contentStrategyScore = calculateContentStrategyScore(contentStrategyAnalysis);
  
  // Step 7: Build category scores
  const categoryScores: CategoryScore[] = [
    { category: 'schema', score: schemaScore, maxScore: 100, issues: schemaIssues },
    { category: 'component', score: componentScore, maxScore: 100, issues: componentIssues },
    { category: 'content', score: contentScore, maxScore: 100, issues: contentIssues },
    { category: 'editorial', score: editorialScore, maxScore: 100, issues: editorialIssues },
    { category: 'seo', score: seoScore, maxScore: 100, issues: seoIssues },
    { category: 'performance', score: performanceScore, maxScore: 100, issues: performanceIssues },
    { category: 'best-practices', score: bestPracticesScore, maxScore: 100, issues: bestPracticesIssues },
    { category: 'governance', score: governanceScore, maxScore: 100, issues: governanceIssues },
  ];
  
  // Step 8: Calculate overall score (weighted average)
  const weights: Record<string, number> = {
    schema: 1.2,
    component: 0.8,
    content: 1.0,
    editorial: 0.9,
    seo: 1.1,
    performance: 1.2,
    'best-practices': 0.8,
    governance: 1.0,
  };
  
  let totalWeight = 0;
  let weightedSum = 0;
  for (const cat of categoryScores) {
    const weight = weights[cat.category] || 1;
    weightedSum += cat.score * weight;
    totalWeight += weight;
  }
  const overallScore = Math.round(weightedSum / totalWeight);
  
  // Step 9: Collect all issues (content strategy issues are prioritized)
  const allIssues: AuditIssue[] = [
    ...contentStrategyIssues,
    ...enumArchitectureIssues,
    ...schemaIssues,
    ...componentIssues,
    ...contentIssues,
    ...editorialIssues,
    ...seoIssues,
    ...performanceIssues,
    ...bestPracticesIssues,
    ...governanceIssues,
    ...architectureIssues,
  ].sort((a, b) => {
    // Sort by severity (critical first), then by category
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.category.localeCompare(b.category);
  });
  
  // Step 10: Generate strategic report (senior content strategist perspective)
  console.log('[Audit] Step 10: Generating strategic report...');
  const strategicReport = generateStrategicReport(
    schema,
    schemaAnalysis,
    componentAnalysis,
    contentAnalysis,
    editorialAnalysis,
    contentStrategyAnalysis,
    entryCounts
  );
  console.log('[Audit] Strategic report generated');
  
  // Step 11: Generate structural observations (high-level architectural insights)
  console.log('[Audit] Step 11: Generating structural observations...');
  const structuralObservations = analyzeStructuralObservations(
    schema,
    strategicReport,
    comprehensiveAssessment
  );
  console.log('[Audit] Structural observations generated');
  
  // Step 12: Run insights analyzers (payload, adoption, SEO readiness)
  console.log('[Audit] Step 12: Running insights analyzers...');
  const payloadEfficiency = analyzePayloadEfficiency(schema);
  console.log('[Audit] - payloadEfficiency done');
  const contentAdoption = analyzeContentAdoption(schema, entryCounts);
  console.log('[Audit] - contentAdoption done');
  const seoReadiness = analyzeSEOReadiness(schema, assetStats);
  console.log('[Audit] - seoReadiness done');
  
  // Step 13: Run content health analyzers (with fallbacks for robustness)
  console.log('[Audit] Step 13: Running content health analyzers...');
  let richTextUsage: RichTextUsageAnalysis;
  let emptyFields: EmptyFieldAnalysis;
  let contentFreshness: ContentFreshnessAnalysis;
  let enhancedPerformance: EnhancedPerformanceAnalysis;
  
  console.log('[Audit] - analyzeRichTextUsage');
  try {
    richTextUsage = await analyzeRichTextUsage(client, schema);
    console.log('[Audit] - richTextUsage done');
  } catch (e) {
    console.warn('[Audit] Rich text analysis failed, using defaults:', e);
    richTextUsage = getDefaultRichTextUsage();
  }
  
  console.log('[Audit] - analyzeEmptyFields');
  try {
    emptyFields = await analyzeEmptyFields(client, schema, entryCounts);
    console.log('[Audit] - emptyFields done');
  } catch (e) {
    console.warn('[Audit] Empty fields analysis failed, using defaults:', e);
    emptyFields = getDefaultEmptyFields();
  }
  
  console.log('[Audit] - analyzeContentFreshness');
  try {
    contentFreshness = await analyzeContentFreshness(client, schema, entryCounts);
    console.log('[Audit] - contentFreshness done');
  } catch (e) {
    console.warn('[Audit] Content freshness analysis failed, using defaults:', e);
    contentFreshness = getDefaultContentFreshness();
  }
  
  console.log('[Audit] - analyzeEnhancedPerformance');
  try {
    enhancedPerformance = await analyzeEnhancedPerformance(client, schema, entryCounts);
    console.log('[Audit] - enhancedPerformance done');
  } catch (e) {
    console.warn('[Audit] Enhanced performance analysis failed, using defaults:', e);
    enhancedPerformance = getDefaultEnhancedPerformance();
  }
  
  console.log('[Audit] Building final result...');
  
  const insights: InsightsAnalysis = {
    payloadEfficiency,
    contentAdoption,
    seoReadiness,
    richTextUsage,
    emptyFields,
    contentFreshness,
    enhancedPerformance,
  };
  
  return {
    connectionInfo: {
      endpoint,
      connectedAt: new Date(),
    },
    overallScore,
    categoryScores,
    schema: schemaAnalysis,
    components: componentAnalysis,
    content: contentAnalysis,
    editorial: editorialAnalysis,
    seo: seoAnalysis,
    performance: performanceAnalysis,
    bestPractices: bestPracticesAnalysis,
    governance: governanceAnalysis,
    architecture: architectureAnalysis,
    contentStrategy: contentStrategyAnalysis,
    strategicReport,
    allIssues,
    comprehensiveAssessment,
    structuralObservations,
    insights,
  };
}

export {
  analyzeSchema,
  analyzeComponents,
  analyzeContent,
  analyzeEditorial,
  analyzeSEO,
  analyzePerformance,
  analyzeBestPractices,
  analyzeGovernance,
  analyzeArchitecture,
  analyzeContentStrategy,
};

