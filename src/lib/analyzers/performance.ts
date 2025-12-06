import type { HygraphSchema, PerformanceAnalysis, AuditIssue, SchemaAnalysis } from '../types';

// Estimate payload size based on field types
function estimateFieldSize(fieldType: string, isList: boolean): number {
  const baseSizes: Record<string, number> = {
    'String': 100,
    'Int': 8,
    'Float': 8,
    'Boolean': 4,
    'ID': 36,
    'DateTime': 24,
    'Date': 10,
    'Json': 500,
    'RichText': 2000,
    'Asset': 200,
  };
  
  const baseSize = baseSizes[fieldType] || 100;
  return isList ? baseSize * 10 : baseSize; // Assume 10 items for lists
}

function calculateModelPayloadSize(
  schema: HygraphSchema, 
  modelName: string, 
  visited: Set<string> = new Set()
): number {
  if (visited.has(modelName)) return 0; // Prevent infinite recursion
  visited.add(modelName);
  
  const model = schema.models.find(m => m.name === modelName);
  if (!model) return 0;
  
  let size = 0;
  for (const field of model.fields) {
    if (field.relatedModel) {
      // Relation - add nested size (limited depth)
      if (visited.size < 3) {
        size += calculateModelPayloadSize(schema, field.relatedModel, new Set(visited));
      } else {
        size += 50; // Just ID reference
      }
    } else {
      size += estimateFieldSize(field.type, field.isList || false);
    }
  }
  
  return size;
}

// Find query depth risks (paths that would require deep queries)
function findQueryDepthRisks(schema: HygraphSchema): {
  path: string[];
  depth: number;
  recommendation: string;
}[] {
  const risks: { path: string[]; depth: number; recommendation: string }[] = [];
  
  function findPaths(
    modelName: string, 
    path: string[], 
    visited: Set<string>,
    maxDepth: number = 6
  ): void {
    if (path.length >= maxDepth || visited.has(modelName)) return;
    
    visited.add(modelName);
    path.push(modelName);
    
    const model = schema.models.find(m => m.name === modelName);
    if (!model) {
      path.pop();
      visited.delete(modelName);
      return;
    }
    
    // Check if this is a risky depth
    if (path.length >= 4) {
      risks.push({
        path: [...path],
        depth: path.length,
        recommendation: path.length >= 5 
          ? 'Consider flattening or using separate queries' 
          : 'Use @skip or fragments to limit query depth',
      });
    }
    
    // Continue exploring
    for (const field of model.fields) {
      if (field.relatedModel && !visited.has(field.relatedModel)) {
        const relatedModel = schema.models.find(m => m.name === field.relatedModel);
        if (relatedModel) {
          findPaths(field.relatedModel, path, new Set(visited), maxDepth);
        }
      }
    }
    
    path.pop();
    visited.delete(modelName);
  }
  
  for (const model of schema.models) {
    findPaths(model.name, [], new Set());
  }
  
  // Deduplicate and sort by depth
  const uniqueRisks = risks.reduce((acc, risk) => {
    const key = risk.path.join('->');
    if (!acc.has(key)) {
      acc.set(key, risk);
    }
    return acc;
  }, new Map<string, typeof risks[0]>());
  
  return Array.from(uniqueRisks.values())
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 10);
}

// Find component nesting depth
function calculateComponentNestingDepths(schema: HygraphSchema): {
  component: string;
  depth: number;
}[] {
  const depths: { component: string; depth: number }[] = [];
  const componentNames = new Set(schema.components.map(c => c.name));
  
  function getDepth(name: string, visited: Set<string>): number {
    if (visited.has(name)) return 0;
    visited.add(name);
    
    const component = schema.components.find(c => c.name === name);
    if (!component) return 0;
    
    let maxChildDepth = 0;
    for (const field of component.fields) {
      if (field.relatedModel && componentNames.has(field.relatedModel)) {
        maxChildDepth = Math.max(maxChildDepth, getDepth(field.relatedModel, new Set(visited)));
      }
    }
    
    return maxChildDepth + 1;
  }
  
  for (const component of schema.components) {
    depths.push({
      component: component.name,
      depth: getDepth(component.name, new Set()),
    });
  }
  
  return depths.sort((a, b) => b.depth - a.depth);
}

export function analyzePerformance(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  entryCounts: Record<string, { draft: number; published: number }>,
  assetStats: { total: number; withoutAlt: number; largeAssets: number }
): PerformanceAnalysis {
  const queryDepthRisks = findQueryDepthRisks(schema);
  
  // Find large collections
  const largeCollections = Object.entries(entryCounts)
    .filter(([, counts]) => counts.draft > 1000)
    .map(([model, counts]) => ({
      model,
      count: counts.draft,
      recommendation: counts.draft > 10000 
        ? 'Implement cursor-based pagination' 
        : 'Use pagination (first/skip) in queries',
    }))
    .sort((a, b) => b.count - a.count);
  
  // Find heavy models (many fields)
  const heavyModels = schema.models
    .map(model => ({
      model: model.name,
      fieldCount: model.fields.length,
      estimatedPayloadKB: Math.round(calculateModelPayloadSize(schema, model.name) / 1024 * 10) / 10,
    }))
    .filter(m => m.fieldCount > 15 || m.estimatedPayloadKB > 5)
    .sort((a, b) => b.estimatedPayloadKB - a.estimatedPayloadKB);
  
  const componentNestingDepth = calculateComponentNestingDepths(schema);
  
  return {
    queryDepthRisks,
    largeCollections,
    heavyModels,
    circularRelationRisks: schemaAnalysis.circularRelations,
    componentNestingDepth,
  };
}

