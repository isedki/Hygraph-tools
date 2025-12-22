# 🤖 Agent Technical Documentation - Hygraph Custom App Suite

**Purpose:** Complete technical reference for AI agents to understand, maintain, and extend this codebase.

---

## 📁 Project Structure

```
hygraph-app/
├── pages/                      # Main HTML apps (static, deployable)
│   ├── transform.html          # Media Studio - Image transformations (v2.0)
│   ├── analytics.html          # Content Analytics - Metrics dashboard
│   ├── health.html             # Content Health - Stale content detection
│   ├── alttext.html            # Alt-Text Generator - AI-powered accessibility
│   ├── page.html               # Schema Explorer - Component usage finder
│   ├── calendar.html           # Content Calendar - Publishing schedule
│   ├── crop-test.html          # Standalone cropping test page
│   └── vercel.json             # Deployment config for pages
├── src/                        # React/Next.js experimental versions
│   ├── app/                    # Next.js app router
│   └── contexts/               # React contexts
├── api/                        # Serverless functions
│   └── exchange-token.js       # OAuth token exchange
├── vercel.json                 # Main deployment config
├── DOCUMENTATION.md            # User-facing docs
└── package.json
```

---

## 🏗️ Architecture Patterns

### 1. Single-File HTML App Pattern
All apps follow a **single-file architecture**:

```html
<!DOCTYPE html>
<html>
<head>
  <style>/* All CSS inline */</style>
</head>
<body>
  <!-- All HTML structure -->
  
  <script type="module">
    // SDK imports
    import "https://unpkg.com/@graphcms/zoid@9.0.64-alpha.1/lib/zoid.min.js";
    import "https://unpkg.com/@hygraph/app-sdk";
    
    const sdk = window["@hygraph/app-sdk"];
    
    // All JavaScript logic
  </script>
</body>
</html>
```

**Benefits:**
- Zero build step
- Instant deployment
- Easy debugging
- Version control friendly (single file changes)

### 2. SDK Initialization Pattern
```javascript
sdk.init({ debug: false })
  .then(async ({ status, props }) => {
    if (status === 'ok' && props) {
      // Get credentials from Hygraph
      const endpoint = props.context?.environment?.endpoint;
      const token = props.context?.environment?.authToken;
      
      if (endpoint && token) {
        // Initialize app
      } else {
        // Show error - must run inside Hygraph
      }
    }
  })
  .catch(e => {
    console.error('SDK init error:', e);
    // Fallback to standalone mode or error
  });
```

### 3. GraphQL Helper Pattern
```javascript
async function gql(query, variables = {}) {
  const body = { query };
  if (Object.keys(variables).length > 0) {
    body.variables = variables;
  }
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(body)
  });
  
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}
```

### 4. Model Discovery Pattern
```javascript
async function discoverModels() {
  const data = await gql(`{
    __schema {
      queryType {
        fields { name type { name ofType { name } } }
      }
      types { name kind fields { name } }
    }
  }`);
  
  const queryFields = data.__schema.queryType.fields;
  const types = data.__schema.types;
  const typeMap = Object.fromEntries(types.map(t => [t.name, t]));
  
  const found = [];
  for (const field of queryFields) {
    const typeName = field.type?.name || field.type?.ofType?.name;
    if (typeName?.endsWith('Connection')) {
      const modelName = typeName.replace('Connection', '');
      if (isSystemModel(modelName) || !typeMap[modelName]) continue;
      
      const pluralApiId = field.name.replace('Connection', '');
      found.push({ name: modelName, pluralApiId });
    }
  }
  
  return [...new Map(found.map(m => [m.name, m])).values()];
}

function isSystemModel(name) {
  if (!name || name.startsWith('_')) return true;
  if (['Asset', 'User', 'ScheduledOperation', 'ScheduledRelease'].includes(name)) return true;
  if (/Connection$|Edge$|Aggregate$|WhereInput$|OrderByInput$|CreateInput$|UpdateInput$/.test(name)) return true;
  if (name.toLowerCase().includes('smartling') || name.toLowerCase().includes('localize')) return true;
  return false;
}
```

### 5. Batch Processing Pattern
```javascript
async function runInBatches(items, fn, batchSize = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
```

