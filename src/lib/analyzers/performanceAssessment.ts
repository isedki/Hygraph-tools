import type {
  HygraphSchema,
  HygraphModel,
  PerformanceAssessment,
  NestedComponentInfo,
  NestedModelInfo,
  HugeModelInfo,
  MissingRequiredFieldInfo,
  CheckpointResult,
  CheckpointStatus,
} from '../types';
import { filterSystemComponents, filterSystemModels } from './systemFilters';

// ============================================
// Configuration
// ============================================

const HUGE_MODEL_THRESHOLD = 25; // Fields count threshold
const DEEP_NESTING_THRESHOLD = 3; // Levels
const HIGH_QUERY_COST_THRESHOLD = 4; // Relation depth

// Fields that should typically be required
const SHOULD_BE_REQUIRED_PATTERNS = [
  { pattern: /^(title|name|headline)$/i, reason: 'Primary identifier' },
  { pattern: /^slug$/i, reason: 'URL routing' },
  { pattern: /^type$/i, reason: 'Content classification' },
];

// ============================================
// Main Analyzer
// ============================================

export function analyzePerformanceAssessment(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): PerformanceAssessment {
  const customModels = filterSystemModels(schema.models);
  const components = filterSystemComponents(schema.components || []);

  const nestedComponents = analyzeNestedComponents(components, customModels);
  const nestedModels = analyzeNestedModels(customModels);
  const hugeModels = analyzeHugeModels(customModels, entryCounts);
  const missingRequiredFields = analyzeMissingRequiredFields(customModels, entryCounts);
  const deepQueryPaths = analyzeDeepQueryPaths(schema);
  const recursiveChains = analyzeRecursiveChains(schema);
  
  // Calculate overall score
  const overallScore = calculateOverallScore(
    nestedComponents,
    nestedModels,
    hugeModels,
    missingRequiredFields,
    deepQueryPaths,
    recursiveChains
  );

  return {
    nestedComponents,
    nestedModels,
    hugeModels,
    missingRequiredFields,
    deepQueryPaths,
    recursiveChains,
    overallScore,
  };
}

// ============================================
// Nested Components Analysis
// Handles: direct nesting, list fields (union-like), and recursive patterns
// ============================================

