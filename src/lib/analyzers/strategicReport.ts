import type {
  HygraphSchema,
  SchemaAnalysis,
  ComponentAnalysis,
  ContentAnalysis,
  EditorialAnalysis,
  ContentStrategyAnalysis,
  StrategicAuditReport,
  StrategicFinding,
  OverallAssessment,
  EditorialEfficiency,
  ContentMaturity,
  GovernanceReadiness,
  RiskLevel,
  ActionItem,
  StrengthsAnalysis,
  ModelDeepDiveAnalysis,
  EnumOverviewAnalysis,
  RelationshipGraphAnalysis,
  ImplementationRoadmap,
  NamingConventionAnalysis,
  ComponentVariantGroup,
  StrategicRecommendation,
  EditorialVelocityEstimate,
  ContentMaturityAssessment,
  OmnichannelReadiness,
  PersonalizationReadiness,
} from '../types';
import { analyzeStrengths } from './strengths';
import { analyzeModelsInDepth } from './modelDeepDive';
import { analyzeEnumOverview } from './enumOverview';
import { analyzeRelationshipGraph } from './relationshipGraph';
import { generateImplementationRoadmap } from './implementationRoadmap';
import { analyzeContentMaturity } from './contentMaturity';
import { analyzeOmnichannelReadiness } from './omnichannelReadiness';
import { analyzeEditorialVelocity } from './editorialVelocity';
import { analyzePermissionModel } from './permissionModel';
import { analyzeLocalization } from './localization';
import { analyzePersonalization } from './personalization';

// Architecture labels for human-readable output
const ARCHITECTURE_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  'ecommerce': { 
    label: 'E-Commerce Platform', 
    icon: '🛒',
    description: 'Product catalogs, inventory, and transactional content'
  },
  'marketing-site': { 
    label: 'Marketing Website', 
    icon: '📢',
    description: 'Landing pages, campaigns, and conversion-focused content'
  },
  'multi-brand': { 
    label: 'Multi-Brand Architecture', 
    icon: '🏷️',
    description: 'Multiple brands sharing content infrastructure'
  },
  'multi-tenant': { 
    label: 'Multi-Tenant Platform', 
    icon: '🏢',
    description: 'Separate content spaces for different organizations'
  },
  'multi-region': { 
    label: 'Multi-Region Setup', 
    icon: '🌍',
    description: 'Regional content variations and localization'
  },
  'blog-publication': { 
    label: 'Blog & Publication', 
    icon: '📝',
    description: 'Articles, authors, and editorial workflows'
  },
  'saas-docs': { 
    label: 'SaaS Documentation', 
    icon: '📚',
    description: 'Technical documentation and guides'
  },
  'portfolio-showcase': { 
    label: 'Portfolio & Showcase', 
    icon: '🎨',
    description: 'Projects, case studies, and visual content'
  },
  'event-platform': { 
    label: 'Event Platform', 
    icon: '🎪',
    description: 'Events, sessions, and attendee management'
  },
  'mixed-unknown': { 
    label: 'Custom Implementation', 
    icon: '🔧',
    description: 'Mixed-purpose or custom content architecture'
  },
};

/**
 * Generate a comprehensive strategic audit report.
 * This is the main entry point that orchestrates all sub-analyzers.
 */
export function generateStrategicReport(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  components: ComponentAnalysis,
  content: ContentAnalysis,
  editorial: EditorialAnalysis,
  contentStrategy: ContentStrategyAnalysis,
  entryCounts: Record<string, { draft: number; published: number }>
): StrategicAuditReport {
  // Run all sub-analyzers
  const strengthsAnalysis = analyzeStrengths(schema, schemaAnalysis, components, content);
  const modelDeepDive = analyzeModelsInDepth(schema, entryCounts);
  const enumOverview = analyzeEnumOverview(schema);
  const relationshipGraph = analyzeRelationshipGraph(schema, entryCounts);
  const contentMaturityAssessment = analyzeContentMaturity(schema, schemaAnalysis, components, contentStrategy);
  const omnichannelReadiness = analyzeOmnichannelReadiness(schema, schemaAnalysis, components, contentStrategy);
  const velocityEstimate = analyzeEditorialVelocity(editorial, contentStrategy);
  const permissionModelReview = analyzePermissionModel(schema, contentStrategy);
  const localizationAssessment = analyzeLocalization(schema);
  const personalizationReadiness = analyzePersonalization(schema);
  
  // Generate findings
  const findings = generateFindings(schemaAnalysis, components, contentStrategy, editorial, modelDeepDive, enumOverview);
  
  // Generate naming analysis (lightweight version)
  const namingAnalysis = generateNamingAnalysis(schema);
  
  // Generate component reusability data
  const componentVariantGroups = analyzeComponentVariants(schema, components);
  
  // Generate implementation roadmap
  const implementationRoadmap = generateImplementationRoadmap(modelDeepDive, enumOverview);
  
  // Calculate system vs custom models
  const systemModels = schema.models.filter(m => m.isSystem).length;
  const customModels = schema.models.filter(m => !m.isSystem).length;
  
  // Generate executive summary with narrative
  const executiveSummary = generateExecutiveSummary(
    schema,
    schemaAnalysis,
    content,
    components,
    contentStrategy,
    strengthsAnalysis,
    findings
  );
  
  // Generate schema overview narratives
  const schemaOverview = generateSchemaOverviewNarratives(schema, schemaAnalysis, components, strengthsAnalysis);
  
  // Generate areas for improvement
  const areasForImprovement = generateAreasForImprovement(
    modelDeepDive,
    namingAnalysis,
    enumOverview,
    componentVariantGroups,
    schema
  );
  
  // Generate use case analysis
  const useCaseAnalysis = generateUseCaseAnalysis(contentStrategy);
  
  // Generate editorial experience
  const editorialExperience = generateEditorialExperience(contentStrategy, editorial, schemaAnalysis, velocityEstimate);
  
  // Generate content strategy assessment
  const contentStrategyAssessment = generateContentStrategy(
    schemaAnalysis,
    components,
    contentStrategy,
    contentMaturityAssessment,
    omnichannelReadiness,
    personalizationReadiness
  );
  
  // Generate performance considerations
  const performanceConsiderations = generatePerformanceConsiderations(schemaAnalysis, contentStrategy, content);
  
  // Generate legacy action plan (for backwards compatibility)
  const actionPlan = generateLegacyActionPlan(findings, contentStrategy);

  // Generate data-driven strategic recommendations
  const strategicRecommendations = generateDataDrivenRecommendations(
    schema,
    schemaAnalysis,
    components,
    contentStrategy,
    modelDeepDive,
    enumOverview,
    componentVariantGroups
  );

  return {
    executiveSummary: {
      ...executiveSummary,
      metrics: {
        models: schemaAnalysis.modelCount,
        customModels,
        systemModels,
        components: schemaAnalysis.componentCount,
        enums: schemaAnalysis.enumCount,
        contentEntries: content.totalEntries,
        reuseScore: components.reuseScore,
      },
    },
    schemaOverview,
    strengths: strengthsAnalysis,
    areasForImprovement,
    modelRecommendations: modelDeepDive,
    enumOverview,
    relationshipGraph,
    useCaseAnalysis,
    editorialExperience,
    contentStrategy: contentStrategyAssessment,
    governance: {
      permissionModelReview,
      localizationAssessment,
    },
    performanceConsiderations,
    implementationRoadmap,
    actionPlan,
    strategicRecommendations,
    findings,
  };
}

