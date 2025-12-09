import type { HygraphSchema, SchemaAnalysis, AuditIssue } from '../types';
import { filterSystemComponents, filterSystemEnums, filterSystemModels } from './systemFilters';

// Build adjacency list for relation graph
function buildRelationGraph(schema: HygraphSchema): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  for (const model of schema.models) {
    if (!graph.has(model.name)) {
      graph.set(model.name, new Set());
    }
    
    for (const field of model.fields) {
      if (field.relatedModel && schema.models.some(m => m.name === field.relatedModel)) {
        graph.get(model.name)!.add(field.relatedModel);
      }
    }
  }
  
  return graph;
}

// Identify bidirectional relations (two-way references)
// In Hygraph, these are a FEATURE - one relationship accessible from both sides
// They should NOT be flagged as circular references
function identifyBidirectionalRelations(graph: Map<string, Set<string>>): Array<[string, string]> {
  const bidirectional: Array<[string, string]> = [];
  const seen = new Set<string>();
  
  for (const [modelA, relations] of graph.entries()) {
    for (const modelB of relations) {
      const pairKey = [modelA, modelB].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      
      // Check if B also has a relation back to A (bidirectional/two-way reference)
      const bRelations = graph.get(modelB);
      if (bRelations && bRelations.has(modelA)) {
        bidirectional.push([modelA, modelB]);
      }
    }
  }
  
  return bidirectional;
}

// Find deep relation chains that may impact query performance
// Only flag chains of 4+ distinct models as a performance consideration
function findDeepRelationChains(
  graph: Map<string, Set<string>>,
  maxDepth: number = 10
): { maxDepth: number; deepPaths: string[][] } {
  const deepPaths: string[][] = [];
  let maxFoundDepth = 0;
  
  function dfs(node: string, path: string[], visited: Set<string>): void {
    if (path.length > maxDepth || visited.has(node)) return;
    
    visited.add(node);
    path.push(node);
    
    if (path.length > maxFoundDepth) {
      maxFoundDepth = path.length;
    }
    
    // Only record paths with 4+ models (meaningful depth for performance)
    if (path.length >= 4) {
      deepPaths.push([...path]);
    }
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path, new Set(visited));
      }
    }
    
    path.pop();
  }
  
  for (const node of graph.keys()) {
    dfs(node, [], new Set());
  }
  
  // Sort by depth and take most significant
  deepPaths.sort((a, b) => b.length - a.length);
  
  return {
    maxDepth: maxFoundDepth,
    deepPaths: deepPaths.slice(0, 5),
  };
}

// Calculate field type distribution
function getFieldTypeDistribution(schema: HygraphSchema): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      const type = field.relatedModel ? 'Relation' : field.type;
      distribution[type] = (distribution[type] || 0) + 1;
    }
  }
  
  for (const component of schema.components) {
    for (const field of component.fields) {
      const type = field.relatedModel ? 'Relation' : field.type;
      distribution[type] = (distribution[type] || 0) + 1;
    }
  }
  
  return distribution;
}

// Analyze model complexity for editorial experience
function analyzeModelComplexity(schema: HygraphSchema): {
  simpleModels: string[];
  moderateModels: string[];
  complexModels: { name: string; fieldCount: number; relationCount: number }[];
} {
  const simpleModels: string[] = [];
  const moderateModels: string[] = [];
  const complexModels: { name: string; fieldCount: number; relationCount: number }[] = [];
  
  for (const model of schema.models) {
    const fieldCount = model.fields.length;
    const relationCount = model.fields.filter(f => f.relatedModel).length;
    
    if (fieldCount <= 10) {
      simpleModels.push(model.name);
    } else if (fieldCount <= 20) {
      moderateModels.push(model.name);
    } else {
      complexModels.push({ name: model.name, fieldCount, relationCount });
    }
  }
  
  return { simpleModels, moderateModels, complexModels };
}

