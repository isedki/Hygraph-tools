# Hygraph Schema Audit Tool

A comprehensive, consultant-grade audit tool for Hygraph CMS schemas. Get professional analysis with specific, evidence-backed findings and actionable recommendations.

**Live Demo:** https://hygraph-schema-audit.vercel.app

---

## Features

### 6-Tab Dashboard

| Tab | What It Covers |
|-----|----------------|
| **Summary** | Overall score, key metrics, quick wins |
| **Structure** | Model organization, components, enums, naming |
| **Content** | Taxonomy, hierarchy, navigation, content distribution |
| **Reusability** | Shared content, components, content vs presentation |
| **Performance** | Nesting depth, query paths, large models |
| **Roadmap** | Prioritized action items |

### Comprehensive Checkpoints

Every finding is backed by specific examples from your schema:

- ✅ **Good** — Best practices followed
- ⚠️ **Warning** — Opportunities for improvement  
- ❌ **Issue** — Problems to address

### What Gets Analyzed

**Structure & Organization**
- Distinct content types
- Page vs content separation
- Redundant/overlapping models
- Component usage & reordering
- Rich text patterns
- Localization setup
- Recursive chains
- Asset centralization
- Enum analysis (single-value, oversized, duplicates, unused)

**Content Architecture**
- Taxonomy models (categories, tags)
- Hierarchy support (parent-child)
- Navigation readiness
- Content distribution per model
- Faceted filtering readiness

**Reusability**
- Shared content patterns
- Component reuse score
- Layout flexibility
- Content vs presentation field analysis
- Duplicate detection (enums, components, models)

**Performance**
- Nested components (with union detection)
- Nested models
- Large models (many fields)
- Missing required fields
- Deep query paths
- Circular references

### Export

Export your audit as **Notion-ready Markdown** with:
- All checkpoints and findings
- Content distribution tables
- Action items as checklists
- Strategic recommendations

---

## Getting Started

1. Go to https://hygraph-schema-audit.vercel.app
2. Enter your Hygraph **Content API Endpoint**
3. Optionally add an **Auth Token** for protected environments
4. Click **Run Audit**

### Required Permissions

- Read access to Content API
- Introspection enabled (default in Hygraph)

---

## System Filtering

The audit automatically excludes Hygraph system items:
- System models: Asset, User, ScheduledOperation, ScheduledRelease
- System components: RichText, Color, Location, etc.
- System enums: Stage, Locale, DocumentFileTypes, etc.

This ensures findings focus only on your custom schema.

---

## Development

### Setup

```bash
git clone <repo-url>
cd audit
npm install
npm run dev
```

### Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **GraphQL:** graphql-request

### Project Structure

```
src/
├── app/                      # Next.js pages
├── components/
│   ├── ConnectForm.tsx       # Connection form
│   └── Dashboard/
│       ├── Dashboard.tsx     # Main 6-tab layout
│       ├── CheckpointCard.tsx # Reusable checkpoint display
│       └── tabs/             # Tab components
│           ├── SummaryTab.tsx
│           ├── StructureTab.tsx
│           ├── ContentArchitectureTab.tsx
│           ├── ReusabilityTab.tsx
│           ├── PerformanceTab.tsx
│           └── RoadmapTab.tsx
└── lib/
    ├── types.ts              # TypeScript interfaces
    ├── export/
    │   └── generateMarkdown.ts # Notion-ready export
    ├── hygraph/
    │   └── introspection.ts  # Schema fetching
    └── analyzers/
        ├── index.ts          # Orchestrator
        ├── systemFilters.ts  # Exclude system items
        ├── structureOrganization.ts
        ├── contentArchitecture.ts
        ├── reusability.ts
        ├── performanceAssessment.ts
        ├── relationshipsAssessment.ts
        ├── duplicates.ts
        └── ...
```

---

## Deployment

Deployed automatically via Vercel on push to `main`.

```bash
# Manual deploy
vercel --prod
```

---

## License

MIT