/**
 * Generate the narrative executive summary
 */
function generateExecutiveSummary(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  content: ContentAnalysis,
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis,
  strengths: StrengthsAnalysis,
  findings: StrategicFinding[]
): Omit<StrategicAuditReport['executiveSummary'], 'metrics'> {
  const criticalFindings = findings.filter(f => f.businessValue === 'high');
  const quickWins = findings.filter(f => f.effort === 'low' && f.businessValue !== 'low');
  
  // Determine overall assessment
  let overallAssessment: OverallAssessment = 'good';
  const highImpactIssues = criticalFindings.length;
  const editorialScore = contentStrategy.editorialExperience.score;
  const fitScore = contentStrategy.architectureFit.score;
  
  if (highImpactIssues >= 5 || editorialScore < 40 || fitScore < 40) {
    overallAssessment = 'critical';
  } else if (highImpactIssues >= 3 || editorialScore < 60 || fitScore < 60) {
    overallAssessment = 'needs-attention';
  } else if (highImpactIssues === 0 && editorialScore >= 80 && fitScore >= 80) {
    overallAssessment = 'excellent';
  }
  
  // Generate narrative summary
  const archLabel = ARCHITECTURE_LABELS[contentStrategy.detectedArchitecture.primary]?.label || 'content platform';
  const customModels = schema.models.filter(m => !m.isSystem).length;
  
  let narrativeSummary = `Your Hygraph schema is ${
    overallAssessment === 'excellent' ? 'well-architected and comprehensive' :
    overallAssessment === 'good' ? 'solid and functional' :
    overallAssessment === 'needs-attention' ? 'functional but showing some stress points' :
    'in need of attention'
  }, with **${customModels} content models** and **${schemaAnalysis.componentCount} components**`;
  
  if (archLabel !== 'Custom Implementation') {
    narrativeSummary += `, supporting a ${archLabel.toLowerCase()}`;
  }
  narrativeSummary += '.';
  
  // Add strength highlights
  if (strengths.strengths.length > 0) {
    narrativeSummary += ` The schema demonstrates ${
      strengths.strengths.length >= 4 ? 'excellent' :
      strengths.strengths.length >= 2 ? 'good' : 'some'
    } foundational practices`;
    
    const keyStrengths = strengths.strengths.slice(0, 2).map(s => s.title.toLowerCase());
    if (keyStrengths.length > 0) {
      narrativeSummary += ` including ${keyStrengths.join(' and ')}`;
    }
    narrativeSummary += '.';
  }
  
  // Add areas for attention
  if (criticalFindings.length > 0) {
    narrativeSummary += ` However, there are ${criticalFindings.length} area${criticalFindings.length > 1 ? 's' : ''} requiring attention that could improve maintainability and editor experience.`;
  }
  
  // Generate headline based on findings
  let headline = '';
  let subheadline = '';
  
  if (overallAssessment === 'excellent') {
    headline = `Your ${archLabel.toLowerCase()} is well-architected and editor-friendly`;
    subheadline = 'Minor optimizations can further improve content operations';
  } else if (overallAssessment === 'good') {
    headline = `Solid foundation with opportunities to improve editorial experience`;
    subheadline = `Your ${archLabel.toLowerCase()} structure works but could benefit from strategic refinements`;
  } else if (overallAssessment === 'needs-attention') {
    headline = `Schema structure is creating friction for content teams`;
    subheadline = 'Addressing key issues will significantly improve content velocity and quality';
  } else {
    headline = `Significant restructuring needed to support content goals`;
    subheadline = 'Current architecture is limiting scalability and creating editorial bottlenecks';
  }
  
  // Key findings (mix of issues and strengths)
  const keyFindings: string[] = [];
  
  // Add positive findings first
  if (strengths.strengths.length > 0) {
    keyFindings.push(strengths.strengths[0].title);
  }
  
  // Add critical issues
  criticalFindings.slice(0, 3).forEach(f => keyFindings.push(f.headline));
  
  // Fill with more positives if needed
  if (keyFindings.length < 4 && strengths.strengths.length > 1) {
    keyFindings.push(strengths.strengths[1].title);
  }
  
  // Quick wins
  const quickWinActions = quickWins.slice(0, 3).map(f => f.recommendation);
  
  // Strategic recommendations (high effort, high value)
  const strategicRecs = findings
    .filter(f => f.effort !== 'low' && f.businessValue === 'high')
    .slice(0, 3)
    .map(f => f.recommendation);
  
  return {
    overallAssessment,
    narrativeSummary,
    headline,
    subheadline,
    keyFindings,
    quickWins: quickWinActions,
    strategicRecommendations: strategicRecs,
  };
}

/**
 * Generate schema overview narratives
 */
