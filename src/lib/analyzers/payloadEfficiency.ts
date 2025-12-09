/**
 * API Payload Efficiency Analyzer
 * 
 * Estimates the response payload size for each model to identify
 * potentially heavy API responses that could impact performance.
 */

import type { HygraphSchema, HygraphModel, HygraphField } from '../types';
import { filterSystemModels, filterSystemComponents } from './systemFilters';

// Estimated bytes per field type (conservative averages)
const FIELD_SIZE_BYTES: Record<string, number> = {
  // Scalar types
  String: 100,      // Average text field
  Int: 8,
  Float: 8,
  Boolean: 4,
  Date: 24,         // ISO date string
  DateTime: 24,
  ID: 36,           // UUID length
  
  // Complex types
  Enum: 20,         // Enum value string
  Json: 2000,       // Arbitrary JSON blob
  RichText: 5000,   // HTML/AST content
  Markdown: 1500,   // Markdown text
  
  // Media/Location
  Asset: 500,       // URL + metadata (fileName, size, mimeType, etc.)
  Location: 50,     // lat/lng pair
  Color: 20,        // Hex or RGBA
  
  // Default for unknown types
  default: 100,
};

// Average multiplier for list fields
const LIST_MULTIPLIER = 5;

// Average number of components in a union/list
const COMPONENT_LIST_MULTIPLIER = 4;

// Maximum recursion depth for references
const MAX_DEPTH = 2;

export interface PayloadFieldBreakdown {
  field: string;
  type: string;
  bytes: number;
  percentage: number;
  isHeavy: boolean; // >20% of payload
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
  overallScore: number; // 0-100
}

/**
 * Estimate the size of a single field
 */
function estimateFieldSize(
  field: HygraphField,
  schema: HygraphSchema,
  depth: number = 0,
  visited: Set<string> = new Set()
): number {
  const baseType = field.type.replace(/[\[\]!]/g, ''); // Strip GraphQL modifiers
  
  // Check for reference/relation fields
  if (field.relatedModel) {
    if (depth >= MAX_DEPTH || visited.has(field.relatedModel)) {
      // At max depth or circular - return minimal estimate
      return 100;
    }
    
    // Find the related model
    const relatedModel = schema.models.find(m => m.name === field.relatedModel);
    if (relatedModel) {
      const newVisited = new Set(visited);
      newVisited.add(field.relatedModel);
      const relatedSize = estimateModelPayload(relatedModel, schema, depth + 1, newVisited);
      
      // List relations multiply
      if (field.isList) {
        return relatedSize * LIST_MULTIPLIER;
      }
      return relatedSize;
    }
  }
  
  // Check for component fields
  const isComponentType = schema.components?.some(c => c.name === baseType);
  if (isComponentType) {
    const component = schema.components?.find(c => c.name === baseType);
    if (component) {
      const componentSize = estimateComponentSize(component, schema, depth);
      return field.isList ? componentSize * COMPONENT_LIST_MULTIPLIER : componentSize;
    }
  }
  
  // Check if it's a union type (component list accepting multiple types)
  if (field.isList && field.type.includes('Union')) {
    // Estimate as average component size * multiplier
    const avgComponentSize = 800;
    return avgComponentSize * COMPONENT_LIST_MULTIPLIER;
  }
  
  // Standard field types
  const baseSize = FIELD_SIZE_BYTES[baseType] || FIELD_SIZE_BYTES['default'];
  
  // List fields multiply
  if (field.isList) {
    return baseSize * LIST_MULTIPLIER;
  }
  
  return baseSize;
}

/**
 * Estimate the size of a component
 */
function estimateComponentSize(
  component: HygraphModel,
  schema: HygraphSchema,
  depth: number
): number {
  let total = 0;
  for (const field of component.fields) {
    total += estimateFieldSize(field, schema, depth, new Set());
  }
  return total;
}

/**
 * Estimate the total payload size for a model
 */
function estimateModelPayload(
  model: HygraphModel,
  schema: HygraphSchema,
  depth: number = 0,
  visited: Set<string> = new Set()
): number {
  let total = 0;
  
  for (const field of model.fields) {
    total += estimateFieldSize(field, schema, depth, visited);
  }
  
  return total;
}

/**
 * Analyze payload efficiency for all models
 */