export function analyzeSchema(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): SchemaAnalysis {
  const customModels = filterSystemModels(schema.models);
  const customComponents = filterSystemComponents(schema.components || []);
  const customEnums = filterSystemEnums(schema.enums || []);
  
  const graph = buildRelationGraph(schema);
  const twoWayReferences = identifyBidirectionalRelations(graph);
  const { maxDepth, deepPaths } = findDeepRelationChains(graph);
  
  // Find models without entries but check if they're referenced
  const referencedModels = new Set<string>();
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.relatedModel) {
        referencedModels.add(field.relatedModel);
      }
    }
  }
  
  const orphanModels = schema.models
    .filter(m => {
      const counts = entryCounts[m.name];
      const hasNoEntries = !counts || (counts.draft === 0 && counts.published === 0);
      const isNotReferenced = !referencedModels.has(m.name);
      return hasNoEntries && isNotReferenced;
    })
    .map(m => m.name);
  
  // Count total relations
  let relationCount = 0;
  for (const model of schema.models) {
    relationCount += model.fields.filter(f => f.relatedModel).length;
  }
  
  // Total fields (custom items only)
  const totalFields = customModels.reduce((sum, m) => sum + m.fields.length, 0) +
                      customComponents.reduce((sum, c) => sum + c.fields.length, 0);
  
  return {
    modelCount: customModels.length,
    componentCount: customComponents.length,
    enumCount: customEnums.length,
    totalFields,
    fieldTypeDistribution: getFieldTypeDistribution(schema),
    relationCount,
    twoWayReferences, // Just tracking, not flagging
    circularRelations: [], // Removed - two-way refs are not circular
    maxNestingDepth: maxDepth,
    deepNestingPaths: deepPaths,
    orphanModels,
  };
}

// Generate strategic findings, not technical issues
export function generateSchemaIssues(analysis: SchemaAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // NOTE: Two-way references are NOT flagged - they're a normal Hygraph feature
  // A → B with a reverse field is ONE bidirectional relationship, not a circular dependency
  
  // Deep relation chains (performance consideration)
  const veryDeepPaths = analysis.deepNestingPaths.filter(p => p.length >= 5);
  if (veryDeepPaths.length > 0) {
    issues.push({
      id: 'deep-relation-chains',
      severity: 'warning',
      category: 'performance',
      title: 'Deep Relation Chains May Impact Query Performance',
      description: `${veryDeepPaths.length} relation chain(s) with 5+ levels detected. The deepest path: ${veryDeepPaths[0].join(' → ')}`,
      impact: 'Queries traversing these chains will be slower and return larger payloads. Frontend developers may over-fetch data.',
      recommendation: 'Consider flattening frequently-queried paths or using GraphQL fragments to limit depth. Evaluate if all levels are needed.',
      affectedItems: veryDeepPaths[0],
    });
  }
  
  // Truly unused models (no entries AND not referenced)
  if (analysis.orphanModels.length > 0) {
    issues.push({
      id: 'unused-models',
      severity: 'info',
      category: 'governance',
      title: 'Models Without Content or References',
      description: `${analysis.orphanModels.length} model(s) have no entries and aren't referenced: ${analysis.orphanModels.slice(0, 5).join(', ')}${analysis.orphanModels.length > 5 ? '...' : ''}`,
      impact: 'Unused models add schema complexity and may confuse editors navigating the content types.',
      recommendation: 'Review if these models are needed. If deprecated, consider removing them to simplify the schema.',
      affectedItems: analysis.orphanModels,
    });
  }
  
  // Large schema complexity
  if (analysis.modelCount > 30) {
    const severity = analysis.modelCount > 50 ? 'warning' : 'info';
    issues.push({
      id: 'schema-complexity',
      severity,
      category: 'governance',
      title: 'Large Schema May Challenge Content Governance',
      description: `Schema contains ${analysis.modelCount} models with ${analysis.totalFields} total fields.`,
      impact: 'Large schemas require strong documentation and governance. Editors may struggle to find the right content type.',
      recommendation: 'Consider grouping related models, using naming conventions, or creating an editorial guide.',
      affectedItems: [],
    });
  }
  
  return issues;
}

export function calculateSchemaScore(analysis: SchemaAnalysis, issues: AuditIssue[]): number {
  let score = 85; // Start at good baseline
  
  // Bonus for using bidirectional relations appropriately
  if (analysis.twoWayReferences.length > 0) {
    score += 5; // Shows proper use of Hygraph features
  }
  
  // Bonus for using components
  if (analysis.componentCount > 0) {
    score += Math.min(analysis.componentCount * 2, 10);
  }
  
  // Minor deduction for very deep nesting
  const veryDeepPaths = analysis.deepNestingPaths.filter(p => p.length >= 5);
  score -= veryDeepPaths.length * 3;
  
  // Minor deduction for unused models
  score -= Math.min(analysis.orphanModels.length, 5);
  
  // Complexity considerations
  if (analysis.modelCount > 50) score -= 5;
  if (analysis.modelCount > 100) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}