function generateSchemaOverviewNarratives(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  components: ComponentAnalysis,
  strengths: StrengthsAnalysis
): StrategicAuditReport['schemaOverview'] {
  const customModels = schema.models.filter(m => !m.isSystem).length;
  const systemModels = schema.models.filter(m => m.isSystem).length;
  
  // Models narrative
  let modelsNarrative = `**${schemaAnalysis.modelCount} models total** (${customModels} custom, ${systemModels} system).`;
  if (customModels > 30) {
    modelsNarrative += ' Large schema may benefit from consolidation review.';
  } else if (customModels > 15) {
    modelsNarrative += ' Well-sized schema with room for growth.';
  } else {
    modelsNarrative += ' Focused schema suitable for current needs.';
  }
  
  // Components narrative
  let componentsNarrative = '';
  if (schemaAnalysis.componentCount === 0) {
    componentsNarrative = 'No components defined. Consider componentization for modular content.';
  } else {
    const usedComponents = components.components.filter(c => c.usedInModels.length > 0);
    componentsNarrative = `**${schemaAnalysis.componentCount} components** for modular content blocks.`;
    
    if (usedComponents.length >= schemaAnalysis.componentCount * 0.8) {
      componentsNarrative += ' Highly utilized component library.';
    } else if (components.unusedComponents.length > 0) {
      componentsNarrative += ` ${components.unusedComponents.length} unused component(s) could be removed.`;
    }
    
    if (strengths.componentHighlights.length > 0) {
      componentsNarrative += ` ${strengths.componentHighlights[0]}.`;
    }
  }
  
  // Enums narrative
  let enumsNarrative = '';
  if (schemaAnalysis.enumCount === 0) {
    enumsNarrative = 'No enumerations defined.';
  } else {
    enumsNarrative = `**${schemaAnalysis.enumCount} enumerations** define controlled options for styling, content types, and configuration.`;
  }
  
  return {
    modelsNarrative,
    componentsNarrative,
    enumsNarrative,
  };
}

/**
 * Generate areas for improvement section
 */
function generateAreasForImprovement(
  modelDeepDive: ModelDeepDiveAnalysis,
  namingAnalysis: NamingConventionAnalysis,
  enumOverview: EnumOverviewAnalysis,
  componentVariants: ComponentVariantGroup[],
  schema: HygraphSchema
): StrategicAuditReport['areasForImprovement'] {
  // Naming conventions
  const namingSummary = namingAnalysis.issues.length === 0
    ? 'Naming conventions are consistent across the schema.'
    : `${namingAnalysis.issues.length} naming inconsistencies identified that could improve readability.`;
  
  // Documentation
  const modelsNeedingDescriptions = modelDeepDive.criticalModels
    .filter(m => m.recommendations.some(r => r.recommendation.includes('description')))
    .map(m => m.modelName);
  
  const documentationSummary = modelsNeedingDescriptions.length === 0
    ? 'Models have adequate documentation.'
    : `${modelsNeedingDescriptions.length} models need better field descriptions for editor guidance.`;
  
  // Validation
  const missingRequired: { model: string; fields: string[] }[] = [];
  const missingPatterns: { model: string; field: string; suggestion: string }[] = [];
  
  for (const model of modelDeepDive.criticalModels) {
    if (model.requiredFieldsSuggestions.length > 0) {
      missingRequired.push({ model: model.modelName, fields: model.requiredFieldsSuggestions });
    }
    for (const v of model.validationSuggestions) {
      missingPatterns.push({ model: model.modelName, field: v.field, suggestion: v.validation });
    }
  }
  
  const validationSummary = missingRequired.length === 0 && missingPatterns.length === 0
    ? 'Validation rules are well-implemented.'
    : `Validation improvements needed: ${missingRequired.length} models need required fields, ${missingPatterns.length} fields need pattern validation.`;
  
  // Component reusability
  const componentSummary = componentVariants.length === 0
    ? 'Component architecture is clean with no obvious consolidation opportunities.'
    : `${componentVariants.length} component group(s) may benefit from consolidation using configuration instead of separate variants.`;
  
  // Localization
  const localizedModels = schema.models.filter(m => 
    m.fields.some(f => f.name === 'locale' || f.name === 'language')
  );
  const localizationSummary = localizedModels.length === 0
    ? 'No localization patterns detected. Document strategy if multi-language support is planned.'
    : `${localizedModels.length} models support localization. Ensure strategy is documented.`;
  
  // Reference cardinality
  const reviewNeeded: { model: string; field: string; current: string; suggestion: string }[] = [];
  for (const model of modelDeepDive.criticalModels) {
    for (const note of model.relationshipNotes) {
      if (note.includes('many-to-many')) {
        const match = note.match(/^(\w+)/);
        if (match) {
          reviewNeeded.push({
            model: model.modelName,
            field: match[1],
            current: 'many-to-many',
            suggestion: 'Verify if multiple selections are actually needed',
          });
        }
      }
    }
  }
  
  const cardinalitySummary = reviewNeeded.length === 0
    ? 'Relationship cardinality appears appropriate.'
    : `${reviewNeeded.length} many-to-many relationship(s) should be reviewed to confirm they\'re necessary.`;
  
  return {
    namingConventions: {
      summary: namingSummary,
      issues: namingAnalysis.issues,
      priority: namingAnalysis.issues.length > 5 ? 'high' : namingAnalysis.issues.length > 0 ? 'medium' : 'low',
      effort: 'low',
    },
    documentation: {
      summary: documentationSummary,
      modelsNeedingDescriptions,
      fieldsNeedingDescriptions: [],
      priority: modelsNeedingDescriptions.length > 3 ? 'high' : 'medium',
      effort: 'medium',
    },
    validation: {
      summary: validationSummary,
      missingRequired,
      missingUnique: [],
      missingPatterns,
      priority: missingRequired.length > 0 ? 'high' : 'medium',
      effort: 'medium',
    },
    componentReusability: {
      summary: componentSummary,
      variantGroups: componentVariants,
      priority: componentVariants.filter(v => v.shouldConsolidate).length > 2 ? 'medium' : 'low',
      effort: 'high',
    },
    localization: {
      summary: localizationSummary,
      recommendations: [
        'Document supported locales',
        'Specify default/fallback locale behavior',
        'Create editorial guidelines for translation workflows',
      ],
      priority: 'medium',
      effort: 'low',
    },
    referenceCardinality: {
      summary: cardinalitySummary,
      reviewNeeded,
      priority: reviewNeeded.length > 3 ? 'medium' : 'low',
      effort: 'low',
    },
  };
}

/**
 * Generate naming convention analysis (lightweight)
 */
