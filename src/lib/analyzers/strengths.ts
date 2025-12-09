import type { 
  HygraphSchema, 
  SchemaAnalysis, 
  ComponentAnalysis, 
  ContentAnalysis,
  StrengthsAnalysis, 
  SchemaStrength 
} from '../types';
import { filterSystemComponents, filterSystemEnums, filterSystemModels } from './systemFilters';

/**
 * Analyzes the schema to identify strengths and what's working well.
 * This provides a balanced view - not just problems, but also good patterns.
 */
export function analyzeStrengths(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  componentAnalysis: ComponentAnalysis,
  contentAnalysis: ContentAnalysis
): StrengthsAnalysis {
  const strengths: SchemaStrength[] = [];
  const architectureHighlights: string[] = [];
  const componentHighlights: string[] = [];
  const taxonomyHighlights: string[] = [];

  // Filter out system items for analysis
  const customComponents = filterSystemComponents(schema.components || []);
  const customEnums = filterSystemEnums(schema.enums || []);
  const customModels = filterSystemModels(schema.models);

  // ============================================
  // Component Architecture Strengths
  // ============================================
  if (customComponents.length > 0) {
    const usedComponents = componentAnalysis.components.filter(c => c.usedInModels.length > 0);
    const highlyReusedComponents = componentAnalysis.components.filter(c => c.usedInModels.length >= 3);
    
    if (componentAnalysis.reuseScore >= 50) {
      strengths.push({
        id: 'excellent-component-architecture',
        title: 'Excellent Component Architecture',
        description: `Your schema leverages ${customComponents.length} components for modular, reusable content blocks.`,
        impact: 'This approach provides flexibility for page builders and reduces duplication.',
        category: 'components',
        examples: getComponentExamples(customComponents),
      });
      componentHighlights.push(`${customComponents.length} reusable components defined`);
    }
    
    if (highlyReusedComponents.length > 0) {
      componentHighlights.push(`${highlyReusedComponents.length} components are highly reused across models`);
    }
    
    if (usedComponents.length > 0) {
      const blockComponents = usedComponents.filter(c => 
        /block|card|banner|section|hero|cta/i.test(c.name)
      );
      if (blockComponents.length > 0) {
        componentHighlights.push(`Rich content blocks: ${blockComponents.map(c => c.name).slice(0, 5).join(', ')}`);
      }
    }
  }

  // ============================================
  // Taxonomy & Organization Strengths
  // ============================================
  const taxonomyModels = customModels.filter(m => 
    /category|topic|tag|taxonomy|type/i.test(m.name)
  );
  
  if (taxonomyModels.length > 0) {
    strengths.push({
      id: 'thoughtful-content-taxonomy',
      title: 'Thoughtful Content Taxonomy',
      description: `Clear hierarchical organization with ${taxonomyModels.length} dedicated taxonomy models.`,
      impact: 'Supports scalable, well-organized content discovery.',
      category: 'taxonomy',
      examples: taxonomyModels.map(m => m.name),
    });
    taxonomyHighlights.push(`${taxonomyModels.length} taxonomy models for content classification`);
  }

  // ============================================
  // Multi-Site/Multi-Brand Support
  // ============================================
  const siteModel = customModels.find(m => /^site$/i.test(m.name));
  const brandModel = customModels.find(m => /^(brand|shop|store)$/i.test(m.name));
  const siteRelations = countModelReferences(schema, 'site');
  const brandRelations = countModelReferences(schema, 'brand|shop|store');
  
  if (siteModel && siteRelations >= 2) {
    strengths.push({
      id: 'multi-site-support',
      title: 'Multi-Site Support',
      description: `Dedicated Site model with relationships across ${siteRelations} content types.`,
      impact: 'Excellent foundation for managing content across multiple platforms.',
      category: 'architecture',
      examples: [`Site model linked to ${siteRelations} models`],
    });
    architectureHighlights.push('Multi-site architecture properly implemented');
  }
  
  if (brandModel && brandRelations >= 2) {
    strengths.push({
      id: 'multi-brand-support',
      title: 'Multi-Brand Architecture',
      description: `Dedicated Brand/Shop model enabling brand-specific content management.`,
      impact: 'Supports brand-specific content and settings at scale.',
      category: 'architecture',
      examples: [`Brand model linked to ${brandRelations} content types`],
    });
    architectureHighlights.push('Multi-brand architecture with proper model relations');
  }

  // ============================================
  // Form Architecture Strengths
  // ============================================
  const formModel = customModels.find(m => /^form$/i.test(m.name));
  const formComponents = customComponents.filter(c => 
    /form|input|field|validator|checkbox|radio|select|textarea/i.test(c.name)
  );
  
  if (formModel || formComponents.length >= 3) {
    strengths.push({
      id: 'comprehensive-form-architecture',
      title: 'Comprehensive Form Architecture',
      description: formComponents.length > 0 
        ? `${formComponents.length} form-related components for structured form management.`
        : 'Dedicated Form model with proper field structure.',
      impact: 'Enables consistent form management across the platform.',
      category: 'forms',
      examples: formComponents.slice(0, 5).map(c => c.name),
    });
  }

  // ============================================
  // SEO & Metadata Strengths
  // ============================================
  const seoComponent = customComponents.find(c => /^seo$/i.test(c.name));
  const modelsWithSeo = customModels.filter(m => 
    m.fields.some(f => /seo|meta/i.test(f.name) || /seo/i.test(f.type))
  );
  
  if (seoComponent || modelsWithSeo.length >= 3) {
    strengths.push({
      id: 'seo-content-metadata',
      title: 'SEO & Content Metadata',
      description: seoComponent 
        ? 'Reusable SEO component embedded across content models.'
        : `${modelsWithSeo.length} models include SEO/meta fields.`,
      impact: 'Supports consistent SEO practices across content types.',
      category: 'seo',
      examples: seoComponent ? ['SEO component'] : modelsWithSeo.slice(0, 3).map(m => m.name),
    });
  }

  // ============================================
  // Content Workflow Strengths
  // ============================================
  if (contentAnalysis.draftRatio > 0 && contentAnalysis.draftRatio < 0.8) {
    const publishedRatio = Math.round((1 - contentAnalysis.draftRatio) * 100);
    architectureHighlights.push(`${publishedRatio}% content published - healthy publishing workflow`);
  }

  // ============================================
  // Bidirectional Relations (Feature, not bug)
  // ============================================
  if (schemaAnalysis.twoWayReferences.length > 0) {
    strengths.push({
      id: 'bidirectional-relations',
      title: 'Smart Content Navigation',
      description: `${schemaAnalysis.twoWayReferences.length} bidirectional relationships enable flexible content navigation.`,
      impact: 'Editors can navigate content from multiple entry points.',
      category: 'architecture',
    });
  }

  // ============================================
  // Modular Content Models
  // ============================================
  const avgFieldsPerModel = schemaAnalysis.totalFields / Math.max(schemaAnalysis.modelCount, 1);
  if (avgFieldsPerModel <= 20 && avgFieldsPerModel >= 5) {
    strengths.push({
      id: 'well-scoped-models',
      title: 'Well-Scoped Content Models',
      description: `Models average ${avgFieldsPerModel.toFixed(0)} fields - appropriately sized for editorial efficiency.`,
      impact: 'Editors work with manageable forms, reducing complexity and errors.',
      category: 'architecture',
    });
  }

  // ============================================
  // Enum Usage for Styling/Layout
  // ============================================
  const stylingEnums = customEnums.filter(e => 
    /color|theme|size|variant|style|alignment|position|width|layout/i.test(e.name)
  );
  
  if (stylingEnums.length > 0) {
    strengths.push({
      id: 'enum-styling-control',
      title: 'Controlled Styling Options',
      description: `${stylingEnums.length} enums provide controlled styling/layout choices for editors.`,
      impact: 'Editors have flexibility within guardrails, maintaining design consistency.',
      category: 'workflow',
      examples: stylingEnums.slice(0, 5).map(e => e.name),
    });
  }

  // ============================================
  // Rich Content Entry
  // ============================================
  if (contentAnalysis.totalEntries > 100) {
    strengths.push({
      id: 'active-content-platform',
      title: 'Active Content Platform',
      description: `${contentAnalysis.totalEntries.toLocaleString()} content entries across the platform.`,
      impact: 'Schema is actively used for real content production.',
      category: 'scalability',
    });
  }

  // ============================================
  // Good Component/Model Ratio
  // ============================================
  const componentToModelRatio = customComponents.length / Math.max(customModels.length, 1);
  if (componentToModelRatio >= 1.5 && customComponents.length >= 5) {
    strengths.push({
      id: 'strong-componentization',
      title: 'Strong Componentization Strategy',
      description: `${componentToModelRatio.toFixed(1)}:1 component-to-model ratio indicates mature modular design.`,
      impact: 'Content is highly modular and reusable across different contexts.',
      category: 'architecture',
    });
    architectureHighlights.push('Excellent component-to-model ratio');
  }

  return {
    strengths,
    architectureHighlights,
    componentHighlights,
    taxonomyHighlights,
  };
}

