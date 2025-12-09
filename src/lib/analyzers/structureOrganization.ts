import type {
  HygraphSchema,
  HygraphModel,
  HygraphField,
  StructureAssessment,
  CheckpointResult,
  CheckpointStatus,
} from '../types';
import { filterSystemComponents, filterSystemEnums, filterSystemModels } from './systemFilters';

// ============================================
// Pattern Definitions
// ============================================

// Vague/generic model names that indicate poor content typing
const VAGUE_MODEL_PATTERNS = /^(content|data|item|entry|record|object|thing|element|block|section)s?$/i;

// Page model patterns
const PAGE_MODEL_PATTERNS = /^(home|about|contact|service|product|landing|blog|news|faq|team|career|privacy|terms|error|404|500)?\s?page$/i;

// Content model patterns (reusable structured content)
const CONTENT_MODEL_PATTERNS = /^(author|person|article|post|testimonial|review|faq|category|tag|topic|product|event|location|address|seo|meta|cta|button|link|image|video|media|asset)s?$/i;

// RTE fields that should be structured
const RTE_SHOULD_BE_STRUCTURED = ['address', 'phone', 'email', 'url', 'price', 'date', 'time', 'number', 'coordinates', 'location', 'contact'];

// Section-specific field patterns (e.g., section17Title)
const SECTION_SPECIFIC_PATTERN = /^(section|block|area|zone|row|column)\d+/i;

// Naming convention patterns
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

// ============================================
// Main Analyzer
// ============================================

export function analyzeStructureOrganization(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): StructureAssessment {
  const customModels = filterSystemModels(schema.models);
  const components = filterSystemComponents(schema.components || []);
  const enums = filterSystemEnums(schema.enums || []);

  return {
    distinctContentTypes: analyzeDistinctContentTypes(customModels),
    pageVsContentSeparation: analyzePageVsContentSeparation(customModels),
    redundantModels: analyzeRedundantModels(customModels),
    overlappingModels: analyzeOverlappingModels(customModels),
    fieldNaming: analyzeFieldNaming(customModels, components),
    componentUsage: analyzeComponentUsage(customModels, components),
    componentReordering: analyzeComponentReordering(customModels, components),
    rteUsage: analyzeRteUsage(customModels, components),
    localization: analyzeLocalization(customModels),
    recursiveChains: analyzeRecursiveChains(schema),
    assetCentralization: analyzeAssetCentralization(customModels),
    enumAnalysis: {
      singleValueEnums: analyzeSingleValueEnums(enums),
      oversizedEnums: analyzeOversizedEnums(enums),
      enumBasedTenancy: analyzeEnumBasedTenancy(enums, customModels),
      duplicateEnums: analyzeDuplicateEnums(enums),
      unusedEnums: analyzeUnusedEnums(enums, customModels, components),
    },
  };
}

// ============================================
// Checkpoint 1: Distinct Content Types
// ============================================

function analyzeDistinctContentTypes(models: HygraphModel[]): CheckpointResult {
  const vague: string[] = [];
  const purposeSpecific: string[] = [];

  for (const model of models) {
    if (VAGUE_MODEL_PATTERNS.test(model.name)) {
      vague.push(model.name);
    } else {
      purposeSpecific.push(model.name);
    }
  }

  const status: CheckpointStatus = vague.length === 0 ? 'good' : vague.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Distinct Content Types',
    findings: vague.length === 0
      ? [`All ${models.length} models have purpose-specific names`]
      : [`${vague.length} model(s) have vague/generic names: ${vague.join(', ')}`],
    examples: vague.length > 0
      ? [{
          items: vague,
          details: 'These names do not clearly indicate content purpose',
        }]
      : [{
          items: purposeSpecific.slice(0, 5),
          details: 'Examples of well-named models',
        }],
    actionItems: vague.length === 0
      ? []
      : vague.map(v => `Rename "${v}" to reflect its content purpose (e.g., "${v}" → "Article", "Product", "Testimonial")`),
  };
}

// ============================================
// Checkpoint 2: Page vs Content Separation
// ============================================

