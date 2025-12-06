import { GraphQLClient } from 'graphql-request';
import type { HygraphSchema, HygraphModel, HygraphField } from '../types';

// ============================================
// Types for Component Usage Finder
// ============================================

export interface ComponentUsageLocation {
  entryId: string;
  entryTitle: string;
  modelName: string;
  modelPluralApiId: string;
  fieldPath: string[];
  stage: 'DRAFT' | 'PUBLISHED';
  componentData: Record<string, unknown>;
  previewFields: Record<string, unknown>;
}

export interface SchemaElement {
  name: string;
  type: 'component' | 'model' | 'enum' | 'field';
  description?: string;
  usedIn?: string[];
  fieldCount?: number;
  fields?: string[];
}

export interface ComponentUsageResult {
  element: SchemaElement;
  totalUsages: number;
  usages: ComponentUsageLocation[];
  modelsWithUsage: string[];
  searchPath: string[];
}

export interface UnionTypeInfo {
  unionName: string;
  possibleTypes: string[];
  usedInModel: string;
  fieldName: string;
}

export interface FieldUsageMap {
  modelName: string;
  modelPluralApiId: string;
  fieldName: string;
  fieldType: string;
  targetElement: string;
  isUnion: boolean;
  unionTypes?: string[];
  isNested: boolean;
  nestingPath: string[];
  isList: boolean;
}

// ============================================
// Enhanced Schema Discovery with Unions
// ============================================

export async function discoverUnionTypes(client: GraphQLClient): Promise<UnionTypeInfo[]> {
  const query = `
    query DiscoverUnions {
      __schema {
        types {
          kind
          name
          possibleTypes {
            name
          }
        }
      }
    }
  `;
  
  try {
    const result = await client.request<{
      __schema: {
        types: { kind: string; name: string; possibleTypes?: { name: string }[] }[];
      };
    }>(query);
    
    const unions: UnionTypeInfo[] = [];
    
    for (const type of result.__schema.types) {
      if (type.kind === 'UNION' && type.possibleTypes && type.possibleTypes.length > 0) {
        // Skip system unions
        if (type.name.startsWith('__') || 
            type.name.includes('ScheduledOperation') ||
            type.name.includes('RichTextEmbedded')) continue;
        
        unions.push({
          unionName: type.name,
          possibleTypes: type.possibleTypes.map(t => t.name),
          usedInModel: '', // Will be filled later
          fieldName: '', // Will be filled later
        });
      }
    }
    
    return unions;
  } catch (error) {
    console.error('Error discovering unions:', error);
    return [];
  }
}

export async function discoverModelFields(
  client: GraphQLClient,
  modelName: string
): Promise<{ name: string; typeName: string; isList: boolean; isUnion: boolean }[]> {
  const query = `
    query DiscoverFields {
      __type(name: "${modelName}") {
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
        }
      }
    }
  `;
  
  try {
    const result = await client.request<{
      __type: {
        fields: {
          name: string;
          type: {
            kind: string;
            name: string | null;
            ofType?: {
              kind: string;
              name: string | null;
              ofType?: {
                kind: string;
                name: string | null;
                ofType?: { kind: string; name: string | null };
              };
            };
          };
        }[];
      } | null;
    }>(query);
    
    if (!result.__type?.fields) return [];
    
    return result.__type.fields.map(f => {
      let typeName = '';
      let isList = false;
      let isUnion = false;
      let current = f.type;
      
      while (current) {
        if (current.kind === 'NON_NULL') {
          current = current.ofType as typeof current;
        } else if (current.kind === 'LIST') {
          isList = true;
          current = current.ofType as typeof current;
        } else if (current.kind === 'UNION') {
          isUnion = true;
          typeName = current.name || '';
          break;
        } else {
          typeName = current.name || '';
          break;
        }
      }
      
      return { name: f.name, typeName, isList, isUnion };
    });
  } catch {
    return [];
  }
}

// ============================================
// Build Schema Element Index
// ============================================

// System components to filter out
const SYSTEM_COMPONENTS = new Set([
  'AssetUpload',
  'AssetUploadError', 
  'AssetUploadRequestPostData',
  'AssetUploadWhereInput',
  'BatchPayload',
  'Color',
  'ColorInput',
  'ConnectPositionInput',
  'DocumentOutputInput',
  'DocumentTransformationInput',
  'DocumentVersion',
  'ImageResizeInput',
  'ImageTransformationInput',
  'Location',
  'LocationInput',
  'PageInfo',
  'RGBA',
  'RGBAInput',
  'RichText',
  'RichTextAST',
  'Version',
  'VersionWhereInput',
]);