function analyzeNestedComponents(
  components: HygraphModel[],
  models: HygraphModel[]
): PerformanceAssessment['nestedComponents'] {
  const nestedItems: NestedComponentInfo[] = [];
  const componentNames = new Set(components.map(c => c.name));

  // Build comprehensive component graph including list fields
  // List fields often indicate modular block/union patterns
  const componentRelations = new Map<string, { target: string; isList: boolean; fieldName: string }[]>();
  
  for (const comp of components) {
    const relations: { target: string; isList: boolean; fieldName: string }[] = [];
    
    for (const field of comp.fields) {
      // Check if field references another component
      if (field.relatedModel && componentNames.has(field.relatedModel)) {
        relations.push({
          target: field.relatedModel,
          isList: field.isList || false,
          fieldName: field.name,
        });
      }
      
      // Also check field type (some schemas use type instead of relatedModel)
      if (field.type && componentNames.has(field.type) && field.type !== field.relatedModel) {
        relations.push({
          target: field.type,
          isList: field.isList || false,
          fieldName: field.name,
        });
      }
    }
    
    componentRelations.set(comp.name, relations);
  }

  // Calculate nesting depth with path tracking
  // Uses memoization to avoid recalculating
  const depthCache = new Map<string, { depth: number; path: string[]; hasListNesting: boolean }>();

  function calculateDepth(
    compName: string,
    visited: Set<string>,
    currentPath: string[]
  ): { depth: number; path: string[]; hasListNesting: boolean } {
    // Check for circular reference
    if (visited.has(compName)) {
      return { depth: currentPath.length, path: [...currentPath], hasListNesting: false };
    }

    // Use cache if available and not in current path
    if (depthCache.has(compName) && !currentPath.includes(compName)) {
      const cached = depthCache.get(compName)!;
      return {
        depth: currentPath.length + cached.depth,
        path: [...currentPath, ...cached.path],
        hasListNesting: cached.hasListNesting,
      };
    }

    visited.add(compName);
    const newPath = [...currentPath, compName];
    const relations = componentRelations.get(compName) || [];

    if (relations.length === 0) {
      const result = { depth: 1, path: [compName], hasListNesting: false };
      depthCache.set(compName, result);
      return { depth: newPath.length, path: newPath, hasListNesting: false };
    }

    let maxDepth = newPath.length;
    let deepestPath = newPath;
    let hasListNesting = false;

    for (const relation of relations) {
      // List fields indicate modular/union patterns - flag them
      if (relation.isList) {
        hasListNesting = true;
      }

      const childResult = calculateDepth(relation.target, new Set(visited), newPath);
      
      if (childResult.depth > maxDepth) {
        maxDepth = childResult.depth;
        deepestPath = childResult.path;
      }
      
      if (childResult.hasListNesting) {
        hasListNesting = true;
      }
    }

    return { depth: maxDepth, path: deepestPath, hasListNesting };
  }

  // Analyze each component
  for (const comp of components) {
    const result = calculateDepth(comp.name, new Set(), []);
    
    if (result.depth >= DEEP_NESTING_THRESHOLD) {
      // Find which models use this component (directly or via other components)
      const parentModels: string[] = [];
      const checkedComponents = new Set<string>();

      function findParentModels(targetComp: string) {
        if (checkedComponents.has(targetComp)) return;
        checkedComponents.add(targetComp);

        // Check models
        for (const model of models) {
          if (model.fields.some(f => 
            f.relatedModel === targetComp || f.type === targetComp
          )) {
            if (!parentModels.includes(model.name)) {
              parentModels.push(model.name);
            }
          }
        }

        // Check parent components recursively
        for (const otherComp of components) {
          if (otherComp.name === targetComp) continue;
          if (otherComp.fields.some(f => 
            f.relatedModel === targetComp || f.type === targetComp
          )) {
            findParentModels(otherComp.name);
          }
        }
      }

      findParentModels(comp.name);

      nestedItems.push({
        component: comp.name,
        depth: result.depth,
        path: result.path,
        parentModels,
      });
    }
  }

  // Sort by depth descending
  nestedItems.sort((a, b) => b.depth - a.depth);

  const status: CheckpointStatus = 
    nestedItems.length === 0 ? 'good' :
    nestedItems.filter(n => n.depth >= 4).length > 0 ? 'issue' : 'warning';

  return {
    status,
    findings: nestedItems.length === 0
      ? ['No deeply nested components detected']
      : [
          `${nestedItems.length} component(s) with ${DEEP_NESTING_THRESHOLD}+ nesting levels`,
          ...(nestedItems.some(n => n.depth >= 5) 
            ? [`⚠️ ${nestedItems.filter(n => n.depth >= 5).length} component(s) with 5+ levels - high query cost`]
            : []),
        ],
    items: nestedItems,
    actionItems: nestedItems.slice(0, 5).map(n =>
      `Flatten "${n.component}" (${n.depth} levels: ${n.path.join(' → ')})${n.parentModels.length > 0 ? ` - affects ${n.parentModels.slice(0, 2).join(', ')}` : ''}`
    ),
  };
}

// ============================================
// Nested Models Analysis
// Handles: model-to-model relations, model-to-component-to-model paths
// ============================================