function analyzePageVsContentSeparation(models: HygraphModel[]): CheckpointResult {
  const pageModels: string[] = [];
  const contentModels: string[] = [];
  const mixedModels: { model: string; embeddedContent: string[] }[] = [];

  for (const model of models) {
    const isPage = PAGE_MODEL_PATTERNS.test(model.name) || model.name.toLowerCase().includes('page');
    const isContent = CONTENT_MODEL_PATTERNS.test(model.name);

    if (isPage) {
      pageModels.push(model.name);
      
      // Check for embedded content that should be referenced
      const embeddedContent: string[] = [];
      for (const field of model.fields) {
        if (field.type === 'RichText' && CONTENT_MODEL_PATTERNS.test(field.name)) {
          embeddedContent.push(field.name);
        }
        // Check for inline arrays of content-like objects
        if (field.isList && !field.relatedModel && field.type !== 'String') {
          const contentLikeFields = ['testimonial', 'faq', 'team', 'feature', 'benefit', 'step'];
          if (contentLikeFields.some(clf => field.name.toLowerCase().includes(clf))) {
            embeddedContent.push(field.name);
          }
        }
      }
      
      if (embeddedContent.length > 0) {
        mixedModels.push({ model: model.name, embeddedContent });
      }
    } else if (isContent) {
      contentModels.push(model.name);
    }
  }

  const status: CheckpointStatus = mixedModels.length === 0 ? 'good' : mixedModels.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Page vs Content Separation',
    findings: [
      `${pageModels.length} page model(s): ${pageModels.slice(0, 5).join(', ')}${pageModels.length > 5 ? '...' : ''}`,
      `${contentModels.length} reusable content model(s): ${contentModels.slice(0, 5).join(', ')}${contentModels.length > 5 ? '...' : ''}`,
      ...(mixedModels.length > 0 ? [`${mixedModels.length} page model(s) embed content that should be referenced`] : []),
    ],
    examples: mixedModels.length > 0
      ? mixedModels.map(m => ({
          items: [m.model],
          details: `Embeds: ${m.embeddedContent.join(', ')} - should be separate models referenced via relation`,
        }))
      : [{
          items: pageModels.slice(0, 3),
          details: 'Page models',
        }],
    actionItems: mixedModels.flatMap(m =>
      m.embeddedContent.map(ec =>
        `Extract "${ec}" from "${m.model}" into a separate "${toPascalCase(ec)}" model and reference it`
      )
    ),
  };
}

// ============================================
// Checkpoint 3: Redundant Models
// ============================================

function analyzeRedundantModels(models: HygraphModel[]): CheckpointResult {
  const redundantGroups: { models: string[]; reason: string }[] = [];

  // Find models with version suffixes (HomePage1, HomePage2)
  const versionPattern = /^(.+?)\s*[vV]?\d+$/;
  const baseNames: Record<string, string[]> = {};

  for (const model of models) {
    const match = model.name.match(versionPattern);
    if (match) {
      const baseName = match[1];
      if (!baseNames[baseName]) baseNames[baseName] = [];
      baseNames[baseName].push(model.name);
    }
  }

  for (const [baseName, versions] of Object.entries(baseNames)) {
    if (versions.length > 1) {
      redundantGroups.push({
        models: versions,
        reason: `Multiple versions of "${baseName}" model`,
      });
    }
  }

  // Find models with 85%+ field overlap
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const m1Fields = new Set(models[i].fields.map(f => f.name.toLowerCase()));
      const m2Fields = new Set(models[j].fields.map(f => f.name.toLowerCase()));
      const shared = [...m1Fields].filter(f => m2Fields.has(f));
      const similarity = shared.length / Math.min(m1Fields.size, m2Fields.size);

      if (similarity >= 0.85 && shared.length >= 4) {
        // Check if not already in a group
        const existingGroup = redundantGroups.find(g =>
          g.models.includes(models[i].name) || g.models.includes(models[j].name)
        );
        if (!existingGroup) {
          redundantGroups.push({
            models: [models[i].name, models[j].name],
            reason: `${Math.round(similarity * 100)}% field overlap (${shared.length} shared fields)`,
          });
        }
      }
    }
  }

  const status: CheckpointStatus = redundantGroups.length === 0 ? 'good' : redundantGroups.length <= 1 ? 'warning' : 'issue';

  return {
    status,
    title: 'Redundant Models',
    findings: redundantGroups.length === 0
      ? ['No redundant models detected']
      : redundantGroups.map(g => `${g.models.join(', ')}: ${g.reason}`),
    examples: redundantGroups.map(g => ({
      items: g.models,
      details: g.reason,
    })),
    actionItems: redundantGroups.map(g =>
      `Consolidate ${g.models.join(' and ')} into a single model with a "type" discriminator field`
    ),
  };
}

