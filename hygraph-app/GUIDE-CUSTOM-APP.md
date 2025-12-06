# Building Hygraph Custom Apps

A practical guide based on real implementation experience.

---

# The Basics

## What is a Custom App?

A web application that runs inside Hygraph's UI. It can:

→ Access the current project's GraphQL API

→ Read the project context (endpoint, environment)

→ Appear as a page, sidebar widget, or field extension

## App Types

**Page Element** — Full page in the Hygraph sidebar

**Sidebar Element** — Widget shown when viewing an entry

**Field Element** — Custom field editor

---

# Project Setup

## Recommended: Static HTML

Simple, fast, no build step required.

```
my-app/
├── pages/
│   ├── setup.html      # Installation page (REQUIRED)
│   ├── page.html       # Your main app
│   ├── sidebar.html    # Sidebar widget (optional)
│   └── health.html     # Additional pages as needed
├── public/
│   ├── icon.svg        # App icon
│   └── manifest.json   # App manifest
└── vercel.json
```

**vercel.json** (IMPORTANT - includes required headers for iframe)
```json
{
  "outputDirectory": "pages",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://*.hygraph.com https://app.hygraph.com" }
      ]
    }
  ]
}
```

⚠️ **Warning:** Next.js/React can cause issues with Hygraph's iframe loading. Static HTML is more reliable.

---

# SDK Integration

## Loading the SDK (ES Module)

```html
<script type="module">
  import "https://unpkg.com/@graphcms/zoid@9.0.64-alpha.1/lib/zoid.min.js";
  import "https://unpkg.com/@hygraph/app-sdk";
  
  const sdk = window["@hygraph/app-sdk"];
  // ... your code
</script>
```

## What the SDK Provides

⚠️ **CRITICAL: The SDK does NOT provide an auth token!**

```javascript
sdk.init({ debug: true })
  .then(({ status, props }) => {
    // ✅ AVAILABLE:
    const endpoint = props.context?.environment?.endpoint;  // Content API URL
    const envId = props.context?.environment?.id;           // Environment ID
    const projectId = props.context?.project?.id;           // Project ID
    
    // ❌ NOT AVAILABLE (will be undefined):
    const authToken = props.authToken;  // ALWAYS undefined!
  });
```

**You MUST ask users for a Permanent Auth Token (PAT) or save it during setup.**

## Setup Page (REQUIRED)

Your setup page must signal completion AND can save credentials:

```html
<!-- setup.html -->
<script type="module">
  import "https://unpkg.com/@graphcms/zoid@9.0.64-alpha.1/lib/zoid.min.js";
  import "https://unpkg.com/@hygraph/app-sdk";
  
  const sdk = window["@hygraph/app-sdk"];
  
  sdk.init().then(({ props }) => {
    // You can save a PAT here if provided in config
    if (props.installation?.config?.token) {
      localStorage.setItem('hygraph_token', props.installation.config.token);
    }
    
    // Mark installation as complete
    props.updateInstallation({
      status: "COMPLETED",
      config: {}
    });
  });
</script>
```

Without calling `updateInstallation`, the app stays in "Installing..." state forever.

---

# Authentication Pattern

## Recommended: localStorage + Manual Input Fallback

```javascript
const STORAGE_KEY = 'my_app_credentials';

// Save credentials
function saveCredentials(endpoint, token) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ endpoint, token }));
  } catch (e) { /* localStorage might be blocked */ }
}

// Load credentials
function loadCredentials() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

// Full initialization pattern
async function initApp() {
  let endpoint = null;
  let token = null;
  
  try {
    const { props } = await sdk.init({ debug: true });
    
    // SDK provides endpoint
    endpoint = props.context?.environment?.endpoint;
    
    // Try to load saved token
    const saved = loadCredentials();
    if (saved?.token) {
      token = saved.token;
    }
    
    if (endpoint && token) {
      // Test credentials
      const test = await gql('{ __typename }');
      if (test.data) {
        startApp();
        return;
      }
    }
  } catch (e) {
    console.log('SDK init failed, standalone mode');
  }
  
  // Fallback: show manual input form
  showCredentialForm();
}
```

---

# Querying Hygraph

## GraphQL Helper Function

```javascript
let endpoint = null;
let token = null;

async function gql(query) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ query })
  });
  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data;
}
```

## Discovering Models

Models are types that have a `Connection` query field:

