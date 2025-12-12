import type {
  HygraphSchema,
  HygraphModel,
  RelationshipsAssessment,
  CheckpointResult,
  CheckpointStatus,
  ReferenceCorrectnessIssue,
} from '../types';
import { filterSystemModels, filterSystemComponents } from './systemFilters';

// System types that are valid reference targets but not user-defined models
const SYSTEM_REFERENCE_TYPES = new Set([
  'Asset',
  'RichText',
  'Workflow',
  'User',
  'ScheduledOperation',
  'ScheduledRelease',
  'Location',
  'Color',
  'RGBA',
]);

// ============================================
// Main Analyzer
// ============================================

export function analyzeRelationshipsAssessment(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): RelationshipsAssessment {
  const customModels = filterSystemModels(schema.models);
  const customComponents = filterSystemComponents(schema.components || []);

  const referenceCorrectness = analyzeReferenceCorrectness(customModels, customComponents);
  const circularReferences = analyzeCircularReferences(customModels);
  const nestedVsLinked = analyzeNestedVsLinked(customModels, customComponents, entryCounts);
  const queryCost = analyzeQueryCost(customModels);

  return {
    referenceCorrectness,
    circularReferences,
    nestedVsLinked,
    queryCost,
  };
}

// ============================================
// Reference Correctness Analysis
// ============================================

function analyzeReferenceCorrectness(
  models: HygraphModel[],
  components: HygraphModel[]
): RelationshipsAssessment['referenceCorrectness'] {
  const issues: ReferenceCorrectnessIssue[] = [];
  const modelNames = new Set(models.map(m => m.name));
  const componentNames = new Set(components.map(c => c.name));

  for (const model of models) {
    for (const field of model.fields) {
      // Check if reference target exists
      if (field.relatedModel) {
        // Skip system types - these are valid Hygraph internal types
        if (SYSTEM_REFERENCE_TYPES.has(field.relatedModel)) {
          continue;
        }
        
        // Skip types that look like system embedded types (RichText variants, etc.)
        if (field.relatedModel.endsWith('RichText') || 
            field.relatedModel.endsWith('EmbeddedAsset') ||
            field.relatedModel.includes('Workflow')) {
          continue;
        }

        const targetExists = modelNames.has(field.relatedModel) || 
                            componentNames.has(field.relatedModel);

        if (!targetExists) {
          issues.push({
            model: model.name,
            field: field.name,
            targetModel: field.relatedModel,
            issue: 'broken_reference',
            suggestion: `Target model "${field.relatedModel}" does not exist`,
          });
        }
      }

      // Check for nullable required references (potential data integrity issue)
      if (field.relatedModel && !field.isRequired && field.isList === false) {
        // Check if this is a key reference that should be required
        const keyPatterns = /^(author|category|site|brand|parent|owner)$/i;
        if (keyPatterns.test(field.name)) {
          issues.push({
            model: model.name,
            field: field.name,
            targetModel: field.relatedModel,
            issue: 'nullable_key_reference',
            suggestion: `Consider making "${field.name}" required for data consistency`,
          });
        }
      }

      // Check for missing reverse relations (orphan prevention)
      if (field.relatedModel && modelNames.has(field.relatedModel)) {
        const targetModel = models.find(m => m.name === field.relatedModel);
        const hasReverseRelation = targetModel?.fields.some(f => 
          f.relatedModel === model.name
        );

        // Only flag if this looks like it should have a reverse
        const shouldHaveReverse = /^(category|tag|topic|author|site|brand)$/i.test(field.name);
        if (shouldHaveReverse && !hasReverseRelation) {
          issues.push({
            model: model.name,
            field: field.name,
            targetModel: field.relatedModel,
            issue: 'missing_reverse_relation',
            suggestion: `Add reverse relation on "${field.relatedModel}" for bidirectional navigation`,
          });
        }
      }
    }
  }

  const status: CheckpointStatus = 
    issues.filter(i => i.issue === 'broken_reference').length > 0 ? 'issue' :
    issues.length > 2 ? 'warning' : 'good';

  return {
    status,
    title: 'Reference Correctness',
    findings: issues.length === 0
      ? ['All references are valid and well-configured']
      : [
          ...issues.filter(i => i.issue === 'broken_reference').length > 0
            ? [`${issues.filter(i => i.issue === 'broken_reference').length} broken reference(s) detected`]
            : [],
          ...issues.filter(i => i.issue === 'nullable_key_reference').length > 0
            ? [`${issues.filter(i => i.issue === 'nullable_key_reference').length} key reference(s) should be required`]
            : [],
          ...issues.filter(i => i.issue === 'missing_reverse_relation').length > 0
            ? [`${issues.filter(i => i.issue === 'missing_reverse_relation').length} reverse relation(s) recommended`]
            : [],
        ],
    examples: issues.slice(0, 5).map(i => ({
      items: [`${i.model}.${i.field}`],
      details: i.suggestion,
    })),
    actionItems: issues.slice(0, 3).map(i => i.suggestion),
    issues,
  };
}