// Check if an enum is a system enum
function isSystemEnum(name: string): boolean {
  // Enums starting with underscore are system enums
  if (name.startsWith('_')) return true;
  
  // Exact system enum names (Hygraph internal enums)
  const systemEnums = new Set([
    'DocumentFileTypes',
    'ImageFit', 
    'Locale',
    'Stage',
    'ScheduledOperationStatus',
    'ScheduledReleaseStatus',
    'SystemDateTimeFieldVariation',
    // Internal Hygraph enums not shown in Schema editor
    'EntityTypeName',
    'UserKind',
    'BatchPayloadType',
    'ColorInput',
    'ConnectPositionInput',
    'DocumentOutputInput',
    'DocumentTransformationInput',
    'ImageResizeInput',
    'ImageTransformationInput',
    'LocationInput',
    'PublishLocaleInput',
    'RGBAInput',
    'RGBAHue',
    'UnpublishLocaleInput',
  ]);
  
  if (systemEnums.has(name)) return true;
  
  // Check if ends with _SystemEnumName (remote field enums)
  for (const sysEnum of systemEnums) {
    if (name.endsWith(`_${sysEnum}`)) return true;
  }
  
  // Filter out anything ending with "Variation" (system date/time fields)
  if (name.endsWith('Variation')) return true;
  
  // Filter out remote field enums (prefixed project enums)
  if (name.includes('FromAnotherProject_')) return true;
  
  return false;
}

// Check if a component is a system component
function isSystemComponent(name: string): boolean {
  if (SYSTEM_COMPONENTS.has(name)) return true;
  
  // Patterns for system components
  if (name.startsWith('Asset') && (
    name.includes('Upload') || 
    name.includes('Transform') ||
    name.includes('Output')
  )) return true;
  
  if (name.endsWith('RichText') && name !== 'RichText') return true;
  if (name.includes('WhereInput')) return true;
  if (name.includes('OrderByInput')) return true;
  if (name.includes('CreateInput')) return true;
  if (name.includes('UpdateInput')) return true;
  if (name.includes('ConnectInput')) return true;
  if (name.includes('UpsertInput')) return true;
  if (name.includes('ManyInlineInput')) return true;
  
  // System suffixes for auto-generated relation/system types
  const systemSuffixes = [
    'ScheduledRelease',
    'ScheduledOperation',
    'User',
    'Version',
    'Asset',
    'Connection',
    'Edge',
    'Aggregate',
  ];
  
  for (const suffix of systemSuffixes) {
    // Match exact suffix or _Suffix pattern
    if (name === suffix) return true;
    if (name.endsWith(`_${suffix}`)) return true;
    if (name.endsWith(`${suffix}Connection`)) return true;
    if (name.endsWith(`${suffix}Edge`)) return true;
  }
  
  // Filter remote field components
  if (name.includes('FromAnotherProject_')) return true;
  
  return false;
}

export function buildSchemaElementIndex(schema: HygraphSchema): SchemaElement[] {
  const elements: SchemaElement[] = [];
  
  // Add components (filter out system components)
  for (const component of schema.components) {
    // Skip system components
    if (isSystemComponent(component.name)) continue;
    
    const usedIn = findWhereComponentIsUsed(component.name, schema);
    elements.push({
      name: component.name,
      type: 'component',
      usedIn,
      fieldCount: component.fields.length,
      fields: component.fields.map(f => f.name),
    });
  }
  
  // Add models (for reference tracking)
  for (const model of schema.models) {
    elements.push({
      name: model.name,
      type: 'model',
      fieldCount: model.fields.length,
      fields: model.fields.map(f => f.name),
    });
  }
  
  // Add enums (filter out system enums)
  for (const enumDef of schema.enums) {
    // Skip system enums
    if (isSystemEnum(enumDef.name)) continue;
    
    const usedIn = findWhereEnumIsUsed(enumDef.name, schema);
    elements.push({
      name: enumDef.name,
      type: 'enum',
      usedIn,
      description: `Values: ${enumDef.values.slice(0, 5).join(', ')}${enumDef.values.length > 5 ? '...' : ''}`,
    });
  }
  
  return elements;
}