// ============================================
// Checkpoint 4: Similar Models with Overlapping Fields
// ============================================

function analyzeOverlappingModels(models: HygraphModel[]): CheckpointResult {
  const overlappingGroups: {
    models: string[];
    sharedFields: string[];
    uniqueFields: Record<string, string[]>;
    similarity: number;
  }[] = [];

  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const m1Fields = new Set(models[i].fields.map(f => f.name.toLowerCase()));
      const m2Fields = new Set(models[j].fields.map(f => f.name.toLowerCase()));
      const shared = [...m1Fields].filter(f => m2Fields.has(f));
      const similarity = shared.length / Math.min(m1Fields.size, m2Fields.size);

      // 70-85% overlap (not redundant, but overlapping)
      if (similarity >= 0.70 && similarity < 0.85 && shared.length >= 3) {
        overlappingGroups.push({
          models: [models[i].name, models[j].name],
          sharedFields: shared,
          uniqueFields: {
            [models[i].name]: [...m1Fields].filter(f => !m2Fields.has(f)),
            [models[j].name]: [...m2Fields].filter(f => !m1Fields.has(f)),
          },
          similarity,
        });
      }
    }
  }

  const status: CheckpointStatus = overlappingGroups.length === 0 ? 'good' : overlappingGroups.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Similar Models with Overlapping Fields',
    findings: overlappingGroups.length === 0
      ? ['No significantly overlapping models detected']
      : overlappingGroups.map(g =>
          `${g.models.join(' & ')}: ${Math.round(g.similarity * 100)}% overlap (${g.sharedFields.length} shared fields)`
        ),
    examples: overlappingGroups.map(g => ({
      items: g.models,
      sharedFields: g.sharedFields.slice(0, 6),
      uniqueToFirst: g.uniqueFields[g.models[0]]?.slice(0, 3),
      uniqueToSecond: g.uniqueFields[g.models[1]]?.slice(0, 3),
    })),
    actionItems: overlappingGroups.map(g =>
      `Consider extracting shared fields (${g.sharedFields.slice(0, 3).join(', ')}...) from ${g.models.join(' & ')} into a shared component`
    ),
  };
}

// ============================================
// Checkpoint 5: Field Count & Naming
// ============================================