// ============================================
// Circular References Analysis
// ============================================

function analyzeCircularReferences(
  models: HygraphModel[]
): RelationshipsAssessment['circularReferences'] {
  const cycles: string[][] = [];
  const bidirectionalPairs: [string, string][] = [];

  // Build graph
  const graph = new Map<string, string[]>();
  for (const model of models) {
    const relations = model.fields
      .filter(f => f.relatedModel && models.some(m => m.name === f.relatedModel))
      .map(f => f.relatedModel!);
    graph.set(model.name, relations);
  }

  // Find bidirectional pairs (A → B AND B → A)
  const seen = new Set<string>();
  for (const [modelA, relations] of graph) {
    for (const modelB of relations) {
      const pairKey = [modelA, modelB].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const bRelations = graph.get(modelB) || [];
      if (bRelations.includes(modelA)) {
        bidirectionalPairs.push([modelA, modelB]);
      }
    }
  }

  // Find true cycles (3+ models in a loop)
  function findCycles(
    start: string,
    current: string,
    path: string[],
    visited: Set<string>
  ): void {
    if (path.length > 1 && current === start) {
      if (path.length >= 3) {
        // Normalize cycle to avoid duplicates
        const normalized = [...path].sort().join('→');
        if (!cycles.some(c => [...c].sort().join('→') === normalized)) {
          cycles.push([...path]);
        }
      }
      return;
    }

    if (visited.has(current)) return;
    if (path.length > 6) return; // Limit depth

    visited.add(current);
    path.push(current);

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      findCycles(start, neighbor, [...path], new Set(visited));
    }
  }

  for (const model of models) {
    findCycles(model.name, model.name, [], new Set());
  }

  // Filter out simple bidirectional (2-node cycles)
  const trueCycles = cycles.filter(c => c.length >= 3);

  const status: CheckpointStatus = 
    trueCycles.length > 2 ? 'issue' :
    trueCycles.length > 0 ? 'warning' : 'good';

  return {
    status,
    title: 'Circular References',
    findings: [
      `${bidirectionalPairs.length} bidirectional relationship(s) (normal for Hygraph)`,
      ...(trueCycles.length > 0
        ? [`${trueCycles.length} circular chain(s) detected (3+ models)`]
        : ['No problematic circular chains detected']),
    ],
    examples: [
      ...bidirectionalPairs.slice(0, 2).map(([a, b]) => ({
        items: [a, b],
        details: `Bidirectional: ${a} ↔ ${b}`,
      })),
      ...trueCycles.slice(0, 2).map(c => ({
        items: c,
        details: `Cycle: ${c.join(' → ')} → ${c[0]}`,
      })),
    ],
    actionItems: trueCycles.slice(0, 2).map(c =>
      `Review circular chain: ${c.join(' → ')} - consider if all relations are necessary`
    ),
    cycles: trueCycles,
    bidirectionalPairs,
  };
}

// ============================================
// Nested vs Linked Analysis
// ============================================

function analyzeNestedVsLinked(
  models: HygraphModel[],
  components: HygraphModel[],
  entryCounts: Record<string, { draft: number; published: number }>
): RelationshipsAssessment['nestedVsLinked'] {
  const shouldBeSplit: { model: string; fieldCount: number; suggestion: string }[] = [];

  for (const model of models) {
    const counts = entryCounts[model.name] || { draft: 0, published: 0 };
    const totalEntries = counts.draft + counts.published;

    // Large models with many fields might benefit from splitting
    if (model.fields.length > 25) {
      // Group fields by potential sub-domains
      const seoFields = model.fields.filter(f => /seo|meta|og|twitter/i.test(f.name));
      const mediaFields = model.fields.filter(f => /image|video|media|thumbnail|cover|banner/i.test(f.name));
      const ctaFields = model.fields.filter(f => /cta|button|link|action/i.test(f.name));

      if (seoFields.length >= 3 && !components.some(c => /seo/i.test(c.name))) {
        shouldBeSplit.push({
          model: model.name,
          fieldCount: seoFields.length,
          suggestion: `Extract SEO fields (${seoFields.map(f => f.name).join(', ')}) to an SEO component`,
        });
      }

      if (mediaFields.length >= 4) {
        shouldBeSplit.push({
          model: model.name,
          fieldCount: mediaFields.length,
          suggestion: `Consider grouping media fields (${mediaFields.slice(0, 3).map(f => f.name).join(', ')}...) into a Media component`,
        });
      }

      if (ctaFields.length >= 3 && !components.some(c => /cta|button/i.test(c.name))) {
        shouldBeSplit.push({
          model: model.name,
          fieldCount: ctaFields.length,
          suggestion: `Extract CTA fields to a reusable CTA component`,
        });
      }
    }

    // Models with many inline fields that could be components
    const inlineListFields = model.fields.filter(f => 
      f.isList && !f.relatedModel && f.type !== 'String'
    );
    if (inlineListFields.length >= 2) {
      shouldBeSplit.push({
        model: model.name,
        fieldCount: inlineListFields.length,
        suggestion: `Consider converting inline list fields to component references for better reusability`,
      });
    }
  }

  const status: CheckpointStatus = 
    shouldBeSplit.length === 0 ? 'good' :
    shouldBeSplit.length <= 3 ? 'warning' : 'issue';

  return {
    status,
    title: 'Nested vs Linked Structure',
    findings: shouldBeSplit.length === 0
      ? ['Model structures are well-organized']
      : [`${shouldBeSplit.length} model(s) could benefit from restructuring`],
    examples: shouldBeSplit.slice(0, 3).map(s => ({
      items: [s.model],
      details: s.suggestion,
    })),
    actionItems: shouldBeSplit.slice(0, 3).map(s => s.suggestion),
    shouldBeSplit,
  };
}