function findWhereComponentIsUsed(componentName: string, schema: HygraphSchema): string[] {
  const usedIn: string[] = [];
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.relatedModel === componentName || field.type === componentName) {
        usedIn.push(model.name);
        break;
      }
    }
  }
  
  for (const component of schema.components) {
    if (component.name === componentName) continue;
    for (const field of component.fields) {
      if (field.relatedModel === componentName || field.type === componentName) {
        usedIn.push(component.name);
        break;
      }
    }
  }
  
  return [...new Set(usedIn)];
}

function findWhereEnumIsUsed(enumName: string, schema: HygraphSchema): string[] {
  const usedIn: string[] = [];
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.type === enumName) {
        usedIn.push(model.name);
        break;
      }
    }
  }
  
  for (const component of schema.components) {
    for (const field of component.fields) {
      if (field.type === enumName) {
        usedIn.push(component.name);
        break;
      }
    }
  }
  
  return [...new Set(usedIn)];
}

// ============================================
// Enhanced Component/Enum Usage Finder
// ============================================

export async function findComponentUsage(
  client: GraphQLClient,
  schema: HygraphSchema,
  elementName: string,
  elementType: 'component' | 'enum',
  limit: number = 100
): Promise<ComponentUsageResult> {
  // Route to appropriate handler
  if (elementType === 'enum') {
    return findEnumUsage(client, schema, elementName, limit);
  }
  return findComponentUsageInternal(client, schema, elementName, limit);
}

// ============================================
// Enum Usage Finder
// ============================================

async function findEnumUsage(
  client: GraphQLClient,
  schema: HygraphSchema,
  enumName: string,
  limit: number
): Promise<ComponentUsageResult> {
  const usages: ComponentUsageLocation[] = [];
  const modelsWithUsage = new Set<string>();
  const searchPath: string[] = [];
  
  // Get enum values for reference
  const enumDef = schema.enums.find(e => e.name === enumName);
  const enumValues = enumDef?.values || [];
  
  const element: SchemaElement = {
    name: enumName,
    type: 'enum',
    usedIn: findWhereEnumIsUsed(enumName, schema),
    description: `Values: ${enumValues.slice(0, 5).join(', ')}${enumValues.length > 5 ? '...' : ''}`,
  };
  
  searchPath.push(`Searching for enum "${enumName}" usage...`);
  searchPath.push(`Enum values: ${enumValues.join(', ')}`);
  
  // For each model, discover fields that use this enum
  for (const model of schema.models) {
    searchPath.push(`Analyzing ${model.name}...`);
    
    // Discover actual field types for this model
    const modelFields = await discoverModelFields(client, model.name);
    
    // Find fields that use this enum
    const enumFields: string[] = [];
    
    for (const field of modelFields) {
      // Skip system fields
      if (['stage', 'id', 'createdAt', 'updatedAt', 'publishedAt', 'documentInStages', 'history', 'publishedBy', 'createdBy', 'updatedBy', 'scheduledIn', 'locale', 'localizations'].includes(field.name)) {
        continue;
      }
      
      // Check if field type is the enum
      if (field.typeName === enumName) {
        enumFields.push(field.name);
      }
    }
    
    if (enumFields.length === 0) continue;
    
    searchPath.push(`  Found ${enumFields.length} field(s) using enum: ${enumFields.join(', ')}`);
    
    // Query this model for enum usage
    try {
      const entries = await queryModelForEnum(
        client,
        model,
        enumFields,
        enumName,
        enumValues,
        limit
      );
      
      for (const entry of entries) {
        modelsWithUsage.add(model.name);
        usages.push(entry);
      }
      
      searchPath.push(`  Found ${entries.length} entries using enum ${enumName}`);
    } catch (error) {
      searchPath.push(`  Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
  
  // Also check components that use the enum and find entries using those components
  const componentsUsingEnum: string[] = [];
  for (const component of schema.components) {
    for (const field of component.fields) {
      if (field.type === enumName) {
        componentsUsingEnum.push(component.name);
        break;
      }
    }
  }
  
  if (componentsUsingEnum.length > 0) {
    searchPath.push(`Enum also used in components: ${componentsUsingEnum.join(', ')}`);
    
    // For each component using the enum, find content using that component
    for (const componentName of componentsUsingEnum) {
      const componentResults = await findComponentUsageInternal(client, schema, componentName, limit);
      
      // Check each component instance for the enum field
      for (const usage of componentResults.usages) {
        // Find the enum field in the component data
        const component = schema.components.find(c => c.name === componentName);
        const enumField = component?.fields.find(f => f.type === enumName);
        
        if (enumField && usage.componentData[enumField.name]) {
          const enumValue = usage.componentData[enumField.name] as string;
          if (enumValues.includes(enumValue)) {
            usages.push({
              ...usage,
              fieldPath: [...usage.fieldPath, enumField.name],
              componentData: { 
                value: enumValue,
                inComponent: componentName,
                field: enumField.name 
              },
            });
            modelsWithUsage.add(usage.modelName);
          }
        }
      }
    }
  }
  
  return {
    element,
    totalUsages: usages.length,
    usages,
    modelsWithUsage: [...modelsWithUsage],
    searchPath,
  };
}

async function queryModelForEnum(
  client: GraphQLClient,
  model: HygraphModel,
  enumFields: string[],
  enumName: string,
  enumValues: string[],
  limit: number
): Promise<ComponentUsageLocation[]> {
  const results: ComponentUsageLocation[] = [];
  
  // Get title field
  const titleField = findTitleField(model);
  
  // Build field selection (just the enum fields directly)
  const fieldSelection = enumFields.join('\n        ');
  
  const query = `
    query Find${model.name}EnumUsage {
      entries: ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
        id
        ${titleField ? titleField : ''}
        ${fieldSelection}
      }
    }
  `;
  
  try {
    const response = await client.request<{ entries: Record<string, unknown>[] }>(query);
    
    for (const entry of response.entries) {
      // Check each enum field
      for (const fieldName of enumFields) {
        const value = entry[fieldName];
        
        // Skip if no value
        if (value === null || value === undefined) continue;
        
        // Handle both single value and array of enum values
        const values = Array.isArray(value) ? value : [value];
        
        for (let i = 0; i < values.length; i++) {
          const enumValue = values[i] as string;
          
          // Verify it's a valid enum value
          if (enumValues.length === 0 || enumValues.includes(enumValue)) {
            results.push({
              entryId: entry.id as string,
              entryTitle: (entry[titleField || 'id'] as string) || entry.id as string,
              modelName: model.name,
              modelPluralApiId: model.pluralApiId,
              fieldPath: Array.isArray(value) ? [fieldName, `[${i}]`] : [fieldName],
              stage: 'DRAFT',
              componentData: { 
                value: enumValue,
                field: fieldName,
                enumType: enumName
              },
              previewFields: extractPreviewFields(entry),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error querying ${model.name} for enum:`, error);
    throw error;
  }
  
  return results;
}

