# Hygraph Schema Audit Application – Comprehensive Documentation

## Project Overview

A Next.js 16 + Tailwind CSS application that performs a thorough audit of Hygraph CMS projects. The audit analyzes both the **static schema definitions** and **actual content entries** to provide actionable insights from a **senior content strategist perspective**.

**Live URL:** https://hygraph-schema-audit.vercel.app

---

## User Requirements & Feedback History

### Initial Requirements
1. Build an app that audits a Hygraph project covering:
   - Schema analysis
   - Complexity assessment
   - Editorial experience
   - Schema best practices
   - Content reuse patterns
2. Input: Content API endpoint + Personal Access Token (PAT)
3. Output: Visual dashboard with Next.js and Tailwind CSS
4. Mix both static schema definitions AND content entries analysis

### Additional Analysis Requests
- SEO analysis
- Performance analysis
- Actionable insights (nesting, circular relationships, components)

### Self-Serve Audit Grid Integration
User provided a detailed audit checklist to incorporate:

#### 1. Structure & Organization
| Checkpoint | Focus |
|------------|-------|
| Page vs. Content Type | Is each page its own model, or do multiple pages share a flexible content type? Is schema encouraging duplication? |
| Field Count & Usage | Are there too many one-off fields (e.g., `section17Title`)? Do field names change unpredictably? |
| Componentization | Using component/block system? Easy to add/reorder sections? |

#### 2. Reusability & Modularity
| Checkpoint | Focus |
|------------|-------|
| Shared Components | Do multiple pages have similar sections managed in one place or duplicated? |
| Template Flexibility | How do editors configure layout/styling? Is schema flexible or locked? |

#### 3. Data Relationships
| Checkpoint | Focus |
|------------|-------|
| Reference Integrity | Are references clearly defined? Circular or overly complex? |
| Nested vs. Linked Content | Is deeply nested content in single model, or should parts be separate linked models? |

#### 4. Naming & Consistency
| Checkpoint | Focus |
|------------|-------|
| Model & Field Naming | Descriptive names? Consistent convention (camelCase/snake_case)? |
| Versioning | Multiple versions of same model (Home v1, Home v2)? Should merge/deprecate? |

#### 5. Scalability & Maintenance
| Checkpoint | Focus |
|------------|-------|
| Environment Strategy | Separate environments (master/stage) with identical schemas? |
| Impact of Changes | Easy to add fields/components without breaking existing content? |
| Performance Considerations | Massive payloads from deeply nested/duplicated data? |

#### 6. Governance & Workflow
| Checkpoint | Focus |
|------------|-------|
| Editorial Workflow | Clear process for adding/updating content? Intuitive for non-technical users? |
| Localization & Multi-Site | Supporting multiple locales/regions? Handling translations well? |

### Critical Feedback: Content Strategist Approach

User emphasized the audit should consider:

1. **Use of components vs models** – when it makes sense to use each
2. **Separate layout from content** – in model design
3. **Clean multi-tenant architecture** – rather than just using enums
4. **Use of variants** – as Hygraph defines them (conditional content based on component location)
5. **Enum analysis:**
   - If enums are used or not
   - Single-value enums (useless)
   - Duplicate enums
   - Enums used for lightweight multi-brand/region/tenant (architectural flaw)
6. **Duplicate content models** – identifying redundancy

### Important Correction: Two-Way References

**User Feedback:** "This is not a circular dependency but more a two-way relationship"

**Example flagged incorrectly:** `AboutUsPage → ContentPageBlock → AboutUsPage`

**Resolution:** 
- Two-way (bidirectional) references are a **Hygraph FEATURE**, not a problem
- Only flag true circular chains with **3+ distinct nodes** as potential issues
- Removed "Bidirectional Relations" feature callout from UI (deemed useless to display)

### Strategic Report Requirements

User requested a **senior content strategist** approach with:

