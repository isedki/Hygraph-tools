import { GraphQLClient } from 'graphql-request';
import type { IntrospectionResult, HygraphSchema, HygraphModel, HygraphField, HygraphTaxonomy } from '../types';

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      types {
        kind
        name
        fields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
          args {
            name
            type {
              kind
              name
            }
          }
        }
        enumValues {
          name
        }
        inputFields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
        possibleTypes {
          name
        }
      }
      queryType {
        name
      }
      mutationType {
        name
      }
    }
  }
`;

// System types to exclude from analysis
const SYSTEM_TYPE_PREFIXES = [
  '__',
  'Aggregate',
  'BatchPayload',
  'Connection',
  'DocumentVersion',
  'Edge',
  'PageInfo',
  'Query',
  'Mutation',
  'Subscription',
  'Version',
  'RGBA',
  'RichText',
  'Location',
  'Color',
];

const SYSTEM_TYPES = new Set([
  'Asset',
  'User',
  'ScheduledOperation',
  'ScheduledRelease',
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
  'DateTime',
  'Date',
  'Json',
  'Long',
  'Hex',
  'RGBAHue',
  'RGBATransparency',
]);

function isSystemType(name: string): boolean {
  if (SYSTEM_TYPES.has(name)) return true;
  return SYSTEM_TYPE_PREFIXES.some(prefix => 
    name.startsWith(prefix) || 
    name.endsWith('Connection') || 
    name.endsWith('Edge') ||
    name.endsWith('Aggregate') ||
    name.endsWith('OrderByInput') ||
    name.endsWith('WhereInput') ||
    name.endsWith('WhereUniqueInput') ||
    name.endsWith('CreateInput') ||
    name.endsWith('UpdateInput') ||
    name.endsWith('UpsertInput') ||
    name.endsWith('ConnectInput') ||
    name.endsWith('CreateManyInlineInput') ||
    name.endsWith('UpdateManyInlineInput') ||
    name.endsWith('ManyWhereInput')
  );
}

type FieldType = NonNullable<IntrospectionResult['__schema']['types'][0]['fields']>[0]['type'];

function extractFieldType(typeObj: FieldType): {
  typeName: string;
  isList: boolean;
  isRequired: boolean;
} {
  let typeName = '';
  let isList = false;
  let isRequired = false;
  
  let current: typeof typeObj | undefined = typeObj;
  
  while (current) {
    if (current.kind === 'NON_NULL') {
      isRequired = true;
      current = current.ofType;
    } else if (current.kind === 'LIST') {
      isList = true;
      current = current.ofType;
    } else {
      typeName = current.name || 'Unknown';
      break;
    }
  }
  
  return { typeName, isList, isRequired };
}

function mapToHygraphField(field: NonNullable<IntrospectionResult['__schema']['types'][0]['fields']>[0]): HygraphField {
  const { typeName, isList, isRequired } = extractFieldType(field.type);
  
  const hygraphField: HygraphField = {
    name: field.name,
    type: typeName,
    isRequired,
    isList,
  };
  
  // Check if it's a relation (pointing to another object type)
  if (!['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'Json', 'Long'].includes(typeName)) {
    hygraphField.relatedModel = typeName;
  }
  
  return hygraphField;
}

export async function fetchSchema(client: GraphQLClient): Promise<HygraphSchema> {
  const result = await client.request<IntrospectionResult>(INTROSPECTION_QUERY);
  
  const models: HygraphModel[] = [];
  const components: HygraphModel[] = [];
  const enums: { name: string; values: string[] }[] = [];
  
  // First, build a map of query field names to detect models and their plural API IDs
  const queryType = result.__schema.types.find(t => t.name === 'Query');
  const queryFields = queryType?.fields || [];
  
  // Build a map from type name to its plural API ID
  const pluralApiIdMap = new Map<string, string>();
  for (const field of queryFields) {
    // Skip connection, version, and special fields
    if (field.name.endsWith('Connection') || 
        field.name.endsWith('Version') || 
        field.name === 'node' ||
        field.name === 'entities' ||
        field.name.startsWith('hygraph')) {
      continue;
    }
    
    // Extract the return type
    const { typeName } = extractFieldType(field.type);
    
    // If this looks like a plural query (returns a list), map the type to this field name
    if (field.type.kind === 'NON_NULL' && field.type.ofType?.kind === 'LIST') {
      // This is likely the plural query
      const singularType = typeName;
      if (singularType && !pluralApiIdMap.has(singularType)) {
        pluralApiIdMap.set(singularType, field.name);
      }
    }
  }
  
  const queryFieldNames = new Set(queryFields.map(f => f.name.toLowerCase()));
  
  for (const type of result.__schema.types) {
    // Skip system types
    if (isSystemType(type.name)) continue;
    
    // Handle enums
    if (type.kind === 'ENUM' && type.enumValues && !type.name.endsWith('Stage') && !type.name.endsWith('OrderByInput')) {
      enums.push({
        name: type.name,
        values: type.enumValues.map(v => v.name),
      });
      continue;
    }
    
    // Handle object types (models and components)
    if (type.kind === 'OBJECT' && type.fields) {
      const fields = type.fields
        .filter(f => !['__typename', 'stage', 'documentInStages', 'history', 'publishedAt', 'createdAt', 'updatedAt', 'publishedBy', 'createdBy', 'updatedBy', 'scheduledIn'].includes(f.name))
        .map(mapToHygraphField);
      
      // Skip if no meaningful fields after filtering
      if (fields.length === 0) continue;
      
      // Get the actual plural API ID from the query fields, or generate a fallback
      const pluralApiId = pluralApiIdMap.get(type.name) || generatePluralApiId(type.name);
      
      const model: HygraphModel = {
        name: type.name,
        apiId: type.name,
        pluralApiId,
        fields,
        isComponent: false, // We'll determine this based on query availability
        isSystem: false,
      };
      
      models.push(model);
    }
  }
  
  // Identify components vs models based on whether they have a direct query
  // Components typically don't have their own queries in the schema
  for (const model of models) {
    const hasDirectQuery = queryFieldNames.has(model.name.toLowerCase()) || 
                          queryFieldNames.has(model.pluralApiId.toLowerCase());
    
    if (!hasDirectQuery && !model.name.startsWith('Rich') && !model.name.endsWith('RichText')) {
      model.isComponent = true;
      components.push(model);
    }
  }
  
  // Filter out components from models
  const actualModels = models.filter(m => !m.isComponent);
  
  // Detect Hygraph native taxonomies
  // Taxonomies appear as types with specific patterns and are referenced by models
  const taxonomies: HygraphTaxonomy[] = [];
  const taxonomyTypeNames = new Set<string>();
  
  // Find taxonomy-related types in the schema
  for (const type of result.__schema.types) {
    // Hygraph taxonomies often have names ending in specific patterns
    // or contain "Taxonomy" in their structure
    if (type.kind === 'OBJECT' && type.fields) {
      // Check if this looks like a taxonomy type (has path, name fields, hierarchical structure)
      const fieldNames = type.fields.map(f => f.name);
      const hasTaxonomyStructure = 
        (fieldNames.includes('path') || fieldNames.includes('ancestors') || fieldNames.includes('children')) &&
        (fieldNames.includes('name') || fieldNames.includes('title')) &&
        !isSystemType(type.name) &&
        !type.name.endsWith('Connection') &&
        !type.name.endsWith('Edge');
      
      if (hasTaxonomyStructure) {
        taxonomyTypeNames.add(type.name);
      }
    }
  }
  
  // Find models that use taxonomy fields
  for (const model of actualModels) {
    for (const field of model.fields) {
      // Check if this field references a taxonomy type
      if (field.relatedModel && taxonomyTypeNames.has(field.relatedModel)) {
        const existingTax = taxonomies.find(t => t.name === field.relatedModel);
        if (existingTax) {
          if (!existingTax.usedInModels.includes(model.name)) {
            existingTax.usedInModels.push(model.name);
          }
        } else {
          taxonomies.push({
            name: field.relatedModel,
            apiId: field.relatedModel,
            usedInModels: [model.name],
          });
        }
      }
    }
  }
  
  // Also check for fields that explicitly have "taxonomy" in their name or type
  for (const model of actualModels) {
    for (const field of model.fields) {
      const fieldNameLower = field.name.toLowerCase();
      const fieldTypeLower = field.type.toLowerCase();
      
      if ((fieldNameLower.includes('taxonomy') || fieldTypeLower.includes('taxonomy')) && 
          field.relatedModel && 
          !taxonomies.some(t => t.name === field.relatedModel)) {
        taxonomies.push({
          name: field.relatedModel,
          apiId: field.relatedModel,
          usedInModels: [model.name],
        });
      }
    }
  }
  
  return {
    models: actualModels,
    components,
    enums,
    taxonomies,
  };
}

// Generate a plural API ID using common English pluralization rules
function generatePluralApiId(name: string): string {
  const lower = name.toLowerCase();
  
  // Handle special cases
  if (lower.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(v => lower.endsWith(v))) {
    return lower.slice(0, -1) + 'ies';
  }
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
    return lower + 'es';
  }
  if (lower === 'person') {
    return 'people';
  }
  if (lower === 'child') {
    return 'children';
  }
  
  return lower + 's';
}

// Batch size for parallel queries (to avoid overwhelming the API)
const ENTITY_COUNT_BATCH_SIZE = 10;

// Fetch count for a single model
async function fetchSingleModelCount(
  client: GraphQLClient,
  model: HygraphModel
): Promise<{ draft: number; published: number }> {
  try {
    const query = `
      query Count${model.name} {
        draft: ${model.pluralApiId}Connection(stage: DRAFT) {
          aggregate {
            count
          }
        }
        published: ${model.pluralApiId}Connection(stage: PUBLISHED) {
          aggregate {
            count
          }
        }
      }
    `;
    
    const result = await client.request<{
      draft: { aggregate: { count: number } };
      published: { aggregate: { count: number } };
    }>(query);
    
    return {
      draft: result.draft.aggregate.count,
      published: result.published.aggregate.count,
    };
  } catch {
    // Model might not support staging or connection queries
    return { draft: 0, published: 0 };
  }
}

// Get entity counts for each model (batched for scalability)
export async function fetchEntityCounts(
  client: GraphQLClient, 
  models: HygraphModel[]
): Promise<Record<string, { draft: number; published: number }>> {
  const counts: Record<string, { draft: number; published: number }> = {};
  
  // Filter to only content models (skip components and system models)
  const contentModels = models.filter(m => !m.isComponent && !m.isSystem);
  
  // Process in parallel batches for performance
  for (let i = 0; i < contentModels.length; i += ENTITY_COUNT_BATCH_SIZE) {
    const batch = contentModels.slice(i, i + ENTITY_COUNT_BATCH_SIZE);
    
    // Run batch in parallel
    const batchResults = await Promise.all(
      batch.map(model => fetchSingleModelCount(client, model))
    );
    
    // Store results
    batch.forEach((model, idx) => {
      counts[model.name] = batchResults[idx];
    });
  }
  
  return counts;
}

// Fetch sample content for analysis
export async function fetchSampleContent(
  client: GraphQLClient,
  model: HygraphModel,
  limit: number = 10
): Promise<Record<string, unknown>[]> {
  try {
    // Build a simple query with basic fields
    const scalarFields = model.fields
      .filter(f => ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date'].includes(f.type))
      .slice(0, 10)
      .map(f => f.name);
    
    if (scalarFields.length === 0) {
      scalarFields.push('id');
    }
    
    const query = `
      query Sample${model.name} {
        ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
          ${scalarFields.join('\n          ')}
        }
      }
    `;
    
    const result = await client.request<Record<string, Record<string, unknown>[]>>(query);
    return result[model.pluralApiId] || [];
  } catch {
    return [];
  }
}

// Fetch asset information
export async function fetchAssetStats(client: GraphQLClient): Promise<{
  total: number;
  withoutAlt: number;
  largeAssets: number;
}> {
  let total = 0;
  let withoutAlt = 0;
  let largeAssets = 0;
  
  // First, get total count (this should always work)
  try {
    const totalQuery = `
      query AssetTotal {
        assetsConnection(stage: DRAFT) {
          aggregate {
            count
          }
        }
      }
    `;
    
    const totalResult = await client.request<{
      assetsConnection: { aggregate: { count: number } };
    }>(totalQuery);
    
    total = totalResult.assetsConnection.aggregate.count;
  } catch {
    // If even basic asset query fails, assets might not exist or be accessible
    return { total: 0, withoutAlt: 0, largeAssets: 0 };
  }
  
  // Try to get assets without alt text (alt field might not exist)
  try {
    const altQuery = `
      query AssetsWithoutAlt {
        withoutAlt: assetsConnection(stage: DRAFT, where: { alt: null }) {
          aggregate {
            count
          }
        }
      }
    `;
    
    const altResult = await client.request<{
      withoutAlt: { aggregate: { count: number } };
    }>(altQuery);
    
    withoutAlt = altResult.withoutAlt.aggregate.count;
  } catch {
    // alt field might not exist - estimate based on total
    // Assume 50% don't have alt if we can't query
    withoutAlt = Math.round(total * 0.5);
  }
  
  // Try to get large assets
  try {
    const largeQuery = `
      query LargeAssets {
        largeAssets: assetsConnection(stage: DRAFT, where: { size_gt: 1000000 }) {
          aggregate {
            count
          }
        }
      }
    `;
    
    const largeResult = await client.request<{
      largeAssets: { aggregate: { count: number } };
    }>(largeQuery);
    
    largeAssets = largeResult.largeAssets.aggregate.count;
  } catch {
    // size filter might not work - estimate
    largeAssets = Math.round(total * 0.1);
  }
  
  return { total, withoutAlt, largeAssets };
}

// Fetch content sample with specific fields for analysis
export async function fetchContentSample(
  client: GraphQLClient,
  model: HygraphModel,
  fields: string[],
  limit: number = 100
): Promise<Record<string, unknown>[]> {
  try {
    // Filter to only include valid fields that exist on the model
    const validFields = fields.filter(f => 
      model.fields.some(mf => mf.name === f)
    );
    
    // Always include id
    if (!validFields.includes('id')) {
      validFields.unshift('id');
    }
    
    if (validFields.length === 0) {
      return [];
    }
    
    const query = `
      query ContentSample${model.name} {
        ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
          ${validFields.join('\n          ')}
        }
      }
    `;
    
    const result = await client.request<Record<string, Record<string, unknown>[]>>(query);
    return result[model.pluralApiId] || [];
  } catch {
    return [];
  }
}

// Fetch freshness data (updatedAt timestamps) for a model
export async function fetchFreshnessData(
  client: GraphQLClient,
  model: HygraphModel,
  limit: number = 1000
): Promise<{ updatedAt: string; createdAt: string }[]> {
  try {
    const query = `
      query FreshnessData${model.name} {
        ${model.pluralApiId}(first: ${limit}, stage: DRAFT, orderBy: updatedAt_DESC) {
          updatedAt
          createdAt
        }
      }
    `;
    
    const result = await client.request<Record<string, { updatedAt: string; createdAt: string }[]>>(query);
    return result[model.pluralApiId] || [];
  } catch {
    return [];
  }
}

// Fetch Rich Text content for analysis (HTML format)
export async function fetchRichTextContent(
  client: GraphQLClient,
  model: HygraphModel,
  richTextField: string,
  limit: number = 50
): Promise<{ id: string; content: { html?: string; text?: string; raw?: unknown } | null }[]> {
  try {
    const query = `
      query RichTextContent${model.name} {
        ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
          id
          ${richTextField} {
            html
            text
          }
        }
      }
    `;
    
    const result = await client.request<Record<string, { id: string; [key: string]: unknown }[]>>(query);
    const entries = result[model.pluralApiId] || [];
    
    return entries.map(entry => ({
      id: entry.id as string,
      content: entry[richTextField] as { html?: string; text?: string; raw?: unknown } | null
    }));
  } catch {
    return [];
  }
}

// Fetch all scalar field values for empty field analysis
export async function fetchFieldValues(
  client: GraphQLClient,
  model: HygraphModel,
  limit: number = 100
): Promise<Record<string, unknown>[]> {
  try {
    // Get all scalar fields (excluding system fields)
    const scalarFields = model.fields
      .filter(f => {
        // Only scalar types
        const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'Json', 'Long'];
        return scalarTypes.includes(f.type);
      })
      .map(f => f.name);
    
    // Always include id
    if (!scalarFields.includes('id')) {
      scalarFields.unshift('id');
    }
    
    // Include Rich Text fields with just text format
    const richTextFields = model.fields
      .filter(f => f.type === 'RichText' || f.name.toLowerCase().includes('richtext'))
      .map(f => `${f.name} { text }`);
    
    const allFields = [...scalarFields, ...richTextFields];
    
    if (allFields.length === 0) {
      return [];
    }
    
    const query = `
      query FieldValues${model.name} {
        ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
          ${allFields.join('\n          ')}
        }
      }
    `;
    
    const result = await client.request<Record<string, Record<string, unknown>[]>>(query);
    return result[model.pluralApiId] || [];
  } catch {
    return [];
  }
}

