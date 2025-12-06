import type { HygraphSchema, EnumPurpose, EnumOverviewAnalysis } from '../types';

/**
 * Analyzes enums to understand their PURPOSE and proper categorization.
 * Goes beyond health checks to explain WHY each enum exists and how it's used.
 */
export function analyzeEnumOverview(schema: HygraphSchema): EnumOverviewAnalysis {
  const enumsByCategory: EnumOverviewAnalysis['enumsByCategory'] = {
    styling: [],
    layout: [],
    contentType: [],
    businessLogic: [],
    tenancy: [],
    status: [],
    other: [],
  };

  const architecturalEnums: EnumPurpose[] = [];

  for (const enumDef of schema.enums) {
    const enumPurpose = analyzeEnumPurpose(enumDef, schema);
    
    // Add to category
    switch (enumPurpose.category) {
      case 'styling':
        enumsByCategory.styling.push(enumPurpose);
        break;
      case 'layout':
        enumsByCategory.layout.push(enumPurpose);
        break;
      case 'content-type':
        enumsByCategory.contentType.push(enumPurpose);
        break;
      case 'business-logic':
        enumsByCategory.businessLogic.push(enumPurpose);
        break;
      case 'tenancy':
        enumsByCategory.tenancy.push(enumPurpose);
        architecturalEnums.push(enumPurpose);
        break;
      case 'status':
        enumsByCategory.status.push(enumPurpose);
        break;
      default:
        enumsByCategory.other.push(enumPurpose);
    }
  }

  // Calculate health summary
  const allEnums = [
    ...enumsByCategory.styling,
    ...enumsByCategory.layout,
    ...enumsByCategory.contentType,
    ...enumsByCategory.businessLogic,
    ...enumsByCategory.tenancy,
    ...enumsByCategory.status,
    ...enumsByCategory.other,
  ];

  const healthSummary = {
    healthy: allEnums.filter(e => e.healthStatus === 'healthy').length,
    warning: allEnums.filter(e => e.healthStatus === 'warning').length,
    critical: allEnums.filter(e => e.healthStatus === 'critical').length,
  };

  // Generate overall assessment
  const overallAssessment = generateOverallAssessment(
    schema.enums.length,
    enumsByCategory,
    architecturalEnums,
    healthSummary
  );

  return {
    totalEnums: schema.enums.length,
    enumsByCategory,
    architecturalEnums,
    healthSummary,
    overallAssessment,
  };
}

function analyzeEnumPurpose(
  enumDef: { name: string; values: string[] },
  schema: HygraphSchema
): EnumPurpose {
  const name = enumDef.name;
  const values = enumDef.values;
  
  // Find where this enum is used
  const usedInModels: string[] = [];
  for (const model of [...schema.models, ...schema.components]) {
    if (model.fields.some(f => f.type === name || f.type?.includes(name))) {
      usedInModels.push(model.name);
    }
  }
  
  // Determine category and purpose
  const { category, purpose } = determineEnumCategoryAndPurpose(name, values);
  
  // Analyze health
  const { healthStatus, issues, recommendations } = analyzeEnumHealth(name, values, usedInModels, category);

  return {
    name,
    values,
    category,
    purpose,
    usedInModels,
    usageCount: usedInModels.length,
    healthStatus,
    issues,
    recommendations,
  };
}