function analyzeNestedModels(models: HygraphModel[]): PerformanceAssessment['nestedModels'] {
  const nestedItems: NestedModelInfo[] = [];
  const modelNames = new Set(models.map(m => m.name));

  // Build comprehensive model relationship graph
  // Include both direct model references and component intermediaries
  const modelRelations = new Map<string, { target: string; fieldName: string; isList: boolean }[]>();
  
  for (const model of models) {
    const relations: { target: string; fieldName: string; isList: boolean }[] = [];
    
    for (const field of model.fields) {
      // Skip system fields
      if (['id', 'createdAt', 'updatedAt', 'publishedAt', 'stage', 'documentInStages'].includes(field.name)) {
        continue;
      }

      // Check for model-to-model relations
      if (field.relatedModel && modelNames.has(field.relatedModel)) {
        relations.push({
          target: field.relatedModel,
          fieldName: field.name,
          isList: field.isList || false,
        });
      }
    }
    
    modelRelations.set(model.name, relations);
  }

  // Find all deep paths using BFS with depth tracking
  function findDeepPaths(
    startModel: string,
    maxSearchDepth: number = 7
  ): { paths: string[][]; maxDepth: number } {
    const allPaths: string[][] = [];
    const queue: { model: string; path: string[]; visited: Set<string> }[] = [
      { model: startModel, path: [startModel], visited: new Set([startModel]) }
    ];

    let maxDepth = 1;

    while (queue.length > 0) {
      const { model, path, visited } = queue.shift()!;

      if (path.length > maxSearchDepth) continue;

      const relations = modelRelations.get(model) || [];

      for (const relation of relations) {
        if (visited.has(relation.target)) continue;

        const newPath = [...path, relation.target];
        const newVisited = new Set(visited);
        newVisited.add(relation.target);

        if (newPath.length >= HIGH_QUERY_COST_THRESHOLD) {
          allPaths.push(newPath);
          maxDepth = Math.max(maxDepth, newPath.length);
        }

        queue.push({
          model: relation.target,
          path: newPath,
          visited: newVisited,
        });
      }
    }

    return { paths: allPaths, maxDepth };
  }

  // Analyze each model as a potential starting point
  const processedPaths = new Set<string>();

  for (const model of models) {
    const { maxDepth, paths } = findDeepPaths(model.name);

    if (maxDepth >= HIGH_QUERY_COST_THRESHOLD && paths.length > 0) {
      // Get the longest path
      const longestPath = paths.reduce((a, b) => a.length > b.length ? a : b, []);
      
      // Avoid duplicate paths (A→B→C vs B→C)
      const pathKey = longestPath.join('→');
      if (processedPaths.has(pathKey)) continue;
      processedPaths.add(pathKey);

      const queryComplexity: 'low' | 'medium' | 'high' = 
        maxDepth >= 6 ? 'high' : 
        maxDepth >= 5 ? 'medium' : 'low';

      nestedItems.push({
        model: model.name,
        depth: maxDepth,
        path: longestPath,
        queryComplexity,
      });
    }
  }

  // Sort by depth descending, then by model name
  nestedItems.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return a.model.localeCompare(b.model);
  });

  // Deduplicate based on similar paths
  const uniqueItems: NestedModelInfo[] = [];
  const seenEndpoints = new Set<string>();
  
  for (const item of nestedItems) {
    const endpoint = `${item.path[0]}→${item.path[item.path.length - 1]}`;
    if (!seenEndpoints.has(endpoint)) {
      seenEndpoints.add(endpoint);
      uniqueItems.push(item);
    }
  }

  const highComplexity = uniqueItems.filter(n => n.queryComplexity === 'high');
  const mediumComplexity = uniqueItems.filter(n => n.queryComplexity === 'medium');
  
  const status: CheckpointStatus = 
    highComplexity.length > 0 ? 'issue' :
    mediumComplexity.length > 2 ? 'warning' :
    uniqueItems.length <= 2 ? 'good' : 'warning';

  return {
    status,
    findings: uniqueItems.length === 0
      ? ['No high query cost model paths detected']
      : [
          `${uniqueItems.length} deep relation path(s) detected`,
          ...(highComplexity.length > 0 
            ? [`⚠️ ${highComplexity.length} path(s) with HIGH query complexity (6+ levels)`]
            : []),
          ...(mediumComplexity.length > 0 
            ? [`${mediumComplexity.length} path(s) with MEDIUM complexity (5 levels)`]
            : []),
        ],
    items: uniqueItems.slice(0, 10),
    actionItems: uniqueItems.slice(0, 3).map(n =>
      `Add direct "${n.path[0]}" → "${n.path[n.path.length - 1]}" reference to avoid ${n.depth - 1} hop query: ${n.path.join(' → ')}`
    ),
  };
}

// ============================================
// Huge Models Analysis
// ============================================

