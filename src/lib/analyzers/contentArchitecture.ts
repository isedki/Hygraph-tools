import type {
  HygraphSchema,
  HygraphModel,
  ContentArchitectureAssessment,
  TaxonomyModel,
  HierarchySupport,
  ContentDistributionEntry,
  FacetedFilteringAssessment,
  CheckpointResult,
  CheckpointStatus,
} from '../types';
import { filterSystemEnums, filterSystemModels } from './systemFilters';

// ============================================
// Pattern Definitions
// ============================================

// Taxonomy model patterns
const CATEGORY_PATTERNS = /^(category|categories)$/i;
const TAG_PATTERNS = /^(tag|tags)$/i;
const TOPIC_PATTERNS = /^(topic|topics|subject|subjects)$/i;
const TYPE_PATTERNS = /^(type|types|kind|kinds|contentType|articleType|postType|productType)$/i;

// Navigation-related field patterns
const SLUG_PATTERNS = /^(slug|url|path|permalink|handle|urlSlug|seoSlug)$/i;
const BREADCRUMB_PATTERNS = /^(breadcrumb|breadcrumbs|parent|parentPage|parentCategory)$/i;
const MENU_MODEL_PATTERNS = /^(menu|nav|navigation|menuItem|navItem|siteNavigation|mainMenu|headerMenu|footerMenu)s?$/i;

// Self-referential patterns for hierarchy
const PARENT_FIELD_PATTERNS = /^(parent|parentId|parentCategory|parentPage|parentItem)$/i;
const CHILDREN_FIELD_PATTERNS = /^(children|childItems|childPages|childCategories|subItems|subCategories)$/i;

// ============================================
// Main Analyzer
// ============================================

export function analyzeContentArchitecture(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): ContentArchitectureAssessment {
  const customModels = filterSystemModels(schema.models);
  const enums = filterSystemEnums(schema.enums || []);

  const taxonomyModels = analyzeTaxonomyModels(customModels, enums, entryCounts);
  const hierarchySupport = analyzeHierarchySupport(customModels);
  const contentDistribution = analyzeContentDistribution(customModels, entryCounts);
  const navigationReadiness = analyzeNavigationReadiness(customModels);
  const facetedFiltering = analyzeFacetedFiltering(customModels, enums);

  return {
    taxonomyModels,
    taxonomySummary: generateTaxonomySummary(taxonomyModels),
    hierarchySupport,
    hierarchySummary: generateHierarchySummary(hierarchySupport),
    contentDistribution,
    navigationReadiness,
    facetedFiltering,
  };
}

// ============================================
// Taxonomy Analysis
// ============================================

function analyzeTaxonomyModels(
  models: HygraphModel[],
  enums: { name: string; values: string[] }[],
  entryCounts: Record<string, { draft: number; published: number }>
): TaxonomyModel[] {
  const taxonomyModels: TaxonomyModel[] = [];

  // Find taxonomy-like models
  for (const model of models) {
    let type: TaxonomyModel['type'] | null = null;

    if (CATEGORY_PATTERNS.test(model.name)) {
      type = 'category';
    } else if (TAG_PATTERNS.test(model.name)) {
      type = 'tag';
    } else if (TOPIC_PATTERNS.test(model.name)) {
      type = 'topic';
    } else if (TYPE_PATTERNS.test(model.name)) {
      type = 'type';
    }

    if (type) {
      const counts = entryCounts[model.name] || { draft: 0, published: 0 };
      const referencedBy = findModelsReferencingThis(model.name, models);

      taxonomyModels.push({
        name: model.name,
        type,
        entryCount: counts.draft + counts.published,
        isEnumBased: false,
        referencedBy,
      });
    }
  }

  // Find enum-based taxonomy (should be models instead)
  for (const enumDef of enums) {
    let type: TaxonomyModel['type'] | null = null;

    if (CATEGORY_PATTERNS.test(enumDef.name) || /category/i.test(enumDef.name)) {
      type = 'category';
    } else if (TAG_PATTERNS.test(enumDef.name) || /tag/i.test(enumDef.name)) {
      type = 'tag';
    } else if (TOPIC_PATTERNS.test(enumDef.name) || /topic/i.test(enumDef.name)) {
      type = 'topic';
    } else if (TYPE_PATTERNS.test(enumDef.name)) {
      type = 'type';
    }

    if (type && enumDef.values.length > 5) {
      const referencedBy = findModelsReferencingEnum(enumDef.name, models);

      taxonomyModels.push({
        name: enumDef.name,
        type,
        entryCount: enumDef.values.length,
        isEnumBased: true,
        referencedBy,
      });
    }
  }

  return taxonomyModels;
}

function findModelsReferencingThis(targetModel: string, models: HygraphModel[]): string[] {
  const referencing: string[] = [];
  for (const model of models) {
    for (const field of model.fields) {
      if (field.relatedModel === targetModel) {
        referencing.push(model.name);
        break;
      }
    }
  }
  return referencing;
}

