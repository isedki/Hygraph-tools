import type { HygraphSchema, AuditIssue } from '../types';
import { filterSystemComponents, filterSystemEnums, filterSystemModels } from './systemFilters';

export interface ArchitectureAnalysis {
  // Enum Analysis
  enumAnalysis: {
    totalEnums: number;
    singleValueEnums: { name: string; value: string }[];
    unusedEnums: string[];
    duplicateEnumValues: { 
      value: string; 
      foundIn: string[]; 
      recommendation: string 
    }[];
    potentialEnumOverlap: {
      enums: string[];
      sharedValues: string[];
      recommendation: string;
    }[];
    enumsAsPageTypes: string[]; // Enums being used instead of proper models
  };
  
  // Variant Analysis
  variantAnalysis: {
    customVariantModels: { 
      name: string; 
      baseModel: string;
      fields: string[];
      issue: string;
    }[];
    shouldUseHygraphVariants: boolean;
    recommendation: string;
  };
  
  // Layout vs Content Separation
  layoutContentSeparation: {
    layoutModels: string[];
    contentModels: string[];
    mixedModels: { 
      name: string; 
      layoutFields: string[]; 
      contentFields: string[];
      recommendation: string;
    }[];
    separationScore: number;
  };
  
  // Component vs Model Usage
  componentVsModel: {
    modelsCouldBeComponents: {
      name: string;
      reason: string;
      recommendation: string;
    }[];
    componentsAreModels: string[];
    properComponents: string[];
  };
  
  // Multitenant Architecture
  multitenantAnalysis: {
    hasMultitenantPattern: boolean;
    tenantIdentifiers: string[];
    usingEnumsForTenants: boolean;
    recommendation: string;
  };
  
  // Block/Section Proliferation
  blockAnalysis: {
    blockModels: string[];
    duplicateBlockPatterns: {
      blocks: string[];
      sharedFields: string[];
      recommendation: string;
    }[];
    shouldConsolidate: boolean;
  };
}

// Detect single-value enums (useless)
function findSingleValueEnums(schema: HygraphSchema): { name: string; value: string }[] {
  return schema.enums
    .filter(e => e.values.length === 1)
    .map(e => ({ name: e.name, value: e.values[0] }));
}

// Find duplicate enum values across different enums
function findDuplicateEnumValues(schema: HygraphSchema): {
  value: string;
  foundIn: string[];
  recommendation: string;
}[] {
  const valueToEnums = new Map<string, string[]>();
  
  for (const enumType of schema.enums) {
    for (const value of enumType.values) {
      const normalizedValue = value.toLowerCase();
      if (!valueToEnums.has(normalizedValue)) {
        valueToEnums.set(normalizedValue, []);
      }
      valueToEnums.get(normalizedValue)!.push(enumType.name);
    }
  }
  
  return Array.from(valueToEnums.entries())
    .filter(([, enums]) => enums.length > 1)
    .map(([value, foundIn]) => ({
      value,
      foundIn,
      recommendation: `Consider consolidating into a single enum or ensuring they serve different purposes`,
    }));
}

// Find potential enum overlaps (similar enums)
function findEnumOverlaps(schema: HygraphSchema): {
  enums: string[];
  sharedValues: string[];
  recommendation: string;
}[] {
  const overlaps: { enums: string[]; sharedValues: string[]; recommendation: string }[] = [];
  const customEnums = filterSystemEnums(schema.enums || []);
  
  for (let i = 0; i < customEnums.length; i++) {
    for (let j = i + 1; j < customEnums.length; j++) {
      const enum1 = customEnums[i];
      const enum2 = customEnums[j];
      
      const values1 = new Set(enum1.values.map(v => v.toLowerCase()));
      const values2 = new Set(enum2.values.map(v => v.toLowerCase()));
      
      const shared = [...values1].filter(v => values2.has(v));
      const overlapRatio = shared.length / Math.min(values1.size, values2.size);
      
      if (overlapRatio >= 0.5 && shared.length >= 2) {
        overlaps.push({
          enums: [enum1.name, enum2.name],
          sharedValues: shared,
          recommendation: `Enums "${enum1.name}" and "${enum2.name}" share ${shared.length} values - consider consolidating`,
        });
      }
    }
  }
  
  return overlaps;
}

