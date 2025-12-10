# Hygraph Developer Guide

A comprehensive reference for building tools and applications that integrate with Hygraph CMS. This guide documents patterns, best practices, and technical details learned from building the Hygraph Schema Audit tool.

---

## Table of Contents

1. [GraphQL Introspection](#graphql-introspection)
2. [Schema Structure](#schema-structure)
3. [System Types & Filtering](#system-types--filtering)
4. [Native Taxonomies](#native-taxonomies)
5. [Content Queries](#content-queries)
6. [Asset Management](#asset-management)
7. [Field Types Reference](#field-types-reference)
8. [Common Patterns](#common-patterns)
9. [Authentication](#authentication)
10. [Best Practices](#best-practices)

---

## GraphQL Introspection

### Basic Introspection Query

Use GraphQL introspection to discover the schema structure:

```graphql
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
```

### Type Kinds

| Kind | Description |
|------|-------------|
| `OBJECT` | Models and components |
| `ENUM` | Enumeration types |
| `UNION` | Union types (used for component fields) |
| `INTERFACE` | Interface types |
| `SCALAR` | Primitive types (String, Int, etc.) |
| `INPUT_OBJECT` | Input types for mutations |
| `LIST` | Array/list wrapper |
| `NON_NULL` | Required field wrapper |

### Unwrapping Nested Types

Types can be nested several levels deep (e.g., `NON_NULL > LIST > NON_NULL > OBJECT`):

```typescript
function unwrapType(type: any): { name: string; isList: boolean; isRequired: boolean } {
  let current = type;
  let isList = false;
  let isRequired = false;

  while (current) {
    if (current.kind === 'NON_NULL') {
      isRequired = true;
      current = current.ofType;
    } else if (current.kind === 'LIST') {
      isList = true;
      current = current.ofType;
    } else {
      return { name: current.name, isList, isRequired };
    }
  }

  return { name: 'Unknown', isList, isRequired };
}
```

---

## Schema Structure

### Models vs Components

**Models** are top-level content types that:
- Have their own query endpoints (e.g., `articles`, `articlesConnection`)
- Can be published independently
- Have system fields (`id`, `createdAt`, `updatedAt`, `publishedAt`, `stage`)

**Components** are reusable content blocks that:
- Cannot be queried directly
- Are embedded within models or other components
- Do not have their own lifecycle

### Detecting Components

Components don't have direct query endpoints. Check the query type:

```typescript
function isComponent(typeName: string, queryFields: string[]): boolean {
  const pluralName = pluralize(typeName).toLowerCase();
  const hasQuery = queryFields.some(
    q => q.toLowerCase() === pluralName || 
         q.toLowerCase() === typeName.toLowerCase()
  );
  return !hasQuery;
}
```

### Union Types (Component Fields)

When a field can contain multiple component types, Hygraph creates a union type:

```graphql
# Example: A "blocks" field that can contain Hero, Text, or Image components
union PageBlocksUnion = HeroBlock | TextBlock | ImageBlock
```

Union types appear as `possibleTypes` in introspection:

```typescript
const unionTypes = schema.types.filter(t => t.kind === 'UNION');
for (const union of unionTypes) {
  console.log(`${union.name} can be: ${union.possibleTypes.map(p => p.name).join(', ')}`);
}
```

---

## System Types & Filtering

### System Type Prefixes to Exclude

These prefixes indicate internal Hygraph types:

```typescript
const SYSTEM_TYPE_PREFIXES = [
  '__',           // GraphQL introspection types
  'Aggregate',    // Aggregation types
  'BatchPayload', // Mutation payloads
  'Connection',   // Relay-style connections
  'DocumentVersion',
  'Edge',         // Relay-style edges
  'PageInfo',     // Pagination info
  'Query',
  'Mutation',
  'Subscription',
  'Version',
  'RGBA',
  'RichText',
  'Location',
  'Color',
];
```

### System Types (Exact Matches)

```typescript
const SYSTEM_TYPES = new Set([
  'Asset',              // Built-in asset model
  'User',               // Built-in user model
  'ScheduledOperation', // Scheduling system
  'ScheduledRelease',   // Scheduling system
  'String', 'Int', 'Float', 'Boolean', 'ID', // Scalars
  'DateTime', 'Date', 'Json', 'Long', 'Hex',
  'RGBAHue', 'RGBATransparency',
]);
```

### System Enums

```typescript
const SYSTEM_ENUMS = new Set([
  'Stage',              // DRAFT, PUBLISHED
  'Locale',             // Localization
  'DocumentFileTypes',  // Asset file types
  'ImageFit',           // Image transformations
  'SystemDateTimeFieldVariation',
  'AssetUploadStatus',  // Asset upload states
  'AssetOrderByInput',
  'ImageResizeFit',
  'ImageResizeMode',
  // Any enum with underscore is typically system/remote source
]);

function isSystemEnum(name: string): boolean {
  if (name.startsWith('_')) return true;
  if (name.includes('_')) return true;  // Remote source configs
  if (name.endsWith('OrderByInput')) return true;
  if (name.endsWith('WhereInput')) return true;
  if (name.endsWith('WhereUniqueInput')) return true;
  if (SYSTEM_ENUMS.has(name)) return true;
  return false;
}
```

### System Components

```typescript
const SYSTEM_COMPONENTS = new Set([
  'TaxonomyNode',      // Native taxonomy system
  'TaxonomyPathNode',  // Native taxonomy system
]);

function isSystemComponent(name: string): boolean {
  if (SYSTEM_COMPONENTS.has(name)) return true;
  if (name.includes('_')) return true;  // Remote source configurations
  if (name.endsWith('RichText')) return true;  // RichText variants
  if (name.endsWith('EmbeddedAsset')) return true;
  return false;
}
```

### System Reference Types

These are valid reference targets but not user-created models:

```typescript
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
```

---

## Native Taxonomies

Hygraph has a built-in taxonomy feature (separate from regular models).

### Detecting Native Taxonomies

Native taxonomies have a specific structure:

```typescript
function isTaxonomyType(type: IntrospectionType): boolean {
  if (type.kind !== 'OBJECT' || !type.fields) return false;
  
  const fieldNames = type.fields.map(f => f.name);
  
  // Taxonomy types have hierarchical fields
  const hasTaxonomyStructure = 
    (fieldNames.includes('path') || 
     fieldNames.includes('ancestors') || 
     fieldNames.includes('children')) &&
    (fieldNames.includes('name') || fieldNames.includes('title'));
  
  return hasTaxonomyStructure && 
         !type.name.endsWith('Connection') &&
         !type.name.endsWith('Edge');
}
```

### Taxonomy Field Type

When a model has a taxonomy field, it references the taxonomy type:

```typescript
interface HygraphTaxonomy {
  name: string;
  apiId: string;
  nodeCount?: number;
  usedInModels: string[];
}
```

### Taxonomy Permissions by Role

| Role | Create/Delete Taxonomy | Manage Nodes |
|------|----------------------|--------------|
| Admin | ✅ Full access | ✅ Full access |
| Developer | ✅ Create/Update | ✅ Full access |
| Editor | ❌ Read only | ✅ Create/Update |
| Contributor | ❌ Read only | ❌ Read only |

---

## Content Queries

### Fetching Entry Counts

```graphql
query CountEntries {
  # Draft entries
  draft: articlesConnection(stage: DRAFT) {
    aggregate {
      count
    }
  }
  # Published entries
  published: articlesConnection(stage: PUBLISHED) {
    aggregate {
      count
    }
  }
}
```

**Important**: Draft count includes unpublished versions of published entries. For unique counts:
- `totalEntries = draft count` (draft includes all)
- `publishedEntries = published count`
- `draftOnlyEntries = draft - published`

### Pagination with Connections

```graphql
query PaginatedArticles($first: Int!, $after: String) {
  articlesConnection(first: $first, after: $after) {
    edges {
      node {
        id
        title
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    aggregate {
      count
    }
  }
}
```

### Filtering Content

```graphql
query FilteredArticles {
  articles(
    where: {
      status: PUBLISHED
      category: { name: "Technology" }
      _search: "keyword"
    }
    orderBy: publishedAt_DESC
    first: 10
  ) {
    id
    title
  }
}
```

---

## Asset Management

### Asset Model Fields

The built-in Asset model includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | ID | Unique identifier |
| `url` | String | CDN URL |
| `fileName` | String | Original filename |
| `mimeType` | String | MIME type |
| `size` | Float | File size in bytes |
| `width` | Int | Image width (images only) |
| `height` | Int | Image height (images only) |
| `alt` | String | Alt text (if configured) |

### Fetching Asset Statistics

```graphql
# Total assets
query TotalAssets {
  assetsConnection {
    aggregate {
      count
    }
  }
}

# Assets without alt text (if alt field exists)
query AssetsWithoutAlt {
  assetsConnection(where: { alt: null }) {
    aggregate {
      count
    }
  }
}

# Large assets (over 1MB)
query LargeAssets {
  assetsConnection(where: { size_gt: 1000000 }) {
    aggregate {
      count
    }
  }
}
```

**Note**: The `alt` field is optional and may not exist in all projects. Handle query errors gracefully.

### Image Transformations

Hygraph supports URL-based image transformations:

```
https://media.graphassets.com/[transformation]/[asset-id]

# Resize
/resize=width:400,height:300,fit:crop/

# Format
/output=format:webp/

# Quality
/compress/quality=value:80/
```

---

## Field Types Reference

### Scalar Types

| Type | GraphQL | Description |
|------|---------|-------------|
| Single line text | `String` | Short text |
| Multi line text | `String` | Long text |
| Rich text | `RichText` | Structured rich content |
| Integer | `Int` | Whole numbers |
| Float | `Float` | Decimal numbers |
| Boolean | `Boolean` | True/false |
| Date | `Date` | Date only |
| DateTime | `DateTime` | Date and time |
| JSON | `Json` | Arbitrary JSON |
| Color | `Color` | Color picker |
| Location | `Location` | Geo coordinates |

### Relational Types

| Type | Description |
|------|-------------|
| Reference | Link to another model |
| Asset | Link to Asset model |
| Union | Multiple possible types (components) |

### Detecting Field Types

```typescript
function categorizeField(field: HygraphField): string {
  const typeName = field.type.toLowerCase();
  
  // Rich text
  if (typeName.includes('richtext') || field.name.toLowerCase().includes('richtext')) {
    return 'richtext';
  }
  
  // Asset reference
  if (typeName === 'asset' || field.relatedModel === 'Asset') {
    return 'asset';
  }
  
  // Enum
  if (field.enumValues && field.enumValues.length > 0) {
    return 'enum';
  }
  
  // Component (union type)
  if (field.isUnion || (field.possibleTypes && field.possibleTypes.length > 0)) {
    return 'component';
  }
  
  // Reference to another model
  if (field.relatedModel) {
    return 'reference';
  }
  
  // Scalar types
  const scalarMap: Record<string, string> = {
    'string': 'text',
    'int': 'integer',
    'float': 'float',
    'boolean': 'boolean',
    'datetime': 'datetime',
    'date': 'date',
    'json': 'json',
  };
  
  return scalarMap[typeName] || 'unknown';
}
```

---

## Common Patterns

### Content vs Presentation Fields

**Content fields** (semantic, reusable):
- `title`, `name`, `heading`
- `description`, `summary`, `body`
- `author`, `category`, `tags`
- `publishedAt`, `date`

**Presentation fields** (layout-specific, avoid in content models):
- `backgroundColor`, `textColor`
- `columns`, `width`, `height`
- `isVisible`, `showOnMobile`, `hideHeader`
- `order`, `position`, `zIndex`

### SEO Field Patterns

```typescript
const SEO_FIELD_PATTERNS = {
  meta: /^(meta|seo)/i,
  title: /title|headline/i,
  description: /(meta)?description|excerpt|summary/i,
  keywords: /keywords?|tags?/i,
  ogImage: /og.?image|social.?image|share.?image/i,
  canonical: /canonical|url|permalink/i,
  noIndex: /no.?index|robots/i,
};
```

### Slug Field Patterns

```typescript
const SLUG_PATTERNS = /^(slug|url|path|permalink|handle|uri)$/i;
```

### Taxonomy Model Patterns

```typescript
const CATEGORY_PATTERNS = /^(category|categories)$/i;
const TAG_PATTERNS = /^(tag|tags|label|labels)$/i;
const TOPIC_PATTERNS = /^(topic|topics|subject|subjects|thematic|thematics|theme|themes)$/i;
```

### Boolean Show/Hide Anti-patterns

These indicate presentation logic leaking into content:

```typescript
const SHOW_HIDE_PATTERNS = [
  /^(show|hide|is.?visible|display)/i,
  /^(enable|disable)/i,
  /(on|for)(mobile|desktop|tablet)/i,
];
```

---

## Authentication

### Token-based Authentication (PAT)

```typescript
import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient(endpoint, {
  headers: {
    Authorization: `Bearer ${permanentAccessToken}`,
  },
});
```

### Management API Authentication

For schema modifications (requires Management API token):

```typescript
const managementClient = new GraphQLClient(
  'https://management.hygraph.com/graphql',
  {
    headers: {
      Authorization: `Bearer ${managementToken}`,
    },
  }
);
```

### Endpoint Patterns

| Endpoint Type | Pattern | Use Case |
|--------------|---------|----------|
| Content API | `https://[region].cdn.hygraph.com/content/[project]/[environment]` | Reading content |
| Content API (no cache) | `https://[region].hygraph.com/v2/[project]/[environment]` | Fresh data |
| Management API | `https://management.hygraph.com/graphql` | Schema changes |

---

## Best Practices

### 1. Always Filter System Types

Never include system types in user-facing analysis:

```typescript
const userModels = schema.types.filter(type => 
  !isSystemType(type.name) && 
  !SYSTEM_TYPE_PREFIXES.some(prefix => type.name.startsWith(prefix))
);
```

### 2. Handle Missing Fields Gracefully

Not all projects have the same fields (e.g., `alt` on assets):

```typescript
try {
  const result = await client.request(query);
  return result;
} catch (error) {
  // Field might not exist, return fallback
  console.warn('Query failed, using fallback:', error.message);
  return fallbackValue;
}
```

### 3. Use Connection Queries for Counts

Direct queries have limits; use Connection queries for accurate counts:

```graphql
# ❌ Bad - limited to first 100
query { articles { id } }

# ✅ Good - accurate count
query { articlesConnection { aggregate { count } } }
```

### 4. Batch Introspection Requests

Run independent queries in parallel:

```typescript
const [models, enums, counts] = await Promise.all([
  fetchModels(client),
  fetchEnums(client),
  fetchCounts(client),
]);
```

### 5. Cache Introspection Results

Schema structure rarely changes during a session:

```typescript
let cachedSchema: HygraphSchema | null = null;

async function getSchema(client: GraphQLClient): Promise<HygraphSchema> {
  if (!cachedSchema) {
    cachedSchema = await fetchSchema(client);
  }
  return cachedSchema;
}
```

### 6. Respect Rate Limits

Hygraph has rate limits on API calls:
- Space requests across time
- Use batched queries where possible
- Implement exponential backoff on failures

### 7. Handle Localization

Multi-locale projects have locale-specific content:

```graphql
query LocalizedContent($locale: Locale!) {
  articles(locales: [$locale]) {
    title
    # Returns content in specified locale
  }
}
```

### 8. Detect Schema Patterns, Not Just Names

Instead of hardcoding field names, detect patterns:

```typescript
// ❌ Brittle
if (field.name === 'blocks') { ... }

// ✅ Robust
if (field.isList && field.isUnion) {
  // This is likely a component field
}
```

---

## Useful Queries

### Get All Model Names

```graphql
query AllModels {
  __schema {
    types {
      name
      kind
    }
  }
}
```

### Get Model Structure

```graphql
query ModelStructure($name: String!) {
  __type(name: $name) {
    name
    fields {
      name
      type {
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
```

### Check If Field Exists

```graphql
query CheckField {
  __type(name: "Asset") {
    fields {
      name
    }
  }
}
```

---

## Error Handling

### Common Error Types

| Error | Cause | Solution |
|-------|-------|----------|
| `UNAUTHENTICATED` | Invalid/expired token | Refresh token |
| `FORBIDDEN` | Insufficient permissions | Check token scope |
| `NOT_FOUND` | Invalid endpoint/model | Verify endpoint URL |
| `RATE_LIMITED` | Too many requests | Implement backoff |
| `VALIDATION_ERROR` | Invalid query | Check query syntax |

### Graceful Degradation

```typescript
async function safeQuery<T>(
  client: GraphQLClient,
  query: string,
  fallback: T
): Promise<T> {
  try {
    return await client.request<T>(query);
  } catch (error) {
    console.error('Query failed:', error);
    return fallback;
  }
}
```

---

## Resources

- [Hygraph Documentation](https://hygraph.com/docs)
- [Hygraph API Reference](https://hygraph.com/docs/api-reference)
- [GraphQL Introspection](https://graphql.org/learn/introspection/)
- [Hygraph Taxonomy Guide](https://hygraph.com/docs/developer-guides/schema/taxonomies)

---

*This guide was created while building the Hygraph Schema Audit tool. Last updated: December 2024.*