function generateNamingAnalysis(schema: HygraphSchema): NamingConventionAnalysis {
  const issues: NamingConventionAnalysis['issues'] = [];
  
  // Check model naming
  for (const model of schema.models) {
    if (model.isSystem) continue;
    
    // Check for inconsistent casing
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(model.name)) {
      issues.push({
        item: model.name,
        current: model.name,
        issue: 'Model name doesn\'t follow PascalCase convention',
        suggestion: toPascalCase(model.name),
      });
    }
    
    // Check for version suffixes
    if (/v\d+$/i.test(model.name)) {
      issues.push({
        item: model.name,
        current: model.name,
        issue: 'Versioned model name - consider consolidating versions',
        suggestion: `Merge ${model.name} variants or deprecate old versions`,
      });
    }
  }
  
  // Check field naming
  for (const model of [...schema.models, ...schema.components]) {
    for (const field of model.fields) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name) && !field.name.startsWith('_')) {
        issues.push({
          item: `${model.name}.${field.name}`,
          current: field.name,
          issue: 'Field name doesn\'t follow camelCase convention',
          suggestion: toCamelCase(field.name),
        });
      }
    }
  }
  
  // Check component naming for prefix consistency
  const prefixedComponents = schema.components.filter(c => /^[A-Z]_/.test(c.name));
  const unprefixedComponents = schema.components.filter(c => !/^[A-Z]_/.test(c.name) && !c.isSystem);
  
  if (prefixedComponents.length > 0 && unprefixedComponents.length > 0) {
    for (const comp of unprefixedComponents) {
      issues.push({
        item: comp.name,
        current: comp.name,
        issue: 'Inconsistent component prefix - some components use prefixes, others don\'t',
        suggestion: `Consider adding prefix for consistency (e.g., C_${comp.name})`,
      });
    }
  }
  
  return {
    modelNaming: {
      pattern: 'PascalCase',
      examples: schema.models.slice(0, 3).map(m => m.name),
      status: issues.filter(i => i.issue.includes('Model')).length > 0 ? 'inconsistent' : 'consistent',
    },
    fieldNaming: {
      pattern: 'camelCase',
      examples: ['title', 'createdAt', 'featuredImage'],
      status: issues.filter(i => i.issue.includes('Field')).length > 0 ? 'inconsistent' : 'consistent',
    },
    componentNaming: {
      pattern: prefixedComponents.length > unprefixedComponents.length ? 'PrefixedPascalCase' : 'PascalCase',
      examples: schema.components.slice(0, 3).map(c => c.name),
      status: issues.filter(i => i.issue.includes('component')).length > 0 ? 'inconsistent' : 'consistent',
    },
    enumNaming: {
      pattern: 'PascalCase',
      examples: schema.enums.slice(0, 3).map(e => e.name),
      status: 'consistent',
    },
    systemFieldsConsistency: {
      pattern: 'Standard Hygraph fields',
      examples: ['id', 'createdAt', 'updatedAt', 'publishedAt'],
      status: 'consistent',
    },
    prefixPatterns: [],
    suggestedStandards: {
      models: 'PascalCase, singular (Article not Articles)',
      fields: 'camelCase, descriptive',
      components: 'PascalCase with optional grouping prefix',
      enums: 'PascalCase',
      booleans: 'is${Property} or should${Action}',
      dates: '${action}At or ${property}Date',
      references: '${modelName} (singular) or ${modelNames} (plural)',
    },
    issues,
  };
}

/**
 * Analyze component variants for consolidation opportunities
 */
function analyzeComponentVariants(
  schema: HygraphSchema,
  components: ComponentAnalysis
): ComponentVariantGroup[] {
  const variantGroups: ComponentVariantGroup[] = [];
  const processed = new Set<string>();
  
  // Find components that might be variants of each other
  for (const comp of schema.components) {
    if (processed.has(comp.name)) continue;
    
    // Extract base name (remove common suffixes/prefixes)
    const baseName = comp.name
      .replace(/^C_/, '')
      .replace(/(Primary|Secondary|Inline|Article|Shopfront|Award|Group)$/i, '')
      .trim();
    
    // Find potential variants
    const variants = schema.components.filter(c => {
      if (c.name === comp.name) return true;
      const otherBase = c.name
        .replace(/^C_/, '')
        .replace(/(Primary|Secondary|Inline|Article|Shopfront|Award|Group)$/i, '')
        .trim();
      return otherBase === baseName && otherBase.length >= 3;
    });
    
    if (variants.length >= 2) {
      // Calculate shared fields
      const allFieldNames = variants.map(v => v.fields.map(f => f.name));
      const sharedFields = allFieldNames[0].filter(f => 
        allFieldNames.every(fields => fields.includes(f))
      );
      
      // Calculate unique fields per variant
      const uniqueFields: Record<string, string[]> = {};
      for (const v of variants) {
        uniqueFields[v.name] = v.fields
          .map(f => f.name)
          .filter(f => !sharedFields.includes(f));
      }
      
      // Determine if consolidation makes sense
      const sharedRatio = sharedFields.length / Math.max(...variants.map(v => v.fields.length));
      const shouldConsolidate = sharedRatio > 0.5 && variants.length >= 3;
      
      variantGroups.push({
        baseName,
        variants: variants.map(v => v.name),
        sharedFields,
        uniqueFields,
        consolidationRecommendation: shouldConsolidate
          ? `Consider consolidating into one "${baseName}" component with a style/variant enum`
          : 'Specialization may be intentional - document reasoning',
        shouldConsolidate,
        effort: shouldConsolidate ? 'high' : 'low',
      });
      
      variants.forEach(v => processed.add(v.name));
    }
  }
  
  return variantGroups.filter(g => g.variants.length >= 2);
}

/**
 * Generate use case analysis
 */
function generateUseCaseAnalysis(
  contentStrategy: ContentStrategyAnalysis
): StrategicAuditReport['useCaseAnalysis'] {
  const arch = contentStrategy.detectedArchitecture;
  const archInfo = ARCHITECTURE_LABELS[arch.primary] || ARCHITECTURE_LABELS['mixed-unknown'];
  const fit = contentStrategy.architectureFit;
  
  let fitAssessment = '';
  if (fit.score >= 80) {
    fitAssessment = `Your schema is well-aligned with ${archInfo.label.toLowerCase()} requirements. The content model supports the expected workflows and content types.`;
  } else if (fit.score >= 60) {
    fitAssessment = `Your schema partially supports ${archInfo.label.toLowerCase()} patterns but has gaps that may limit effectiveness.`;
  } else {
    fitAssessment = `The current schema structure doesn't fully support ${archInfo.label.toLowerCase()} requirements. Consider restructuring to better match your use case.`;
  }
  
  return {
    detectedUseCase: archInfo.label,
    useCaseIcon: archInfo.icon,
    fitScore: fit.score,
    fitAssessment,
    strengths: fit.strengths.map(s => ({
      finding: s,
      businessImpact: 'Supports efficient content operations',
    })),
    gaps: fit.issues.map(issue => ({
      finding: issue.issue,
      businessImpact: issue.priority === 'high' 
        ? 'Significantly impacts content team productivity'
        : 'May cause friction in content workflows',
      recommendation: issue.recommendation,
    })),
  };
}