```javascript
async function fetchModels() {
  const data = await gql(`{
    __schema {
      queryType {
        fields { name type { name ofType { name } } }
      }
      types { name kind fields { name } }
    }
  }`);
  
  const queryFields = data.data.__schema.queryType.fields;
  const types = data.data.__schema.types;
  const typeMap = Object.fromEntries(types.map(t => [t.name, t]));
  
  const models = [];
  
  for (const field of queryFields) {
    const typeName = field.type?.name || field.type?.ofType?.name;
    
    // Models have a XxxConnection query field
    if (typeName?.endsWith('Connection')) {
      const modelName = typeName.replace('Connection', '');
      
      if (isSystemModel(modelName)) continue;
      if (!typeMap[modelName]) continue;
      
      const modelType = typeMap[modelName];
      
      // Find a good title field
      const titleField = ['title', 'name', 'headline', 'label', 'slug']
        .find(f => modelType.fields?.some(x => x.name === f)) || 'id';
      
      // Check for common fields
      const hasUpdatedAt = modelType.fields?.some(x => x.name === 'updatedAt');
      const hasCreatedAt = modelType.fields?.some(x => x.name === 'createdAt');
      
      // Get plural API ID (the query field name without "Connection")
      const pluralApiId = field.name.replace('Connection', '');
      
      models.push({
        name: modelName,
        pluralApiId,
        titleField,
        hasUpdatedAt,
        hasCreatedAt
      });
    }
  }
  
  return models;
}
```

## Filtering System Types

```javascript
function isSystemModel(name) {
  if (!name || name.startsWith('_')) return true;
  
  // Built-in Hygraph types
  const SYSTEM = ['Asset', 'User', 'ScheduledOperation', 'ScheduledRelease'];
  if (SYSTEM.includes(name)) return true;
  
  // Integration types (filter these out!)
  if (name.toLowerCase().includes('smartling')) return true;
  if (name.toLowerCase().includes('localize')) return true;
  if (name.toLowerCase().includes('lokalise')) return true;
  
  // Query/mutation helper types
  if (/Connection$|Edge$|Aggregate$/.test(name)) return true;
  if (/WhereInput$|OrderByInput$|CreateInput$|UpdateInput$/.test(name)) return true;
  
  return false;
}
```

## Understanding Stages

⚠️ **CRITICAL: DRAFT stage contains ALL entries (including published ones)**

```javascript
// DRAFT = all entries in the system
// PUBLISHED = only entries that have been published

// Count all entries
const allCount = await gql(`{
  articlesConnection(stage: DRAFT) { aggregate { count } }
}`);

// Count only published
const pubCount = await gql(`{
  articlesConnection(stage: PUBLISHED) { aggregate { count } }
}`);

// Unpublished = DRAFT - PUBLISHED
const unpublishedCount = allCount - pubCount;
```

## Common Query Patterns

### Get entry counts
```javascript
const data = await gql(`{
  articles: articlesConnection(stage: DRAFT) {
    aggregate { count }
  }
}`);
const count = data.data.articles.aggregate.count;
```

### Get entries with filters
```javascript
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const data = await gql(`{
  articles(
    stage: DRAFT,
    first: 100,
    where: { updatedAt_lt: "${weekAgo.toISOString()}" },
    orderBy: updatedAt_ASC
  ) {
    id
    title
    updatedAt
    createdAt
  }
}`);
```

### Get entries with date range
```javascript
const data = await gql(`{
  articles(
    stage: DRAFT,
    where: {
      createdAt_gte: "${startDate.toISOString()}",
      createdAt_lt: "${endDate.toISOString()}"
    }
  ) {
    id
    title
  }
}`);
```

---

# Common Errors & Fixes

## "SDK Token available: false"

**This is EXPECTED!** The SDK does not provide auth tokens.

**Fix:** Use localStorage to save a PAT that the user provides once.

## "Cannot read properties of undefined"

**Cause:** Accessing nested props before SDK init completes

**Fix:** Always use optional chaining:
```javascript
const endpoint = props?.context?.environment?.endpoint;
```

## "Field 'xxx' is not defined"

**Cause:** Querying a field that doesn't exist on that type

**Fix:** Introspect first, then query only existing fields:
```javascript
const modelType = typeMap[modelName];
const hasTitle = modelType.fields?.some(f => f.name === 'title');
const titleField = hasTitle ? 'title' : 'id';
```

## 500 Errors from Hygraph API

**Cause:** Query too complex or invalid field combination

**Fix:** 
- Simplify introspection queries
- Query models sequentially, not all at once
- Use aggregate counts instead of fetching all entries

```javascript
// BAD: Complex query that might 500
const data = await gql(`{
  model1 { ... }
  model2 { ... }
  model3 { ... }
  // 20 more models...
}`);

// GOOD: Sequential queries
for (const model of models) {
  const data = await gql(`{
    ${model.pluralApiId}Connection(stage: DRAFT) {
      aggregate { count }
    }
  }`);
}
```

## "Installation Stuck Spinning"

**Cause:** Setup page never called `updateInstallation`