// ============================================
// Component Usage Finder (internal)
// ============================================

// Find all paths from components to the target element (for deeply nested search)
function findPathsToComponent(
  targetElement: string,
  schema: HygraphSchema,
  unions: UnionTypeInfo[]
): Set<string> {
  const containingComponents = new Set<string>();
  
  // Find components that directly contain the target
  for (const component of schema.components) {
    for (const field of component.fields) {
      const relatedType = field.relatedModel || field.type;
      
      // Direct reference
      if (relatedType === targetElement) {
        containingComponents.add(component.name);
        continue;
      }
      
      // Check unions
      const union = unions.find(u => u.unionName === relatedType);
      if (union && union.possibleTypes.includes(targetElement)) {
        containingComponents.add(component.name);
      }
    }
  }
  
  // Recursively find components that contain those components (up to 3 levels)
  for (let depth = 0; depth < 3; depth++) {
    const newContaining = new Set<string>();
    
    for (const component of schema.components) {
      if (containingComponents.has(component.name)) continue;
      
      for (const field of component.fields) {
        const relatedType = field.relatedModel || field.type;
        
        if (containingComponents.has(relatedType)) {
          newContaining.add(component.name);
          continue;
        }
        
        const union = unions.find(u => u.unionName === relatedType);
        if (union) {
          for (const possibleType of union.possibleTypes) {
            if (containingComponents.has(possibleType)) {
              newContaining.add(component.name);
              break;
            }
          }
        }
      }
    }
    
    for (const c of newContaining) {
      containingComponents.add(c);
    }
  }
  
  return containingComponents;
}