function analyzeFieldNaming(models: HygraphModel[], components: HygraphModel[]): CheckpointResult {
  const sectionSpecificFields: { model: string; field: string }[] = [];
  const namingIssues: { model: string; field: string; issue: string }[] = [];
  const largeModels: { model: string; fieldCount: number }[] = [];

  for (const model of [...models, ...components]) {
    // Check field count
    if (model.fields.length > 20) {
      largeModels.push({ model: model.name, fieldCount: model.fields.length });
    }

    for (const field of model.fields) {
      // Check for section-specific fields
      if (SECTION_SPECIFIC_PATTERN.test(field.name)) {
        sectionSpecificFields.push({ model: model.name, field: field.name });
      }

      // Check naming convention (should be camelCase)
      if (!CAMEL_CASE.test(field.name) && !field.name.startsWith('_')) {
        namingIssues.push({
          model: model.name,
          field: field.name,
          issue: 'Not camelCase',
        });
      }
    }
  }

  const hasIssues = sectionSpecificFields.length > 0 || namingIssues.length > 3 || largeModels.length > 0;
  const status: CheckpointStatus = !hasIssues ? 'good' : (sectionSpecificFields.length > 3 || largeModels.length > 2) ? 'issue' : 'warning';

  return {
    status,
    title: 'Field Count & Naming',
    findings: [
      ...(sectionSpecificFields.length > 0
        ? [`${sectionSpecificFields.length} section-specific field(s) found (e.g., section17Title pattern)`]
        : []),
      ...(namingIssues.length > 0
        ? [`${namingIssues.length} field(s) don't follow camelCase convention`]
        : []),
      ...(largeModels.length > 0
        ? [`${largeModels.length} model(s) have more than 20 fields`]
        : []),
      ...(sectionSpecificFields.length === 0 && namingIssues.length === 0 && largeModels.length === 0
        ? ['Field naming is consistent and models are well-sized']
        : []),
    ],
    examples: [
      ...sectionSpecificFields.slice(0, 3).map(f => ({
        items: [`${f.model}.${f.field}`],
        details: 'Section-specific naming - should use components instead',
      })),
      ...largeModels.slice(0, 2).map(m => ({
        items: [m.model],
        details: `${m.fieldCount} fields - consider splitting or using components`,
      })),
    ],
    actionItems: [
      ...sectionSpecificFields.slice(0, 3).map(f =>
        `Replace "${f.field}" in "${f.model}" with a reusable component`
      ),
      ...largeModels.map(m =>
        `Split "${m.model}" (${m.fieldCount} fields) into smaller models or extract field groups into components`
      ),
    ],
  };
}

// ============================================
// Checkpoint 6: Use of Components
// ============================================

function analyzeComponentUsage(models: HygraphModel[], components: HygraphModel[]): CheckpointResult {
  const modelsWithComponents: string[] = [];
  const modelsWithoutComponents: string[] = [];
  const componentUsage: Record<string, string[]> = {};

  for (const comp of components) {
    componentUsage[comp.name] = [];
  }

  for (const model of models) {
    let usesComponent = false;
    for (const field of model.fields) {
      if (field.relatedModel && componentUsage[field.relatedModel] !== undefined) {
        usesComponent = true;
        componentUsage[field.relatedModel].push(model.name);
      }
    }
    if (usesComponent) {
      modelsWithComponents.push(model.name);
    } else if (model.fields.length > 5) {
      modelsWithoutComponents.push(model.name);
    }
  }

  const unusedComponents = Object.entries(componentUsage)
    .filter(([, usedIn]) => usedIn.length === 0)
    .map(([name]) => name);

  const status: CheckpointStatus = 
    components.length === 0 && models.length > 5 ? 'issue' :
    modelsWithoutComponents.length > models.length / 2 ? 'warning' : 'good';

  return {
    status,
    title: 'Use of Components',
    findings: [
      `${components.length} component(s) defined`,
      `${modelsWithComponents.length}/${models.length} models use components`,
      ...(unusedComponents.length > 0 ? [`${unusedComponents.length} unused component(s): ${unusedComponents.join(', ')}`] : []),
    ],
    examples: components.length > 0
      ? Object.entries(componentUsage)
          .filter(([, usedIn]) => usedIn.length > 0)
          .slice(0, 3)
          .map(([name, usedIn]) => ({
            items: [name],
            details: `Used in: ${usedIn.join(', ')}`,
          }))
      : [{
          items: modelsWithoutComponents.slice(0, 3),
          details: 'Models that could benefit from componentization',
        }],
    actionItems: [
      ...(components.length === 0 ? ['Create reusable components for repeated field patterns (CTA, SEO, Media, etc.)'] : []),
      ...unusedComponents.map(c => `Remove unused component "${c}" or integrate it into models`),
      ...modelsWithoutComponents.slice(0, 2).map(m =>
        `Consider extracting repeated field groups from "${m}" into components`
      ),
    ],
  };
}

// ============================================
// Checkpoint 7: Component Reordering
// ============================================

