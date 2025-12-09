# 🛠️ Hygraph Custom App Suite

**A complete toolkit for content operations, accessibility, and schema management**

![Version](https://img.shields.io/badge/version-1.6.0-blue)
![Apps](https://img.shields.io/badge/apps-6-green)
![Status](https://img.shields.io/badge/status-production-success)

---

## 🎯 Executive Summary

This custom app suite extends Hygraph with **5 powerful tools** that solve real content management challenges:

| App | Problem Solved | Impact |
|-----|----------------|--------|
| 🔍 **Schema Explorer** | "Where is this component used?" | Find usage across 1000s of entries in seconds |
| 📅 **Content Calendar** | "What's scheduled to publish?" | Visual publishing schedule for entire team |
| 🏥 **Content Health** | "What content is stale or broken?" | Identify neglected content automatically |
| 🖼️ **Alt-Text Generator** | "Our images lack accessibility" | AI-generated alt text for all images (FREE) |
| 🎨 **Image Transform Helper** | "How do I optimize images?" | Visual tool for responsive image generation |
| 📊 **Content Analytics** | "How is our content performing?" | Metrics, velocity, and author activity |

**Key Achievement:** All apps work seamlessly inside Hygraph's interface with automatic authentication.

---

## 🚀 The Apps

### 1. 🔍 Schema Explorer

> **"Find every entry using any component in your entire project"**

#### What It Does
- Browse all **Models**, **Components**, and **Enums** in your schema
- Search for content using any component (detects **7 levels of nesting**)
- Find unused schema elements that can be cleaned up
- Navigate directly to entries in Hygraph Studio

#### Key Features
| Feature | Description |
|---------|-------------|
| **Deep Nested Detection** | Finds components inside components inside components... |
| **Parallel Queries** | Searches all models simultaneously for speed |
| **Dual Stage Search** | Checks both DRAFT and PUBLISHED content |
| **Direct Links** | One-click navigation to entries in Hygraph |
| **Smart Filtering** | Hides system types, integration components, and noise |

#### Use Cases
- ✅ "Can I safely delete this component?" → Check if it's used anywhere
- ✅ "Which entries use our Hero component?" → Instant list with links
- ✅ "What schema elements are unused?" → Cleanup recommendations

#### Tabs
| Tab | Purpose |
|-----|---------|
| **Components** | Browse all reusable components |
| **Models** | See content models and their structure |
| **Enums** | View enumeration types and values |
| **Personalization** | Components used for A/B testing / variants |

---

### 2. 📅 Content Calendar

> **"See your entire publishing schedule at a glance"**

#### What It Does
- Visual calendar showing all scheduled content releases
- Month, Week, and Day views with smart filtering
- Works with Hygraph's native **Releases** feature
- Hover for details, click to edit

#### Key Features
| Feature | Description |
|---------|-------------|
| **Three Views** | Month (overview), Week (planning), Day (detail) |
| **Date Picker** | Jump to any date with the calendar icon |
| **Model Filters** | Filter by content type (alphabetically sorted) |
| **Hover Details** | See release name, status, author, creation date |
| **Parallel Loading** | Queries all models simultaneously for speed |

#### How It Works
```
Hygraph Releases → Calendar parses scheduledIn → Visual display
```

No custom fields needed — uses Hygraph's built-in scheduling!

#### Navigation
- **◀ ▶** — Previous/Next period
- **Today** — Jump to current date
- **📅 Icon** — Open date picker
- **Filter dropdown** — Filter by model

---

### 3. 🏥 Content Health Dashboard

> **"Identify stale, broken, and neglected content automatically"**

#### What It Does
- Finds entries not updated in X days (configurable)
- Lists unused models with zero entries
- Calculates overall **Health Score** (0-100%)
- Dashboard cards with key metrics

#### Key Features
| Feature | Description |
|---------|-------------|
| **Stale Content Detection** | Find entries stuck in draft or not updated |
| **Unused Model Finder** | Identify schema bloat |
| **Health Score** | Single metric for content quality |
| **Dashboard Cards** | Draft/Published ratio, New this week, Age distribution |
| **Model Filter** | Focus on specific content types |
| **Sticky Headers** | Easy navigation while scrolling |

#### Health Score Calculation
```
Base: 100%
- Stale entries: -50% max (proportional to % stale)
- Unused models: -30% max (proportional to % unused)
= Final Score
```

#### Dashboard Cards
| Card | What It Shows |
|------|---------------|
| **Draft vs Published** | Ratio with visual indicator |
| **New This Week** | Entries created in last 7 days |
| **Content Age** | Distribution: Recent / Aging / Old |
| **Model with Most Entries** | Your largest content type |

---

### 4. 🖼️ Alt-Text Generator

> **"AI-powered accessibility for all your images — FREE"**

#### What It Does
- Scans all images in your project (DRAFT + PUBLISHED)
- Identifies images missing alt text
- Generates alt text using **Google Gemini 2.0 Flash** (free tier)
- Bulk processing with progress tracking

#### Key Features
| Feature | Description |
|---------|-------------|
| **Full Scan** | Finds all images across both stages |
| **AI Generation** | Google Gemini creates descriptive alt text |
| **Bulk Processing** | Process hundreds of images automatically |
| **Progress Tracking** | Live progress bar with ETA |
| **Pause/Resume** | Stop anytime, continue later |
| **Persistence** | Progress saved to localStorage |
| **Rate Limiting** | Automatic 4-second delays for free tier |

#### Cost Comparison
| Images | OpenAI GPT-4o | Google Gemini |
|--------|---------------|---------------|
| 100 | ~$1 | **FREE** |
| 1,000 | ~$10 | **FREE** |
| 10,000 | ~$100 | **FREE** |

#### Processing Times
| Images | Time |
|--------|------|
| 15 | ~1 minute |
| 100 | ~7 minutes |
| 500 | ~35 minutes |
| 1,000 | ~67 minutes |

#### Supported Alt Text Fields
The app auto-detects: `altText`, `alt`, `alternativeText`, `description`, `caption`

---

### 5. 🎨 Image Transform Helper

> **"Generate optimized, responsive images with visual preview"**

#### What It Does
- Browse all images in your project
- Apply transformations with live preview
- Generate responsive variants for different screen sizes
- Get ready-to-use code (srcset, picture, CSS)

#### Key Features
| Feature | Description |
|---------|-------------|
| **Asset Browser** | Grid view of all project images with search |
| **Live Preview** | See transformations in real-time |
| **Side-by-Side Compare** | Original vs transformed |
| **Responsive Variants** | Generate multiple sizes at once |
| **Code Output** | srcset, `<picture>`, CSS media queries |
| **GraphQL Integration** | Works with new Hygraph CDN |

#### Available Transformations
| Transform | Options |
|-----------|---------|
| **Resize** | Width, Height, Fit (clip, crop, scale, max) |
| **Quality** | 1-100% compression |
| **Format** | Auto (WebP), JPEG, PNG, WebP |
| **Blur** | 0-20 amount |
| **Sharpen** | 0-20 amount |

#### Presets
| Preset | Size |
|--------|------|
| Thumbnail | 150×150 crop |
| Medium | 600w |
| Large | 1200w |
| Full HD | 1920w |
| Square | 500×500 crop |

#### Output Formats
```html
<!-- srcset -->
<img srcset="image-320w.webp 320w, image-640w.webp 640w, image-1024w.webp 1024w" />

<!-- picture element -->
<picture>
  <source type="image/webp" srcset="..." />
  <img src="fallback.jpg" />
</picture>

/* CSS */
.hero { background-image: url('image-320w.webp'); }
@media (min-width: 640px) { ... }
```

---

### 6. 📊 Content Analytics

> **"Understand your content performance with data-driven insights"**

#### What It Does
- Overview cards showing total entries, published vs draft, and weekly/monthly activity
- Content distribution by model with visual bar charts
- Content creation velocity over the last 12 weeks
- Author activity tracking (top contributors)

#### Key Features
| Feature | Description |
|---------|-------------|
| **Overview Cards** | Total entries, published, drafts, this week/month |
| **Content by Model** | Bar chart of top 10 models by entry count |
| **Velocity Chart** | 12-week trend of content creation |
| **Author Activity** | Top contributors in the last 30 days |
| **Trend Indicators** | Week-over-week and month-over-month changes |

#### Overview Cards
| Card | What It Shows |
|------|---------------|
| **Total Entries** | All content entries in your project |
| **Published** | Entries in PUBLISHED stage (% of total) |
| **Drafts** | Entries only in DRAFT stage |
| **Models** | Number of content models |
| **This Week** | Entries created in last 7 days |
| **This Month** | Entries created in last 30 days |

#### Velocity Insights
The velocity chart shows:
- Weekly content creation over 12 weeks
- Average entries per week
- Total over the period
- Trend percentage (up/down vs start of period)

#### Author Activity
Shows top 10 contributors with:
- Author name and initials
- Number of entries created (last 30 days)
- Visual activity bar
- Rank position

*Note: Author tracking requires `createdBy` field access in your API permissions.*

---

## 📊 Technical Highlights

### Performance Optimizations
| Optimization | Impact |
|--------------|--------|
| **Parallel Queries** | 5-10x faster than sequential |
| **Batch Processing** | 10-15 concurrent requests |
| **Smart Caching** | localStorage for credentials |
| **Debounced Updates** | Prevents API spam |

### Compatibility
- ✅ Works with **new Hygraph CDN** (region-specific URLs)
- ✅ Works with **legacy CDN** (media.graphassets.com)
- ✅ Supports all Hygraph **regions** (EU, US, etc.)
- ✅ Automatic **authentication** when inside Hygraph

### Security
- 🔒 Credentials stored in browser localStorage only
- 🔒 No external servers (except Gemini for alt-text)
- 🔒 All queries run in your browser
- 🔒 PAT shared securely across all tools

---

## 🔧 Installation

### Quick Start (5 minutes)

**Step 1:** Create Custom App in Hygraph
```
Apps → Create App → Custom App
Name: Hygraph Tools
API ID: hygraph-tools
App URL: https://hygraph-app-static.vercel.app
```

**Step 2:** Add Page Elements
| Element | Slug |
|---------|------|
| Schema Explorer | `/page.html` |
| Content Calendar | `/calendar.html` |
| Content Health | `/health.html` |
| Alt-Text Generator | `/alttext.html` |
| Image Transform | `/transform.html` |
| Content Analytics | `/analytics.html` |

**Step 3:** Set Permissions
```
☑️ Read existing content
☑️ Read existing environments  
☑️ Read content model / components
☑️ Update existing content (for Alt-Text)
```

**Step 4:** Install & Complete Setup

---

## 📈 Business Value

### Time Savings
| Task | Before | After |
|------|--------|-------|
| Find component usage | 30+ min manual search | **5 seconds** |
| Review publishing schedule | Check each entry | **Calendar view** |
| Identify stale content | Export & spreadsheet | **Instant dashboard** |
| Add alt text to 1000 images | Days of manual work | **~1 hour automated** |
| Generate responsive images | Developer task | **Self-service tool** |

### Quality Improvements
- **SEO:** All images have proper alt text
- **Accessibility:** WCAG compliance for images
- **Performance:** Optimized responsive images
- **Content Quality:** No more forgotten draft entries
- **Schema Health:** Clean, used-only components

### Cost Savings
- **Alt-text generation:** FREE with Gemini vs $100+ with OpenAI
- **Developer time:** Self-service tools for content teams
- **Maintenance:** Identify unused schema elements to remove

---

## 🗂️ Version History

### v1.6.0 — Content Analytics
- New Content Analytics page element
- Overview cards (total, published, drafts, models, weekly, monthly)
- Content by Model bar chart (top 10)
- 12-week content creation velocity chart
- Author activity tracking (top 10 contributors)
- Trend indicators (week-over-week, month-over-month)
- Parallel queries for fast data loading

### v1.5.0 — Image Transform Helper
- New Image Transform page element
- Asset browser with search and pagination
- Live transformation preview
- Side-by-side comparison
- Responsive variant generation
- GraphQL API integration for new CDN
- Code output (srcset, picture, CSS)

### v1.4.0 — Alt-Text Generator
- AI-powered alt text using Google Gemini 2.0 Flash (FREE)
- Bulk generation with progress tracking
- Pause/Resume/Cancel controls
- Scans both DRAFT and PUBLISHED stages
- Auto-detects alt text field on Asset model

### v1.3.0 — Content Health Dashboard
- Stale content detection (configurable threshold)
- Unused model finder
- Health score calculation
- Dashboard cards with key metrics
- Sticky headers for easy navigation

### v1.2.0 — Calendar Enhancements
- Month/Week/Day view toggle
- Date picker navigation
- Hover popups with details
- Parallel query loading

### v1.1.0 — Content Calendar
- Visual publishing schedule
- Integration with Hygraph Releases
- Model filtering

### v1.0.0 — Schema Explorer
- Component/Model/Enum browser
- Deep nested detection
- Usage statistics
- Direct Hygraph links

---

## 🛠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| App won't load | Check permissions, clear cache |
| "No entries found" | Content must be in DRAFT or PUBLISHED |
| Missing components | System components are filtered by design |
| Alt-text field not found | Add `altText` field to Asset model |
| Gemini rate limit | Wait, or process in smaller batches |
| Transform URL broken | App now uses GraphQL API (fixed) |
| Calendar 400 errors | Expected for models without scheduling |

### Getting Help

1. Check browser console for errors
2. Verify PAT has correct permissions
3. Ensure endpoint URL is correct
4. Try clearing localStorage and re-authenticating

---

## 📝 License

Internal tool built for [Your Company Name]

**Built with:**
- Hygraph App SDK
- Google Gemini 2.0 Flash API
- Vanilla JavaScript (no frameworks)
- Deployed on Vercel

---

*Last updated: December 2024*