/**
 * Generate editorial experience assessment
 */
function generateEditorialExperience(
  contentStrategy: ContentStrategyAnalysis,
  editorial: EditorialAnalysis,
  schema: SchemaAnalysis,
  velocityEstimate: EditorialVelocityEstimate
): StrategicAuditReport['editorialExperience'] {
  const expScore = contentStrategy.editorialExperience.score;
  const complexModels = contentStrategy.editorialExperience.complexModels;
  const avgFields = editorial.averageFieldsPerModel;
  
  // Determine efficiency
  let efficiency: EditorialEfficiency = 'manageable';
  if (expScore >= 80 && complexModels.length === 0) {
    efficiency = 'streamlined';
  } else if (expScore < 50 || complexModels.length > 3) {
    efficiency = 'frustrating';
  } else if (expScore < 70 || complexModels.length > 1) {
    efficiency = 'cumbersome';
  }
  
  // Generate editor persona narrative
  let editorPersona = '';
  if (efficiency === 'streamlined') {
    editorPersona = 'Content editors will find this schema intuitive and efficient. Models are well-scoped, making content creation straightforward. New team members should be productive quickly.';
  } else if (efficiency === 'manageable') {
    editorPersona = 'Editors can work with this schema effectively, though some models require familiarity. New team members may need guidance on certain content types.';
  } else if (efficiency === 'cumbersome') {
    editorPersona = 'Editors will face friction with several content types. Complex models slow down content creation and increase the chance of errors. Training and documentation are essential.';
  } else {
    editorPersona = 'The current schema creates significant editorial friction. Large models overwhelm editors, inconsistent patterns cause confusion, and content velocity suffers. Restructuring is recommended.';
  }
  
  // Pain points
  const painPoints = complexModels.map(m => ({
    issue: `"${m.name}" is complex (${m.issues.join(', ')})`,
    impact: 'Slows content creation and increases errors',
    solution: m.simplification,
  }));
  
  // Add general pain points
  if (avgFields > 20) {
    painPoints.push({
      issue: `Models average ${avgFields.toFixed(0)} fields`,
      impact: 'Editors must navigate large forms',
      solution: 'Group related fields into components or split into focused models',
    });
  }
  
  // Positives
  const positives: string[] = [];
  if (schema.componentCount > 0) {
    positives.push(`Using ${schema.componentCount} component(s) for modular content`);
  }
  if (contentStrategy.editorialExperience.editorFriendlyModels.length > 0) {
    positives.push(`${contentStrategy.editorialExperience.editorFriendlyModels.length} models are editor-friendly`);
  }
  if (schema.twoWayReferences.length > 0) {
    positives.push('Bidirectional relations enable flexible content navigation');
  }
  
  // Overall assessment
  let overallAssessment = '';
  if (efficiency === 'streamlined') {
    overallAssessment = 'Editorial experience is excellent. Content teams should be productive and errors minimal.';
  } else if (efficiency === 'manageable') {
    overallAssessment = 'Editorial experience is acceptable but could be improved. Focus on simplifying complex models.';
  } else {
    overallAssessment = 'Editorial experience needs significant improvement. Prioritize restructuring complex models to unblock content teams.';
  }
  
  return {
    efficiency,
    editorPersona,
    painPoints,
    positives,
    overallAssessment,
    velocityEstimate,
  };
}

/**
 * Generate content strategy assessment
 */
function generateContentStrategy(
  schema: SchemaAnalysis,
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis,
  contentMaturityAssessment: ContentMaturityAssessment,
  omnichannelReadiness: OmnichannelReadiness,
  personalizationReadiness: PersonalizationReadiness
): StrategicAuditReport['contentStrategy'] {
  const compRate = contentStrategy.componentStrategy.componentReuseRate;
  const missingComps = contentStrategy.componentStrategy.missingComponents.length;
  
  // Determine maturity
  let maturityLevel: ContentMaturity = 'intermediate';
  let maturityDescription = '';
  
  if (schema.componentCount === 0 || compRate < 1) {
    maturityLevel = 'basic';
    maturityDescription = 'The schema uses a simple model-based approach without significant componentization. This works for smaller projects but limits reusability as content grows.';
  } else if (compRate >= 2 && missingComps === 0 && components.unusedComponents.length === 0) {
    maturityLevel = 'advanced';
    maturityDescription = 'The schema demonstrates mature content modeling with strong componentization and reuse patterns. Well-positioned for scale and content governance.';
  } else {
    maturityLevel = 'intermediate';
    maturityDescription = 'The schema shows good practices but has room to improve reusability and componentization. Building on this foundation will improve content operations.';
  }
  
  // Reusability assessment
  const reuseScore = Math.round(Math.min(100, compRate * 40 + (schema.componentCount * 5)));
  let reusabilityAssessment = '';
  if (reuseScore >= 70) {
    reusabilityAssessment = 'Strong content reuse patterns. Components are used effectively across models, reducing duplication.';
  } else if (reuseScore >= 40) {
    reusabilityAssessment = 'Moderate reuse. Some componentization exists but opportunities remain to reduce duplication.';
  } else {
    reusabilityAssessment = 'Limited reuse. Content is largely duplicated across models. Componentization would improve consistency.';
  }
  
  // Scalability
  let scalabilityAssessment = '';
  if (schema.modelCount > 50) {
    scalabilityAssessment = 'Large schema may face governance challenges as it grows. Consider consolidation strategies.';
  } else if (schema.modelCount > 30) {
    scalabilityAssessment = 'Schema size is approaching complexity limits. Plan for governance as content types expand.';
  } else {
    scalabilityAssessment = 'Schema is well-sized for current needs with room to grow.';
  }
  
  // Governance readiness
  let governanceReadiness: GovernanceReadiness = 'needs-work';
  let governanceNotes = '';
  
  if (schema.componentCount > 0 && components.unusedComponents.length === 0 && missingComps === 0) {
    governanceReadiness = 'ready';
    governanceNotes = 'Clean schema with no unused components or obvious gaps. Ready for team-wide content governance.';
  } else if (components.unusedComponents.length > 3 || missingComps > 3) {
    governanceReadiness = 'missing';
    governanceNotes = 'Schema needs cleanup before implementing governance. Address unused components and fill gaps first.';
  } else {
    governanceReadiness = 'needs-work';
    governanceNotes = 'Schema is partially ready for governance. Address identified issues before formalizing processes.';
  }
  
  return {
    maturity: maturityLevel,
    maturityDescription,
    contentMaturityAssessment,
    reusabilityScore: reuseScore,
    reusabilityAssessment,
    scalabilityAssessment,
    governanceReadiness,
    governanceNotes,
    omnichannelReadiness,
    personalizationReadiness,
  };
}