function analyzeComponentReordering(models: HygraphModel[], components: HygraphModel[]): CheckpointResult {
  const modelsWithReorderableComponents: { model: string; field: string; componentTypes: string[] }[] = [];
  const modelsWithFixedStructure: string[] = [];

  for (const model of models) {
    let hasReorderable = false;
    for (const field of model.fields) {
      // Check for list fields that reference components (allows reordering)
      if (field.isList && field.relatedModel && components.some(c => c.name === field.relatedModel)) {
        modelsWithReorderableComponents.push({
          model: model.name,
          field: field.name,
          componentTypes: [field.relatedModel],
        });
        hasReorderable = true;
      }
    }
    if (!hasReorderable && model.fields.length > 10) {
      modelsWithFixedStructure.push(model.name);
    }
  }

  const status: CheckpointStatus = 
    modelsWithReorderableComponents.length >= models.length / 3 ? 'good' :
    modelsWithFixedStructure.length > models.length / 2 ? 'issue' : 'warning';

  return {
    status,
    title: 'Component Reordering',
    findings: [
      `${modelsWithReorderableComponents.length} model(s) support component reordering`,
      ...(modelsWithFixedStructure.length > 0
        ? [`${modelsWithFixedStructure.length} model(s) have fixed structure (no reorderable components)`]
        : []),
    ],
    examples: modelsWithReorderableComponents.slice(0, 3).map(m => ({
      items: [m.model],
      details: `Field "${m.field}" allows reordering of ${m.componentTypes.join(', ')}`,
    })),
    actionItems: modelsWithFixedStructure.slice(0, 2).map(m =>
      `Add a "sections" or "blocks" field to "${m}" with list of components for layout flexibility`
    ),
  };
}

// ============================================
// Checkpoint 8: RTE Usage
// ============================================

function analyzeRteUsage(models: HygraphModel[], components: HygraphModel[]): CheckpointResult {
  const rteIssues: { model: string; field: string; issue: string }[] = [];
  const properRteUsage: { model: string; field: string }[] = [];

  for (const model of [...models, ...components]) {
    for (const field of model.fields) {
      if (field.type === 'RichText') {
        // Check if this should be structured
        const shouldBeStructured = RTE_SHOULD_BE_STRUCTURED.some(pattern =>
          field.name.toLowerCase().includes(pattern)
        );

        if (shouldBeStructured) {
          rteIssues.push({
            model: model.name,
            field: field.name,
            issue: `"${field.name}" should be structured, not RichText`,
          });
        } else {
          properRteUsage.push({ model: model.name, field: field.name });
        }
      }
    }
  }

  const status: CheckpointStatus = rteIssues.length === 0 ? 'good' : rteIssues.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'RTE Usage',
    findings: rteIssues.length === 0
      ? [`RichText is used appropriately in ${properRteUsage.length} field(s)`]
      : [`${rteIssues.length} RichText field(s) should be structured instead`],
    examples: rteIssues.length > 0
      ? rteIssues.slice(0, 3).map(i => ({
          items: [`${i.model}.${i.field}`],
          details: i.issue,
        }))
      : properRteUsage.slice(0, 3).map(p => ({
          items: [`${p.model}.${p.field}`],
          details: 'Appropriate use of RichText for content',
        })),
    actionItems: rteIssues.map(i =>
      `Change "${i.model}.${i.field}" from RichText to structured field(s)`
    ),
  };
}

// ============================================
// Checkpoint 9: Localization
// ============================================

