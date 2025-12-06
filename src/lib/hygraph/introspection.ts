import { GraphQLClient } from 'graphql-request';
import type { IntrospectionResult, HygraphSchema, HygraphModel, HygraphField } from '../types';

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
  
  return {
    models: actualModels,
    components,
    enums,
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

// Get entity counts for each model
export async function fetchEntityCounts(
  client: GraphQLClient, 
  models: HygraphModel[]
): Promise<Record<string, { draft: number; published: number }>> {
  const counts: Record<string, { draft: number; published: number }> = {};
  
  // Build aggregation queries for each model
  for (const model of models) {
    if (model.isComponent) continue;
    
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
      
      counts[model.name] = {
        draft: result.draft.aggregate.count,
        published: result.published.aggregate.count,
      };
    } catch {
      // Model might not support staging or connection queries
      counts[model.name] = { draft: 0, published: 0 };
    }
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
  try {
    const query = `
      query AssetStats {
        assetsConnection(stage: DRAFT) {
          aggregate {
            count
          }
        }
        withoutAlt: assetsConnection(stage: DRAFT, where: { alt: null }) {
          aggregate {
            count
          }
        }
        largeAssets: assetsConnection(stage: DRAFT, where: { size_gt: 1000000 }) {
          aggregate {
            count
          }
        }
      }
    `;
    
    const result = await client.request<{
      assetsConnection: { aggregate: { count: number } };
      withoutAlt: { aggregate: { count: number } };
      largeAssets: { aggregate: { count: number } };
    }>(query);
    
    return {
      total: result.assetsConnection.aggregate.count,
      withoutAlt: result.withoutAlt.aggregate.count,
      largeAssets: result.largeAssets.aggregate.count,
    };
  } catch {
    return { total: 0, withoutAlt: 0, largeAssets: 0 };
  }
}