/**
 * Generate performance considerations
 */
function generatePerformanceConsiderations(
  schema: SchemaAnalysis,
  contentStrategy: ContentStrategyAnalysis,
  content: ContentAnalysis
): StrategicAuditReport['performanceConsiderations'] {
  const deepPaths = contentStrategy.deepNesting.problematicPaths;
  const bottlenecks: { issue: string; impact: string }[] = [];
  const queryOptimization: string[] = [];
  const indexRecommendations: string[] = [];
  const cacheStrategy: string[] = [];
  const optimizations: string[] = [];
  
  // Check for deep nesting
  const veryDeepPaths = deepPaths.filter(p => p.depth >= 5);
  if (veryDeepPaths.length > 0) {
    bottlenecks.push({
      issue: `${veryDeepPaths.length} relation chain(s) with 5+ levels`,
      impact: 'Deep queries are slower and return larger payloads',
    });
    queryOptimization.push('Use GraphQL fragments to limit query depth');
    queryOptimization.push('Avoid requesting all nested relations unnecessarily');
  }
  
  // Check for high relation count
  const relationDensity = schema.relationCount / Math.max(schema.modelCount, 1);
  if (relationDensity > 5) {
    bottlenecks.push({
      issue: 'High relation density across models',
      impact: 'Complex queries may time out or return excessive data',
    });
    queryOptimization.push('Implement query pagination for large result sets');
  }
  
  // Check for large schema
  if (schema.totalFields > 500) {
    bottlenecks.push({
      issue: `Large schema with ${schema.totalFields} total fields`,
      impact: 'Schema editor may be slow; introspection queries larger',
    });
  }
  
  // Index recommendations
  indexRecommendations.push('Ensure slug fields are indexed (common for URL routing)');
  indexRecommendations.push('Consider indexes on frequently filtered fields (status, category, site)');
  
  // Cache strategy
  cacheStrategy.push('Cache stable content (categories, sites, authors)');
  cacheStrategy.push('Set appropriate cache TTLs for frequently accessed content');
  if (content.totalEntries > 1000) {
    cacheStrategy.push('Implement CDN caching for high-traffic content');
  }
  
  // Determine overall risk
  let overallRisk: RiskLevel = 'low';
  let riskAssessment = '';
  
  if (veryDeepPaths.length > 3 || bottlenecks.length > 3) {
    overallRisk = 'high';
    riskAssessment = 'Multiple performance risks identified. Address before scaling content or traffic.';
  } else if (veryDeepPaths.length > 0 || bottlenecks.length > 1) {
    overallRisk = 'medium';
    riskAssessment = 'Some performance considerations to address. Monitor query performance as content grows.';
  } else {
    overallRisk = 'low';
    riskAssessment = 'No significant performance risks identified. Schema is well-optimized for queries.';
    optimizations.push('Continue monitoring as content volume grows');
  }
  
  return {
    overallRisk,
    riskAssessment,
    queryOptimization,
    indexRecommendations,
    cacheStrategy,
    potentialBottlenecks: bottlenecks,
    optimizationOpportunities: optimizations,
  };
}

/**
 * Generate strategic findings
 */
function generateFindings(
  schema: SchemaAnalysis,
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis,
  editorial: EditorialAnalysis,
  modelDeepDive: ModelDeepDiveAnalysis,
  enumOverview: EnumOverviewAnalysis
): StrategicFinding[] {
  const findings: StrategicFinding[] = [];
  
  // Editorial friction from complex models
  for (const model of contentStrategy.editorialExperience.complexModels) {
    findings.push({
      id: `editorial-friction-${model.name}`,
      headline: `Editorial Bottleneck in ${model.name}`,
      situation: `The "${model.name}" model has ${model.issues.join(', ')}, creating friction for content editors.`,
      impact: 'Editors spend more time navigating forms. Error rates increase with complexity. Content velocity decreases.',
      recommendation: model.simplification,
      effort: model.issues.length > 2 ? 'high' : 'medium',
      businessValue: 'high',
      category: 'editorial',
      affectedItems: [model.name],
    });
  }
  
  // Missing components (reusability opportunity)
  for (const mc of contentStrategy.componentStrategy.missingComponents) {
    findings.push({
      id: `missing-component-${mc.description.substring(0, 20)}`,
      headline: 'Content Reuse Opportunity',
      situation: mc.description,
      impact: `Duplication across ${mc.affectedModels.length} models increases maintenance burden and risks inconsistency.`,
      recommendation: mc.recommendation,
      effort: 'medium',
      businessValue: 'medium',
      category: 'reusability',
      affectedItems: mc.affectedModels,
    });
  }
  
  // Duplicate model patterns
  for (const dup of contentStrategy.modelUsage.duplicateModels) {
    findings.push({
      id: `duplicate-models-${dup.models.join('-')}`,
      headline: 'Redundant Content Models',
      situation: `Models "${dup.models.join('" and "')}" share ${dup.sharedFields.length} fields (${dup.sharedFields.slice(0, 3).join(', ')}...).`,
      impact: 'Duplicated models confuse editors and complicate content governance. Changes must be made in multiple places.',
      recommendation: dup.recommendation,
      effort: 'high',
      businessValue: 'high',
      category: 'governance',
      affectedItems: dup.models,
    });
  }
  
  // Enum architecture issues
  for (const enumPurpose of enumOverview.architecturalEnums) {
    if (enumPurpose.healthStatus === 'critical') {
    findings.push({
        id: `enum-architecture-${enumPurpose.name}`,
        headline: `Enum-Based Tenancy: ${enumPurpose.name}`,
        situation: `Using "${enumPurpose.name}" enum for brand/site/tenant segmentation limits scalability.`,
        impact: 'Cannot add metadata to brands/sites. Filtering becomes complex. Adding new values requires schema changes.',
        recommendation: 'Create a dedicated content model with proper relationships and metadata fields.',
        effort: 'high',
        businessValue: 'high',
        category: 'architecture',
        affectedItems: [enumPurpose.name],
        examples: enumPurpose.values.slice(0, 5),
      });
    }
  }
  
  // Deep nesting performance
  const veryDeepPaths = contentStrategy.deepNesting.problematicPaths.filter(p => p.depth >= 5);
  if (veryDeepPaths.length > 0) {
    findings.push({
      id: 'deep-nesting-performance',
      headline: 'Deep Relation Chains May Impact Frontend Performance',
      situation: `${veryDeepPaths.length} relation path(s) with 5+ levels: ${veryDeepPaths[0].path.join(' → ')}`,
      impact: 'Deep queries return larger payloads and are slower. Frontend developers may over-fetch data.',
      recommendation: 'Consider flattening frequently-queried paths or adding direct references for common access patterns.',
      effort: 'medium',
      businessValue: 'medium',
      category: 'performance',
    });
  }
  
  // Validation improvements
  const modelsNeedingValidation = modelDeepDive.criticalModels.filter(m => m.requiredFieldsSuggestions.length > 0);
  if (modelsNeedingValidation.length > 0) {
      findings.push({
      id: 'validation-improvements',
      headline: 'Missing Required Field Validations',
      situation: `${modelsNeedingValidation.length} critical models have fields that should be required (title, slug, etc.)`,
      impact: 'Incomplete content can be saved, causing frontend errors and inconsistent user experience.',
      recommendation: 'Add required field validations to ensure content completeness.',
      effort: 'low',
        businessValue: 'high',
      category: 'validation',
      affectedItems: modelsNeedingValidation.map(m => m.modelName),
      });
  }
  
  // Component reuse positive (strength)
  if (components.reuseScore > 60 && contentStrategy.componentStrategy.wellDesigned.length > 0) {
    findings.push({
      id: 'good-component-reuse',
      headline: 'Strong Component Reuse Pattern',
      situation: `${contentStrategy.componentStrategy.wellDesigned.length} well-designed component(s) are reused across models.`,
      impact: 'Good reuse patterns reduce duplication and improve consistency.',
      recommendation: 'Continue this pattern for new content types.',
      effort: 'low',
      businessValue: 'high',
      category: 'reusability',
    });
  }
  
  // Sort findings by business value then effort (high value, low effort first)
  findings.sort((a, b) => {
    const valueOrder = { high: 0, medium: 1, low: 2 };
    const effortOrder = { low: 0, medium: 1, high: 2 };
    const valueDiff = valueOrder[a.businessValue] - valueOrder[b.businessValue];
    if (valueDiff !== 0) return valueDiff;
    return effortOrder[a.effort] - effortOrder[b.effort];
  });
  
  return findings;
}