// ============================================
// Query Cost Analysis
// ============================================

function analyzeQueryCost(
  models: HygraphModel[]
): RelationshipsAssessment['queryCost'] {
  const highCostPaths: { path: string[]; depth: number; estimatedCost: 'low' | 'medium' | 'high' }[] = [];
  const modelNames = new Set(models.map(m => m.name));

  // Build graph
  const graph = new Map<string, string[]>();
  for (const model of models) {
    const relations = model.fields
      .filter(f => f.relatedModel && modelNames.has(f.relatedModel))
      .map(f => f.relatedModel!);
    graph.set(model.name, relations);
  }

  // Find all paths using BFS (with safeguards)
  // SAFEGUARD: Limit exploration to prevent memory issues on complex schemas
  const MAX_QUEUE_SIZE = 500;
  const MAX_PATHS_PER_START = 20;
  const MAX_TOTAL_PATHS = 50;
  
  function findPaths(start: string, maxDepth: number = 5): string[][] {
    const paths: string[][] = [];
    const queue: { node: string; path: string[] }[] = [{ node: start, path: [start] }];

    while (queue.length > 0 && paths.length < MAX_PATHS_PER_START && queue.length < MAX_QUEUE_SIZE) {
      const { node, path } = queue.shift()!;
      if (path.length > maxDepth) continue;

      const neighbors = (graph.get(node) || []).slice(0, 5); // Limit neighbors
      for (const neighbor of neighbors) {
        if (path.includes(neighbor)) continue; // Avoid cycles

        const newPath = [...path, neighbor];
        if (newPath.length >= 4) {
          paths.push(newPath);
          if (paths.length >= MAX_PATHS_PER_START) break;
        }
        if (queue.length < MAX_QUEUE_SIZE) {
          queue.push({ node: neighbor, path: newPath });
        }
      }
    }

    return paths;
  }

  // Find paths from each model (limited)
  const processedPaths = new Set<string>();
  const modelsToAnalyze = models.slice(0, 20);
  for (const model of modelsToAnalyze) {
    if (highCostPaths.length >= MAX_TOTAL_PATHS) break;
    const paths = findPaths(model.name);
    for (const path of paths) {
      const pathKey = `${path[0]}→${path[path.length - 1]}`;
      if (processedPaths.has(pathKey)) continue;
      processedPaths.add(pathKey);

      const depth = path.length - 1;
      const estimatedCost: 'low' | 'medium' | 'high' = 
        depth >= 5 ? 'high' :
        depth >= 4 ? 'medium' : 'low';

      if (depth >= 4) {
        highCostPaths.push({ path, depth, estimatedCost });
      }
    }
  }

  // Sort by depth
  highCostPaths.sort((a, b) => b.depth - a.depth);

  const highCost = highCostPaths.filter(p => p.estimatedCost === 'high');
  const mediumCost = highCostPaths.filter(p => p.estimatedCost === 'medium');

  const status: CheckpointStatus = 
    highCost.length > 2 ? 'issue' :
    highCost.length > 0 || mediumCost.length > 3 ? 'warning' : 'good';

  return {
    status,
    title: 'Query Cost',
    findings: highCostPaths.length === 0
      ? ['No high-cost query paths detected']
      : [
          ...(highCost.length > 0 ? [`${highCost.length} high-cost path(s) (5+ hops)`] : []),
          ...(mediumCost.length > 0 ? [`${mediumCost.length} medium-cost path(s) (4 hops)`] : []),
        ],
    examples: highCostPaths.slice(0, 3).map(p => ({
      items: p.path,
      details: `${p.depth} hops (${p.estimatedCost} cost): ${p.path.join(' → ')}`,
    })),
    actionItems: highCost.slice(0, 2).map(p =>
      `Add direct reference from "${p.path[0]}" to "${p.path[p.path.length - 1]}" to reduce query depth`
    ),
    highCostPaths: highCostPaths.slice(0, 10),
  };
}