function findModelsReferencingEnum(enumName: string, models: HygraphModel[]): string[] {
  const referencing: string[] = [];
  for (const model of models) {
    for (const field of model.fields) {
      if (field.type === enumName || field.enumValues?.length) {
        referencing.push(model.name);
        break;
      }
    }
  }
  return referencing;
}

function generateTaxonomySummary(taxonomyModels: TaxonomyModel[]): CheckpointResult {
  const properModels = taxonomyModels.filter(t => !t.isEnumBased);
  const enumBased = taxonomyModels.filter(t => t.isEnumBased);

  const status: CheckpointStatus = 
    enumBased.length > 0 ? 'warning' :
    properModels.length === 0 ? 'issue' : 'good';

  return {
    status,
    title: 'Taxonomy & Categorization',
    findings: [
      `${properModels.length} taxonomy model(s) found: ${properModels.map(t => t.name).join(', ') || 'none'}`,
      ...(enumBased.length > 0
        ? [`${enumBased.length} enum-based taxonomy detected (should be models): ${enumBased.map(t => t.name).join(', ')}`]
        : []),
    ],
    examples: [
      ...properModels.map(t => ({
        items: [t.name],
        details: `Type: ${t.type}, ${t.entryCount} entries, referenced by: ${t.referencedBy.join(', ') || 'none'}`,
      })),
      ...enumBased.map(t => ({
        items: [t.name],
        details: `Enum-based ${t.type} with ${t.entryCount} values - should be a content model`,
      })),
    ],
    actionItems: [
      ...(properModels.length === 0 ? ['Create Category, Tag, or Topic models for content organization'] : []),
      ...enumBased.map(t =>
        `Migrate enum "${t.name}" to a "${capitalize(t.type)}" content model for better metadata and scalability`
      ),
    ],
  };
}

// ============================================
// Hierarchy Analysis
// ============================================

function analyzeHierarchySupport(models: HygraphModel[]): HierarchySupport[] {
  const hierarchicalModels: HierarchySupport[] = [];

  for (const model of models) {
    for (const field of model.fields) {
      // Check for self-referential parent field
      if (
        (PARENT_FIELD_PATTERNS.test(field.name) || CHILDREN_FIELD_PATTERNS.test(field.name)) &&
        field.relatedModel === model.name
      ) {
        hierarchicalModels.push({
          model: model.name,
          selfRefField: field.name,
          supportsNesting: true,
          maxDepthEstimate: field.isList ? 5 : 2, // Lists allow deeper nesting
        });
        break;
      }

      // Check for parent field referencing another model (e.g., Page.parentPage -> Page)
      if (PARENT_FIELD_PATTERNS.test(field.name) && field.relatedModel) {
        hierarchicalModels.push({
          model: model.name,
          selfRefField: field.name,
          supportsNesting: field.relatedModel === model.name,
          maxDepthEstimate: field.relatedModel === model.name ? 5 : 1,
        });
        break;
      }
    }
  }

  return hierarchicalModels;
}

function generateHierarchySummary(hierarchySupport: HierarchySupport[]): CheckpointResult {
  const selfReferencing = hierarchySupport.filter(h => h.supportsNesting);

  const status: CheckpointStatus = 
    selfReferencing.length > 0 ? 'good' :
    hierarchySupport.length > 0 ? 'warning' : 'issue';

  return {
    status,
    title: 'Content Hierarchy',
    findings: selfReferencing.length > 0
      ? [`${selfReferencing.length} model(s) support hierarchical content: ${selfReferencing.map(h => h.model).join(', ')}`]
      : ['No self-referential hierarchy detected'],
    examples: selfReferencing.map(h => ({
      items: [h.model],
      details: `Self-reference via "${h.selfRefField}" field, supports ~${h.maxDepthEstimate} levels deep`,
    })),
    actionItems: selfReferencing.length === 0
      ? ['Consider adding parent/children fields to Page or Category models for navigation hierarchy']
      : [],
  };
}

// ============================================
// Content Distribution Analysis
// ============================================

function analyzeContentDistribution(
  models: HygraphModel[],
  entryCounts: Record<string, { draft: number; published: number }>
): ContentDistributionEntry[] {
  const distribution: ContentDistributionEntry[] = [];
  let totalEntries = 0;

  // Calculate total first
  for (const model of models) {
    const counts = entryCounts[model.name] || { draft: 0, published: 0 };
    totalEntries += counts.draft + counts.published;
  }

  // Build distribution entries
  for (const model of models) {
    const counts = entryCounts[model.name] || { draft: 0, published: 0 };
    const total = counts.draft + counts.published;

    distribution.push({
      model: model.name,
      draft: counts.draft,
      published: counts.published,
      total,
      percentage: totalEntries > 0 ? Math.round((total / totalEntries) * 100 * 10) / 10 : 0,
    });
  }

  // Sort by total entries descending
  distribution.sort((a, b) => b.total - a.total);

  return distribution;
}