function determineEnumCategoryAndPurpose(
  name: string,
  values: string[]
): { category: EnumPurpose['category']; purpose: string } {
  const nameLower = name.toLowerCase();
  const valuesLower = values.map(v => v.toLowerCase());

  // ============================================
  // STYLING ENUMS
  // ============================================
  if (/color|theme|tone|shade/i.test(name) ||
      valuesLower.some(v => /^(light|dark|primary|secondary|accent|neutral|muted|vibrant)/i.test(v))) {
    return {
      category: 'styling',
      purpose: `Controls visual appearance/theming. Values: ${values.slice(0, 5).join(', ')}${values.length > 5 ? '...' : ''}`,
    };
  }

  if (/size|scale|weight/i.test(name) ||
      valuesLower.some(v => /^(xs|sm|md|lg|xl|xxl|small|medium|large|thin|regular|bold)/i.test(v))) {
    return {
      category: 'styling',
      purpose: `Controls size/scale options. Values: ${values.slice(0, 5).join(', ')}${values.length > 5 ? '...' : ''}`,
    };
  }

  if (/variant|style|appearance/i.test(name)) {
    return {
      category: 'styling',
      purpose: `Defines visual variants for components. Editors can select different appearances while maintaining consistent structure.`,
    };
  }

  // ============================================
  // LAYOUT ENUMS
  // ============================================
  if (/layout|grid|column|row|flex|alignment|position|direction|spacing|width|background/i.test(name)) {
    return {
      category: 'layout',
      purpose: `Controls layout configuration. Allows editors to adjust positioning and structure without code changes.`,
    };
  }

  if (valuesLower.some(v => /^(left|right|center|top|bottom|full|half|third|quarter)/i.test(v))) {
    return {
      category: 'layout',
      purpose: `Position/alignment control for content placement.`,
    };
  }

  // ============================================
  // CONTENT TYPE ENUMS
  // ============================================
  if (/type|kind|category|format|mode/i.test(name) && !isTenancyEnum(name, values)) {
    return {
      category: 'content-type',
      purpose: `Categorizes content into different types. Used for filtering, conditional display, and content organization.`,
    };
  }

  // ============================================
  // STATUS ENUMS
  // ============================================
  if (/status|state|phase|stage/i.test(name) ||
      valuesLower.some(v => /^(draft|published|pending|approved|rejected|active|inactive|archived)/i.test(v))) {
    return {
      category: 'status',
      purpose: `Tracks content lifecycle or workflow state. Enables workflow automation and content filtering.`,
    };
  }

  if (/level|priority|importance/i.test(name) ||
      valuesLower.some(v => /^(high|medium|low|critical|normal|urgent)/i.test(v))) {
    return {
      category: 'status',
      purpose: `Indicates priority/importance level for content prioritization.`,
    };
  }

  if (/visibility|access/i.test(name) ||
      valuesLower.some(v => /^(public|private|internal|restricted|members)/i.test(v))) {
    return {
      category: 'status',
      purpose: `Controls content visibility/access permissions.`,
    };
  }

  // ============================================
  // TENANCY ENUMS (Architectural - needs attention)
  // ============================================
  if (isTenancyEnum(name, values)) {
    return {
      category: 'tenancy',
      purpose: `⚠️ Used for multi-brand/site/tenant segmentation. This enum-based approach has scalability limitations. Consider dedicated models for better metadata support.`,
    };
  }

  // ============================================
  // BUSINESS LOGIC ENUMS
  // ============================================
  if (/payment|shipping|delivery|subscription|plan|tier/i.test(name)) {
    return {
      category: 'business-logic',
      purpose: `Business process configuration. Controls e-commerce or subscription-related options.`,
    };
  }

  if (/action|trigger|event|hook/i.test(name)) {
    return {
      category: 'business-logic',
      purpose: `Defines business actions or triggers for automation.`,
    };
  }

  // ============================================
  // DEFAULT - OTHER
  // ============================================
  return {
    category: 'other',
    purpose: `Custom enumeration with ${values.length} values. Review if this could be simplified or if purpose is clear to editors.`,
  };
}

function isTenancyEnum(name: string, values: string[]): boolean {
  // Name patterns suggesting multi-tenant/brand/site usage
  if (/^(shop|brand|store|merchant|vendor|partner|client|tenant|organization|site|domain|channel|region|country|locale|market)s?$/i.test(name)) {
    return true;
  }
  
  // Values that look like brand/site names (capitalized words, not styling/layout values)
  const nonGenericValues = values.filter(v => 
    !/^(xs|sm|md|lg|xl|left|right|center|top|bottom|primary|secondary|dark|light|active|inactive|draft|published)/i.test(v) &&
    v.length > 2
  );
  
  // If most values look like proper nouns/names and there are several
  if (nonGenericValues.length >= 3 && nonGenericValues.length / values.length > 0.8) {
    const looksLikeNames = nonGenericValues.filter(v => /^[A-Z]/.test(v) || /_/.test(v));
    if (looksLikeNames.length >= 3) {
      return true;
    }
  }
  
  return false;
}

