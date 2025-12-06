# 🔍 Schema Explorer + 📅 Content Calendar + 🏥 Content Health + 🖼️ Alt-Text Generator

**Analyze your Hygraph schema, plan your publishing, monitor content health, and generate AI-powered alt text.**

---

# Overview

This custom Hygraph app suite helps you understand your content model, plan your publishing schedule, and improve content accessibility.

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

**Alt-Text Generator - What you can do:**

→ Scan all images in your project (DRAFT + PUBLISHED)

→ Identify images missing alt text

→ Generate AI-powered alt text using Google Gemini (FREE)

→ Bulk generate alt text for hundreds of images

→ Pause, resume, and track progress

→ Apply alt text directly to Hygraph assets

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

☑️ Update existing content *(required for Alt-Text Generator)*

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

## 6️⃣ Add Alt-Text Generator Page Element (Optional)

```
Name:   Alt-Text Generator
Slug:   /alttext.html
```

## 7️⃣ Complete Setup

**Install** → Open app → Click **Complete Installation**

---

# Using the Alt-Text Generator

## Getting Started

### Step 1: Get a Google Gemini API Key (FREE)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key (starts with `AIza...`)

### Step 2: Connect to Your Project

Enter your credentials:

| Field | Description |
|-------|-------------|
| **Hygraph Endpoint** | Your Content API URL (auto-filled if running inside Hygraph) |
| **Hygraph Auth Token** | A PAT with read/write access to Assets |
| **Google Gemini API Key** | Your free API key from Step 1 |

Click **Connect & Scan Images**

## Dashboard Overview

After connecting, you'll see:

| Stat | Description |
|------|-------------|
| **Total Images** | All images in your project (DRAFT + PUBLISHED) |
| **Missing Alt Text** | Images without accessibility descriptions |
| **Has Alt Text** | Images with alt text already set |
| **Coverage** | Percentage of images with alt text |

## Filtering Images

Use the filter tabs to view:

- **⚠️ Missing Alt Text** — Images that need alt text (default)
- **✅ Has Alt Text** — Images with alt text already
- **📷 All Images** — Everything

## Generating Alt Text

### Single Image

1. Find an image missing alt text
2. Click **✨ Generate** on that image
3. Review the generated text in the textarea
4. Edit if needed
5. Click **✅ Apply** to save to Hygraph

### Bulk Generation

1. Click **✨ Generate All Missing** in the header
2. Confirm the number of images to process
3. Watch the progress modal showing:
   - Current image being processed
   - Progress bar (X / Y completed)
   - Estimated time remaining
4. Use **⏸️ Pause** to pause and resume later
5. Use **✖️ Cancel** to stop (progress is saved)

## Rate Limits & Timing

Google Gemini free tier has rate limits:

| Limit | Value |
|-------|-------|
| Requests per minute | 15 |
| Requests per day | 1,500 |

The app automatically adds 4-second delays between images to stay within limits.

**Estimated processing times:**

| Images | Time |
|--------|------|
| 15 | ~1 minute |
| 100 | ~7 minutes |
| 500 | ~35 minutes |
| 1,000 | ~67 minutes |

## Resume Interrupted Jobs

If you close the browser or pause generation:

1. Progress is automatically saved
2. When you return, you'll see a "Resume Available" notice
3. Click **Resume generation** to continue where you left off
4. Or click **Start fresh** to begin again

## Alt Text Field Detection

The app automatically detects which field your Asset model uses for alt text:

- `altText` (recommended)
- `alt`
- `alternativeText`
- `description`
- `caption`

If no alt text field is found, you'll see a warning to add one to your Asset model.

## Tips for Better Alt Text

The AI generates concise, descriptive alt text optimized for:

- **Accessibility** — Screen readers can describe images to visually impaired users
- **SEO** — Search engines index alt text for image search

**Good alt text:**
- Under 125 characters
- Describes the image content
- Doesn't start with "Image of" or "A photo of"

**Examples:**
- ✅ "Golden retriever puppy playing with a red ball in a sunny backyard"
- ✅ "Team meeting in modern conference room with glass walls"
- ❌ "Image of a dog"
- ❌ "photo.jpg"

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

- **Stale content** — Entries not updated in 90+ days
- **Unused models** — Models with zero content

## Stale Content

Shows all entries that haven't been updated longer than the threshold (default: 30 days).

**Configure the threshold:**
1. Enter a number in the "Older than X days" field
2. Click **Apply** or press Enter

Each entry shows:
- Entry title and model
- Last updated date
- Days since last update (color-coded by severity)

## Dashboard Cards

| Card | What it shows |
|------|---------------|
| **Draft vs Published** | Ratio of draft to published entries |
| **New This Week** | Entries created in the last 7 days |
| **Content Age** | Distribution of content by age |
| **Model with Most Entries** | Your largest content model |

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

## "How do I improve my image SEO?"

1. Open **Alt-Text Generator**
2. Filter by **Missing Alt Text**
3. Click **Generate All Missing**
4. Review and apply the generated alt text

---

# Technical Notes

**Authentication**
The app uses your Hygraph session automatically. A one-time PAT setup is required for schema introspection and asset updates.

**Query Limits**
Searches up to 100 entries per model. Alt-Text Generator fetches all images across both DRAFT and PUBLISHED stages.

**Nesting Depth**
Detects components nested up to 5 levels deep.

**AI Processing**
Alt text is generated using Google Gemini 2.0 Flash. Image data is sent to Google's API for processing.

**Data Privacy**
Schema and content queries are processed in your browser. Alt text generation sends image data to Google Gemini API.

---

# Troubleshooting

**"No entries found" but I know they exist**

→ Content must be in DRAFT or PUBLISHED stage

→ Check that the component is actually used (not just referenced in schema)

**App won't load**

→ Verify permissions are set correctly

→ Try clearing browser cache

**Missing some components**

→ System components (inputs, connections, etc.) are filtered by design

**Alt-Text Generator shows "No alt text field found"**

→ Add a String field named `altText` (or `alt`, `description`) to your Asset model in Hygraph

**Gemini API returns an error**

→ Check your API key is valid at [Google AI Studio](https://aistudio.google.com/apikey)

→ You may have hit daily rate limits (1,500 requests/day)

→ Wait until the next day or create a new API key

**Bulk generation is slow**

→ This is intentional! The 4-second delay prevents hitting Gemini's 15 requests/minute limit

→ For 1,000+ images, consider running overnight

---

# Version History

**v1.4.0** — Alt-Text Generator

- New Alt-Text Generator page element
- Scan all images (DRAFT + PUBLISHED stages)
- AI-powered alt text using Google Gemini 2.0 Flash (FREE)
- Bulk generation with progress tracking
- Pause/Resume/Cancel controls
- Progress persistence in localStorage
- Auto-detect alt text field on Asset model
- Rate limiting for Gemini free tier (15 RPM)

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
