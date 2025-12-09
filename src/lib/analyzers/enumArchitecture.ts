import type { HygraphSchema, AuditIssue } from '../types';
import { filterSystemEnums, filterSystemModels } from './systemFilters';

export interface EnumArchitectureAnalysis {
  architecturalPatterns: {
    multiBrand: {
      detected: boolean;
      enumName?: string;
      values: string[];
      recommendation: string;
    };
    multiRegion: {
      detected: boolean;
      enumName?: string;
      values: string[];
      recommendation: string;
    };
    multiTenant: {
      detected: boolean;
      enumName?: string;
      values: string[];
      recommendation: string;
    };
    multiSite: {
      detected: boolean;
      enumName?: string;
      values: string[];
      recommendation: string;
    };
  };
  
  lightweightArchitectureFlaws: {
    type: 'multi-brand' | 'multi-region' | 'multi-tenant' | 'multi-site' | null;
    issue: string;
    currentApproach: string;
    scalabilityRisk: 'high' | 'medium' | 'low';
    recommendation: string;
    affectedEnums: string[];
  }[];
  
  enumUsagePatterns: {
    stylingEnums: string[];
    layoutEnums: string[];
    contentTypeEnums: string[];
    businessLogicEnums: string[];
    tenancyEnums: string[];
  };
  
  enumHealth: {
    singleValueEnums: { name: string; value: string; issue: string }[];
    unusedEnums: string[];
    duplicateValues: { value: string; foundIn: string[] }[];
    overlappingEnums: { enums: string[]; overlap: string[] }[];
    oversizedEnums: { name: string; valueCount: number; recommendation: string }[];
  };
  
  overallAssessment: string;
  scalabilityScore: number;
}

// Patterns for detecting architectural enum usage
const multiBrandPatterns = /^(shop|brand|store|merchant|vendor|partner|client)s?$/i;
const multiRegionPatterns = /^(region|country|locale|language|market|territory|geo|location)s?$/i;
const multiTenantPatterns = /^(tenant|organization|org|company|workspace|account|site|instance)s?$/i;
const multiSitePatterns = /^(site|domain|subdomain|channel|platform|portal)s?$/i;

const stylingPatterns = /^(color|theme|size|variant|style|alignment|position|direction|spacing|weight|display)s?$/i;
const layoutPatterns = /^(layout|grid|column|row|section|width|height|flex|container|background)s?$/i;
const contentTypePatterns = /^(type|kind|category|format|mode|status|state|level|priority|visibility)s?$/i;

export function analyzeEnumArchitecture(schema: HygraphSchema): EnumArchitectureAnalysis {
  const enums = filterSystemEnums(schema.enums || []);
  
  // Detect architectural patterns in enums
  const architecturalPatterns = {
    multiBrand: detectPattern(enums, multiBrandPatterns),
    multiRegion: detectPattern(enums, multiRegionPatterns),
    multiTenant: detectPattern(enums, multiTenantPatterns),
    multiSite: detectPattern(enums, multiSitePatterns),
  };
  
  // Categorize enums by usage
  const enumUsagePatterns = categorizeEnums(enums);
  
  // Detect lightweight architecture flaws
  const lightweightArchitectureFlaws = detectLightweightArchitectureFlaws(
    architecturalPatterns,
    enums,
    schema.models
  );
  
  // Analyze enum health
  const enumHealth = analyzeEnumHealth(enums);
  
  // Calculate scalability score
  const scalabilityScore = calculateScalabilityScore(
    architecturalPatterns,
    lightweightArchitectureFlaws,
    enumHealth
  );
  
  // Generate overall assessment
  const overallAssessment = generateOverallAssessment(
    architecturalPatterns,
    lightweightArchitectureFlaws,
    scalabilityScore
  );
  
  return {
    architecturalPatterns,
    lightweightArchitectureFlaws,
    enumUsagePatterns,
    enumHealth,
    overallAssessment,
    scalabilityScore,
  };
}