/**
 * Get example component names grouped by type
 */
function getComponentExamples(components: HygraphSchema['components']): string[] {
  const examples: string[] = [];
  
  const blocks = components.filter(c => /block|section|hero|banner/i.test(c.name));
  const cards = components.filter(c => /card/i.test(c.name));
  const forms = components.filter(c => /form|input|field/i.test(c.name));
  const rich = components.filter(c => /video|carousel|accordion|gallery/i.test(c.name));
  
  if (blocks.length > 0) {
    examples.push(`UI Blocks: ${blocks.slice(0, 3).map(c => c.name).join(', ')}`);
  }
  if (cards.length > 0) {
    examples.push(`Card components: ${cards.slice(0, 3).map(c => c.name).join(', ')}`);
  }
  if (forms.length > 0) {
    examples.push(`Form fields: ${forms.slice(0, 3).map(c => c.name).join(', ')}`);
  }
  if (rich.length > 0) {
    examples.push(`Rich content: ${rich.slice(0, 3).map(c => c.name).join(', ')}`);
  }
  
  return examples;
}

/**
 * Count how many models reference a pattern
 */
function countModelReferences(schema: HygraphSchema, pattern: string): number {
  const regex = new RegExp(pattern, 'i');
  let count = 0;
  
  for (const model of schema.models) {
    if (model.fields.some(f => regex.test(f.relatedModel || '') || regex.test(f.type))) {
      count++;
    }
  }
  
  return count;
}