function analyzeHugeModels(
  models: HygraphModel[],
  entryCounts: Record<string, { draft: number; published: number }>
): PerformanceAssessment['hugeModels'] {
  const hugeItems: HugeModelInfo[] = [];

  for (const model of models) {
    if (model.fields.length > HUGE_MODEL_THRESHOLD) {
      const counts = entryCounts[model.name] || { draft: 0, published: 0 };
      const hasHighUsage = counts.draft + counts.published > 100;

      hugeItems.push({
        model: model.name,
        fieldCount: model.fields.length,
        threshold: HUGE_MODEL_THRESHOLD,
        recommendation: hasHighUsage
          ? `High-usage model with ${model.fields.length} fields - prioritize splitting for API performance`
          : `${model.fields.length} fields exceed recommended ${HUGE_MODEL_THRESHOLD} - consider using components`,
      });
    }
  }

  // Sort by field count descending
  hugeItems.sort((a, b) => b.fieldCount - a.fieldCount);

  const status: CheckpointStatus = 
    hugeItems.length === 0 ? 'good' :
    hugeItems.filter(h => h.fieldCount > 40).length > 0 ? 'issue' : 'warning';

  return {
    status,
    findings: hugeItems.length === 0
      ? [`All models have ≤${HUGE_MODEL_THRESHOLD} fields`]
      : [`${hugeItems.length} model(s) exceed ${HUGE_MODEL_THRESHOLD} field threshold`],
    items: hugeItems,
    actionItems: hugeItems.map(h =>
      `Split "${h.model}" (${h.fieldCount} fields) into focused models or extract field groups into components`
    ),
  };
}

// ============================================
// Missing Required Fields Analysis
// ============================================

function analyzeMissingRequiredFields(
  models: HygraphModel[],
  entryCounts: Record<string, { draft: number; published: number }>
): PerformanceAssessment['missingRequiredFields'] {
  const items: MissingRequiredFieldInfo[] = [];

  // Focus on models with content
  for (const model of models) {
    const counts = entryCounts[model.name] || { draft: 0, published: 0 };
    if (counts.draft + counts.published === 0) continue;

    const suggestedRequired: string[] = [];
    const reasons: string[] = [];

    for (const { pattern, reason } of SHOULD_BE_REQUIRED_PATTERNS) {
      const matchingField = model.fields.find(f => pattern.test(f.name));
      if (matchingField && !matchingField.isRequired) {
        suggestedRequired.push(matchingField.name);
        reasons.push(reason);
      }
    }

    if (suggestedRequired.length > 0) {
      items.push({
        model: model.name,
        suggestedRequired,
        reason: `${suggestedRequired.join(', ')} should be required (${reasons.join(', ')})`,
      });
    }
  }

  const status: CheckpointStatus = 
    items.length === 0 ? 'good' :
    items.length <= 3 ? 'warning' : 'issue';

  return {
    status,
    findings: items.length === 0
      ? ['Key fields are properly marked as required']
      : [`${items.length} model(s) have key fields that should be required`],
    items,
    actionItems: items.map(i =>
      `Make "${i.suggestedRequired.join('", "')}" required in "${i.model}" to ensure data completeness`
    ),
  };
}

// ============================================
// Deep Query Paths Analysis
// ============================================

function analyzeDeepQueryPaths(schema: HygraphSchema): CheckpointResult {
  const deepPaths: { path: string[]; depth: number; issue: string }[] = [];
  const models = filterSystemModels(schema.models);

  // Build relationship graph
  const graph = new Map<string, string[]>();
  for (const model of models) {
    const relations = model.fields
      .filter(f => f.relatedModel && models.some(m => m.name === f.relatedModel))
      .map(f => f.relatedModel!);
    graph.set(model.name, relations);
  }

  // Find paths using BFS
  function findDeepPathsFrom(start: string): string[][] {
    const paths: string[][] = [];
    const queue: { node: string; path: string[] }[] = [{ node: start, path: [start] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (path.length > 6) continue; // Limit search depth

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (path.includes(neighbor)) continue; // Avoid cycles

        const newPath = [...path, neighbor];
        if (newPath.length >= HIGH_QUERY_COST_THRESHOLD) {
          paths.push(newPath);
        }
        queue.push({ node: neighbor, path: newPath });
      }
    }

    return paths;
  }

  // Find deep paths from each model
  const allPaths: string[][] = [];
  for (const model of models) {
    allPaths.push(...findDeepPathsFrom(model.name));
  }

  // Deduplicate and keep longest paths
  const uniquePaths = new Map<string, string[]>();
  for (const path of allPaths) {
    const key = `${path[0]}→${path[path.length - 1]}`;
    if (!uniquePaths.has(key) || uniquePaths.get(key)!.length < path.length) {
      uniquePaths.set(key, path);
    }
  }

  const sortedPaths = Array.from(uniquePaths.values())
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);

  for (const path of sortedPaths) {
    deepPaths.push({
      path,
      depth: path.length - 1,
      issue: `Querying from ${path[0]} to ${path[path.length - 1]} requires ${path.length - 1} nested relation(s)`,
    });
  }

  const status: CheckpointStatus = 
    deepPaths.length === 0 ? 'good' :
    deepPaths.filter(p => p.depth >= 5).length > 0 ? 'issue' : 'warning';

  return {
    status,
    title: 'Deep Query Paths',
    findings: deepPaths.length === 0
      ? ['No excessively deep query paths detected']
      : [`${deepPaths.length} path(s) require ${HIGH_QUERY_COST_THRESHOLD}+ nested queries`],
    examples: deepPaths.map(p => ({
      items: p.path,
      details: `${p.depth} hops: ${p.path.join(' → ')}`,
    })),
    actionItems: deepPaths.slice(0, 3).map(p =>
      `Add direct reference from "${p.path[0]}" to "${p.path[p.path.length - 1]}" if frequently queried together`
    ),
  };
}