function detectPattern(
  enums: { name: string; values: string[] }[],
  pattern: RegExp
): { detected: boolean; enumName?: string; values: string[]; recommendation: string } {
  const matchingEnum = enums.find(e => pattern.test(e.name));
  
  if (matchingEnum) {
    const patternType = getPatternType(pattern);
    return {
      detected: true,
      enumName: matchingEnum.name,
      values: matchingEnum.values,
      recommendation: matchingEnum.values.length > 10
        ? `Consider migrating ${matchingEnum.name} enum to a dedicated content model for better scalability and metadata support.`
        : matchingEnum.values.length > 5
          ? `${matchingEnum.name} enum is growing. Plan for migration to a content model if you expect to add more ${patternType}.`
          : `${matchingEnum.name} enum is appropriate for current scale. Monitor growth and plan migration if values exceed 10.`,
    };
  }
  
  return {
    detected: false,
    values: [],
    recommendation: 'No pattern detected.',
  };
}

function getPatternType(pattern: RegExp): string {
  if (pattern === multiBrandPatterns) return 'brands/shops';
  if (pattern === multiRegionPatterns) return 'regions/locales';
  if (pattern === multiTenantPatterns) return 'tenants/organizations';
  if (pattern === multiSitePatterns) return 'sites/domains';
  return 'values';
}

function categorizeEnums(enums: { name: string; values: string[] }[]): EnumArchitectureAnalysis['enumUsagePatterns'] {
  const result: EnumArchitectureAnalysis['enumUsagePatterns'] = {
    stylingEnums: [],
    layoutEnums: [],
    contentTypeEnums: [],
    businessLogicEnums: [],
    tenancyEnums: [],
  };
  
  for (const enumDef of enums) {
    if (stylingPatterns.test(enumDef.name) || enumDef.values.some(v => /^(sm|md|lg|xl|xs|primary|secondary|dark|light)$/i.test(v))) {
      result.stylingEnums.push(enumDef.name);
    } else if (layoutPatterns.test(enumDef.name)) {
      result.layoutEnums.push(enumDef.name);
    } else if (contentTypePatterns.test(enumDef.name)) {
      result.contentTypeEnums.push(enumDef.name);
    } else if (multiBrandPatterns.test(enumDef.name) || multiTenantPatterns.test(enumDef.name) || 
               multiRegionPatterns.test(enumDef.name) || multiSitePatterns.test(enumDef.name)) {
      result.tenancyEnums.push(enumDef.name);
    } else {
      result.businessLogicEnums.push(enumDef.name);
    }
  }
  
  return result;
}

function detectLightweightArchitectureFlaws(
  patterns: EnumArchitectureAnalysis['architecturalPatterns'],
  enums: { name: string; values: string[] }[],
  models: { name: string; fields: { name: string; type: string }[] }[]
): EnumArchitectureAnalysis['lightweightArchitectureFlaws'] {
  const flaws: EnumArchitectureAnalysis['lightweightArchitectureFlaws'] = [];
  
  // Check for lightweight multi-brand using enum
  if (patterns.multiBrand.detected && patterns.multiBrand.values.length > 3) {
    const enumUsageCount = countEnumUsageInModels(patterns.multiBrand.enumName!, models);
    
    if (enumUsageCount >= 3) {
      flaws.push({
        type: 'multi-brand',
        issue: `Using "${patterns.multiBrand.enumName}" enum across ${enumUsageCount} models for multi-brand architecture`,
        currentApproach: `Enum with ${patterns.multiBrand.values.length} values: ${patterns.multiBrand.values.slice(0, 5).join(', ')}${patterns.multiBrand.values.length > 5 ? '...' : ''}`,
        scalabilityRisk: patterns.multiBrand.values.length > 7 ? 'high' : patterns.multiBrand.values.length > 5 ? 'medium' : 'low',
        recommendation: 'Create a dedicated "Brand" or "Shop" content model with fields for name, logo, settings, etc. Replace enum references with model relations for better scalability and brand-specific metadata.',
        affectedEnums: [patterns.multiBrand.enumName!],
      });
    }
  }
  
  // Check for lightweight multi-region using enum
  if (patterns.multiRegion.detected && patterns.multiRegion.values.length > 5) {
    const enumUsageCount = countEnumUsageInModels(patterns.multiRegion.enumName!, models);
    
    if (enumUsageCount >= 2) {
      flaws.push({
        type: 'multi-region',
        issue: `Using "${patterns.multiRegion.enumName}" enum for multi-region content management`,
        currentApproach: `Enum with ${patterns.multiRegion.values.length} values for region-based content`,
        scalabilityRisk: patterns.multiRegion.values.length > 10 ? 'high' : 'medium',
        recommendation: 'Consider Hygraph\'s built-in localization features or create a "Region" content model for region-specific settings and content.',
        affectedEnums: [patterns.multiRegion.enumName!],
      });
    }
  }
  
  // Check for lightweight multi-tenant using enum
  if (patterns.multiTenant.detected) {
    const enumUsageCount = countEnumUsageInModels(patterns.multiTenant.enumName!, models);
    
    if (enumUsageCount >= 1) {
      flaws.push({
        type: 'multi-tenant',
        issue: `Using "${patterns.multiTenant.enumName}" enum for multi-tenant architecture - critical scalability concern`,
        currentApproach: `Enum-based tenancy with ${patterns.multiTenant.values.length} tenants`,
        scalabilityRisk: 'high',
        recommendation: 'Multi-tenant architectures should use proper content models with relations, not enums. Create a "Tenant" or "Organization" model with proper relations and permissions.',
        affectedEnums: [patterns.multiTenant.enumName!],
      });
    }
  }
  
  return flaws;
}