export function generatePerformanceIssues(
  analysis: PerformanceAnalysis,
  assetStats: { total: number; withoutAlt: number; largeAssets: number }
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Query depth risks
  for (const risk of analysis.queryDepthRisks.slice(0, 5)) {
    issues.push({
      id: `query-depth-${risk.path.join('-')}`,
      severity: risk.depth >= 5 ? 'warning' : 'info',
      category: 'performance',
      title: 'Deep Query Path',
      description: `Query path ${risk.depth} levels deep: ${risk.path.join(' → ')}`,
      impact: 'Deep queries increase response time and API complexity',
      recommendation: risk.recommendation,
      affectedItems: risk.path,
    });
  }
  
  // Large collections
  for (const collection of analysis.largeCollections) {
    issues.push({
      id: `large-collection-${collection.model}`,
      severity: collection.count > 10000 ? 'warning' : 'info',
      category: 'performance',
      title: 'Large Collection',
      description: `"${collection.model}" has ${collection.count.toLocaleString()} entries`,
      impact: 'Queries without pagination will be slow and may timeout',
      recommendation: collection.recommendation,
      affectedItems: [collection.model],
    });
  }
  
  // Heavy models
  for (const heavy of analysis.heavyModels.slice(0, 5)) {
    issues.push({
      id: `heavy-model-${heavy.model}`,
      severity: heavy.fieldCount > 25 ? 'warning' : 'info',
      category: 'performance',
      title: 'Heavy Model',
      description: `"${heavy.model}" has ${heavy.fieldCount} fields (~${heavy.estimatedPayloadKB}KB per entry)`,
      impact: 'Large payloads increase bandwidth and parsing time',
      recommendation: 'Use field selection to fetch only needed fields',
      affectedItems: [heavy.model],
    });
  }
  
  // Circular relation risks
  for (const cycle of analysis.circularRelationRisks) {
    issues.push({
      id: `circular-perf-${cycle.join('-')}`,
      severity: 'critical',
      category: 'performance',
      title: 'Circular Relation Risk',
      description: `Circular path: ${cycle.join(' → ')}`,
      impact: 'Can cause infinite loops or stack overflow in queries',
      recommendation: 'Set query depth limits or restructure relations',
      affectedItems: cycle,
    });
  }
  
  // Deep component nesting
  for (const comp of analysis.componentNestingDepth) {
    if (comp.depth > 3) {
      issues.push({
        id: `deep-component-nesting-${comp.component}`,
        severity: comp.depth > 4 ? 'warning' : 'info',
        category: 'performance',
        title: 'Deep Component Nesting',
        description: `Component "${comp.component}" has ${comp.depth} levels of nesting`,
        impact: 'Deeply nested components increase query complexity',
        recommendation: 'Flatten component structure or limit nesting depth',
        affectedItems: [comp.component],
      });
    }
  }
  
  // Large assets
  if (assetStats.largeAssets > 0) {
    issues.push({
      id: 'large-assets',
      severity: assetStats.largeAssets > 50 ? 'warning' : 'info',
      category: 'performance',
      title: 'Large Assets',
      description: `${assetStats.largeAssets} asset(s) over 1MB`,
      impact: 'Large assets slow down page loads significantly',
      recommendation: 'Use Hygraph image transformations to optimize delivery',
      affectedItems: [],
    });
  }
  
  return issues;
}

export function calculatePerformanceScore(analysis: PerformanceAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for query depth risks
  score -= Math.min(analysis.queryDepthRisks.length * 3, 15);
  
  // Deduct for very deep queries (5+)
  const veryDeepQueries = analysis.queryDepthRisks.filter(r => r.depth >= 5);
  score -= veryDeepQueries.length * 5;
  
  // Deduct for large collections
  score -= Math.min(analysis.largeCollections.length * 3, 15);
  
  // Extra deduction for very large collections
  const veryLarge = analysis.largeCollections.filter(c => c.count > 10000);
  score -= veryLarge.length * 5;
  
  // Deduct for heavy models
  score -= Math.min(analysis.heavyModels.length * 2, 10);
  
  // Deduct for circular relations (critical)
  score -= analysis.circularRelationRisks.length * 10;
  
  // Deduct for deep component nesting
  const deepComponents = analysis.componentNestingDepth.filter(c => c.depth > 3);
  score -= deepComponents.length * 3;
  
  return Math.max(0, Math.min(100, score));
}


