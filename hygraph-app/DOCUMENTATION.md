# 🔍 Schema Explorer + 📅 Content Calendar + 🏥 Content Health

**Analyze your Hygraph schema, plan your publishing, and monitor content health.**

---

# Overview

This custom Hygraph app suite helps you understand your content model and plan your publishing schedule.

**Schema Explorer - What you can do:**

→ Browse components, models, and enums

→ Find every entry using a specific component

→ Detect deeply nested component usage

→ Identify unused schema elements

→ Navigate directly to entries in Hygraph

**Content Calendar - What you can do:**

→ View scheduled content on Month / Week / Day views

→ See all entries scheduled via Hygraph's native Releases

→ Jump to any date with the built-in date picker

→ Filter by content model (dropdown, alphabetically sorted)

→ Hover to see entry details (release name, status, created date)

→ Click "Open in Hygraph" to edit entries directly

**Content Health - What you can do:**

→ Find entries stuck in draft for too long (configurable days)

→ Identify unused models with zero entries

→ See overall content health score

→ Quick links to fix problematic entries

---

# Installation

## 1️⃣ Create Custom App

Navigate to **Apps** → **Create App** → **Custom App**

**App Configuration**

```
Name:     Schema Explorer
API ID:   schema-explorer
App URL:  https://hygraph-app-static.vercel.app
```

## 2️⃣ Add Page Element

```
Name:   Schema Explorer
Slug:   /page.html
```

## 3️⃣ Set Permissions

Enable under **Content API**:

☑️ Read existing content

☑️ Read existing environments

☑️ Read content model / components

## 4️⃣ Add Calendar Page Element (Optional)

```
Name:   Content Calendar
Slug:   /calendar.html
```

## 5️⃣ Add Health Dashboard Page Element (Optional)

```
Name:   Content Health
Slug:   /health.html
```

## 6️⃣ Complete Setup

**Install** → Open app → Click **Complete Installation**

---

# Using the Calendar

## Calendar Views

Switch between views using the toggle buttons:

| View | Best For |
|------|----------|
| **Month** | Overview of the full month, shows up to 5 entries per day |
| **Week** | See all entries for a 7-day period |
| **Day** | Detailed view of a single day with all entries |

## Navigation

- **◀ ▶ arrows** — Navigate to previous/next period (month, week, or day)
- **Today button** — Jump back to current date
- **📅 Calendar icon** — Click to open date picker and jump to any date
- **Click the date title** — Also opens the date picker

## Entry Details (Hover)

Hover over any entry to see a popup with:

- 📅 Scheduled publish date & time
- Entry title and model name
- Release name (from Hygraph Releases)
- Status indicator
- Created date (if available)
- **"Open in Hygraph →"** link to edit the entry

## Model Filters

Click **"Filter by: All Models"** dropdown to filter by content type.

Models are sorted alphabetically for easy navigation.

## How Scheduling Works

The calendar uses **Hygraph's native Releases** feature:

1. Go to any content entry in Hygraph
2. Click **Schedule** → **Add to Release**
3. Create or select a Release with a future date
4. The entry will appear on the calendar at that date

No custom fields required — works with Hygraph's built-in scheduling!

---

# Using the Content Health Dashboard

## Health Score

The dashboard calculates an overall health score (0-100%) based on:

- **Stale drafts** — Entries sitting in draft too long
- **Unused models** — Models with zero content

## Stale Drafts

Shows all entries that have been in draft stage longer than the threshold (default: 30 days).

**Configure the threshold:**
1. Enter a number in the "Older than X days" field
2. Click **Apply** or press Enter

Each entry shows:
- Entry title and model
- Created date
- Days in draft (color-coded by severity)
- **"Open →"** button to fix in Hygraph

## Unused Models

Lists all models that have zero entries created.

Consider:
- Removing unused models to simplify your schema
- Or adding content if the model is needed

---

# Using the Schema Explorer

## Search Tab

**Finding where a component is used:**

1. Select a component from the sidebar
2. Click **Find Content Usage**
3. View all entries that use this component

The search detects components even when nested 5+ levels deep inside other components.

## Tree View

Click the 📁 icon to switch to tree view.

See your models as folders with their components, relations, and enums organized underneath.

```
Page
├── Components
│   ├── HeroSection
│   └── ContentBlock
├── Relations  
│   └── Author
└── Enums
    └── PageType
```

## Statistics Tab

Click **Scan All Usage** to analyze your entire schema.

**What you'll see:**

- Total components and enums
- Usage count per element
- Which models use each element
- List of unused elements

---

# Common Tasks

## "Can I safely delete this component?"

1. Search for the component
2. If **No content entries found** → Safe to delete
3. If entries exist → Review them first

## "Which components are never used?"

1. Go to **Statistics** tab
2. Click **Scan All Usage**
3. Scroll to **Unused Elements**

## "What uses this enum value?"

1. Filter by **Enums**
2. Select the enum
3. Click **Find Content Usage**

---

# Technical Notes

**Authentication**
The app uses your Hygraph session automatically. A one-time PAT setup is required for schema introspection.

**Query Limits**
Searches up to 100 entries per model in DRAFT stage.

**Nesting Depth**
Detects components nested up to 5 levels deep.

**Data Privacy**
All processing happens in your browser. No data is sent to external servers.

---

# Troubleshooting

**"No entries found" but I know they exist**

→ Content must be in DRAFT stage

→ Check that the component is actually used (not just referenced in schema)

**App won't load**

→ Verify permissions are set correctly

→ Try clearing browser cache

**Missing some components**

→ System components (inputs, connections, etc.) are filtered by design

---

# Version History

**v1.3.0** — Content Health Dashboard

- New Content Health page element
- Find entries stuck in draft for X+ days
- Identify unused models (zero entries)
- Overall health score calculation
- Configurable stale draft threshold
- Direct links to fix entries in Hygraph

**v1.2.0** — Calendar Enhancements

- Month / Week / Day view toggle
- Date picker for quick navigation (click 📅 icon or date title)
- Hover popup with entry details (release, status, created date)
- Model filter dropdown (alphabetically sorted)
- "Open in Hygraph" links in popup
- Uses native Hygraph Releases (no custom fields required)

**v1.1.0** — Content Calendar

- Visual calendar view for scheduled content
- Drag-and-drop rescheduling
- Model filters
- Integration with Hygraph Releases

**v1.0.0** — Initial Release

- Schema browser with list and tree views
- Component and enum content search  
- Deep nested detection
- Usage statistics dashboard
- Direct Hygraph links