// Detect enums being used as page types (anti-pattern)
function findEnumsAsPageTypes(schema: HygraphSchema): string[] {
  const pagePatterns = [/page/i, /route/i, /template/i, /view/i];
  const customEnums = filterSystemEnums(schema.enums || []);
  
  return customEnums
    .filter(e => {
      // Check if enum name suggests page types
      const nameMatches = pagePatterns.some(p => p.test(e.name));
      
      // Check if values look like page names
      const valuesLookLikePages = e.values.some(v => 
        /^(home|about|contact|blog|product|category|checkout|cart|profile|settings|dashboard)/i.test(v)
      );
      
      return nameMatches || (valuesLookLikePages && e.values.length > 3);
    })
    .map(e => e.name);
}

// Detect custom variant models (should use Hygraph's built-in variants)
function detectCustomVariantModels(schema: HygraphSchema): {
  name: string;
  baseModel: string;
  fields: string[];
  issue: string;
}[] {
  const variantPattern = /^(.+?)(Variant|Version|Localized|Regional|Variation)$/i;
  const variants: { name: string; baseModel: string; fields: string[]; issue: string }[] = [];
  
  for (const model of schema.models) {
    const match = model.name.match(variantPattern);
    if (match) {
      const baseName = match[1];
      const baseModel = schema.models.find(m => 
        m.name.toLowerCase() === baseName.toLowerCase()
      );
      
      if (baseModel) {
        variants.push({
          name: model.name,
          baseModel: baseModel.name,
          fields: model.fields.map(f => f.name),
          issue: `"${model.name}" appears to be a variant of "${baseModel.name}" - consider using Hygraph's built-in localization or Segments feature instead`,
        });
      }
    }
  }
  
  // Also check for Segment model pattern (used for targeting)
  const segmentModel = schema.models.find(m => 
    m.name.toLowerCase() === 'segment' || 
    m.name.toLowerCase() === 'audience' ||
    m.name.toLowerCase() === 'target'
  );
  
  if (segmentModel) {
    // Find models that reference segments with variant-like relations
    for (const model of schema.models) {
      const hasVariantRelation = model.fields.some(f => 
        f.name.toLowerCase().includes('variant') && f.relatedModel
      );
      
      if (hasVariantRelation && !variants.some(v => v.name === model.name)) {
        variants.push({
          name: model.name,
          baseModel: 'Segment-based',
          fields: model.fields.filter(f => f.name.toLowerCase().includes('variant')).map(f => f.name),
          issue: `"${model.name}" uses custom variant pattern - consider using Hygraph's Segments or localization features`,
        });
      }
    }
  }
  
  return variants;
}