// ============================================
// Navigation Readiness Analysis
// ============================================

function analyzeNavigationReadiness(models: HygraphModel[]): CheckpointResult {
  const modelsWithSlug: { model: string; slugField: string }[] = [];
  const modelsWithBreadcrumbs: { model: string; field: string }[] = [];
  const menuModels: string[] = [];

  for (const model of models) {
    // Check for menu/navigation models
    if (MENU_MODEL_PATTERNS.test(model.name)) {
      menuModels.push(model.name);
    }

    for (const field of model.fields) {
      // Check for slug fields
      if (SLUG_PATTERNS.test(field.name)) {
        modelsWithSlug.push({ model: model.name, slugField: field.name });
      }

      // Check for breadcrumb/parent support
      if (BREADCRUMB_PATTERNS.test(field.name)) {
        modelsWithBreadcrumbs.push({ model: model.name, field: field.name });
      }
    }
  }

  const hasSlug = modelsWithSlug.length > 0;
  const hasBreadcrumbs = modelsWithBreadcrumbs.length > 0;
  const hasMenuModel = menuModels.length > 0;

  const status: CheckpointStatus = 
    hasSlug && (hasBreadcrumbs || hasMenuModel) ? 'good' :
    hasSlug ? 'warning' : 'issue';

  return {
    status,
    title: 'Navigation Patterns',
    findings: [
      hasSlug ? `${modelsWithSlug.length} model(s) have slug fields for URL routing` : 'No slug fields detected',
      hasBreadcrumbs ? `${modelsWithBreadcrumbs.length} model(s) support breadcrumbs` : 'No breadcrumb support detected',
      hasMenuModel ? `Menu model(s) found: ${menuModels.join(', ')}` : 'No dedicated menu/navigation model',
    ],
    examples: [
      ...modelsWithSlug.slice(0, 3).map(m => ({
        items: [m.model],
        details: `Slug field: "${m.slugField}"`,
      })),
      ...menuModels.slice(0, 2).map(m => ({
        items: [m],
        details: 'Navigation model for menu structure',
      })),
    ],
    actionItems: [
      ...(!hasSlug ? ['Add slug fields to content models for URL routing'] : []),
      ...(!hasBreadcrumbs ? ['Consider adding parent references for breadcrumb navigation'] : []),
      ...(!hasMenuModel ? ['Create a Menu or Navigation model for site navigation structure'] : []),
    ],
  };
}

// ============================================
// Faceted Filtering Analysis
// ============================================

function analyzeFacetedFiltering(
  models: HygraphModel[],
  enums: { name: string; values: string[] }[]
): FacetedFilteringAssessment {
  const filterableFields: FacetedFilteringAssessment['filterableFields'] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];

  // Content models that typically need filtering
  const contentModelPatterns = /^(article|post|product|event|job|listing|item|resource)s?$/i;
  const contentModels = models.filter(m => contentModelPatterns.test(m.name));

  for (const model of models) {
    for (const field of model.fields) {
      // Enum fields are filterable
      if (field.enumValues && field.enumValues.length > 0) {
        filterableFields.push({
          model: model.name,
          field: field.name,
          type: 'enum',
        });
      } else if (field.type && enums.some(e => e.name === field.type)) {
        filterableFields.push({
          model: model.name,
          field: field.name,
          type: 'enum',
        });
      }

      // Reference fields are filterable
      if (field.relatedModel && models.some(m => m.name === field.relatedModel)) {
        filterableFields.push({
          model: model.name,
          field: field.name,
          type: 'reference',
        });
      }

      // Boolean fields are filterable
      if (field.type === 'Boolean') {
        filterableFields.push({
          model: model.name,
          field: field.name,
          type: 'boolean',
        });
      }
    }
  }

  // Check for gaps in content models
  for (const contentModel of contentModels) {
    const modelFilters = filterableFields.filter(f => f.model === contentModel.name);
    if (modelFilters.length < 2) {
      gaps.push(`"${contentModel.name}" has only ${modelFilters.length} filterable field(s)`);
      recommendations.push(`Add category/tag references or status enums to "${contentModel.name}" for better filtering`);
    }
  }

  // Calculate score
  const avgFiltersPerContentModel = contentModels.length > 0
    ? filterableFields.filter(f => contentModels.some(cm => cm.name === f.model)).length / contentModels.length
    : filterableFields.length / Math.max(models.length, 1);

  const score = Math.min(100, Math.round(avgFiltersPerContentModel * 25));

  const status: CheckpointStatus = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'issue';

  return {
    score,
    status,
    filterableFields,
    gaps,
    recommendations,
  };
}

// ============================================
// Helper Functions
// ============================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