function analyzeLocalization(models: HygraphModel[]): CheckpointResult {
  const localizedModels: string[] = [];
  const overLocalizedFields: { model: string; field: string; issue: string }[] = [];

  // Fields that should NOT be localized
  const shouldNotLocalize = ['id', 'slug', 'apiId', 'createdAt', 'updatedAt', 'publishedAt', 'order', 'sortOrder', 'enabled', 'active', 'visible'];

  for (const model of models) {
    let hasLocalized = false;
    for (const field of model.fields) {
      // Check if field appears to be localized (Hygraph marks this)
      // For this analysis, we check field naming patterns that suggest locale handling
      if (field.name.includes('locale') || field.name.includes('language')) {
        hasLocalized = true;
      }

      // Check for over-localization
      if (shouldNotLocalize.some(snl => field.name.toLowerCase() === snl.toLowerCase())) {
        // This field type shouldn't typically be localized
        // Note: We can't directly check if it's localized without full schema details
      }
    }
    if (hasLocalized) {
      localizedModels.push(model.name);
    }
  }

  const status: CheckpointStatus = overLocalizedFields.length === 0 ? 'good' : 'warning';

  return {
    status,
    title: 'Localization',
    findings: [
      `${localizedModels.length} model(s) have locale-related fields`,
      ...(overLocalizedFields.length > 0
        ? [`${overLocalizedFields.length} field(s) may be over-localized`]
        : []),
    ],
    examples: localizedModels.length > 0
      ? [{
          items: localizedModels.slice(0, 5),
          details: 'Models with localization support',
        }]
      : [],
    actionItems: [
      ...(localizedModels.length === 0 && models.length > 5
        ? ['Consider using Hygraph\'s built-in localization if multi-language support is needed']
        : []),
      ...overLocalizedFields.map(f =>
        `Review localization for "${f.model}.${f.field}" - ${f.issue}`
      ),
    ],
  };
}

// ============================================
// Checkpoint 10: Recursive Chains
// ============================================

function analyzeRecursiveChains(schema: HygraphSchema): CheckpointResult {
  const recursiveChains: string[][] = [];
  const graph: Map<string, string[]> = new Map();
  const customModels = filterSystemModels(schema.models);

  // Build relationship graph
  for (const model of customModels) {
    const relations: string[] = [];
    for (const field of model.fields) {
      if (field.relatedModel && schema.models.some(m => m.name === field.relatedModel)) {
        relations.push(field.relatedModel);
      }
    }
    graph.set(model.name, relations);
  }

  // Find paths longer than 3 hops using DFS
  function findDeepPaths(start: string, visited: Set<string>, path: string[]): void {
    if (path.length > 4) {
      recursiveChains.push([...path]);
      return;
    }

    const neighbors = graph.get(start) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        path.push(neighbor);
        findDeepPaths(neighbor, visited, path);
        path.pop();
        visited.delete(neighbor);
      }
    }
  }

  for (const model of customModels) {
    const visited = new Set<string>([model.name]);
    findDeepPaths(model.name, visited, [model.name]);
  }

  // Deduplicate chains
  const uniqueChains = recursiveChains.filter((chain, index) => {
    const chainStr = chain.join('→');
    return recursiveChains.findIndex(c => c.join('→') === chainStr) === index;
  }).slice(0, 5);

  const status: CheckpointStatus = uniqueChains.length === 0 ? 'good' : uniqueChains.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Recursive Chains',
    findings: uniqueChains.length === 0
      ? ['No deep recursive chains detected (all paths ≤3 hops)']
      : [`${uniqueChains.length} deep relation chain(s) detected (>3 hops)`],
    examples: uniqueChains.map(chain => ({
      items: chain,
      details: `${chain.length - 1} hops: ${chain.join(' → ')}`,
    })),
    actionItems: uniqueChains.map(chain =>
      `Consider flattening chain: ${chain.join(' → ')} - add direct reference from ${chain[0]} to ${chain[chain.length - 1]}`
    ),
  };
}

// ============================================
// Checkpoint 11: Asset Centralization
// ============================================

