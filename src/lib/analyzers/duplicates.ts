import type {
  HygraphSchema,
  HygraphModel,
  DuplicatesAssessment,
  DuplicateEnumGroup,
  DuplicateComponentGroup,
  DuplicateModelGroup,
  BooleanShowHideField,
  CheckpointStatus,
} from '../types';
import { filterSystemComponents, filterSystemEnums, filterSystemModels } from './systemFilters';

// ============================================
// Main Analyzer
// ============================================

export function analyzeDuplicates(schema: HygraphSchema): DuplicatesAssessment {
  const customModels = filterSystemModels(schema.models);
  const components = filterSystemComponents(schema.components || []);
  const enums = filterSystemEnums(schema.enums || []);

  return {
    enums: analyzeDuplicateEnums(enums),
    components: analyzeDuplicateComponents(components),
    models: analyzeDuplicateModels(customModels),
    booleanShowHide: analyzeBooleanShowHide(customModels, components),
  };
}

// ============================================
// Duplicate Enums Analysis
// ============================================

function analyzeDuplicateEnums(enums: { name: string; values: string[] }[]): DuplicatesAssessment['enums'] {
  const groups: DuplicateEnumGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < enums.length; i++) {
    if (processed.has(enums[i].name)) continue;

    const similarEnums: string[] = [enums[i].name];
    let allSharedValues: string[] = [...enums[i].values];

    for (let j = i + 1; j < enums.length; j++) {
      if (processed.has(enums[j].name)) continue;

      const shared = enums[i].values.filter(v => enums[j].values.includes(v));
      const overlapRatio = shared.length / Math.min(enums[i].values.length, enums[j].values.length);

      // If 50%+ overlap and at least 3 shared values
      if (overlapRatio >= 0.5 && shared.length >= 3) {
        similarEnums.push(enums[j].name);
        allSharedValues = allSharedValues.filter(v => enums[j].values.includes(v));
        processed.add(enums[j].name);
      }
    }

    if (similarEnums.length > 1) {
      processed.add(enums[i].name);
      groups.push({
        enums: similarEnums,
        sharedValues: allSharedValues.slice(0, 10),
        recommendation: similarEnums.length === 2
          ? `Consolidate "${similarEnums[0]}" and "${similarEnums[1]}" into a single enum`
          : `Consolidate ${similarEnums.length} enums (${similarEnums.join(', ')}) into a single base enum`,
      });
    }
  }

  const status: CheckpointStatus = 
    groups.length === 0 ? 'good' :
    groups.length <= 1 ? 'warning' : 'issue';

  return {
    status,
    groups,
    actionItems: groups.map(g => g.recommendation),
  };
}

// ============================================
// Duplicate Components Analysis
// ============================================

function analyzeDuplicateComponents(components: HygraphModel[]): DuplicatesAssessment['components'] {
  const groups: DuplicateComponentGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < components.length; i++) {
    if (processed.has(components[i].name)) continue;

    const c1Fields = new Set(components[i].fields.map(f => f.name.toLowerCase()));
    const similarComponents: string[] = [components[i].name];
    const uniqueFields: Record<string, string[]> = {
      [components[i].name]: components[i].fields.map(f => f.name),
    };
    let sharedFields = [...c1Fields];

    for (let j = i + 1; j < components.length; j++) {
      if (processed.has(components[j].name)) continue;

      const c2Fields = new Set(components[j].fields.map(f => f.name.toLowerCase()));
      const shared = [...c1Fields].filter(f => c2Fields.has(f));
      const similarity = shared.length / Math.min(c1Fields.size, c2Fields.size);

      // If 60%+ similarity and at least 3 shared fields
      if (similarity >= 0.6 && shared.length >= 3) {
        similarComponents.push(components[j].name);
        sharedFields = sharedFields.filter(f => c2Fields.has(f));
        uniqueFields[components[j].name] = [...c2Fields].filter(f => !c1Fields.has(f));
        uniqueFields[components[i].name] = [...c1Fields].filter(f => !c2Fields.has(f));
        processed.add(components[j].name);
      }
    }

    if (similarComponents.length > 1) {
      processed.add(components[i].name);
      const avgSimilarity = Math.round(
        (sharedFields.length / Math.max(...similarComponents.map(name => 
          components.find(c => c.name === name)?.fields.length || 0
        ))) * 100
      );

      groups.push({
        components: similarComponents,
        similarity: avgSimilarity,
        sharedFields,
        uniqueFields,
        recommendation: `Consolidate ${similarComponents.join(', ')} into one component with a "variant" or "style" enum field`,
      });
    }
  }

  const status: CheckpointStatus = 
    groups.length === 0 ? 'good' :
    groups.length <= 1 ? 'warning' : 'issue';

  return {
    status,
    groups,
    actionItems: groups.map(g => g.recommendation),
  };
}

// ============================================
// Duplicate Models Analysis
// ============================================

/**
 * Check if a model is a Hygraph auto-generated RichText embedded model
 * These have names like "ModelNameFieldNameRichText" and are system-generated
 */
function isRichTextEmbeddedModel(modelName: string): boolean {
  // RichText embedded models end with "RichText" and usually have compound names
  if (!modelName.endsWith('RichText')) return false;
  
  // Must have more than just "RichText" (i.e., has a prefix)
  const prefix = modelName.slice(0, -8); // Remove "RichText"
  if (prefix.length < 2) return false;
  
  // Check for patterns like "SomethingRichText" where Something is compound
  // These are auto-generated for each RichText field
  return true;
}

/**
 * Check if a model is an auto-generated embedded type
 */
