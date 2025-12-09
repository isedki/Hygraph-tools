import { GraphQLClient } from 'graphql-request';
import type { HygraphSchema, HygraphModel, HygraphField, HygraphEnum, HygraphUnion } from './types';

// GraphQL introspection query
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      types {
        name
        kind
        description
        fields(includeDeprecated: true) {
          name
          description
          type {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
        enumValues {
          name
        }
        possibleTypes {
          name
        }
      }
      queryType {
        name
        fields {
          name
        }
      }
    }
  }
`;

// System types to filter out
const SYSTEM_TYPE_PREFIXES = ['__', '_'];
const SYSTEM_TYPE_PATTERNS = [
  /^Rich.*Text$/,
  /.*Connection$/,
  /.*Edge$/,
  /.*Aggregate$/,
  /.*WhereInput$/,
  /.*OrderByInput$/,
  /.*CreateInput$/,
  /.*UpdateInput$/,
  /.*ManyInlineInput$/,
  /.*UpsertInput$/,
  /.*ConnectInput$/,
];

const SYSTEM_COMPONENTS = new Set([
  'Color', 'Location', 'RGBA', 'RichText', 'RichTextAST', 
  'PageInfo', 'BatchPayload', 'Version', 'DocumentVersion',
  'AssetUpload', 'AssetUploadError', 'AssetUploadRequestPostData',
]);

const SYSTEM_ENUMS = new Set([
  'DocumentFileTypes', 'ImageFit', 'Locale', 'Stage',
  'ScheduledOperationStatus', 'ScheduledReleaseStatus',
  'SystemDateTimeFieldVariation', 'EntityTypeName', 'UserKind',
]);

function isSystemType(name: string): boolean {
  if (SYSTEM_TYPE_PREFIXES.some(p => name.startsWith(p))) return true;
  if (SYSTEM_TYPE_PATTERNS.some(p => p.test(name))) return true;
  if (SYSTEM_COMPONENTS.has(name)) return true;
  if (name.includes('FromAnotherProject_')) return true;
  return false;
}

function isSystemEnum(name: string): boolean {
  if (SYSTEM_ENUMS.has(name)) return true;
  if (name.startsWith('_')) return true;
  if (name.endsWith('Variation')) return true;
  for (const sysEnum of SYSTEM_ENUMS) {
    if (name.endsWith(`_${sysEnum}`)) return true;
  }
  if (name.includes('FromAnotherProject_')) return true;
  return false;
}

function isSystemComponent(name: string): boolean {
  if (SYSTEM_COMPONENTS.has(name)) return true;
  if (isSystemType(name)) return true;
  const systemSuffixes = ['ScheduledRelease', 'ScheduledOperation', 'User', 'Version', 'Asset'];
  for (const suffix of systemSuffixes) {
    if (name === suffix) return true;
    if (name.endsWith(`_${suffix}`)) return true;
  }
  return false;
}

function unwrapType(type: { name?: string; kind?: string; ofType?: unknown }): string {
  if (type.name) return type.name;
  if (type.ofType) return unwrapType(type.ofType as typeof type);
  return 'Unknown';
}

function generatePluralApiId(name: string): string {
  if (name.endsWith('s')) return name + 'es';
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  return name + 's';
}

export async function fetchSchema(client: GraphQLClient): Promise<HygraphSchema> {
  const result = await client.request<{
    __schema: {
      types: Array<{
        name: string;
        kind: string;
        description?: string;
        fields?: Array<{
          name: string;
          description?: string;
          type: { name?: string; kind?: string; ofType?: unknown };
        }>;
        enumValues?: Array<{ name: string }>;
        possibleTypes?: Array<{ name: string }>;
      }>;
      queryType: {
        name: string;
        fields: Array<{ name: string }>;
      };
    };
  }>(INTROSPECTION_QUERY);

  const models: HygraphModel[] = [];
  const components: HygraphModel[] = [];
  const enums: HygraphEnum[] = [];
  const unions: HygraphUnion[] = [];

  // Get query field names to identify models vs components
  const queryFieldNames = new Set(
    result.__schema.queryType.fields.map(f => f.name.toLowerCase())
  );

  for (const type of result.__schema.types) {
    // Skip system types
    if (isSystemType(type.name)) continue;

    // Process OBJECT types (models and components)
    if (type.kind === 'OBJECT' && type.fields) {
      const fields: HygraphField[] = type.fields.map(f => {
        const typeName = unwrapType(f.type);
        return {
          name: f.name,
          type: typeName,
          isRequired: f.type.kind === 'NON_NULL',
          isList: f.type.kind === 'LIST' || (f.type as { ofType?: { kind: string } }).ofType?.kind === 'LIST',
          relatedModel: typeName !== 'String' && typeName !== 'Int' && typeName !== 'Float' && 
                        typeName !== 'Boolean' && typeName !== 'DateTime' && typeName !== 'ID' &&
                        typeName !== 'Json' && typeName !== 'Date' ? typeName : undefined,
          description: f.description,
        };
      });

      const pluralApiId = generatePluralApiId(type.name.charAt(0).toLowerCase() + type.name.slice(1));
      
      const model: HygraphModel = {
        name: type.name,
        apiId: type.name,
        pluralApiId,
        fields,
        isComponent: false,
        isSystem: false,
      };

      // Determine if it's a model or component based on query availability
      const hasDirectQuery = queryFieldNames.has(type.name.toLowerCase()) ||
                            queryFieldNames.has(pluralApiId.toLowerCase());

      if (!hasDirectQuery && !isSystemComponent(type.name)) {
        model.isComponent = true;
        components.push(model);
      } else if (!isSystemType(type.name)) {
        models.push(model);
      }
    }

    // Process ENUM types
    if (type.kind === 'ENUM' && type.enumValues && !isSystemEnum(type.name)) {
      enums.push({
        name: type.name,
        values: type.enumValues.map(v => v.name),
      });
    }

    // Process UNION types
    if (type.kind === 'UNION' && type.possibleTypes) {
      unions.push({
        name: type.name,
        possibleTypes: type.possibleTypes.map(t => t.name),
      });
    }
  }

  return { models, components, enums, unions };
}

export function createClient(endpoint: string, authToken: string): GraphQLClient {
  return new GraphQLClient(endpoint, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}