1. **Executive Summary** with headline, key findings, quick wins
2. **Use Case Analysis** – detect architecture type (multi-brand, e-commerce, etc.)
3. **Editorial Experience Assessment** – efficiency rating, pain points
4. **Content Strategy Evaluation** – maturity, reusability, governance readiness
5. **Performance Considerations** – risk level, bottlenecks
6. **Action Plan** – immediate, short-term, long-term priorities

### Architecture Detection Requirements

Identify what type of architecture is being implemented:
- Multi-brand (e.g., "shops")
- Multi-tenant
- Multi-region
- E-commerce
- Brand promotion
- Marketing site
- Blog/publication
- SaaS docs
- Portfolio/showcase
- Event platform

Then assess if the **model design fits** the detected architecture.

### Enum Architecture Flaw Detection

Specifically detect:
- **Lightweight multi-brand** via enum (should be proper model)
- **Lightweight multi-region** via enum (should use localization or model)
- **Lightweight multi-tenant** via enum (critical scalability concern)
- **Single-value enums** (provide no benefit)
- **Oversized enums** (should be content models)
- **Overlapping enums** (potential consolidation needed)

### UI/UX Requirements

1. **Stable deployment URL:** `hygraph-schema-audit.vercel.app`
2. **Schema diagram** showing essential models (with content OR referenced by 2+ models)
3. **Formal report header** with:
   - Generated timestamp
   - Project identification (from endpoint)
   - Assessment date
4. **Save and reuse credentials** – stored in localStorage, shown in dropdown
5. **PDF export** – professional, easy-to-read format

### Test Project

User provided a test Hygraph project (multi-brand architecture with "shops"):
- **Content API:** `https://eu-central-1-dotcontrol.cdn.hygraph.com/content/cmav7qlmh0kv907w3gztl8a2f/master`
- **PAT:** (stored in memory, ID: 11828679)

---

## Technical Architecture

### Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **GraphQL:** graphql-request
- **Storage:** localStorage for credentials

### Project Structure
```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ConnectForm.tsx          # API connection + credential management
│   └── Dashboard/
│       ├── Dashboard.tsx        # Main dashboard layout
│       ├── ExecutiveSummary.tsx # Report header + summary card
│       ├── SchemaOverview.tsx   # Model/component/enum counts
│       ├── SchemaDiagram.tsx    # Essential models visualization
│       ├── StrategicFindings.tsx# Detailed findings
│       ├── ActionPlan.tsx       # Prioritized recommendations
│       └── ExportButton.tsx     # PDF export trigger
└── lib/
    ├── types.ts                 # All TypeScript interfaces
    ├── hygraph/
    │   └── introspection.ts     # GraphQL introspection + content queries
    ├── analyzers/
    │   ├── index.ts             # Main audit orchestrator
    │   ├── schema.ts            # Schema structure analysis
    │   ├── components.ts        # Component reuse analysis
    │   ├── content.ts           # Content entry analysis
    │   ├── editorial.ts         # Editorial experience scoring
    │   ├── seo.ts               # SEO field coverage
    │   ├── performance.ts       # Performance risk assessment
    │   ├── bestPractices.ts     # Naming, validation, constraints
    │   ├── governance.ts        # Workflow, localization, versioning
    │   ├── architecture.ts      # Layout/content separation, variants
    │   ├── contentStrategy.ts   # Architecture detection, model usage
    │   ├── enumArchitecture.ts  # Enum pattern/flaw analysis
    │   └── strategicReport.ts   # Business-language report generation
    └── export/
        └── generatePDF.ts       # PDF content generation
```

---

## Analysis Modules

### 1. Schema Analysis (`schema.ts`)
- Model/component/enum counts
- Field type distribution
- Relation count
- Two-way references (feature, not issue)
- True circular relations (3+ nodes only)
- Max nesting depth
- Orphan models

### 2. Component Analysis (`components.ts`)
- Component usage across models
- Unused components
- Duplicate field patterns (componentization opportunities)
- Reuse score

### 3. Content Analysis (`content.ts`)
- Entry counts per model (draft vs published)
- Empty models
- Content freshness distribution
- Asset statistics

