# 🚀 Reusable Patterns for Building a Monetizable SaaS App

**Extracted from:** Hygraph Custom App Suite  
**Goal:** Build a CMS-agnostic content management tool that can be monetized

---

## 💡 Product Ideas (Based on What Works)

### 1. **Universal Media Studio** 💰💰💰
**What it does:** Visual image transformation, cropping, optimization tool
**Target:** Any developer/content team using CDN-based images
**Monetization:** 
- Free: 100 transforms/month
- Pro: $9/mo unlimited + team features
- Enterprise: Self-hosted + API

**Key differentiators:**
- Works with ANY image CDN (Cloudinary, imgix, Hygraph, Contentful)
- Visual srcset generator
- Bulk optimization
- No vendor lock-in

### 2. **Content Health Monitor** 💰💰
**What it does:** Track stale content, unused assets, content velocity
**Target:** Content teams at scale
**Monetization:**
- Free: 1 project, basic metrics
- Pro: $19/mo unlimited projects + alerts
- Team: $49/mo + Slack integration + reports

### 3. **AI Alt-Text Generator** 💰💰💰
**What it does:** Bulk generate alt text for accessibility
**Target:** E-commerce, media companies, accessibility compliance
**Monetization:**
- Free: 50 images/month (using Gemini free tier)
- Pro: $0.02/image (bulk pricing)
- Enterprise: Self-hosted + custom prompts

### 4. **Schema Analyzer** 💰
**What it does:** Visualize and analyze GraphQL schemas
**Target:** Developers working with GraphQL APIs
**Monetization:**
- Free tier with basic features
- Pro with dependency graphs, breaking change detection

---

## 🏗️ Reusable Architecture Patterns

### 1. Single-File Progressive Web App
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SaaS App</title>
  <style>
    /* CSS Variables for theming */
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --text-primary: #f1f5f9;
      --text-muted: #64748b;
      --accent: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    
    /* Base styles */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: var(--bg-primary); color: var(--text-primary); }
  </style>
</head>
<body>
  <!-- Setup/Auth View -->
  <div id="setup-view"></div>
  
  <!-- Main App View -->
  <div id="main-view" style="display:none;"></div>
  
  <script type="module">
    // Your app logic
  </script>
</body>
</html>
```

**Benefits:**
- Zero build step = faster iteration
- Single file = easy deployment anywhere
- Progressive enhancement = works without JS for basic content

### 2. Universal API Adapter Pattern
```javascript
// Abstract API layer that works with any backend
class ContentAPI {
  constructor(config) {
    this.type = config.type; // 'graphql', 'rest', 'custom'
    this.endpoint = config.endpoint;
    this.auth = config.auth;
  }
  
  async query(operation, variables = {}) {
    switch (this.type) {
      case 'graphql':
        return this.graphqlQuery(operation, variables);
      case 'rest':
        return this.restQuery(operation, variables);
      default:
        throw new Error(`Unsupported API type: ${this.type}`);
    }
  }
  