### 6. Pagination Pattern (Cursor-based)
```javascript
let endCursor = null;
let hasNextPage = false;
const ASSETS_PER_PAGE = 50;

async function fetchAssets(append = false) {
  const afterClause = append && endCursor ? `, after: "${endCursor}"` : '';
  
  const data = await gql(`{
    assetsConnection(first: ${ASSETS_PER_PAGE}${afterClause}, stage: DRAFT, where: { ... }) {
      pageInfo { hasNextPage endCursor }
      aggregate { count }
      edges { node { id fileName url ... } }
    }
  }`);
  
  const connection = data.assetsConnection;
  const newAssets = connection.edges.map(e => e.node);
  
  if (append) {
    assets = [...assets, ...newAssets];
  } else {
    assets = newAssets;
  }
  
  endCursor = connection.pageInfo?.endCursor;
  hasNextPage = connection.pageInfo?.hasNextPage || false;
}
```

### 7. Debounce Pattern
```javascript
let debounceTimer = null;

function debouncedFunction() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Execute actual function
  }, 300); // 300ms delay
}
```

### 8. Schema Introspection for Enums
```javascript
async function fetchEnumValues(enumTypeName) {
  // First, find what enum type a field uses
  const schemaData = await gql(`{
    __type(name: "Asset") {
      fields {
        name
        type {
          name
          kind
          ofType { name kind }
          enumValues { name }
        }
      }
    }
  }`);
  
  // Find the field and get enum values
  const folderField = schemaData.__type?.fields?.find(f => f.name === 'folder');
  
  if (folderField) {
    let enumValues = folderField.type?.enumValues;
    const typeName = folderField.type?.name || folderField.type?.ofType?.name;
    
    if (!enumValues && typeName) {
      const enumData = await gql(`{
        __type(name: "${typeName}") {
          enumValues { name }
        }
      }`);
      enumValues = enumData.__type?.enumValues;
    }
    
    return enumValues?.map(v => v.name) || [];
  }
}
```

---

## 📊 App-Specific Details

### Media Studio (transform.html) - v2.0
**Features:**
- Asset browsing with folder structure
- Visual cropping with Cropper.js
- Focal point selection
- Quality/format adjustments
- Blur/sharpen effects
- Save configs to asset metadata
- Responsive srcset generation
- Upload with preview modal

**Key State Variables:**
```javascript
let selectedAsset = null;        // Currently selected image
let focalPoint = { x: 0.5, y: 0.5 }; // Focal point coordinates (0-1)
let cropData = null;             // { x, y, width, height } in pixels
let isCropMode = false;          // Toggle between crop/focal mode
let cropper = null;              // Cropper.js instance
let currentFolder = '';          // Folder filter
let currentTypeFilter = '';      // MIME type filter
let endCursor = null;            // Pagination cursor
```

**Custom Asset Fields Used:**
- `transformConfigs` (Json) - Saved transform configurations
- `folder` (Enum) - Folder categorization

### Content Analytics (analytics.html)
**Features:**
- Total entries, published, drafts
- Content by model bar chart
- 12-week velocity trend
- Author activity tracking

**Key Queries:**
```graphql
# Count query per model
{
  m0_draft: articlesConnection(stage: DRAFT) { aggregate { count } }
  m0_pub: articlesConnection(stage: PUBLISHED) { aggregate { count } }
  m0_week: articlesConnection(stage: DRAFT, where: { createdAt_gte: "..." }) { aggregate { count } }
}
```

### Content Health (health.html)
**Features:**
- Stale content detection (configurable days)
- Unused model finder
- Health score calculation
- Dashboard cards

**Health Score Formula:**
```javascript
const stalePenalty = Math.min(Math.round((staleCount / totalCount) * 100), 50);
const unusedPenalty = Math.min(Math.round((unusedModels / totalModels) * 50), 30);
const score = 100 - stalePenalty - unusedPenalty;
```

### Alt-Text Generator (alttext.html)
**Features:**
- AI-powered alt text using Google Gemini 2.0 Flash (FREE)
- Bulk processing with progress tracking
- Pause/Resume/Cancel controls
- Rate limiting (4s between requests)

**Gemini API Integration:**
```javascript
async function generateWithGemini(imageUrl) {
  const base64Image = await fetchImageAsBase64(imageUrl);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Generate concise alt text...' },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image }}
          ]
        }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.4 }
      })
    }
  );
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}
```