// ============================================
// Recursive Chains Analysis
// ============================================

function analyzeRecursiveChains(schema: HygraphSchema): CheckpointResult {
  const models = filterSystemModels(schema.models);
  const cycles: string[][] = [];

  // Build graph
  const graph = new Map<string, string[]>();
  for (const model of models) {
    const relations = model.fields
      .filter(f => f.relatedModel && models.some(m => m.name === f.relatedModel))
      .map(f => f.relatedModel!);
    graph.set(model.name, relations);
  }

  // Find cycles using DFS
  function findCycles(node: string, path: string[], visited: Set<string>): void {
    if (path.length > 1 && path[0] === node) {
      // Found a cycle
      if (path.length > 2) { // Only true cycles (3+ nodes)
        cycles.push([...path]);
      }
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      findCycles(neighbor, [...path], new Set(visited));
    }
  }

  for (const model of models) {
    findCycles(model.name, [], new Set());
  }

  // Deduplicate cycles
  const uniqueCycles: string[][] = [];
  const seen = new Set<string>();
  for (const cycle of cycles) {
    const normalized = [...cycle].sort().join('→');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueCycles.push(cycle);
    }
  }

  const status: CheckpointStatus = 
    uniqueCycles.length === 0 ? 'good' :
    uniqueCycles.length > 2 ? 'issue' : 'warning';

  return {
    status,
    title: 'Recursive Chains',
    findings: uniqueCycles.length === 0
      ? ['No circular dependencies detected']
      : [`${uniqueCycles.length} circular reference chain(s) detected`],
    examples: uniqueCycles.slice(0, 3).map(c => ({
      items: c,
      details: `Cycle: ${c.join(' → ')} → ${c[0]}`,
    })),
    actionItems: uniqueCycles.slice(0, 2).map(c =>
      `Break circular reference: ${c.join(' → ')} - consider removing one direction or using a junction model`
    ),
  };
}

// ============================================
// Overall Score Calculation
// ============================================

function calculateOverallScore(
  nestedComponents: PerformanceAssessment['nestedComponents'],
  nestedModels: PerformanceAssessment['nestedModels'],
  hugeModels: PerformanceAssessment['hugeModels'],
  missingRequiredFields: PerformanceAssessment['missingRequiredFields'],
  deepQueryPaths: CheckpointResult,
  recursiveChains: CheckpointResult
): number {
  let score = 100;

  // Deduct for nested components
  if (nestedComponents.status === 'issue') score -= 15;
  else if (nestedComponents.status === 'warning') score -= 8;

  // Deduct for nested models
  if (nestedModels.status === 'issue') score -= 15;
  else if (nestedModels.status === 'warning') score -= 8;

  // Deduct for huge models
  if (hugeModels.status === 'issue') score -= 15;
  else if (hugeModels.status === 'warning') score -= 8;

  // Deduct for missing required fields
  if (missingRequiredFields.status === 'issue') score -= 10;
  else if (missingRequiredFields.status === 'warning') score -= 5;

  // Deduct for deep query paths
  if (deepQueryPaths.status === 'issue') score -= 15;
  else if (deepQueryPaths.status === 'warning') score -= 8;

  // Deduct for recursive chains
  if (recursiveChains.status === 'issue') score -= 15;
  else if (recursiveChains.status === 'warning') score -= 8;

  return Math.max(0, Math.min(100, score));
}