function analyzeAssetCentralization(models: HygraphModel[]): CheckpointResult {
  const modelsWithAssetRefs: string[] = [];
  const modelsWithInlineMedia: { model: string; field: string }[] = [];

  for (const model of models) {
    for (const field of model.fields) {
      // Check for Asset model reference (centralized)
      if (field.relatedModel === 'Asset') {
        modelsWithAssetRefs.push(model.name);
      }
      // Check for inline media (URL strings for images/videos)
      if (field.type === 'String' && /^(image|video|media|file|asset|thumbnail|cover|banner|logo|icon)(Url|URL|Uri|URI|Path)?$/i.test(field.name)) {
        modelsWithInlineMedia.push({ model: model.name, field: field.name });
      }
    }
  }

  const status: CheckpointStatus = 
    modelsWithInlineMedia.length === 0 ? 'good' :
    modelsWithInlineMedia.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Asset Centralization',
    findings: [
      `${new Set(modelsWithAssetRefs).size} model(s) reference centralized Asset model`,
      ...(modelsWithInlineMedia.length > 0
        ? [`${modelsWithInlineMedia.length} field(s) use inline media URLs instead of Asset references`]
        : []),
    ],
    examples: modelsWithInlineMedia.length > 0
      ? modelsWithInlineMedia.slice(0, 3).map(m => ({
          items: [`${m.model}.${m.field}`],
          details: 'Inline URL field - should reference Asset model',
        }))
      : [{
          items: [...new Set(modelsWithAssetRefs)].slice(0, 5),
          details: 'Models properly using Asset references',
        }],
    actionItems: modelsWithInlineMedia.map(m =>
      `Replace "${m.field}" string field in "${m.model}" with Asset model reference`
    ),
  };
}

// ============================================
// Enum Analysis - Checkpoint: Single Value Enums
// ============================================

function analyzeSingleValueEnums(enums: { name: string; values: string[] }[]): CheckpointResult {
  const singleValue = enums.filter(e => e.values.length === 1);

  const status: CheckpointStatus = singleValue.length === 0 ? 'good' : singleValue.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Single-Value Enums',
    findings: singleValue.length === 0
      ? ['No single-value enums detected']
      : [`${singleValue.length} enum(s) have only one value (useless)`],
    examples: singleValue.map(e => ({
      items: [e.name],
      details: `Only value: "${e.values[0]}"`,
    })),
    actionItems: singleValue.map(e =>
      `Remove "${e.name}" enum (single value "${e.values[0]}") - use constant or add meaningful values`
    ),
  };
}

// ============================================
// Enum Analysis - Checkpoint: Oversized Enums
// ============================================

function analyzeOversizedEnums(enums: { name: string; values: string[] }[]): CheckpointResult {
  const oversized = enums.filter(e => e.values.length > 20);

  const status: CheckpointStatus = oversized.length === 0 ? 'good' : oversized.length <= 1 ? 'warning' : 'issue';

  return {
    status,
    title: 'Oversized Enums',
    findings: oversized.length === 0
      ? ['No oversized enums detected (all have ≤20 values)']
      : [`${oversized.length} enum(s) have more than 20 values`],
    examples: oversized.map(e => ({
      items: [e.name],
      details: `${e.values.length} values - should be a content model`,
    })),
    actionItems: oversized.map(e =>
      `Migrate "${e.name}" (${e.values.length} values) to a dedicated content model for better manageability`
    ),
  };
}

// ============================================
// Enum Analysis - Checkpoint: Enum-Based Tenancy
// ============================================

function analyzeEnumBasedTenancy(enums: { name: string; values: string[] }[], models: HygraphModel[]): CheckpointResult {
  const tenancyPatterns = /^(shop|brand|store|site|tenant|organization|client|channel|market|region)s?$/i;
  const tenancyEnums = enums.filter(e => tenancyPatterns.test(e.name));

  // Check usage across models
  const tenancyUsage: { enum: string; usedIn: string[]; valueCount: number }[] = [];
  for (const tenancyEnum of tenancyEnums) {
    const usedIn: string[] = [];
    for (const model of models) {
      for (const field of model.fields) {
        if (field.type === tenancyEnum.name || field.enumValues?.some(v => tenancyEnum.values.includes(v))) {
          usedIn.push(model.name);
          break;
        }
      }
    }
    if (usedIn.length > 0) {
      tenancyUsage.push({
        enum: tenancyEnum.name,
        usedIn,
        valueCount: tenancyEnum.values.length,
      });
    }
  }

  const status: CheckpointStatus = tenancyUsage.length === 0 ? 'good' : tenancyUsage.some(t => t.usedIn.length >= 3) ? 'issue' : 'warning';

  return {
    status,
    title: 'Enum-Based Tenancy',
    findings: tenancyUsage.length === 0
      ? ['No enum-based tenancy patterns detected']
      : tenancyUsage.map(t =>
          `"${t.enum}" (${t.valueCount} values) used for tenancy across ${t.usedIn.length} model(s)`
        ),
    examples: tenancyUsage.map(t => ({
      items: [t.enum],
      details: `Used in: ${t.usedIn.join(', ')}`,
    })),
    actionItems: tenancyUsage.map(t =>
      `Create a dedicated "${toPascalCase(t.enum.replace(/s$/, ''))}" content model instead of "${t.enum}" enum for scalability`
    ),
  };
}