function countEnumUsageInModels(enumName: string, models: { name: string; fields: { name: string; type: string }[] }[]): number {
  let count = 0;
  for (const model of models) {
    for (const field of model.fields) {
      if (field.type === enumName || field.type.includes(enumName)) {
        count++;
        break; // Count each model only once
      }
    }
  }
  return count;
}

function analyzeEnumHealth(enums: { name: string; values: string[] }[]): EnumArchitectureAnalysis['enumHealth'] {
  const result: EnumArchitectureAnalysis['enumHealth'] = {
    singleValueEnums: [],
    unusedEnums: [],
    duplicateValues: [],
    overlappingEnums: [],
    oversizedEnums: [],
  };
  
  // Track all values across enums
  const valueToEnums: Record<string, string[]> = {};
  
  for (const enumDef of enums) {
    // Single value enums
    if (enumDef.values.length === 1) {
      result.singleValueEnums.push({
        name: enumDef.name,
        value: enumDef.values[0],
        issue: 'Single-value enum provides no selection benefit and adds schema complexity',
      });
    }
    
    // Oversized enums
    if (enumDef.values.length > 20) {
      result.oversizedEnums.push({
        name: enumDef.name,
        valueCount: enumDef.values.length,
        recommendation: `Consider migrating "${enumDef.name}" (${enumDef.values.length} values) to a dedicated content model for better manageability`,
      });
    }
    
    // Track values for duplicate detection
    for (const value of enumDef.values) {
      if (!valueToEnums[value]) {
        valueToEnums[value] = [];
      }
      valueToEnums[value].push(enumDef.name);
    }
  }
  
  // Find duplicate values across enums
  for (const [value, enumNames] of Object.entries(valueToEnums)) {
    if (enumNames.length > 1) {
      result.duplicateValues.push({
        value,
        foundIn: enumNames,
      });
    }
  }
  
  // Find overlapping enums (enums with significant overlap)
  const enumPairs: Set<string> = new Set();
  for (let i = 0; i < enums.length; i++) {
    for (let j = i + 1; j < enums.length; j++) {
      const overlap = enums[i].values.filter(v => enums[j].values.includes(v));
      const overlapRatio = overlap.length / Math.min(enums[i].values.length, enums[j].values.length);
      
      if (overlapRatio > 0.5 && overlap.length >= 3) {
        const pairKey = [enums[i].name, enums[j].name].sort().join('|');
        if (!enumPairs.has(pairKey)) {
          enumPairs.add(pairKey);
          result.overlappingEnums.push({
            enums: [enums[i].name, enums[j].name],
            overlap,
          });
        }
      }
    }
  }
  
  return result;
}