// Analyze layout vs content separation
function analyzeLayoutContentSeparation(schema: HygraphSchema): {
  layoutModels: string[];
  contentModels: string[];
  mixedModels: { name: string; layoutFields: string[]; contentFields: string[]; recommendation: string }[];
  separationScore: number;
} {
  const layoutPatterns = [/layout/i, /template/i, /page/i, /section/i, /grid/i, /container/i];
  const layoutFieldPatterns = [/position/i, /align/i, /theme/i, /style/i, /display/i, /layout/i, /padding/i, /margin/i, /width/i, /height/i, /column/i, /row/i];
  const contentFieldPatterns = [/title/i, /description/i, /content/i, /body/i, /text/i, /name/i, /slug/i, /author/i, /date/i, /image/i];
  
  const layoutModels: string[] = [];
  const contentModels: string[] = [];
  const mixedModels: { name: string; layoutFields: string[]; contentFields: string[]; recommendation: string }[] = [];
  
  for (const model of schema.models) {
    const isLayoutModel = layoutPatterns.some(p => p.test(model.name));
    
    const layoutFields = model.fields.filter(f => 
      layoutFieldPatterns.some(p => p.test(f.name))
    ).map(f => f.name);
    
    const contentFields = model.fields.filter(f => 
      contentFieldPatterns.some(p => p.test(f.name))
    ).map(f => f.name);
    
    if (isLayoutModel) {
      layoutModels.push(model.name);
      
      // Check if layout model has content fields (mixing)
      if (contentFields.length > 2) {
        mixedModels.push({
          name: model.name,
          layoutFields,
          contentFields,
          recommendation: `"${model.name}" mixes layout and content - separate into a Layout model (presentation) and Content model (data)`,
        });
      }
    } else {
      contentModels.push(model.name);
      
      // Check if content model has too many layout fields
      if (layoutFields.length > 3) {
        mixedModels.push({
          name: model.name,
          layoutFields,
          contentFields,
          recommendation: `"${model.name}" has layout concerns - extract layout fields to a separate DisplaySettings component`,
        });
      }
    }
  }
  
  // Calculate separation score
  const totalModels = schema.models.length;
  const mixedCount = mixedModels.length;
  const separationScore = totalModels > 0 
    ? Math.round(((totalModels - mixedCount) / totalModels) * 100)
    : 100;
  
  return { layoutModels, contentModels, mixedModels, separationScore };
}

// Detect models that should be components
function detectModelsCouldBeComponents(schema: HygraphSchema): {
  name: string;
  reason: string;
  recommendation: string;
}[] {
  const shouldBeComponents: { name: string; reason: string; recommendation: string }[] = [];
  
  // Patterns that suggest a component
  const componentPatterns = [
    /^(block|section|card|item|element|widget|module|cta|button|link|banner|hero|feature)/i,
  ];
  
  for (const model of schema.models) {
    // Check if name suggests component
    const nameMatchesComponent = componentPatterns.some(p => p.test(model.name));
    
    // Check if it's only used as a nested reference (never queried directly)
    const isOnlyNested = model.fields.length <= 5;
    
    // Check if it has no slug/id fields that suggest standalone content
    const hasStandaloneFields = model.fields.some(f => 
      ['slug', 'url', 'permalink', 'path'].includes(f.name.toLowerCase())
    );
    
    if (nameMatchesComponent && isOnlyNested && !hasStandaloneFields) {
      shouldBeComponents.push({
        name: model.name,
        reason: `Small model (${model.fields.length} fields) with component-like name`,
        recommendation: `Convert "${model.name}" to a Component - it appears to be used for composition, not standalone content`,
      });
    }
  }
  
  return shouldBeComponents;
}

// Detect multitenant patterns
function detectMultitenantPattern(schema: HygraphSchema): {
  hasMultitenantPattern: boolean;
  tenantIdentifiers: string[];
  usingEnumsForTenants: boolean;
  recommendation: string;
} {
  const tenantPatterns = [/tenant/i, /site/i, /brand/i, /region/i, /country/i, /market/i, /location/i];
  const tenantIdentifiers: string[] = [];
  let usingEnumsForTenants = false;
  
  // Check enums for tenant-like patterns
  for (const enumType of schema.enums) {
    if (tenantPatterns.some(p => p.test(enumType.name))) {
      tenantIdentifiers.push(`Enum: ${enumType.name}`);
      usingEnumsForTenants = true;
    }
  }
  
  // Check model fields for tenant references
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (tenantPatterns.some(p => p.test(field.name))) {
        tenantIdentifiers.push(`${model.name}.${field.name}`);
      }
    }
  }
  
  const hasMultitenantPattern = tenantIdentifiers.length > 0;
  
  let recommendation = '';
  if (usingEnumsForTenants) {
    recommendation = 'Using enums for tenants/regions limits scalability. Consider: 1) Separate Hygraph environments per tenant, 2) A Tenant model with proper references, or 3) Hygraph\'s multi-environment features';
  } else if (hasMultitenantPattern) {
    recommendation = 'Multitenant pattern detected. Ensure tenant isolation is properly implemented with filtering and permissions';
  }
  
  return {
    hasMultitenantPattern,
    tenantIdentifiers,
    usingEnumsForTenants,
    recommendation,
  };
}