  async graphqlQuery(query, variables) {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.auth.token}`
      },
      body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0].message);
    return data.data;
  }
  
  async restQuery(endpoint, options = {}) {
    const res = await fetch(`${this.endpoint}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${this.auth.token}` },
      ...options
    });
    return res.json();
  }
}

// Usage with different backends
const hygraphAPI = new ContentAPI({
  type: 'graphql',
  endpoint: 'https://...hygraph.com/v2/.../master',
  auth: { token: 'pat_...' }
});

const contentfulAPI = new ContentAPI({
  type: 'rest',
  endpoint: 'https://cdn.contentful.com/spaces/...',
  auth: { token: 'access_token_...' }
});
```

### 3. Plugin Architecture for CMS Integrations
```javascript
// Base plugin interface
class CMSPlugin {
  constructor(config) {
    this.config = config;
  }
  
  async connect() { throw new Error('Not implemented'); }
  async listAssets(options) { throw new Error('Not implemented'); }
  async getAsset(id) { throw new Error('Not implemented'); }
  async updateAsset(id, data) { throw new Error('Not implemented'); }
  async transformUrl(asset, transforms) { throw new Error('Not implemented'); }
}

// Hygraph plugin
class HygraphPlugin extends CMSPlugin {
  async listAssets({ page, filter }) {
    const cursor = page > 1 ? this.cursors[page - 1] : null;
    const data = await this.gql(`{
      assetsConnection(first: 50${cursor ? `, after: "${cursor}"` : ''}) {
        edges { node { id url fileName width height } }
        pageInfo { hasNextPage endCursor }
      }
    }`);
    return {
      assets: data.assetsConnection.edges.map(e => e.node),
      hasMore: data.assetsConnection.pageInfo.hasNextPage
    };
  }
  
  transformUrl(asset, transforms) {
    // Build Hygraph transformation URL
    const parts = [];
    if (transforms.width) parts.push(`resize: { width: ${transforms.width} }`);
    if (transforms.quality) parts.push(`quality: { value: ${transforms.quality} }`);
    // ... etc
    return `${asset.url}?${parts.join('&')}`;
  }
}

// Cloudinary plugin
class CloudinaryPlugin extends CMSPlugin {
  transformUrl(asset, transforms) {
    // Build Cloudinary transformation URL
    const transformString = [];
    if (transforms.width) transformString.push(`w_${transforms.width}`);
    if (transforms.quality) transformString.push(`q_${transforms.quality}`);
    return asset.url.replace('/upload/', `/upload/${transformString.join(',')}/`);
  }
}
```

### 4. Observability & Analytics Pattern
```javascript
class Analytics {
  constructor(config) {
    this.enabled = config.enabled ?? true;
    this.endpoint = config.endpoint;
    this.sessionId = this.generateSessionId();
    this.events = [];
    this.flushInterval = setInterval(() => this.flush(), 30000);
  }
  
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  track(event, properties = {}) {
    if (!this.enabled) return;
    
    this.events.push({
      event,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent
    });
    
    // Flush immediately for important events
    if (['error', 'purchase', 'signup'].includes(event)) {
      this.flush();
    }
  }
  
  async flush() {
    if (this.events.length === 0) return;
    
    const batch = [...this.events];
    this.events = [];
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch })
      });
    } catch (e) {
      // Re-add events on failure
      this.events = [...batch, ...this.events];
    }
  }
  
  // Convenience methods
  pageView(page) { this.track('page_view', { page }); }
  featureUsed(feature) { this.track('feature_used', { feature }); }
  error(error, context) { this.track('error', { error: error.message, context }); }
}

// Usage
const analytics = new Analytics({
  enabled: !localStorage.getItem('analytics_opt_out'),
  endpoint: '/api/analytics'
});

analytics.pageView('/dashboard');
analytics.featureUsed('crop_tool');
analytics.track('transform_applied', { width: 800, format: 'webp' });
```

### 5. Rate Limiting & Queue Pattern
```javascript
class RateLimitedQueue {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.minDelay = options.minDelay || 100; // ms between requests
    this.queue = [];
    this.running = 0;
    this.lastRun = 0;
  }
  
  async add(fn, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, priority });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.process();
    });
  }
  
  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    
    // Respect rate limit
    const now = Date.now();
    const timeSinceLastRun = now - this.lastRun;
    if (timeSinceLastRun < this.minDelay) {
      setTimeout(() => this.process(), this.minDelay - timeSinceLastRun);
      return;
    }
    
    const { fn, resolve, reject } = this.queue.shift();
    this.running++;
    this.lastRun = Date.now();
    
    try {
      const result = await fn();
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// Usage - for AI API calls with rate limits
const aiQueue = new RateLimitedQueue({
  maxConcurrent: 3,
  minDelay: 4000 // 15 requests per minute
});

async function generateAltTextForAll(images) {
  const results = await Promise.all(
    images.map(img => 
      aiQueue.add(() => generateAltText(img.url), img.priority)
    )
  );
  return results;
}
```

### 6. Progressive Loading Pattern
```javascript
class ProgressiveLoader {
  constructor(container, options = {}) {
    this.container = container;
    this.pageSize = options.pageSize || 50;
    this.loadMore = options.loadMore;
    this.render = options.render;
    this.items = [];
    this.cursor = null;
    this.hasMore = true;
    this.loading = false;
    
    this.setupInfiniteScroll();
  }
  
  setupInfiniteScroll() {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && this.hasMore && !this.loading) {
        this.load();
      }
    });
    
    this.sentinel = document.createElement('div');
    this.sentinel.className = 'load-more-sentinel';
    this.container.appendChild(this.sentinel);
    observer.observe(this.sentinel);
  }
  
  async load() {
    if (this.loading || !this.hasMore) return;
    
    this.loading = true;
    this.showLoading();
    
    try {
      const { items, cursor, hasMore } = await this.loadMore(this.cursor);
      this.items.push(...items);
      this.cursor = cursor;
      this.hasMore = hasMore;
      this.render(this.items);
    } catch (e) {
      this.showError(e);
    } finally {
      this.loading = false;
      this.hideLoading();
    }
  }
  
  showLoading() {
    this.sentinel.innerHTML = '<div class="spinner"></div>';
  }
  
  hideLoading() {
    this.sentinel.innerHTML = this.hasMore ? '' : '<p>No more items</p>';
  }
  
  showError(e) {
    this.sentinel.innerHTML = `<p class="error">Error: ${e.message}</p>`;
  }
  
  reset() {
    this.items = [];
    this.cursor = null;
    this.hasMore = true;
    this.container.innerHTML = '';
    this.container.appendChild(this.sentinel);
    this.load();
  }
}
```

### 7. Client-Side Image Processing Pattern
```javascript
class ImageProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }
  
  async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  
  async crop(src, { x, y, width, height }) {
    const img = await this.loadImage(src);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    return this.toBlob();
  }
  
  async resize(src, { width, height, fit = 'contain' }) {
    const img = await this.loadImage(src);
    
    let targetWidth = width;
    let targetHeight = height;
    
    if (fit === 'contain') {
      const ratio = Math.min(width / img.width, height / img.height);
      targetWidth = img.width * ratio;
      targetHeight = img.height * ratio;
    } else if (fit === 'cover') {
      const ratio = Math.max(width / img.width, height / img.height);
      targetWidth = img.width * ratio;
      targetHeight = img.height * ratio;
    }
    
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return this.toBlob();
  }
  
  async applyFilters(src, { blur = 0, contrast = 100, brightness = 100 }) {
    const img = await this.loadImage(src);
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    
    this.ctx.filter = `blur(${blur}px) contrast(${contrast}%) brightness(${brightness}%)`;
    this.ctx.drawImage(img, 0, 0);
    this.ctx.filter = 'none';
    
    return this.toBlob();
  }
  
  toBlob(type = 'image/jpeg', quality = 0.9) {
    return new Promise(resolve => {
      this.canvas.toBlob(resolve, type, quality);
    });
  }
  
  toDataUrl(type = 'image/jpeg', quality = 0.9) {
    return this.canvas.toDataURL(type, quality);
  }
}

// Usage
const processor = new ImageProcessor();
const croppedBlob = await processor.crop(imageUrl, { x: 100, y: 100, width: 500, height: 500 });
const previewUrl = URL.createObjectURL(croppedBlob);
```

---

## 💰 Monetization Strategies

### 1. Freemium with Usage Limits
```javascript
class UsageLimiter {
  constructor(plan) {
    this.plan = plan;
    this.limits = {
      free: { transforms: 100, storage: 100 * 1024 * 1024 },
      pro: { transforms: Infinity, storage: 10 * 1024 * 1024 * 1024 },
      enterprise: { transforms: Infinity, storage: Infinity }
    };
  }
  
  async checkLimit(action) {
    const usage = await this.getUsage();
    const limit = this.limits[this.plan][action];
    
    if (usage[action] >= limit) {
      throw new UpgradeRequiredError(action, this.plan);
    }
    
    return true;
  }
  
  async trackUsage(action, amount = 1) {
    const usage = await this.getUsage();
    usage[action] = (usage[action] || 0) + amount;
    await this.saveUsage(usage);
  }
}
```

### 2. Feature Gating
```javascript
const FEATURE_FLAGS = {
  free: ['basic_crop', 'basic_resize', 'export_jpg'],
  pro: ['advanced_crop', 'batch_processing', 'export_all_formats', 'api_access'],
  enterprise: ['white_label', 'sso', 'custom_integrations', 'sla']
};

function hasFeature(plan, feature) {
  return FEATURE_FLAGS[plan]?.includes(feature) || false;
}

// In UI
if (hasFeature(userPlan, 'batch_processing')) {
  showBatchButton();
} else {
  showUpgradePrompt('batch_processing');
}
```

### 3. Metered Billing (API calls)
```javascript
class MeterService {
  constructor(stripeCustomerId) {
    this.customerId = stripeCustomerId;
  }
  
  async recordUsage(meterId, quantity) {
    await fetch('/api/usage', {
      method: 'POST',
      body: JSON.stringify({
        customerId: this.customerId,
        meterId,
        quantity,
        timestamp: Date.now()
      })
    });
  }
}

// Track each API call
async function transformImage(params) {
  const result = await doTransform(params);
  await meter.recordUsage('image_transforms', 1);
  return result;
}
```

---

## 🔒 Security Best Practices

### 1. No Secrets in Frontend
```javascript
// ❌ Bad - API key in frontend
const apiKey = 'sk-abc123...';

// ✅ Good - API key in backend
async function callAI(prompt) {
  return fetch('/api/ai', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}
```

### 2. Secure Token Storage
```javascript
// ✅ Use HTTP-only cookies for auth
// Set by backend:
// Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict

// ❌ Don't store sensitive tokens in localStorage
// localStorage.setItem('api_key', '...')  // XSS vulnerable
```

### 3. Input Validation
```javascript
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9._-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

function validateImageUrl(url) {
  const allowed = ['https://cdn.example.com', 'https://images.example.com'];
  return allowed.some(domain => url.startsWith(domain));
}
```

---

## 📊 Observability Stack Recommendation

### Self-Hosted (Budget)
- **Analytics:** Plausible, Umami
- **Error Tracking:** Sentry (free tier)
- **Logging:** Loki + Grafana

### Managed (Scale)
- **Analytics:** Mixpanel, Amplitude
- **Error Tracking:** Sentry, Bugsnag
- **APM:** Datadog, New Relic

### Key Metrics to Track
```javascript
// Business metrics
analytics.track('signup', { plan: 'free', source: 'google' });
analytics.track('upgrade', { from: 'free', to: 'pro', mrr: 19 });
analytics.track('churn', { plan: 'pro', reason: 'too_expensive' });

// Product metrics
analytics.track('feature_activated', { feature: 'crop_tool', first_use: true });
analytics.track('export', { format: 'webp', quality: 80 });
analytics.track('api_call', { endpoint: '/transform', latency_ms: 234 });

// Technical metrics
analytics.track('error', { type: 'network', endpoint: '/api/transform' });
analytics.track('performance', { lcp: 1200, fid: 50, cls: 0.1 });
```

---

## 🚀 Go-to-Market Checklist

### MVP Launch
- [ ] Core feature working (image transforms OR health checks OR alt-text)
- [ ] Single CMS integration (start with Hygraph or Contentful)
- [ ] Basic auth (email + password OR OAuth)
- [ ] Usage limits for free tier
- [ ] Stripe integration for payments
- [ ] Landing page with clear value prop

### Growth
- [ ] Additional CMS integrations (plugin architecture)
- [ ] API access for developers
- [ ] Team features (shared projects, roles)
- [ ] Zapier/Make integration
- [ ] Documentation site

### Scale
- [ ] Self-hosted option
- [ ] White-labeling
- [ ] SSO (SAML, OIDC)
- [ ] SLA guarantees
- [ ] Dedicated support

---

*This document extracts reusable patterns from production code. Adapt as needed for your specific use case.*