// ============================================
// Enum Analysis - Checkpoint: Duplicate Enums
// ============================================

function analyzeDuplicateEnums(enums: { name: string; values: string[] }[]): CheckpointResult {
  const duplicateGroups: { enums: string[]; sharedValues: string[] }[] = [];

  for (let i = 0; i < enums.length; i++) {
    for (let j = i + 1; j < enums.length; j++) {
      const shared = enums[i].values.filter(v => enums[j].values.includes(v));
      const overlapRatio = shared.length / Math.min(enums[i].values.length, enums[j].values.length);

      if (overlapRatio >= 0.5 && shared.length >= 3) {
        // Check if not already in a group
        const existingGroup = duplicateGroups.find(g =>
          g.enums.includes(enums[i].name) || g.enums.includes(enums[j].name)
        );
        if (existingGroup) {
          if (!existingGroup.enums.includes(enums[i].name)) existingGroup.enums.push(enums[i].name);
          if (!existingGroup.enums.includes(enums[j].name)) existingGroup.enums.push(enums[j].name);
        } else {
          duplicateGroups.push({
            enums: [enums[i].name, enums[j].name],
            sharedValues: shared,
          });
        }
      }
    }
  }

  const status: CheckpointStatus = duplicateGroups.length === 0 ? 'good' : duplicateGroups.length <= 1 ? 'warning' : 'issue';

  return {
    status,
    title: 'Duplicate Enums',
    findings: duplicateGroups.length === 0
      ? ['No duplicate enum patterns detected']
      : duplicateGroups.map(g =>
          `${g.enums.join(', ')} share ${g.sharedValues.length} values`
        ),
    examples: duplicateGroups.map(g => ({
      items: g.enums,
      sharedFields: g.sharedValues.slice(0, 6),
      details: `Shared values: ${g.sharedValues.slice(0, 5).join(', ')}${g.sharedValues.length > 5 ? '...' : ''}`,
    })),
    actionItems: duplicateGroups.map(g =>
      `Consolidate ${g.enums.join(' and ')} into a single enum or extract shared values`
    ),
  };
}

// ============================================
// Enum Analysis - Checkpoint: Unused Enums
// ============================================

function analyzeUnusedEnums(
  enums: { name: string; values: string[] }[],
  models: HygraphModel[],
  components: HygraphModel[]
): CheckpointResult {
  const usedEnums = new Set<string>();

  for (const item of [...models, ...components]) {
    for (const field of item.fields) {
      if (field.enumValues && field.enumValues.length > 0) {
        // Find which enum this field uses
        for (const enumDef of enums) {
          if (field.enumValues.some(v => enumDef.values.includes(v))) {
            usedEnums.add(enumDef.name);
          }
        }
      }
      if (field.type && enums.some(e => e.name === field.type)) {
        usedEnums.add(field.type);
      }
    }
  }

  const unusedEnums = enums.filter(e => !usedEnums.has(e.name)).map(e => e.name);

  const status: CheckpointStatus = unusedEnums.length === 0 ? 'good' : unusedEnums.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    title: 'Unused Enums',
    findings: unusedEnums.length === 0
      ? ['All enums are in use']
      : [`${unusedEnums.length} enum(s) are defined but not used`],
    examples: unusedEnums.length > 0
      ? [{
          items: unusedEnums.slice(0, 5),
          details: 'Not referenced by any model or component',
        }]
      : [],
    actionItems: unusedEnums.map(e =>
      `Remove unused enum "${e}" to reduce schema complexity`
    ),
  };
}

// ============================================
// Helper Functions
// ============================================

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^./, s => s.toUpperCase());
}