### 4. Editorial Analysis (`editorial.ts`)
- Model complexity scoring
- Average fields per model
- Required field ratio
- Localization burden

### 5. SEO Analysis (`seo.ts`)
- SEO field coverage
- Slug field presence
- Alt text coverage
- Open Graph fields
- Rich text heading issues

### 6. Performance Analysis (`performance.ts`)
- Query depth risks
- Large collection warnings
- Heavy model identification
- Component nesting depth

### 7. Best Practices Analysis (`bestPractices.ts`)
- Naming convention issues
- Missing unique constraints
- Enum suggestions for string fields
- Missing validation

### 8. Governance Analysis (`governance.ts`)
- Page vs content type patterns
- Field count analysis (one-off fields)
- Versioned models detection
- Template flexibility score
- Localization analysis
- Stage usage (draft/published ratio)
- Editor experience score

### 9. Architecture Analysis (`architecture.ts`)
- Enum analysis (single-value, unused, duplicates, overlaps)
- Variant analysis (custom variant models vs Hygraph variants)
- Layout/content separation scoring
- Component vs model recommendations
- Multi-tenant pattern detection
- Block consolidation opportunities

### 10. Content Strategy Analysis (`contentStrategy.ts`)
- **Architecture detection** with confidence scoring
- Model usage classification (active, underutilized, overloaded, duplicate)
- Component strategy assessment
- Editorial experience scoring
- Deep nesting identification
- Duplication patterns

### 11. Enum Architecture Analysis (`enumArchitecture.ts`)
- Multi-brand/region/tenant/site pattern detection
- Lightweight architecture flaw identification
- Enum categorization (styling, layout, content type, business logic, tenancy)
- Enum health (single-value, oversized, overlapping)
- Scalability scoring

### 12. Strategic Report Generator (`strategicReport.ts`)
- Executive summary with headline/subheadline
- Use case analysis with fit score
- Editorial experience assessment
- Content maturity evaluation
- Performance risk assessment
- Prioritized action plan generation

---

## Key Types

```typescript
// Architecture types detected
type ArchitectureType = 
  | 'ecommerce'
  | 'marketing-site'
  | 'multi-brand'
  | 'multi-tenant'
  | 'multi-region'
  | 'blog-publication'
  | 'saas-docs'
  | 'portfolio-showcase'
  | 'event-platform'
  | 'mixed-unknown';

// Assessment levels
type OverallAssessment = 'excellent' | 'good' | 'needs-attention' | 'critical';
type EditorialEfficiency = 'streamlined' | 'manageable' | 'cumbersome' | 'frustrating';
type ContentMaturity = 'basic' | 'intermediate' | 'advanced';
type RiskLevel = 'low' | 'medium' | 'high';
```

---

## UI Components

### Dashboard Tabs
1. **Executive Report** – Summary, schema overview, diagram, use case, editorial experience, maturity, performance
2. **Strategic Findings** – Detailed findings with effort/value ratings
3. **Action Plan** – Immediate, short-term, long-term recommendations
4. **Technical Details** – Raw metrics, category scores, all issues list

### Export
- PDF export via browser print dialog
- Professional formatting with all key sections
- Color-coded severity badges
- Print-optimized styles

---

## Deployment

- **Platform:** Vercel
- **Stable URL:** https://hygraph-schema-audit.vercel.app
- **Alias Command:** `npx vercel alias set <deployment-url> hygraph-schema-audit.vercel.app`

---

## Bugs Fixed

1. **Circular dependency misclassification** – Two-way refs were flagged as circular; now only 3+ node cycles flagged
2. **Type mismatch in contentStrategy** – `similarity` vs `sharedFields` property
3. **Architecture confidence type** – Was string, should be number (0-1)
4. **Missing `primary` property** – Used `.type` instead of `.primary` for architecture

---

## Future Considerations

- Enhance diagram to handle very large schemas (100+ models)
- Add CSV export option
- Consider Management API integration for deeper insights
- Add comparison mode (audit A vs audit B)
- Webhook integration for continuous monitoring