function analyzeEnumHealth(
  name: string,
  values: string[],
  usedInModels: string[],
  category: EnumPurpose['category']
): { healthStatus: EnumPurpose['healthStatus']; issues: string[]; recommendations: string[] } {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let healthStatus: EnumPurpose['healthStatus'] = 'healthy';

  // Single value enum
  if (values.length === 1) {
    issues.push(`Single-value enum provides no selection benefit`);
    recommendations.push(`Remove enum and use constant, or add meaningful values if selection is planned`);
    healthStatus = 'warning';
  }

  // Unused enum
  if (usedInModels.length === 0) {
    issues.push(`Enum is not used in any model`);
    recommendations.push(`Remove unused enum or implement in relevant models`);
    healthStatus = 'warning';
  }

  // Oversized enum
  if (values.length > 20) {
    issues.push(`Large enum with ${values.length} values may be hard to manage`);
    recommendations.push(`Consider migrating to a content model for better manageability and metadata support`);
    healthStatus = 'warning';
  }

  // Tenancy enum - critical
  if (category === 'tenancy') {
    if (values.length > 5) {
      issues.push(`Using enum for multi-tenant/brand architecture limits scalability`);
      recommendations.push(`Create a dedicated content model (Brand, Site, etc.) with proper relationships`);
      healthStatus = 'critical';
    } else {
      issues.push(`Small tenancy enum is acceptable but monitor growth`);
      recommendations.push(`Plan migration to content model if brands/sites exceed 10`);
      healthStatus = 'warning';
    }
  }

  // Very small styling enums might be over-engineered
  if (category === 'styling' && values.length <= 2 && usedInModels.length <= 1) {
    issues.push(`Small styling enum with limited usage`);
    recommendations.push(`Evaluate if enum adds value or if default styling would suffice`);
    // Don't change health status for minor styling concerns
  }

  return { healthStatus, issues, recommendations };
}

function generateOverallAssessment(
  totalEnums: number,
  enumsByCategory: EnumOverviewAnalysis['enumsByCategory'],
  architecturalEnums: EnumPurpose[],
  healthSummary: EnumOverviewAnalysis['healthSummary']
): string {
  const parts: string[] = [];

  // Overall count
  parts.push(`**${totalEnums} enumerations** define controlled options across the schema.`);

  // Category breakdown
  const categories: string[] = [];
  if (enumsByCategory.styling.length > 0) {
    categories.push(`${enumsByCategory.styling.length} for styling`);
  }
  if (enumsByCategory.layout.length > 0) {
    categories.push(`${enumsByCategory.layout.length} for layout`);
  }
  if (enumsByCategory.contentType.length > 0) {
    categories.push(`${enumsByCategory.contentType.length} for content types`);
  }
  if (enumsByCategory.status.length > 0) {
    categories.push(`${enumsByCategory.status.length} for status/workflow`);
  }
  if (enumsByCategory.businessLogic.length > 0) {
    categories.push(`${enumsByCategory.businessLogic.length} for business logic`);
  }
  
  if (categories.length > 0) {
    parts.push(`Distribution: ${categories.join(', ')}.`);
  }

  // Architectural concerns
  if (architecturalEnums.length > 0) {
    const critical = architecturalEnums.filter(e => e.healthStatus === 'critical');
    if (critical.length > 0) {
      parts.push(`⚠️ **${critical.length} enum(s) used for tenancy/brand segmentation** - consider migrating to content models for better scalability.`);
    }
  }

  // Health summary
  if (healthSummary.critical > 0) {
    parts.push(`Health: ${healthSummary.critical} critical, ${healthSummary.warning} warnings, ${healthSummary.healthy} healthy.`);
  } else if (healthSummary.warning > 0) {
    parts.push(`Health: ${healthSummary.warning} warnings, ${healthSummary.healthy} healthy.`);
  } else {
    parts.push(`All enums are healthy.`);
  }

  return parts.join(' ');
}