/**
 * Generate legacy action plan (for backwards compatibility)
 */
function generateLegacyActionPlan(
  findings: StrategicFinding[],
  contentStrategy: ContentStrategyAnalysis
): StrategicAuditReport['actionPlan'] {
  const immediate: ActionItem[] = [];
  const shortTerm: ActionItem[] = [];
  const longTerm: ActionItem[] = [];
  
  // Quick wins (low effort)
  const quickWins = findings.filter(f => f.effort === 'low');
  for (const win of quickWins.slice(0, 3)) {
    immediate.push({
      action: win.recommendation,
      effort: 'low',
      impact: win.impact,
    });
  }
  
  // Medium effort items for short term
  const mediumEffort = findings.filter(f => f.effort === 'medium' && f.businessValue !== 'low');
  for (const item of mediumEffort.slice(0, 4)) {
    shortTerm.push({
      action: item.recommendation,
      effort: 'medium',
      impact: item.impact,
    });
  }
  
  // High effort, strategic items
  const strategic = findings.filter(f => f.effort === 'high' && f.businessValue === 'high');
  for (const item of strategic.slice(0, 3)) {
    longTerm.push({
      action: item.recommendation,
      effort: 'high',
      impact: item.impact,
    });
  }
  
  return { immediate, shortTerm, longTerm };
}

/**
 * Generate data-driven strategic recommendations based on actual metrics
 */