async function findComponentUsageInternal(
  client: GraphQLClient,
  schema: HygraphSchema,
  elementName: string,
  limit: number
): Promise<ComponentUsageResult> {
  const usages: ComponentUsageLocation[] = [];
  const modelsWithUsage = new Set<string>();
  const searchPath: string[] = [];
  
  // Get the element info
  const element: SchemaElement = {
    name: elementName,
    type: 'component',
    usedIn: findWhereComponentIsUsed(elementName, schema),
  };
  
  // Discover union types that might contain this component
  searchPath.push('Discovering schema structure...');
  const unions = await discoverUnionTypes(client);
  
  // Find all components that could contain the target (directly or nested)
  const containingComponents = findPathsToComponent(elementName, schema, unions);
  searchPath.push(`Found ${containingComponents.size} components that may contain ${elementName} (directly or nested)`);
  
  // Find unions that include the target or any containing component
  const allRelevantTypes = new Set([elementName, ...containingComponents]);
  
  // For each model, check if it has fields that reference any of the relevant types
  for (const model of schema.models) {
    searchPath.push(`Analyzing ${model.name}...`);
    
    // Discover actual field types for this model
    const modelFields = await discoverModelFields(client, model.name);
    
    // Find ALL component/union fields (we'll query them all and search deeply)
    const componentFields: { fieldName: string; isUnion: boolean; unionTypes?: string[] }[] = [];
    
    for (const field of modelFields) {
      // Skip system fields
      if (['stage', 'id', 'createdAt', 'updatedAt', 'publishedAt', 'documentInStages', 'history', 'publishedBy', 'createdBy', 'updatedBy', 'scheduledIn', 'locale', 'localizations'].includes(field.name)) {
        continue;
      }
      
      // Check if field type is directly relevant
      if (allRelevantTypes.has(field.typeName)) {
        componentFields.push({ fieldName: field.name, isUnion: false });
        continue;
      }
      
      // Check if field type is a union that contains relevant types
      if (field.isUnion) {
        const union = unions.find(u => u.unionName === field.typeName);
        if (union) {
          const hasRelevantType = union.possibleTypes.some(t => allRelevantTypes.has(t));
          if (hasRelevantType) {
            componentFields.push({ 
              fieldName: field.name, 
              isUnion: true, 
              unionTypes: union.possibleTypes 
            });
          }
        }
      }
      
      // Also check for component fields that aren't in our schema but might contain the target
      const fieldComponent = schema.components.find(c => c.name === field.typeName);
      if (fieldComponent) {
        componentFields.push({ fieldName: field.name, isUnion: false });
      }
    }
    
    if (componentFields.length === 0) {
      searchPath.push(`  No component fields found`);
      continue;
    }
    
    searchPath.push(`  Found ${componentFields.length} component field(s) to search`);
    
    // Query this model for component usage
    try {
      const entries = await queryModelForComponent(
        client,
        model,
        componentFields,
        elementName,
        schema,
        limit
      );
      
      for (const entry of entries) {
        modelsWithUsage.add(model.name);
        usages.push(entry);
      }
      
      searchPath.push(`  Found ${entries.length} entries using ${elementName}`);
    } catch (error) {
      searchPath.push(`  Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
  
  return {
    element,
    totalUsages: usages.length,
    usages,
    modelsWithUsage: [...modelsWithUsage],
    searchPath,
  };
}

// Build a deep query fragment for a component, including all nested component fields
function buildDeepComponentQuery(
  targetElement: string,
  schema: HygraphSchema,
  unions: UnionTypeInfo[],
  visited: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 5
): string {
  if (depth >= maxDepth || visited.has(targetElement)) {
    return '__typename';
  }
  
  visited.add(targetElement);
  
  const component = schema.components.find(c => c.name === targetElement);
  if (!component) {
    return '__typename';
  }
  
  const fields: string[] = ['__typename'];
  
  // Add scalar fields
  const scalarFields = component.fields
    .filter(f => isScalarType(f.type))
    .slice(0, 5)
    .map(f => f.name);
  fields.push(...scalarFields);
  
  // Add nested component/union fields recursively
  for (const field of component.fields) {
    if (isScalarType(field.type)) continue;
    
    const relatedType = field.relatedModel || field.type;
    
    // Check if it's a component
    const nestedComponent = schema.components.find(c => c.name === relatedType);
    if (nestedComponent) {
      const nestedQuery = buildDeepComponentQuery(
        relatedType, schema, unions, new Set(visited), depth + 1, maxDepth
      );
      fields.push(`${field.name} { ${nestedQuery} }`);
      continue;
    }
    
    // Check if it's a union
    const union = unions.find(u => u.unionName === relatedType);
    if (union) {
      const fragments = union.possibleTypes.map(type => {
        const typeComponent = schema.components.find(c => c.name === type);
        if (typeComponent) {
          const nestedQuery = buildDeepComponentQuery(
            type, schema, unions, new Set(visited), depth + 1, maxDepth
          );
          return `... on ${type} { ${nestedQuery} }`;
        }
        return `... on ${type} { __typename }`;
      }).join('\n        ');
      fields.push(`${field.name} { __typename ${fragments} }`);
    }
  }
  
  return fields.join('\n      ');
}

async function queryModelForComponent(
  client: GraphQLClient,
  model: HygraphModel,
  componentFields: { fieldName: string; isUnion: boolean; unionTypes?: string[] }[],
  elementName: string,
  schema: HygraphSchema,
  limit: number
): Promise<ComponentUsageLocation[]> {
  const results: ComponentUsageLocation[] = [];
  
  // Discover unions for deep querying
  const unions = await discoverUnionTypes(client);
  
  // Get component fields for the target
  const component = schema.components.find(c => c.name === elementName);
  const componentScalarFields = component?.fields
    .filter(f => isScalarType(f.type))
    .slice(0, 5)
    .map(f => f.name) || [];
  
  // Build field selections with DEEP nesting support
  const fieldSelections = componentFields.map(cf => {
    if (cf.isUnion && cf.unionTypes) {
      // For union types, build deep queries for each possible type
      const fragments = cf.unionTypes.map(type => {
        const typeComponent = schema.components.find(c => c.name === type);
        if (typeComponent) {
          const deepQuery = buildDeepComponentQuery(type, schema, unions, new Set(), 0, 5);
          return `... on ${type} { ${deepQuery} }`;
        }
        return `... on ${type} { __typename }`;
      }).join('\n        ');
      
      return `${cf.fieldName} {
        __typename
        ${fragments}
      }`;
    } else {
      // Direct component field - build deep query
      const fieldType = cf.fieldName;
      const relatedComponent = component || schema.components.find(c => 
        model.fields.some(f => f.name === fieldType && f.relatedModel === c.name)
      );
      
      // Find the actual type of this field
      const modelField = model.fields.find(f => f.name === cf.fieldName);
      const fieldTypeName = modelField?.relatedModel || elementName;
      
      const deepQuery = buildDeepComponentQuery(fieldTypeName, schema, unions, new Set(), 0, 5);
      
      return `${cf.fieldName} {
        ${deepQuery}
      }`;
    }
  }).join('\n      ');
  
  // Get title field
  const titleField = findTitleField(model);
  
  const query = `
    query Find${model.name}ComponentUsage {
      entries: ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
        id
        ${titleField ? titleField : ''}
        ${fieldSelections}
      }
    }
  `;
  
  try {
    const response = await client.request<{ entries: Record<string, unknown>[] }>(query);
    
    for (const entry of response.entries) {
      // Search through each component field
      for (const cf of componentFields) {
        const fieldValue = entry[cf.fieldName];
        
        if (!fieldValue) continue;
        
        const locations = findComponentInValue(
          fieldValue,
          elementName,
          [cf.fieldName]
        );
        
        for (const location of locations) {
          results.push({
            entryId: entry.id as string,
            entryTitle: (entry[titleField || 'id'] as string) || entry.id as string,
            modelName: model.name,
            modelPluralApiId: model.pluralApiId,
            fieldPath: location.path,
            stage: 'DRAFT',
            componentData: location.data,
            previewFields: extractPreviewFields(entry),
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error querying ${model.name}:`, error);
    throw error;
  }
  
  return results;
}