### Schema Explorer (page.html)
**Features:**
- Component/Model/Enum browsing
- Deep nested component detection (7 levels)
- Usage search across all models
- Direct links to Hygraph entries

**Nested Detection Pattern:**
```javascript
function detectNestedComponents(fieldType, depth = 0, path = []) {
  if (depth > 7) return [];
  
  const results = [];
  const typeName = fieldType.name || fieldType.ofType?.name;
  
  if (components.includes(typeName)) {
    results.push({ component: typeName, path, depth });
  }
  
  // Recurse into union types
  if (fieldType.possibleTypes) {
    for (const subType of fieldType.possibleTypes) {
      results.push(...detectNestedComponents(subType, depth + 1, [...path, typeName]));
    }
  }
  
  return results;
}
```

---

## 🔐 Security Considerations

### Current Security Model
1. **No PAT in localStorage** (transform.html v2.0) - Credentials from SDK only
2. **Browser-only execution** - No server-side storage
3. **CORS handling** - Hygraph CDN allows cross-origin requests

### Security Improvements Applied:
- Removed localStorage for auth tokens
- App requires Hygraph SDK context to run
- No external API calls except Gemini (alt-text only)

---

## ⚡ Performance Optimizations

### Implemented Optimizations:
1. **Parallel queries** - Batch processing with `Promise.allSettled`
2. **Cursor pagination** - `assetsConnection` instead of `skip/first`
3. **Server-side filtering** - GraphQL `where` clause instead of client filter
4. **Debounced updates** - Prevent API spam
5. **Lazy loading** - Folders/counts load in background
6. **Blob URLs** - Local preview without server round-trip

### Scaling Recommendations (10K+ assets):
- Use `assetsConnection` with cursor pagination
- Server-side filtering (folder, type, search)
- Aggregate queries for counts
- Virtual scrolling for large lists

---

## 🚀 Deployment

### Vercel Configuration (vercel.json)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://*.hygraph.com https://app.hygraph.com" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/transform", "destination": "/pages/transform.html" },
    { "source": "/analytics", "destination": "/pages/analytics.html" }
  ]
}
```

### Deploy Commands:
```bash
# Preview deployment
cd hygraph-app && vercel

# Production deployment
cd hygraph-app && vercel --prod --force --yes
```

---

## 🧪 Testing Checklist

### Media Studio Testing:
- [ ] Asset loading with pagination
- [ ] Folder filtering
- [ ] Type filtering
- [ ] Search functionality
- [ ] Image selection (including AVIF)
- [ ] Crop mode toggle
- [ ] Focal point setting
- [ ] Quality/format changes
- [ ] Preview updates
- [ ] Config save/load
- [ ] Upload with modal
- [ ] Download cropped image

### Common Issues & Fixes:
| Issue | Cause | Fix |
|-------|-------|-----|
| Image not selecting | Null element reference | Check element exists before .src |
| AVIF dimensions null | Hygraph metadata missing | Use naturalWidth/Height |
| Crop preview blank | CORS error | crossOrigin="anonymous" |
| Upload failing | CORS on Management API | Use SDK auth token |
| App blank in iframe | X-Frame-Options | Set headers in vercel.json |

---

## 📝 Version History

| Version | Changes |
|---------|---------|
| v2.0 | AVIF support, null-safe element access, client-side dimensions |
| v1.9 | Removed preview thumbnail |
| v1.8 | Reset controls on image select |
| v1.7 | Format change with crop mode |
| v1.6 | Real Hygraph preview URLs |
| v1.5 | Upload preview modal |
| v1.4 | No publish on upload/save |
| v1.3 | 10K+ asset scaling |
| v1.2 | Security fix (no localStorage PAT) |

---

## 🔧 Common Modifications

### Add New Custom Field to Asset:
1. Add field in Hygraph Schema
2. Update `fetchAssets()` query to include field
3. Add fallback query without field
4. Update `renderAssets()` to display field

### Add New Transform Effect:
1. Add HTML control in right panel
2. Add event listener for control
3. Update `fetchTransformedUrl()` to include in query
4. Update `buildGraphQLQuery()` for display
5. Update `updateCropPreview()` if client-side preview needed

### Add New File Type Filter:
1. Add `<option>` to `#type-filter` select
2. MIME type will be used in `where` clause automatically

---

*Last Updated: December 2024 - v2.0*