function generateDataDrivenRecommendations(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis,
  modelDeepDive: ModelDeepDiveAnalysis,
  enumOverview: EnumOverviewAnalysis,
  componentVariants: ComponentVariantGroup[]
): StrategicRecommendation[] {
  const recommendations: StrategicRecommendation[] = [];

  // 1. Component Reuse Recommendation
  const duplicatePatterns = components.duplicateFieldPatterns;
  const missingComponents = contentStrategy.componentStrategy.missingComponents;
  
  if (duplicatePatterns.length > 0 || missingComponents.length > 0) {
    const affectedModelsCount = new Set([
      ...duplicatePatterns.flatMap(d => d.foundInModels),
      ...missingComponents.flatMap(m => m.affectedModels),
    ]).size;
    
    const patternCount = duplicatePatterns.length + missingComponents.length;
    
    if (patternCount > 0 && affectedModelsCount >= 2) {
      recommendations.push({
        id: 'component-reuse',
        title: 'Increase Component Reuse',
        finding: `**${patternCount} field pattern${patternCount > 1 ? 's' : ''}** duplicated across **${affectedModelsCount} models** without componentization.`,
        recommendation: 'Create shared components for repeated field patterns to reduce duplication and ensure consistency.',
        impact: 'Editors work with consistent interfaces. Updates propagate automatically. Faster content creation.',
        metrics: [
          { label: 'Duplicate Patterns', value: patternCount },
          { label: 'Affected Models', value: affectedModelsCount },
          { label: 'Current Reuse Score', value: `${components.reuseScore}%` },
        ],
        priority: patternCount >= 3 ? 'high' : 'medium',
        effort: 'medium',
        category: 'editor-experience',
      });
    }
  }

  // 2. Component Consolidation Recommendation
  const consolidatableVariants = componentVariants.filter(v => v.shouldConsolidate);
  if (consolidatableVariants.length > 0) {
    const totalVariants = consolidatableVariants.reduce((sum, g) => sum + g.variants.length, 0);
    const exampleGroup = consolidatableVariants[0];
    
    recommendations.push({
      id: 'component-consolidation',
      title: 'Consolidate Component Variants',
      finding: `**${totalVariants} component variants** across ${consolidatableVariants.length} groups share significant fields (e.g., ${exampleGroup.baseName}: ${exampleGroup.variants.slice(0, 3).join(', ')}).`,
      recommendation: 'Merge variant components into configurable base components with style/variant enum fields.',
      impact: 'Simpler component library. Easier for editors to understand. Reduced maintenance burden.',
      metrics: [
        { label: 'Variant Groups', value: consolidatableVariants.length },
        { label: 'Total Variants', value: totalVariants },
        { label: 'Avg Shared Fields', value: `${Math.round(exampleGroup.sharedFields.length / exampleGroup.variants.length * 100)}%` },
      ],
      priority: totalVariants >= 5 ? 'high' : 'medium',
      effort: 'high',
      category: 'editor-experience',
    });
  }

  // 3. Model Simplification Recommendation
  const complexModels = contentStrategy.editorialExperience.complexModels;
  const modelsOver25Fields = complexModels.filter(m => 
    m.issues.some(i => i.includes('Too many fields'))
  );
  
  if (modelsOver25Fields.length > 0) {
    const modelNames = modelsOver25Fields.slice(0, 3).map(m => m.name).join(', ');
    const fieldCounts = modelDeepDive.criticalModels
      .filter(m => modelsOver25Fields.some(c => c.name === m.modelName))
      .map(m => `${m.modelName}: ${m.fieldCount}`)
      .slice(0, 3)
      .join(', ');
    
    recommendations.push({
      id: 'model-simplification',
      title: 'Simplify Complex Models',
      finding: `**${modelsOver25Fields.length} model${modelsOver25Fields.length > 1 ? 's' : ''}** exceed recommended field count (${fieldCounts || modelNames}).`,
      recommendation: 'Break down into focused models or group fields using components and field tabs.',
      impact: 'Editors navigate smaller forms. Reduced cognitive load. Fewer errors during content creation.',
      metrics: [
        { label: 'Complex Models', value: modelsOver25Fields.length },
        { label: 'Avg Fields in Complex', value: Math.round(modelsOver25Fields.reduce((sum, m) => {
          const match = m.issues.find(i => i.includes('Too many fields'));
          const fieldCount = match ? parseInt(match.match(/\d+/)?.[0] || '25') : 25;
          return sum + fieldCount;
        }, 0) / modelsOver25Fields.length) },
      ],
      priority: modelsOver25Fields.length >= 3 ? 'high' : 'medium',
      effort: 'high',
      category: 'editor-experience',
    });
  }

  // 4. Enum to Model Migration Recommendation
  const criticalEnums = enumOverview.architecturalEnums.filter(e => e.healthStatus === 'critical');
  if (criticalEnums.length > 0) {
    const totalValues = criticalEnums.reduce((sum, e) => sum + e.values.length, 0);
    const totalUsage = criticalEnums.reduce((sum, e) => sum + e.usageCount, 0);
    const enumNames = criticalEnums.map(e => e.name).join(', ');
    
    recommendations.push({
      id: 'enum-to-model',
      title: 'Migrate Tenancy Enums to Models',
      finding: `**${criticalEnums.length} enum${criticalEnums.length > 1 ? 's' : ''}** (${enumNames}) with **${totalValues} values** used for brand/site segmentation across **${totalUsage} references**.`,
      recommendation: 'Create dedicated content models (Brand, Site, etc.) with proper relationships to enable metadata and scale.',
      impact: 'Add brand logos, settings, and metadata. No schema changes for new brands. Better content filtering.',
      metrics: [
        { label: 'Tenancy Enums', value: criticalEnums.length },
        { label: 'Total Values', value: totalValues },
        { label: 'Model References', value: totalUsage },
      ],
      priority: 'high',
      effort: 'high',
      category: 'scalability',
    });
  }

  // 5. Documentation Recommendation
  const modelsNeedingDocs = modelDeepDive.criticalModels.filter(m => 
    m.recommendations.some(r => r.recommendation.includes('description'))
  );
  
  if (modelsNeedingDocs.length > 0) {
    const totalFields = modelsNeedingDocs.reduce((sum, m) => sum + m.fieldCount, 0);
    const modelNames = modelsNeedingDocs.slice(0, 3).map(m => m.modelName).join(', ');
    
    recommendations.push({
      id: 'add-documentation',
      title: 'Add Field Documentation',
      finding: `**${modelsNeedingDocs.length} critical model${modelsNeedingDocs.length > 1 ? 's' : ''}** (${modelNames}) lack field descriptions.`,
      recommendation: 'Add descriptions to fields explaining purpose, format requirements, and usage context.',
      impact: 'Editors understand expectations. Reduced support questions. Faster onboarding for new team members.',
      metrics: [
        { label: 'Models Needing Docs', value: modelsNeedingDocs.length },
        { label: 'Total Fields', value: totalFields },
      ],
      priority: modelsNeedingDocs.length >= 5 ? 'high' : 'medium',
      effort: 'low',
      category: 'editor-experience',
    });
  }

  // 6. Taxonomy Enhancement Recommendation
  const taxonomyModels = schema.models.filter(m => 
    /^(category|topic|tag|taxonomy)s?$/i.test(m.name) && !m.isSystem
  );
  const contentModelsCount = schema.models.filter(m => 
    /^(article|post|page|product|event)s?$/i.test(m.name) && !m.isSystem
  ).length;
  
  if (taxonomyModels.length < 2 && contentModelsCount >= 2) {
    recommendations.push({
      id: 'taxonomy-enhancement',
      title: 'Enhance Content Taxonomy',
      finding: `Only **${taxonomyModels.length} taxonomy model${taxonomyModels.length !== 1 ? 's' : ''}** for **${contentModelsCount} content types**.`,
      recommendation: 'Add Category, Topic, or Tag models to improve content organization and discoverability.',
      impact: 'Better content filtering. Improved search and navigation. Easier content curation.',
      metrics: [
        { label: 'Taxonomy Models', value: taxonomyModels.length },
        { label: 'Content Types', value: contentModelsCount },
      ],
      priority: 'medium',
      effort: 'medium',
      category: 'content-strategy',
    });
  }

  // 7. Unused Components Recommendation
  if (components.unusedComponents.length >= 3) {
    recommendations.push({
      id: 'cleanup-unused',
      title: 'Clean Up Unused Components',
      finding: `**${components.unusedComponents.length} components** are defined but not used in any model.`,
      recommendation: 'Review and remove unused components to simplify the schema and reduce confusion.',
      impact: 'Cleaner schema. Less confusion for editors. Easier maintenance.',
      metrics: [
        { label: 'Unused Components', value: components.unusedComponents.length },
        { label: 'Total Components', value: schemaAnalysis.componentCount },
      ],
      priority: 'low',
      effort: 'low',
      category: 'governance',
    });
  }

  // Sort by priority (high first) then effort (low first)
  recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const effortOrder = { low: 0, medium: 1, high: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return effortOrder[a.effort] - effortOrder[b.effort];
  });

  return recommendations;
}

// Helper functions
function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^./, s => s.toUpperCase());
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^./, s => s.toLowerCase());
}