function isEmbeddedTypeModel(modelName: string): boolean {
  // Check for common embedded type patterns
  const embeddedSuffixes = ['RichText', 'EmbeddedAsset', 'Link'];
  return embeddedSuffixes.some(suffix => 
    modelName.endsWith(suffix) && modelName.length > suffix.length
  );
}

function analyzeDuplicateModels(models: HygraphModel[]): DuplicatesAssessment['models'] {
  const groups: DuplicateModelGroup[] = [];
  const processed = new Set<string>();

  // Filter out auto-generated embedded type models (RichText, etc.)
  const userModels = models.filter(m => !isEmbeddedTypeModel(m.name));

  // First, find name-based duplicates (versioned models)
  const versionPattern = /^(.+?)[_\s]?[vV]?\d+$/;
  const baseNames = new Map<string, string[]>();

  for (const model of userModels) {
    const match = model.name.match(versionPattern);
    const baseName = match ? match[1] : null;
    
    if (baseName) {
      if (!baseNames.has(baseName)) {
        baseNames.set(baseName, []);
      }
      baseNames.get(baseName)!.push(model.name);
    }
  }

  for (const [baseName, versions] of baseNames) {
    if (versions.length > 1) {
      for (const v of versions) processed.add(v);
      groups.push({
        models: versions,
        similarity: 90,
        sharedFields: [],
        reason: `Versioned models of "${baseName}"`,
        recommendation: `Consolidate ${versions.join(', ')} into a single "${baseName}" model and deprecate old versions`,
      });
    }
  }

  // Then find field-based duplicates (only for actual content models)
  for (let i = 0; i < userModels.length; i++) {
    if (processed.has(userModels[i].name)) continue;
    
    // Skip small models (less than 5 fields) - not enough to be meaningful duplicates
    if (userModels[i].fields.length < 5) continue;

    const m1Fields = new Set(userModels[i].fields.map(f => f.name.toLowerCase()));
    const similarModels: string[] = [userModels[i].name];
    let sharedFields = [...m1Fields];
    let maxSimilarity = 0;

    for (let j = i + 1; j < userModels.length; j++) {
      if (processed.has(userModels[j].name)) continue;
      
      // Skip small models
      if (userModels[j].fields.length < 5) continue;

      const m2Fields = new Set(userModels[j].fields.map(f => f.name.toLowerCase()));
      const shared = [...m1Fields].filter(f => m2Fields.has(f));
      
      // Exclude common fields that appear in many models
      const commonFields = new Set(['id', 'createdat', 'updatedat', 'publishedat', 'stage', 'locale', 'title', 'slug', 'name', 'description']);
      const meaningfulShared = shared.filter(f => !commonFields.has(f));
      
      const similarity = meaningfulShared.length / Math.min(m1Fields.size, m2Fields.size);

      // If 70%+ similarity and at least 5 meaningful shared fields
      if (similarity >= 0.7 && meaningfulShared.length >= 5) {
        similarModels.push(userModels[j].name);
        sharedFields = sharedFields.filter(f => m2Fields.has(f));
        maxSimilarity = Math.max(maxSimilarity, similarity);
        processed.add(userModels[j].name);
      }
    }

    if (similarModels.length > 1) {
      processed.add(userModels[i].name);
      groups.push({
        models: similarModels,
        similarity: Math.round(maxSimilarity * 100),
        sharedFields: sharedFields.slice(0, 10),
        reason: `${Math.round(maxSimilarity * 100)}% field overlap (${sharedFields.length} shared fields)`,
        recommendation: `Consider consolidating ${similarModels.join(' and ')} into a single model with a "type" discriminator field`,
      });
    }
  }

  const status: CheckpointStatus = 
    groups.length === 0 ? 'good' :
    groups.length <= 1 ? 'warning' : 'issue';

  return {
    status,
    groups,
    actionItems: groups.map(g => g.recommendation),
  };
}

// ============================================
// Boolean Show/Hide Analysis
// ============================================

function analyzeBooleanShowHide(
  models: HygraphModel[],
  components: HygraphModel[]
): DuplicatesAssessment['booleanShowHide'] {
  const fields: BooleanShowHideField[] = [];

  const patterns: { regex: RegExp; pattern: BooleanShowHideField['pattern'] }[] = [
    { regex: /^show[A-Z]/i, pattern: 'show' },
    { regex: /^hide[A-Z]/i, pattern: 'hide' },
    { regex: /^enable[A-Z]/i, pattern: 'enable' },
    { regex: /^disable[A-Z]/i, pattern: 'disable' },
    { regex: /^is[A-Z]/i, pattern: 'is' },
  ];

  for (const item of [...models, ...components]) {
    for (const field of item.fields) {
      if (field.type !== 'Boolean') continue;

      for (const { regex, pattern } of patterns) {
        if (regex.test(field.name)) {
          fields.push({
            model: item.name,
            field: field.name,
            pattern,
          });
          break;
        }
      }
    }
  }

  // Group by pattern for better insights
  const byPattern = fields.reduce((acc, f) => {
    if (!acc[f.pattern]) acc[f.pattern] = [];
    acc[f.pattern].push(f);
    return acc;
  }, {} as Record<string, BooleanShowHideField[]>);

  const status: CheckpointStatus = 
    fields.length <= 3 ? 'good' :
    fields.length <= 8 ? 'warning' : 'issue';

  return {
    status,
    fields,
    actionItems: fields.length > 3
      ? [
          `Found ${fields.length} boolean show/hide fields - consider if these create editor confusion`,
          ...Object.entries(byPattern)
            .filter(([, fs]) => fs.length >= 3)
            .map(([pattern, fs]) =>
              `${fs.length} "${pattern}*" fields may indicate presentation logic in content schema`
            ),
        ]
      : [],
  };
}