export function analyzePayloadEfficiency(schema: HygraphSchema): PayloadEfficiencyAnalysis {
  const customModels = filterSystemModels(schema.models);
  const estimates: PayloadEstimate[] = [];
  const heavyModels: { model: string; kb: number; reason: string }[] = [];
  let totalBytes = 0;
  
  for (const model of customModels) {
    const fieldBreakdown: PayloadFieldBreakdown[] = [];
    let modelTotalBytes = 0;
    
    // Calculate size for each field
    for (const field of model.fields) {
      const bytes = estimateFieldSize(field, schema, 0, new Set([model.name]));
      modelTotalBytes += bytes;
      
      fieldBreakdown.push({
        field: field.name,
        type: field.type,
        bytes,
        percentage: 0, // Will calculate after total
        isHeavy: false,
      });
    }
    
    // Calculate percentages and identify heavy fields
    const heavyFields: string[] = [];
    for (const fb of fieldBreakdown) {
      fb.percentage = modelTotalBytes > 0 ? Math.round((fb.bytes / modelTotalBytes) * 100) : 0;
      fb.isHeavy = fb.percentage > 20;
      if (fb.isHeavy) {
        heavyFields.push(fb.field);
      }
    }
    
    // Sort by size descending
    fieldBreakdown.sort((a, b) => b.bytes - a.bytes);
    
    const estimatedKB = Math.round(modelTotalBytes / 1024 * 10) / 10;
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (estimatedKB > 100) {
      riskLevel = 'high';
    } else if (estimatedKB > 50) {
      riskLevel = 'medium';
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (riskLevel === 'high') {
      recommendations.push(`Consider lazy-loading relations or using field selection`);
    }
    if (heavyFields.length > 0) {
      const richTextFields = fieldBreakdown.filter(f => 
        f.type.includes('RichText') && f.isHeavy
      );
      if (richTextFields.length > 0) {
        recommendations.push(`Rich text fields (${richTextFields.map(f => f.field).join(', ')}) are heavy - consider excerpts for list views`);
      }
      
      const listRelations = fieldBreakdown.filter(f => 
        f.isHeavy && f.type.includes('[')
      );
      if (listRelations.length > 0) {
        recommendations.push(`List relations (${listRelations.map(f => f.field).join(', ')}) multiply payload - use pagination`);
      }
    }
    
    estimates.push({
      model: model.name,
      estimatedBytes: modelTotalBytes,
      estimatedKB,
      fieldBreakdown,
      riskLevel,
      heavyFields,
      recommendations,
    });
    
    totalBytes += modelTotalBytes;
    
    // Track heavy models
    if (riskLevel !== 'low') {
      let reason = '';
      if (heavyFields.length > 0) {
        reason = `Heavy fields: ${heavyFields.slice(0, 3).join(', ')}`;
      } else if (model.fields.length > 30) {
        reason = `Many fields (${model.fields.length})`;
      } else {
        reason = `Complex nested relations`;
      }
      
      heavyModels.push({
        model: model.name,
        kb: estimatedKB,
        reason,
      });
    }
  }
  
  // Sort estimates by size descending
  estimates.sort((a, b) => b.estimatedBytes - a.estimatedBytes);
  heavyModels.sort((a, b) => b.kb - a.kb);
  
  // Calculate average
  const avgPayloadKB = customModels.length > 0 
    ? Math.round((totalBytes / customModels.length) / 1024 * 10) / 10
    : 0;
  
  // Generate overall recommendations
  const overallRecommendations: string[] = [];
  
  if (heavyModels.length > 0) {
    overallRecommendations.push(
      `${heavyModels.length} model(s) have estimated payloads >50KB - review field selection in queries`
    );
  }
  
  const richTextCount = customModels.reduce((count, model) => 
    count + model.fields.filter(f => f.type.includes('RichText')).length, 0
  );
  if (richTextCount > 10) {
    overallRecommendations.push(
      `Schema has ${richTextCount} RichText fields - consider using excerpts for list queries`
    );
  }
  
  const deepRelations = customModels.filter(m => 
    m.fields.some(f => f.relatedModel && f.isList)
  );
  if (deepRelations.length > 5) {
    overallRecommendations.push(
      `${deepRelations.length} models have list relations - ensure queries use pagination`
    );
  }
  
  if (overallRecommendations.length === 0) {
    overallRecommendations.push('Payload sizes are within healthy ranges');
  }
  
  // Calculate overall score
  let score = 100;
  score -= heavyModels.filter(m => m.kb > 100).length * 15; // High risk
  score -= heavyModels.filter(m => m.kb <= 100 && m.kb > 50).length * 8; // Medium risk
  score = Math.max(0, Math.min(100, score));
  
  return {
    estimates,
    heavyModels,
    avgPayloadKB,
    totalModelsAnalyzed: customModels.length,
    recommendations: overallRecommendations,
    overallScore: score,
  };
}