function calculateScalabilityScore(
  patterns: EnumArchitectureAnalysis['architecturalPatterns'],
  flaws: EnumArchitectureAnalysis['lightweightArchitectureFlaws'],
  health: EnumArchitectureAnalysis['enumHealth']
): number {
  let score = 100;
  
  // Deduct for architecture flaws
  for (const flaw of flaws) {
    if (flaw.scalabilityRisk === 'high') score -= 20;
    else if (flaw.scalabilityRisk === 'medium') score -= 10;
    else score -= 5;
  }
  
  // Deduct for health issues
  score -= health.singleValueEnums.length * 2;
  score -= health.oversizedEnums.length * 5;
  score -= health.overlappingEnums.length * 3;
  
  // Bonus for proper architecture patterns (detected but well-sized)
  if (patterns.multiBrand.detected && patterns.multiBrand.values.length <= 5) score += 5;
  if (patterns.multiRegion.detected && patterns.multiRegion.values.length <= 10) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

function generateOverallAssessment(
  patterns: EnumArchitectureAnalysis['architecturalPatterns'],
  flaws: EnumArchitectureAnalysis['lightweightArchitectureFlaws'],
  score: number
): string {
  const detectedPatterns = [
    patterns.multiBrand.detected && 'multi-brand',
    patterns.multiRegion.detected && 'multi-region',
    patterns.multiTenant.detected && 'multi-tenant',
    patterns.multiSite.detected && 'multi-site',
  ].filter(Boolean);
  
  if (detectedPatterns.length === 0) {
    return 'Enum architecture is straightforward with no complex tenancy patterns detected. Enums are used primarily for content types and styling.';
  }
  
  const highRiskFlaws = flaws.filter(f => f.scalabilityRisk === 'high');
  
  if (highRiskFlaws.length > 0) {
    return `Critical: ${detectedPatterns.join(', ')} architecture detected using lightweight enum-based approach. This creates scalability risks and limits metadata capabilities. Consider migrating to dedicated content models.`;
  }
  
  if (flaws.length > 0) {
    return `${detectedPatterns.join(', ')} pattern(s) detected with some scalability considerations. Review the recommendations for each pattern to ensure future scalability.`;
  }
  
  return `${detectedPatterns.join(', ')} pattern(s) detected with appropriate enum sizing. Monitor growth and plan migration if business requirements expand.`;
}

export function generateEnumArchitectureIssues(analysis: EnumArchitectureAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Issues from architecture flaws
  for (const flaw of analysis.lightweightArchitectureFlaws) {
    issues.push({
      id: `enum-arch-${flaw.type}`,
      severity: flaw.scalabilityRisk === 'high' ? 'critical' : 'warning',
      category: 'schema',
      title: `Lightweight ${flaw.type} Architecture via Enum`,
      description: flaw.issue,
      impact: `${flaw.currentApproach}. This approach limits scalability, prevents adding metadata, and complicates content filtering.`,
      recommendation: flaw.recommendation,
      affectedItems: flaw.affectedEnums,
    });
  }
  
  // Issues from health problems
  for (const singleValue of analysis.enumHealth.singleValueEnums) {
    issues.push({
      id: `enum-single-${singleValue.name}`,
      severity: 'info',
      category: 'best-practices',
      title: `Single-Value Enum: ${singleValue.name}`,
      description: `Enum "${singleValue.name}" has only one value: "${singleValue.value}"`,
      impact: singleValue.issue,
      recommendation: 'Remove the enum and use a constant, or add more meaningful values if selection will be needed.',
      affectedItems: [singleValue.name],
    });
  }
  
  for (const oversized of analysis.enumHealth.oversizedEnums) {
    issues.push({
      id: `enum-oversized-${oversized.name}`,
      severity: 'warning',
      category: 'schema',
      title: `Oversized Enum: ${oversized.name}`,
      description: `Enum "${oversized.name}" has ${oversized.valueCount} values`,
      impact: 'Large enums are difficult to maintain, slow to load in editors, and may indicate a need for a proper content model.',
      recommendation: oversized.recommendation,
      affectedItems: [oversized.name],
    });
  }
  
  for (const overlap of analysis.enumHealth.overlappingEnums) {
    issues.push({
      id: `enum-overlap-${overlap.enums.join('-')}`,
      severity: 'info',
      category: 'best-practices',
      title: `Overlapping Enums: ${overlap.enums.join(' & ')}`,
      description: `These enums share ${overlap.overlap.length} values: ${overlap.overlap.slice(0, 5).join(', ')}`,
      impact: 'Duplicate values across enums may indicate a need for consolidation or a shared base enum.',
      recommendation: 'Consider merging these enums or extracting common values to a shared enum.',
      affectedItems: overlap.enums,
    });
  }
  
  return issues;
}

export function calculateEnumArchitectureScore(analysis: EnumArchitectureAnalysis): number {
  return analysis.scalabilityScore;
}