// Analyze block proliferation
function analyzeBlockProliferation(schema: HygraphSchema): {
  blockModels: string[];
  duplicateBlockPatterns: { blocks: string[]; sharedFields: string[]; recommendation: string }[];
  shouldConsolidate: boolean;
} {
  const blockPatterns = [/^block/i, /section$/i, /module$/i];
  
  const blockModels = schema.models
    .filter(m => blockPatterns.some(p => p.test(m.name)))
    .map(m => m.name);
  
  const duplicatePatterns: { blocks: string[]; sharedFields: string[]; recommendation: string }[] = [];
  
  // Compare block models for similarities
  const blockModelData = schema.models
    .filter(m => blockModels.includes(m.name))
    .map(m => ({
      name: m.name,
      fieldNames: new Set(m.fields.map(f => f.name.toLowerCase())),
    }));
  
  for (let i = 0; i < blockModelData.length; i++) {
    for (let j = i + 1; j < blockModelData.length; j++) {
      const block1 = blockModelData[i];
      const block2 = blockModelData[j];
      
      const shared = [...block1.fieldNames].filter(f => block2.fieldNames.has(f));
      const similarity = shared.length / Math.min(block1.fieldNames.size, block2.fieldNames.size);
      
      if (similarity > 0.5 && shared.length >= 3) {
        duplicatePatterns.push({
          blocks: [block1.name, block2.name],
          sharedFields: shared,
          recommendation: `"${block1.name}" and "${block2.name}" share ${shared.length} fields - consider creating a unified Block component with a "type" field`,
        });
      }
    }
  }
  
  return {
    blockModels,
    duplicateBlockPatterns: duplicatePatterns,
    shouldConsolidate: blockModels.length > 5 || duplicatePatterns.length > 0,
  };
}

export function analyzeArchitecture(schema: HygraphSchema): ArchitectureAnalysis {
  const customEnums = filterSystemEnums(schema.enums || []);
  const customComponents = filterSystemComponents(schema.components || []);
  const singleValueEnums = findSingleValueEnums(schema);
  const duplicateEnumValues = findDuplicateEnumValues(schema);
  const enumOverlaps = findEnumOverlaps(schema);
  const enumsAsPageTypes = findEnumsAsPageTypes(schema);
  const customVariants = detectCustomVariantModels(schema);
  const layoutSeparation = analyzeLayoutContentSeparation(schema);
  const modelsCouldBeComponents = detectModelsCouldBeComponents(schema);
  const multitenantAnalysis = detectMultitenantPattern(schema);
  const blockAnalysis = analyzeBlockProliferation(schema);
  
  return {
    enumAnalysis: {
      totalEnums: customEnums.length,
      singleValueEnums,
      unusedEnums: [], // Would need usage analysis
      duplicateEnumValues,
      potentialEnumOverlap: enumOverlaps,
      enumsAsPageTypes,
    },
    variantAnalysis: {
      customVariantModels: customVariants,
      shouldUseHygraphVariants: customVariants.length > 0,
      recommendation: customVariants.length > 0 
        ? 'Custom variant models detected. Use Hygraph\'s built-in Localization for language variants, or Segments feature for audience targeting'
        : 'No custom variant anti-patterns detected',
    },
    layoutContentSeparation: layoutSeparation,
    componentVsModel: {
      modelsCouldBeComponents,
      componentsAreModels: [], // Components that should stay models
      properComponents: customComponents.map(c => c.name),
    },
    multitenantAnalysis,
    blockAnalysis,
  };
}

