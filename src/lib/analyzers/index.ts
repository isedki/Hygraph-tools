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

export async function runFullAudit(
  client: GraphQLClient,
  endpoint: string
): Promise<AuditResult> {
  // Step 1: Fetch schema via introspection
  const schema: HygraphSchema = await fetchSchema(client);
  
  // Step 2: Fetch entity counts for each model
  const entryCounts = await fetchEntityCounts(client, schema.models);
  
  // Step 3: Fetch asset statistics
  const assetStats = await fetchAssetStats(client);
  
  // Step 4: Run all analyzers
  const schemaAnalysis = analyzeSchema(schema, entryCounts);
  const componentAnalysis = analyzeComponents(schema);
  const contentAnalysis = analyzeContent(entryCounts, assetStats);
  const editorialAnalysis = analyzeEditorial(schema);
  const seoAnalysis = analyzeSEO(schema, assetStats);
  const performanceAnalysis = analyzePerformance(schema, schemaAnalysis, entryCounts, assetStats);
  const bestPracticesAnalysis = analyzeBestPractices(schema);
  const governanceAnalysis = analyzeGovernance(schema, contentAnalysis);
  const architectureAnalysis = analyzeArchitecture(schema);
  const contentStrategyAnalysis = analyzeContentStrategy(schema, entryCounts);
  const enumArchitectureAnalysis = analyzeEnumArchitecture(schema);
  
  // Step 4b: Run comprehensive assessment analyzers
  const structureAssessment = analyzeStructureOrganization(schema, entryCounts);
  const contentArchitectureAssessment = analyzeContentArchitecture(schema, entryCounts);
  const reusabilityAssessment = analyzeReusability(schema, entryCounts);
  const performanceAssessmentResult = analyzePerformanceAssessment(schema, entryCounts);
  const relationshipsAssessment = analyzeRelationshipsAssessment(schema, entryCounts);
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
  // Now passing all required data for comprehensive analysis
  const strategicReport = generateStrategicReport(
    schema,
    schemaAnalysis,
    componentAnalysis,
    contentAnalysis,
    editorialAnalysis,
    contentStrategyAnalysis,
    entryCounts
  );
  
  // Step 11: Generate structural observations (high-level architectural insights)
  const structuralObservations = analyzeStructuralObservations(
    schema,
    strategicReport,
    comprehensiveAssessment
  );
  
  // Step 12: Run insights analyzers (payload, adoption, SEO readiness)
  const payloadEfficiency = analyzePayloadEfficiency(schema);
  const contentAdoption = analyzeContentAdoption(schema, entryCounts);
  const seoReadiness = analyzeSEOReadiness(schema, assetStats);
  
  const insights: InsightsAnalysis = {
    payloadEfficiency,
    contentAdoption,
    seoReadiness,
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