**Fix:** Add to setup.html:
```javascript
props.updateInstallation({
  status: "COMPLETED",
  config: {}
});
```

## CORS Errors

**Cause:** Missing iframe headers

**Fix:** Add headers to vercel.json:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://*.hygraph.com" }
      ]
    }
  ]
}
```

## Sticky Headers Not Working

**Cause:** Parent element has `overflow: hidden`

**Fix:** Remove overflow:hidden from parent containers:
```css
/* DON'T do this if you need sticky children */
.section { overflow: hidden; }

/* DO this instead */
.section { /* no overflow property */ }
.sticky-header { position: sticky; top: 0; z-index: 50; background: white; }
```

---

# Deployment

## Vercel (Recommended)

```bash
cd my-app
npx vercel --prod
```

## Register in Hygraph

1. Go to **Project Settings → Apps**
2. Click **Create App** or **Install App**
3. Enter your Vercel URL as the base URL
4. Configure:
   - **Setup URL**: `/setup.html`
   - **Page Element URL**: `/page.html` (or your main page)
   - **Sidebar Element URL**: `/sidebar.html` (optional)

## API ID Rules

When registering your app, the API ID must:
- Be lowercase
- Use only letters, numbers, and hyphens
- Start with a letter
- Examples: `content-health`, `schema-explorer`, `my-calendar`

---

# Complete Working Example

## Minimal Page App

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Custom App</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; }
    .form { max-width: 400px; margin: 50px auto; }
    .form input { width: 100%; padding: 8px; margin: 8px 0; }
    .form button { width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; cursor: pointer; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div id="credential-form" class="form">
    <h2>Connect to Hygraph</h2>
    <input type="text" id="endpoint" placeholder="Content API Endpoint">
    <input type="text" id="token" placeholder="Permanent Auth Token">
    <button id="connect">Connect</button>
    <div id="error" style="color: red; margin-top: 10px;"></div>
  </div>
  
  <div id="app" class="hidden">
    <h1>My App</h1>
    <div id="content">Loading...</div>
  </div>

  <script type="module">
    import "https://unpkg.com/@graphcms/zoid@9.0.64-alpha.1/lib/zoid.min.js";
    import "https://unpkg.com/@hygraph/app-sdk";
    
    const sdk = window["@hygraph/app-sdk"];
    const $ = s => document.querySelector(s);
    
    let endpoint = null;
    let token = null;
    
    const STORAGE_KEY = 'my_app_creds';
    const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({endpoint, token})); } catch(e){} };
    const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){ return null; } };
    
    async function gql(query) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
      return data.data;
    }
    
    async function startApp() {
      $('#credential-form').classList.add('hidden');
      $('#app').classList.remove('hidden');
      
      // Your app logic here
      const data = await gql('{ __schema { queryType { name } } }');
      $('#content').textContent = 'Connected! Schema query type: ' + data.__schema.queryType.name;
    }
    
    // Connect button handler
    $('#connect').onclick = async () => {
      endpoint = $('#endpoint').value.trim();
      token = $('#token').value.trim();
      
      if (!endpoint || !token) {
        $('#error').textContent = 'Please fill both fields';
        return;
      }
      
      try {
        await gql('{ __typename }');
        save();
        startApp();
      } catch (e) {
        $('#error').textContent = 'Connection failed: ' + e.message;
      }
    };
    
    // Initialize
    sdk.init({ debug: true })
      .then(async ({ props }) => {
        endpoint = props?.context?.environment?.endpoint;
        const saved = load();
        
        if (endpoint && saved?.token) {
          token = saved.token;
          try {
            await gql('{ __typename }');
            startApp();
            return;
          } catch (e) { /* credentials invalid */ }
        }
        
        // Pre-fill endpoint if available
        if (endpoint) $('#endpoint').value = endpoint;
        if (saved?.token) $('#token').value = saved.token;
      })
      .catch(() => {
        // SDK failed - standalone mode
        const saved = load();
        if (saved?.endpoint) $('#endpoint').value = saved.endpoint;
        if (saved?.token) $('#token').value = saved.token;
      });
  </script>
</body>
</html>
```

---

# Tips

→ **Start with static HTML** — Avoid framework complexity

→ **Log everything** — `console.log(props)` is your friend

→ **SDK gives endpoint, NOT token** — Always plan for manual token input

→ **Save credentials to localStorage** — So users don't re-enter every time

→ **Use DRAFT stage for counts** — It contains all entries

→ **Query sequentially** — Avoid 500 errors from complex queries

→ **Filter system/integration types** — smartling, localize, Lokalise, etc.

→ **Test outside Hygraph first** — Use the credential form to develop locally

→ **Check console for errors** — Hygraph iframe can swallow some errors
