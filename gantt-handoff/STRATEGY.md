# Architecture Strategy: GitHub-Based vs Google Apps Script

## Current State: Google Apps Script

### How It Works

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Google Sheet   │────▶│  Google Apps Script  │────▶│  Static HTML    │
│  (Source Data)  │     │  (Bound Script)      │     │  (GitHub Pages) │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │
                        Runs inside Google
                        Uses CacheService
```

### Pros
- Direct access to sheet (no API key needed)
- Built-in caching (CacheService)
- No external infrastructure
- Already working for TPS-Schedule

### Cons
- 6-hour cache TTL max
- Tightly coupled to Google
- Hard to version/deploy changes
- Limited debugging
- Can't easily access historical data
- Script changes require manual deployment

---

## Option A: GitHub Actions + Static JSON

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Google Sheet   │────▶│  GitHub Actions      │────▶│  JSON Files     │
│  (Public View)  │     │  (Scheduled Job)     │     │  (In Repo)      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │                              │
                        Runs on schedule              Served via
                        Uses Sheets API              GitHub Pages
                                                           │
                                                           ▼
                                                    ┌─────────────────┐
                                                    │  Static HTML    │
                                                    │  (React App)    │
                                                    └─────────────────┘
```

### Implementation

1. **GitHub Action** runs every 15-30 minutes
2. Fetches data via Google Sheets API (public sheet = no auth needed)
3. Processes and saves as JSON files in repo
4. Commits and pushes changes
5. GitHub Pages serves both JSON and HTML

### Workflow File

```yaml
# .github/workflows/fetch-schedule.yml
name: Fetch Schedule Data

on:
  schedule:
    - cron: '*/15 6-20 * * 1-5'  # Every 15min, 6AM-8PM, Mon-Fri
  workflow_dispatch:  # Manual trigger

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Fetch and process data
        run: node scripts/fetch-schedule.js
        env:
          GOOGLE_SHEETS_ID: ${{ secrets.GOOGLE_SHEETS_ID }}

      - name: Commit changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add data/
          git diff --staged --quiet || git commit -m "Update schedule data"
          git push
```

### Fetch Script

```javascript
// scripts/fetch-schedule.js
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;

async function fetchSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  const text = await response.text();
  // Google returns JSONP, need to extract JSON
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}

async function main() {
  const sheets = await getAvailableSheets();
  const schedules = {};

  for (const sheet of sheets) {
    const data = await fetchSheetData(sheet.name);
    schedules[sheet.date] = processSheetData(data);
  }

  fs.writeFileSync('data/schedules.json', JSON.stringify(schedules, null, 2));
}
```

### Pros
- Version controlled data
- Easy to see changes over time
- No Google Apps Script needed
- Can store unlimited history
- Better debugging (local development)
- Free (GitHub Actions minutes)

### Cons
- 15-30 min data staleness
- Commits clutter git history
- GitHub Pages has soft rate limits
- Need to handle API rate limits

---

## Option B: Serverless Functions (Recommended)

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Google Sheet   │────▶│  Vercel/Netlify      │────▶│  React App      │
│  (Public View)  │     │  Edge Functions      │     │  (Same Deploy)  │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │
                        On-demand fetch
                        with edge caching
```

### Implementation

1. Deploy React app to Vercel/Netlify
2. API routes fetch from Google Sheets on demand
3. Edge caching handles repeated requests
4. No scheduled jobs needed

### Vercel API Route

```javascript
// api/schedule.js (Vercel)
export const config = {
  runtime: 'edge',
};

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const CACHE_TTL = 300; // 5 minutes

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const category = searchParams.get('category');

  // Fetch from Google Sheets
  const data = await fetchScheduleData(date);

  // Filter by category if specified
  const filtered = category
    ? data.filter(p => p.category === category)
    : data;

  return new Response(JSON.stringify(filtered), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `s-maxage=${CACHE_TTL}, stale-while-revalidate`,
    },
  });
}