interface FoundLocation {
  path: string[];
  data: Record<string, unknown>;
}

function findComponentInValue(
  value: unknown,
  elementName: string,
  currentPath: string[]
): FoundLocation[] {
  const results: FoundLocation[] = [];
  
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (obj.__typename === elementName) {
          results.push({
            path: [...currentPath, `[${i}]`],
            data: obj,
          });
        }
        // Recurse into nested objects
        for (const [key, nestedValue] of Object.entries(obj)) {
          if (key === '__typename') continue;
          if (nestedValue && typeof nestedValue === 'object') {
            const nested = findComponentInValue(nestedValue, elementName, [...currentPath, `[${i}]`, key]);
            results.push(...nested);
          }
        }
      }
    }
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.__typename === elementName) {
      results.push({
        path: currentPath,
        data: obj,
      });
    }
    // Recurse into nested objects
    for (const [key, nestedValue] of Object.entries(obj)) {
      if (key === '__typename') continue;
      if (nestedValue && typeof nestedValue === 'object') {
        const nested = findComponentInValue(nestedValue, elementName, [...currentPath, key]);
        results.push(...nested);
      }
    }
  }
  
  return results;
}

function isScalarType(type: string): boolean {
  const scalars = ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'Json', 'Long'];
  return scalars.includes(type);
}

