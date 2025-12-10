# Hygraph Developer Guide

A comprehensive reference for building tools and applications that integrate with Hygraph CMS. This guide documents patterns, best practices, and technical details learned from building the Hygraph Schema Audit tool and Custom App Suite.

---

## Table of Contents

1. [Building Custom Apps](#building-custom-apps)
2. [GraphQL Introspection](#graphql-introspection)
3. [Schema Structure](#schema-structure)
4. [System Types & Filtering](#system-types--filtering)
5. [Native Taxonomies](#native-taxonomies)
6. [Content Queries](#content-queries)
7. [Asset Management](#asset-management)
8. [Field Types Reference](#field-types-reference)
9. [Common Patterns](#common-patterns)
10. [Authentication](#authentication)
11. [Best Practices](#best-practices)

---

## Building Custom Apps

Hygraph allows you to build custom apps that embed directly into the Hygraph Studio interface. These apps can extend functionality with custom pages, sidebar widgets, field renderers, and more.

### App Types & Elements

| Element Type | Description | Use Case |
|-------------|-------------|----------|
| **Page** | Full-page app in the sidebar | Dashboards, tools, reports |
| **Sidebar** | Widget in content entry sidebar | Context-specific info, actions |
| **Field** | Custom field renderer | Special input types, integrations |
| **Form** | Custom form renderer | Complete form customization |
| **Table** | Custom table cell renderer | Special display in content list |

### App Architecture

```
┌─────────────────────────────────────────────────┐
│                 Hygraph Studio                   │
│  ┌───────────────────────────────────────────┐  │
│  │              Your App (iframe)             │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │         HTML/JS/CSS                  │  │  │
│  │  │                                      │  │  │
│  │  │   postMessage ◄──────► Hygraph SDK   │  │  │
│  │  │                                      │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
            │
            ▼
   ┌─────────────────┐
   │  Your Backend   │  (optional, for token exchange)
   │   (Serverless)  │
   └─────────────────┘
```

### Creating a Custom App

**Step 1: Register the App**

```
Hygraph Studio → Apps → Create App → Custom App
```

| Field | Example |
|-------|---------|
| Name | My Custom Tool |
| API ID | my-custom-tool |
| App URL | https://your-app.vercel.app |

**Step 2: Add App Elements**

Each element is a page/component served at a specific path:

```javascript
// Page element at /dashboard.html
{
  type: 'page',
  name: 'Dashboard',
  slug: '/dashboard.html',
  icon: 'chart'
}

// Sidebar element
{
  type: 'sidebar',
  name: 'Quick Actions',
  slug: '/sidebar.html'
}
```

**Step 3: Configure Permissions**

Apps need explicit permissions:

```
☑️ Read existing content
☑️ Read existing environments
☑️ Read content model / components
☑️ Update existing content (if writing)
☑️ Delete content (if needed)
```

### Authentication Flow

Hygraph apps use a secure token exchange for automatic authentication:

```
┌──────────┐      ┌───────────────┐      ┌──────────────┐
│  Hygraph │      │   Your App    │      │ Your Backend │
│  Studio  │      │   (iframe)    │      │  (serverless)│
└────┬─────┘      └───────┬───────┘      └──────┬───────┘
     │                    │                     │
     │ 1. Load iframe     │                     │
     │ ─────────────────► │                     │
     │                    │                     │
     │ 2. postMessage     │                     │
     │    (context +      │                     │
     │     exchangeCode)  │                     │
     │ ─────────────────► │                     │
     │                    │                     │
     │                    │ 3. Exchange code    │
     │                    │    for tokens       │
     │                    │ ──────────────────► │
     │                    │                     │
     │                    │                     │ 4. Call Hygraph
     │                    │                     │    Management API
     │                    │                     │    with clientId +
     │                    │                     │    clientSecret +
     │                    │                     │    exchangeCode
     │                    │                     │
     │                    │ 5. Return appToken  │
     │                    │    + contentToken   │
     │                    │ ◄────────────────── │
     │                    │                     │
     │                    │ 6. Use tokens       │
     │                    │    for API calls    │
     │                    │                     │
```

### Receiving Context via postMessage

When Hygraph loads your app, it sends context via `postMessage`:

```javascript
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (!event.origin.includes('hygraph.com')) return;
  
  const { type, ...context } = event.data;
  
  if (type === 'hgcms:init' || type === 'app:init') {
    handleInit(context);
  }
});

function handleInit(context) {
  // Context contains:
  const {
    context: {
      project: {
        id,           // Project ID
        name,         // Project name
      },
      environment: {
        id,           // Environment ID (usually "master")
        name,         // Environment name
        endpoint,     // Content API endpoint
      },
      user: {
        id,           // Current user ID
        email,        // User email
      },
    },
    exchangeCode,     // One-time code for token exchange
    region,           // API region (e.g., "eu-central-1")
  } = context;
  
  // Exchange code for tokens
  exchangeToken(exchangeCode, project.id, region);
}
```

### Token Exchange (Server-Side)

**Keep your client secret secure on the server!**

```javascript
// api/exchange-token.js (Vercel serverless function)
export default async function handler(req, res) {
  // CORS for Hygraph iframe
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { code, projectId, region } = req.body;
  const clientId = process.env.HYGRAPH_APP_CLIENT_ID;
  const clientSecret = process.env.HYGRAPH_APP_CLIENT_SECRET;
  
  // Step 1: Exchange code for App Token
  const tokenResponse = await fetch(
    'https://management.hygraph.com/app-exchange-token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientSecret,
        exchangeCode: code,
      }),
    }
  );
  
  const { appToken } = await tokenResponse.json();
  
  // Step 2: Get Content API token from Management API
  const managementEndpoint = `https://${region}.api.hygraph.com/graphql`;
  
  const contentTokenResponse = await fetch(managementEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appToken}`,
    },
    body: JSON.stringify({
      query: `query {
        _viewer {
          ... on AppTokenViewer {
            project(id: "${projectId}") {
              environment(id: "master") {
                authToken
                endpoint
              }
            }
          }
        }
      }`,
    }),
  });
  
  const data = await contentTokenResponse.json();
  const contentToken = data.data?._viewer?.project?.environment?.authToken;
  const endpoint = data.data?._viewer?.project?.environment?.endpoint;
  
  return res.json({ appToken, contentToken, endpoint });
}
```

### Using Tokens in Your App

```javascript
// Store tokens after exchange
let authToken = null;
let apiEndpoint = null;

async function initializeApp(context, exchangeCode) {
  const response = await fetch('/api/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: exchangeCode,
      projectId: context.project.id,
      region: context.environment.region,
    }),
  });
  
  const { contentToken, endpoint } = await response.json();
  authToken = contentToken;
  apiEndpoint = endpoint;
  
  // Now you can make API calls
  loadData();
}

async function queryContent(query) {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ query }),
  });
  
  return response.json();
}
```

### Sidebar Elements

Sidebar elements appear in the content entry sidebar:

```javascript
// sidebar.html
window.addEventListener('message', (event) => {
  if (event.data.type === 'hgcms:init') {
    const { entry } = event.data.context;
    
    // entry contains the current content entry data
    console.log('Current entry:', entry.id, entry.__typename);
    
    // Render sidebar content based on entry
    renderSidebar(entry);
  }
});
```

### Field Extensions

Custom field renderers replace the default field UI:

```javascript
// In your app manifest / element config
{
  type: 'field',
  name: 'Color Picker',
  slug: '/field-color.html',
  fieldType: 'STRING', // The underlying field type
}

// field-color.html
window.addEventListener('message', (event) => {
  if (event.data.type === 'hgcms:field:state') {
    const { value, field, isDisabled } = event.data;
    renderColorPicker(value);
  }
});

// Send value back to Hygraph
function updateValue(newValue) {
  window.parent.postMessage({
    type: 'hgcms:field:change',
    value: newValue,
  }, '*');
}
```

### Static HTML Apps (No Framework)

You can build apps with plain HTML/JS (no React/Next.js required):

```html
<!-- page.html -->
<!DOCTYPE html>
<html>
<head>
  <title>My Hygraph App</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
    .loading { opacity: 0.5; }
  </style>
</head>
<body>
  <div id="app">
    <div class="loading">Loading...</div>
  </div>
  
  <script>
    let config = null;
    
    // Listen for Hygraph context
    window.addEventListener('message', async (event) => {
      if (!event.origin.includes('hygraph.com')) return;
      
      if (event.data.type === 'hgcms:init' || event.data.type === 'app:init') {
        config = event.data;
        await initApp();
      }
    });
    
    async function initApp() {
      // Exchange token
      const tokens = await exchangeToken(config.exchangeCode);
      
      // Load data
      const data = await fetchData(tokens.endpoint, tokens.contentToken);
      
      // Render UI
      document.getElementById('app').innerHTML = renderUI(data);
    }
    
    // ... rest of your app logic
  </script>
</body>
</html>
```

### App Deployment

**Recommended: Vercel**

```bash
# vercel.json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" }
      ]
    }
  ]
}
```

**Environment Variables (Vercel Dashboard):**

```
HYGRAPH_APP_CLIENT_ID=your_client_id
HYGRAPH_APP_CLIENT_SECRET=your_client_secret
```

### App Manifest Structure

When creating app elements via the Management SDK:

```javascript
// Create page element
client.createAppElement({
  appApiId: 'my-app',
  apiId: 'dashboard-page',
  type: 'page',
  name: 'Dashboard',
  slug: '/dashboard.html',
  config: {
    // Custom config passed to your app
  },
});

// Create sidebar element
client.createAppElement({
  appApiId: 'my-app',
  apiId: 'quick-actions',
  type: 'sidebar',
  name: 'Quick Actions',
  slug: '/sidebar.html',
  config: {},
});
```

### Handling Multiple Regions

Hygraph projects exist in different regions. Handle this in token exchange:

```javascript
function getManagementEndpoint(region) {
  // Map region strings to API endpoints
  const regionMap = {
    'eu-central-1': 'https://eu-central-1.api.hygraph.com/graphql',
    'eu-west-1': 'https://eu-west-1.api.hygraph.com/graphql',
    'us-east-1': 'https://us-east-1.api.hygraph.com/graphql',
    'us-west-2': 'https://us-west-2.api.hygraph.com/graphql',
    'ap-northeast-1': 'https://ap-northeast-1.api.hygraph.com/graphql',
    'ap-southeast-1': 'https://ap-southeast-1.api.hygraph.com/graphql',
  };
  
  // Extract base region from complex strings
  // e.g., "api-eu-central-1-shared-euc1-02" -> "eu-central-1"
  for (const [key, endpoint] of Object.entries(regionMap)) {
    if (region.includes(key)) return endpoint;
  }
  
  // Fallback to management endpoint
  return 'https://management.hygraph.com/graphql';
}
```

### Content API Endpoint Patterns

| Region | CDN Endpoint | Direct Endpoint |
|--------|--------------|-----------------|
| EU Central | `eu-central-1.cdn.hygraph.com` | `eu-central-1.hygraph.com` |
| EU West | `eu-west-1.cdn.hygraph.com` | `eu-west-1.hygraph.com` |
| US East | `us-east-1.cdn.hygraph.com` | `us-east-1.hygraph.com` |
| US West | `us-west-2.cdn.hygraph.com` | `us-west-2.hygraph.com` |
| Asia | `ap-northeast-1.cdn.hygraph.com` | `ap-northeast-1.hygraph.com` |

Full endpoint format:
```
https://[region].cdn.hygraph.com/content/[project-id]/[environment]
```

### Debugging Apps

1. **Check postMessage events:**
   ```javascript
   window.addEventListener('message', (e) => {
     console.log('postMessage received:', e.data);
   });
   ```

2. **Test outside Hygraph:**
   - Provide manual PAT input for standalone testing
   - Use localStorage to persist credentials

3. **Common issues:**
   - CORS errors → Check `Access-Control-Allow-Origin`
   - X-Frame-Options → Must allow framing
   - Token exchange fails → Verify client ID/secret

### Example: Complete Page Element

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schema Explorer</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    .error {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="loading">Connecting to Hygraph...</div>
  </div>

  <script>
    // State
    let endpoint = null;
    let token = null;
    
    // Listen for Hygraph context
    window.addEventListener('message', async (event) => {
      if (!event.origin.includes('hygraph.com') && 
          !event.origin.includes('localhost')) return;
      
      const { type, exchangeCode, context } = event.data;
      
      if (type === 'hgcms:init' || type === 'app:init') {
        try {
          // Exchange token
          const tokens = await exchangeTokens(
            exchangeCode,
            context.project.id,
            context.environment.region || 'eu-central-1'
          );
          
          endpoint = tokens.endpoint;
          token = tokens.contentToken;
          
          // Load and render data
          await loadSchema();
        } catch (error) {
          showError(error.message);
        }
      }
    });
    
    async function exchangeTokens(code, projectId, region) {
      const response = await fetch('/api/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, projectId, region }),
      });
      
      if (!response.ok) throw new Error('Token exchange failed');
      return response.json();
    }
    
    async function loadSchema() {
      const query = `{
        __schema {
          types {
            name
            kind
            fields { name }
          }
        }
      }`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      
      const data = await response.json();
      renderSchema(data.data.__schema);
    }
    
    function renderSchema(schema) {
      const models = schema.types
        .filter(t => t.kind === 'OBJECT' && !t.name.startsWith('_'))
        .slice(0, 20);
      
      document.getElementById('app').innerHTML = `
        <h1>Schema Explorer</h1>
        <div class="card">
          <h2>Models (${models.length})</h2>
          <ul>
            ${models.map(m => `
              <li>
                <strong>${m.name}</strong>
                <span>(${m.fields?.length || 0} fields)</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    function showError(message) {
      document.getElementById('app').innerHTML = `
        <div class="error">
          <strong>Error:</strong> ${message}
        </div>
      `;
    }
  </script>
</body>
</html>
```

### App Ideas

| App Type | Description |
|----------|-------------|
| **Schema Explorer** | Browse components, find usage |
| **Content Calendar** | Visual publishing schedule |
| **Content Health** | Find stale/orphaned content |
| **Alt-Text Generator** | AI-powered accessibility |
| **Image Optimizer** | Transform & optimize assets |
| **Analytics Dashboard** | Content metrics & velocity |
| **Translation Manager** | Localization workflow |
| **SEO Checker** | Meta field validation |
| **Link Checker** | Find broken references |
| **Bulk Editor** | Mass content updates |

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