async function fetchScheduleData(date) {
  const sheetName = formatSheetName(date);
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const text = await response.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));

  return processSheetData(json.table.rows);
}
```

### Pros
- Real-time data (with smart caching)
- No git history pollution
- Serverless = no infrastructure
- Free tier usually sufficient
- Better developer experience
- Easy local development

### Cons
- Dependency on Vercel/Netlify
- Cold start latency (minimal with edge)
- Need to handle errors gracefully

---

## Option C: Cloudflare Workers + KV

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Google Sheet   │────▶│  Cloudflare Worker   │────▶│  Cloudflare KV  │
│  (Public View)  │     │  (Edge Function)     │     │  (Key-Value)    │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                                           │
                                                    ┌─────────────────┐
                                                    │  Static Site    │
                                                    │  (Pages)        │
                                                    └─────────────────┘
```

### Implementation

```javascript
// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/schedule') {
      return handleScheduleRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleScheduleRequest(request, env) {
  const cacheKey = 'schedule-data';

  // Try KV cache first
  let data = await env.SCHEDULE_KV.get(cacheKey, 'json');

  if (!data) {
    // Fetch fresh data
    data = await fetchFromGoogleSheets();

    // Cache for 5 minutes
    await env.SCHEDULE_KV.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 300
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Pros
- Extremely fast (edge locations worldwide)
- KV storage for persistent cache
- Generous free tier
- No cold starts

### Cons
- Cloudflare-specific APIs
- KV has eventual consistency
- Learning curve if unfamiliar

---

## Accessing Public Google Sheets

### Method 1: JSONP Export (No Auth Required)

```javascript
const SHEET_ID = 'your-sheet-id';

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const text = await response.text();

  // Response is JSONP: google.visualization.Query.setResponse({...})
  // Extract the JSON object
  const jsonStr = text.substring(47).slice(0, -2);
  const data = JSON.parse(jsonStr);

  return data.table.rows.map(row =>
    row.c.map(cell => cell?.v ?? '')
  );
}
```

### Method 2: CSV Export (Simple)

```javascript
async function fetchSheetAsCSV(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const csv = await response.text();

  return parseCSV(csv);
}
```

### Method 3: Google Sheets API (Requires API Key)

```javascript
const API_KEY = 'your-api-key';

async function fetchSheetWithAPI(sheetName, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!${range}?key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.values;
}
```

### Getting Sheet List

```javascript
async function getSheetNames() {
  // This requires API key
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.sheets.map(s => s.properties.title);
}
```

---

## Recommendation

### For Your Use Case: **Option B (Vercel/Netlify)**

**Why:**

1. **Simplest setup** - Deploy once, it just works
2. **Fresh data** - No stale cache concerns
3. **Free tier** - Vercel free tier handles this easily
4. **Local dev** - `vercel dev` for local testing
5. **No git pollution** - Data isn't committed to repo
6. **Historical data** - Fetch any sheet by date
7. **No secrets exposed** - Sheet ID stays server-side

### Quick Start with Vercel

```bash
# Create new project
npx create-next-app@latest tps-gantt --typescript --tailwind

# Add API route
mkdir -p pages/api
# Create pages/api/schedule.ts

# Deploy
vercel
```

### Project Structure

```
tps-gantt/
├── pages/
│   ├── api/
│   │   ├── schedule.ts      # Fetch schedule data
│   │   ├── roster.ts        # Fetch roster/categories
│   │   └── sheets.ts        # List available sheets
│   └── index.tsx            # Gantt chart UI
├── components/
│   ├── GanttChart.tsx
│   ├── CategoryFilter.tsx
│   └── WeekSelector.tsx
├── lib/
│   ├── sheets.ts            # Google Sheets fetching
│   ├── parser.ts            # Data parsing logic
│   └── types.ts             # TypeScript types
└── public/
    └── ...
```

---

## Migration Path

### Phase 1: Proof of Concept
1. Create new Vercel project
2. Implement basic sheet fetching
3. Build simple Gantt UI
4. Test with real data

### Phase 2: Feature Parity
1. Add multi-select category filter
2. Implement 2-week date range
3. Add all event types
4. Style and polish

### Phase 3: Enhancements
1. Add print/export functionality
2. Implement data caching
3. Add error handling
4. Performance optimization

### Phase 4: Optional
1. Historical data storage
2. Schedule change tracking
3. Notifications
