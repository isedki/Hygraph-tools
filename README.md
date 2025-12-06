# Hygraph Schema Audit Tool

A comprehensive content strategy audit tool for Hygraph CMS schemas. Analyze your schema's health, identify improvement opportunities, and get actionable recommendations from a senior content strategist perspective.

**Live Demo:** https://hygraph-schema-audit.vercel.app

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Features](#features)
- [Understanding the Report](#understanding-the-report)
  - [Executive Summary](#executive-summary)
  - [Content Maturity Assessment](#content-maturity-assessment)
  - [Omnichannel Readiness](#omnichannel-readiness)
  - [Editorial Velocity](#editorial-velocity)
  - [Relationship Diagram](#relationship-diagram)
  - [Strategic Recommendations](#strategic-recommendations)
  - [Implementation Roadmap](#implementation-roadmap)
- [Scoring Methodology](#scoring-methodology)
- [Development](#development)
- [Deployment](#deployment)

---

## Overview

The Hygraph Schema Audit Tool connects to your Hygraph Content API and performs a deep analysis of your schema structure, content patterns, and editorial experience. It provides:

- **Content Maturity Assessment** — 5-level maturity scale with dimension breakdowns
- **Omnichannel Readiness** — Evaluate how well your content works across channels
- **Editorial Velocity Estimates** — Time-to-publish projections based on schema complexity
- **Relationship Visualization** — Interactive diagram of model connections
- **Strategic Recommendations** — Data-driven improvement suggestions with impact metrics
- **Implementation Roadmap** — Phased action plan for schema improvements

---

## Getting Started

### Connecting Your Schema

1. Navigate to the audit tool
2. Enter your Hygraph **Content API Endpoint** (e.g., `https://eu-central-1.cdn.hygraph.com/content/xxx/master`)
3. Optionally provide an **Auth Token** for protected environments
4. Click **Run Audit**

The tool uses GraphQL introspection to analyze your schema structure and queries your content to understand usage patterns.

### Required Permissions

- Read access to your Content API
- Introspection must be enabled (default in Hygraph)

---

## Features

### Schema Analysis
- Model, component, and enum inventory
- Field type distribution
- Relationship mapping (one-way, bidirectional)
- Nesting depth analysis
- Orphaned model detection

### Content Strategy Assessment
- Architecture type detection (e-commerce, marketing site, blog, multi-tenant, etc.)
- Use case fit scoring
- Component reuse analysis
- Duplication pattern identification

### Editorial Experience
- Model complexity scoring
- Required field ratio analysis
- Editor-friendly model identification
- Pain point detection

### Governance & Compliance
- Permission model review
- Localization assessment
- Naming convention analysis
- Documentation coverage

---

## Understanding the Report

### Executive Summary

The top-level assessment of your schema with:

| Metric | Description |
|--------|-------------|
| **Overall Assessment** | Excellent, Good, Needs Attention, or Critical |
| **Project Info** | Region, environment, and project ID extracted from endpoint |
| **Key Metrics** | Model count, component count, enum count, content entries |
| **Reuse Score** | Percentage indicating component utilization |

### Content Maturity Assessment

A **5-level maturity model** evaluating your schema's sophistication:

| Level | Label | Description |
|-------|-------|-------------|
| 1 | **Chaotic** | Ad-hoc structure, no patterns |
| 2 | **Reactive** | Supports current needs but inconsistent |
| 3 | **Defined** | Foundational standards exist |
| 4 | **Managed** | Clear structure, repeatable workflows |
| 5 | **Optimized** | Reusable patterns, strong governance |

#### Dimensions

| Dimension | What It Measures |
|-----------|------------------|
| **Structure** | Model organization, nesting depth, duplication |
| **Reuse** | Component utilization and pattern consistency |
| **Editorial Clarity** | Content/design separation, field intuitiveness, documentation |
| **Scalability** | Growth readiness and complexity management |

### Omnichannel Readiness

Evaluates how well your content can serve multiple channels (web, mobile, email, headless):

| Indicator | What It Checks |
|-----------|----------------|
| **Presentation-Free Content** | Fields without layout/styling concerns |
| **Semantic Structure** | Clear naming, proper typing |
| **Asset Flexibility** | Image variants, responsive patterns |
| **API Design** | Query depth, pagination patterns |

### Editorial Velocity

Estimates how long it takes editors to publish content:

- **Average Time-to-Publish** — Based on field counts, required ratios, and complexity
- **Model Breakdown** — Per-model time estimates with contributing factors
- **Bottlenecks** — Models that slow down content creation
- **Velocity Tips** — Specific recommendations to speed up editorial workflows

### Relationship Diagram

An interactive SVG visualization of your schema:

| Element | Color | Meaning |
|---------|-------|---------|
| **Blue circles** | Models | Primary content models |
| **Purple circles** | Components | Reusable content blocks |
| **Amber circles** | Enums | Controlled option sets |
| **⭐ Star** | Hub | Most connected models |
| **Solid lines** | References | Model relationships |
| **Green lines** | Bidirectional | Two-way references |

**Interactions:**
- Hover on nodes to highlight connections
- Click "Show all nodes" to expand the full schema

### Strategic Recommendations

Data-driven recommendations with metrics:

```
┌─────────────────────────────────────────────────────────┐
│ Increase Component Reuse                                │
│                                                         │
│ Finding: 3 field patterns duplicated across 8 models    │
│                                                         │
│ Recommendation: Create shared components for repeated   │
│ field patterns to reduce duplication and ensure         │
│ consistency.                                            │
│                                                         │
│ Impact: Editors work with consistent interfaces.        │
│ Updates propagate automatically.                        │
│                                                         │
│ Priority: HIGH    Effort: MEDIUM                        │
└─────────────────────────────────────────────────────────┘
```

Each recommendation includes:
- **Finding** — Specific data-driven observation
- **Recommendation** — Actionable improvement
- **Impact** — Business/editorial benefit
- **Priority** — High, Medium, or Low
- **Effort** — Low, Medium, or High

### Implementation Roadmap

A phased action plan:

| Phase | Timeline | Focus |
|-------|----------|-------|
| **Quick Wins** | 1-2 weeks | Low-effort, high-impact changes |
| **Foundation** | 2-4 weeks | Structural improvements |
| **Optimization** | 4-8 weeks | Advanced enhancements |
| **Maintenance** | Ongoing | Continuous improvement tasks |

---

## Scoring Methodology

### Content Maturity Score

The maturity level is calculated from four dimensions, each scored 20-95:

```
Average Score = (Structure + Reuse + Editorial Clarity + Scalability) / 4

Level 5: 85+    (Optimized)
Level 4: 70-84  (Managed)
Level 3: 55-69  (Defined)
Level 2: 40-54  (Reactive)
Level 1: <40    (Chaotic)
```

#### Structure Dimension

```
Base: 90
- Duplicate models: -6 each
- Orphan models: -4 each
- Deep nesting (>3 levels): -8 per level
- Circular relations: -6 each
+ Two-way references: +5
```

#### Reuse Dimension

```
Base: Component reuse score
+ Reuse rate × 10
- Unused components: -3 each
- Missing component opportunities: -2 each
```

#### Editorial Clarity Dimension

```
Base: 60
+ Concise models (avg ≤12 fields): +10
+ Balanced required fields (<30%): +5
+ Good documentation (>70% coverage): +10
+ Clear field naming: +5
+ Editor-friendly models: +8
- Complex models: -3 each
- Layout fields on content models: -5 to -20
```

#### Scalability Dimension

```
Base: 85
- Models over 40: -1.5 each
- Fields over 600: -(excess/20)
- Circular relations: -5 each
```

### Editorial Velocity Estimate

Time-to-publish is estimated per model:

```
Base: 2 minutes
+ Fields × 0.3 minutes
+ Required fields × 0.2 minutes
+ Nested components × 1.5 minutes
+ Relations × 0.5 minutes
```

---

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd audit

# Install dependencies
npm install

# Start development server
npm run dev
```

### Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS
- **GraphQL:** graphql-request
- **Deployment:** Vercel

### Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/
│   ├── ConnectForm.tsx     # Endpoint input form
│   └── Dashboard/          # Report components
│       ├── Dashboard.tsx
│       ├── ExecutiveSummary.tsx
│       ├── ContentMaturityGauge.tsx
│       ├── OmnichannelReadinessCard.tsx
│       ├── EditorialVelocityPanel.tsx
│       ├── RelationshipDiagram.tsx
│       ├── StrategicRecommendationsSection.tsx
│       ├── ImplementationRoadmap.tsx
│       └── ...
└── lib/
    ├── types.ts            # TypeScript interfaces
    ├── hygraph/
    │   └── introspection.ts  # Schema fetching
    └── analyzers/          # Analysis modules
        ├── index.ts
        ├── schema.ts
        ├── components.ts
        ├── contentStrategy.ts
        ├── contentMaturity.ts
        ├── omnichannelReadiness.ts
        ├── editorialVelocity.ts
        ├── permissionModel.ts
        ├── localization.ts
        ├── personalization.ts
        ├── strategicReport.ts
        └── ...
```

### Adding New Analyzers

1. Create analyzer file in `src/lib/analyzers/`
2. Export analysis function and types
3. Import in `strategicReport.ts`
4. Add results to `StrategicAuditReport` type
5. Create UI component in `src/components/Dashboard/`
6. Wire into `Dashboard.tsx`

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Set custom domain alias
vercel alias set <deployment-url> your-domain.vercel.app
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| None required | The tool uses client-provided endpoints | — |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request

---

## License

MIT License

---

## Support

For issues or feature requests, please open a GitHub issue.