function findTitleField(model: HygraphModel): string {
  const titleCandidates = ['title', 'name', 'heading', 'label', 'slug', 'displayName', 'internalName'];
  
  for (const candidate of titleCandidates) {
    const field = model.fields.find(f => f.name.toLowerCase() === candidate.toLowerCase());
    if (field && field.type === 'String') {
      return field.name;
    }
  }
  
  const stringField = model.fields.find(f => f.type === 'String');
  return stringField?.name || '';
}

function extractPreviewFields(entry: Record<string, unknown>): Record<string, unknown> {
  const preview: Record<string, unknown> = {};
  let count = 0;
  
  for (const [key, value] of Object.entries(entry)) {
    if (count >= 4) break;
    if (key === '__typename') continue;
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      preview[key] = value;
      count++;
    }
  }
  
  return preview;
}

// ============================================
// Trace Element Dependencies
// ============================================

export function traceElementDependencies(
  elementName: string,
  schema: HygraphSchema
): { directUsage: string[]; indirectUsage: { through: string; in: string }[] } {
  const directUsage: string[] = [];
  const indirectUsage: { through: string; in: string }[] = [];
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.relatedModel === elementName || field.type === elementName) {
        directUsage.push(`${model.name}.${field.name}`);
      }
    }
  }
  
  const componentsUsingElement = new Set<string>();
  for (const component of schema.components) {
    for (const field of component.fields) {
      if (field.relatedModel === elementName || field.type === elementName) {
        componentsUsingElement.add(component.name);
        directUsage.push(`${component.name}.${field.name}`);
      }
    }
  }
  
  for (const componentName of componentsUsingElement) {
    for (const model of schema.models) {
      for (const field of model.fields) {
        if (field.relatedModel === componentName || field.type === componentName) {
          indirectUsage.push({
            through: componentName,
            in: `${model.name}.${field.name}`,
          });
        }
      }
    }
  }
  
  return { directUsage, indirectUsage };
}

// ============================================
// Enhanced: Discover unions containing component
// ============================================

export async function findUnionsContainingComponent(
  client: GraphQLClient,
  componentName: string
): Promise<{ unionName: string; models: { modelName: string; fieldName: string }[] }[]> {
  const unions = await discoverUnionTypes(client);
  const relevantUnions = unions.filter(u => u.possibleTypes.includes(componentName));
  
  const results: { unionName: string; models: { modelName: string; fieldName: string }[] }[] = [];
  
  // Now find which model fields use these unions
  const modelsQuery = `
    query GetModels {
      __schema {
        queryType {
          fields {
            name
            type {
              name
              kind
            }
          }
        }
      }
    }
  `;
  
  try {
    const modelsResult = await client.request<{
      __schema: { queryType: { fields: { name: string; type: { name: string; kind: string } }[] } };
    }>(modelsQuery);
    
    // Get model names from plural queries
    const modelNames = modelsResult.__schema.queryType.fields
      .filter(f => !f.name.includes('Connection') && !f.name.includes('Version') && f.name !== 'node')
      .map(f => {
        // Convert plural to singular (simple heuristic)
        const name = f.type.name;
        return name;
      })
      .filter(Boolean);
    
    for (const union of relevantUnions) {
      const modelsUsingUnion: { modelName: string; fieldName: string }[] = [];
      
      // For each potential model, check its fields
      for (const modelName of modelNames) {
        if (!modelName) continue;
        const fields = await discoverModelFields(client, modelName);
        for (const field of fields) {
          if (field.typeName === union.unionName) {
            modelsUsingUnion.push({ modelName, fieldName: field.name });
          }
        }
      }
      
      if (modelsUsingUnion.length > 0) {
        results.push({ unionName: union.unionName, models: modelsUsingUnion });
      }
    }
  } catch (error) {
    console.error('Error finding unions:', error);
  }
  
  return results;
}