export function generateArchitectureIssues(analysis: ArchitectureAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Single value enums
  for (const enumInfo of analysis.enumAnalysis.singleValueEnums) {
    issues.push({
      id: `single-value-enum-${enumInfo.name}`,
      severity: 'warning',
      category: 'governance',
      title: 'Single-Value Enum',
      description: `Enum "${enumInfo.name}" has only one value: "${enumInfo.value}"`,
      impact: 'Single-value enums provide no validation benefit and add unnecessary complexity',
      recommendation: 'Remove the enum and use a constant, or add more meaningful values',
      affectedItems: [enumInfo.name],
    });
  }
  
  // Duplicate enum values
  for (const dup of analysis.enumAnalysis.duplicateEnumValues) {
    issues.push({
      id: `duplicate-enum-value-${dup.value}`,
      severity: 'info',
      category: 'governance',
      title: 'Duplicate Enum Value',
      description: `Value "${dup.value}" appears in multiple enums: ${dup.foundIn.join(', ')}`,
      impact: 'Duplicate values across enums can cause confusion and maintenance issues',
      recommendation: dup.recommendation,
      affectedItems: dup.foundIn,
    });
  }
  
  // Enum overlaps
  for (const overlap of analysis.enumAnalysis.potentialEnumOverlap) {
    issues.push({
      id: `enum-overlap-${overlap.enums.join('-')}`,
      severity: 'warning',
      category: 'governance',
      title: 'Overlapping Enums',
      description: `Enums ${overlap.enums.join(' and ')} share ${overlap.sharedValues.length} values`,
      impact: 'Overlapping enums suggest they could be consolidated into a single enum',
      recommendation: overlap.recommendation,
      affectedItems: overlap.enums,
    });
  }
  
  // Enums as page types
  for (const enumName of analysis.enumAnalysis.enumsAsPageTypes) {
    issues.push({
      id: `enum-as-pages-${enumName}`,
      severity: 'warning',
      category: 'governance',
      title: 'Enum Used for Page Types',
      description: `Enum "${enumName}" appears to define page types`,
      impact: 'Using enums for page types limits flexibility - pages can\'t have their own content structure',
      recommendation: 'Create proper Page content models instead of using an enum. Each page type can have its own model or use a flexible "Page" model with components',
      affectedItems: [enumName],
    });
  }
  
  // Custom variant models
  for (const variant of analysis.variantAnalysis.customVariantModels) {
    issues.push({
      id: `custom-variant-${variant.name}`,
      severity: 'warning',
      category: 'governance',
      title: 'Custom Variant Model Pattern',
      description: `"${variant.name}" is a custom variant of "${variant.baseModel}"`,
      impact: 'Custom variant models duplicate content structure and complicate querying',
      recommendation: variant.issue,
      affectedItems: [variant.name, variant.baseModel],
    });
  }
  
  // Layout/content mixing
  for (const mixed of analysis.layoutContentSeparation.mixedModels) {
    issues.push({
      id: `mixed-layout-content-${mixed.name}`,
      severity: 'warning',
      category: 'governance',
      title: 'Mixed Layout and Content',
      description: `"${mixed.name}" mixes layout fields (${mixed.layoutFields.slice(0, 3).join(', ')}) with content fields (${mixed.contentFields.slice(0, 3).join(', ')})`,
      impact: 'Mixing layout and content violates separation of concerns, making content reuse difficult',
      recommendation: mixed.recommendation,
      affectedItems: [mixed.name],
    });
  }
  
  // Low separation score
  if (analysis.layoutContentSeparation.separationScore < 70) {
    issues.push({
      id: 'low-separation-score',
      severity: 'warning',
      category: 'governance',
      title: 'Poor Layout/Content Separation',
      description: `Only ${analysis.layoutContentSeparation.separationScore}% of models properly separate layout from content`,
      impact: 'Poor separation makes content reuse across different layouts difficult',
      recommendation: 'Extract layout concerns into separate Layout models or DisplaySettings components',
      affectedItems: analysis.layoutContentSeparation.mixedModels.map(m => m.name),
    });
  }
  
  // Models that should be components
  for (const model of analysis.componentVsModel.modelsCouldBeComponents) {
    issues.push({
      id: `model-should-be-component-${model.name}`,
      severity: 'info',
      category: 'governance',
      title: 'Model Could Be Component',
      description: `"${model.name}": ${model.reason}`,
      impact: 'Using models instead of components for composition creates unnecessary entries and complicates queries',
      recommendation: model.recommendation,
      affectedItems: [model.name],
    });
  }
  
  // Multitenant issues
  if (analysis.multitenantAnalysis.usingEnumsForTenants) {
    issues.push({
      id: 'enums-for-tenants',
      severity: 'warning',
      category: 'governance',
      title: 'Enums Used for Multitenancy',
      description: `Tenant/region identifiers found in enums: ${analysis.multitenantAnalysis.tenantIdentifiers.join(', ')}`,
      impact: 'Enums for tenants don\'t scale well and lack proper isolation',
      recommendation: analysis.multitenantAnalysis.recommendation,
      affectedItems: analysis.multitenantAnalysis.tenantIdentifiers,
    });
  }
  
  // Block proliferation
  if (analysis.blockAnalysis.shouldConsolidate) {
    issues.push({
      id: 'block-proliferation',
      severity: 'info',
      category: 'governance',
      title: 'Block Model Proliferation',
      description: `${analysis.blockAnalysis.blockModels.length} block-type models found`,
      impact: 'Many similar block models increase schema complexity and editor confusion',
      recommendation: 'Consider a unified "Block" component with a type discriminator and conditional fields',
      affectedItems: analysis.blockAnalysis.blockModels,
    });
  }
  
  for (const dup of analysis.blockAnalysis.duplicateBlockPatterns) {
    issues.push({
      id: `duplicate-blocks-${dup.blocks.join('-')}`,
      severity: 'warning',
      category: 'governance',
      title: 'Similar Block Models',
      description: `${dup.blocks.join(' and ')} share ${dup.sharedFields.length} fields`,
      impact: 'Duplicate block structures increase maintenance burden',
      recommendation: dup.recommendation,
      affectedItems: dup.blocks,
    });
  }
  
  // Good practices
  if (analysis.layoutContentSeparation.separationScore >= 80) {
    issues.push({
      id: 'good-separation',
      severity: 'info',
      category: 'governance',
      title: 'Good Layout/Content Separation',
      description: `${analysis.layoutContentSeparation.separationScore}% separation score`,
      impact: 'Good separation enables content reuse across layouts',
      recommendation: 'Maintain this pattern',
      affectedItems: [],
      score: 5,
    });
  }
  
  if (analysis.enumAnalysis.singleValueEnums.length === 0 && analysis.enumAnalysis.potentialEnumOverlap.length === 0) {
    issues.push({
      id: 'good-enum-usage',
      severity: 'info',
      category: 'governance',
      title: 'Clean Enum Usage',
      description: 'No single-value or overlapping enums detected',
      impact: 'Well-designed enums improve data validation and editor experience',
      recommendation: 'Continue this pattern',
      affectedItems: [],
      score: 5,
    });
  }
  
  return issues;
}

export function calculateArchitectureScore(analysis: ArchitectureAnalysis): number {
  let score = 100;
  
  // Enum issues
  score -= analysis.enumAnalysis.singleValueEnums.length * 5;
  score -= analysis.enumAnalysis.potentialEnumOverlap.length * 3;
  score -= analysis.enumAnalysis.enumsAsPageTypes.length * 8;
  
  // Variant issues
  score -= analysis.variantAnalysis.customVariantModels.length * 10;
  
  // Layout/content separation
  if (analysis.layoutContentSeparation.separationScore < 70) {
    score -= 15;
  } else if (analysis.layoutContentSeparation.separationScore < 85) {
    score -= 5;
  }
  score -= analysis.layoutContentSeparation.mixedModels.length * 3;
  
  // Component vs model
  score -= analysis.componentVsModel.modelsCouldBeComponents.length * 2;
  
  // Multitenant
  if (analysis.multitenantAnalysis.usingEnumsForTenants) {
    score -= 10;
  }
  
  // Block proliferation
  if (analysis.blockAnalysis.shouldConsolidate) {
    score -= 5;
  }
  score -= analysis.blockAnalysis.duplicateBlockPatterns.length * 5;
  
  return Math.max(0, Math.min(100, score));
}

