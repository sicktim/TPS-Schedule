# TPS Class Gantt Chart - Handoff Documentation

This folder contains comprehensive documentation for building a standalone Class Gantt Chart application that extracts data from the TPS Schedule Google Sheet.

## Quick Links

| Document | Purpose |
|----------|---------|
| [CONTEXT.md](./CONTEXT.md) | Full project background, what exists, what's needed |
| [DATA-STRUCTURES.md](./DATA-STRUCTURES.md) | Cache formats, API responses, sheet structure |
| [STRATEGY.md](./STRATEGY.md) | GitHub vs Google Apps Script comparison |
| [code-examples/](./code-examples/) | Relevant code snippets to adapt |

## Project Goal

Build a Class Gantt Chart view that displays:
- **Entire class schedules** for a 2-week window (1 week historical + 1 week future)
- **Mon-Fri columns** with time-based event bars
- **Alphabetically sorted roster** rows
- **Event types**: Flying, Ground, NA, Supervision
- **Multi-select category filter** (Class 26A, 26B, FTC/STC splits, staff groups)

## Key Decision: Where to Run the Backend

### Option A: GitHub Actions + Static Hosting
- Extract data via Google Sheets API on a schedule
- Cache as JSON files in repo or external service
- Serve via GitHub Pages or similar

### Option B: Serverless Functions (Vercel/Netlify/Cloudflare)
- API routes that fetch from Google Sheets on demand
- Built-in caching, no Google Apps Script needed

### Option C: Keep Google Apps Script (Current Approach)
- Already working, but tightly coupled to TPS-Schedule
- Harder to extend for historical data needs

See [STRATEGY.md](./STRATEGY.md) for detailed comparison.

## Source Google Sheet

- **URL**: Publicly viewable TPS Schedule spreadsheet
- **Structure**: One sheet per day (named by date, e.g., "6 Jan" or "6 Jan 25")
- **Sections**: Supervision, Flying Events, Ground Events, NA, Roster

## Getting Started in New Session

When starting a new Claude Code session, provide this context:

```
I'm building a Class Gantt Chart application that displays TPS (Test Pilot School)
class schedules in a weekly Gantt-style view.

Key requirements:
1. Extract data from a publicly viewable Google Sheet
2. Display 2 weeks of data (1 week past + 1 week future)
3. Show all people in selected categories, even without events
4. Multi-select filter by class/category
5. Mon-Fri columns with time-based event positioning

I have handoff documentation in the gantt-handoff/ folder with:
- CONTEXT.md - Full background
- DATA-STRUCTURES.md - Data formats
- STRATEGY.md - Architecture options
- code-examples/ - Working code to adapt

Please review these files and help me build this application.
```

## Files to Review First

1. **CONTEXT.md** - Understand the full picture
2. **DATA-STRUCTURES.md** - See exact data formats
3. **STRATEGY.md** - Choose your architecture
4. **code-examples/sheet-parser.js** - Core parsing logic
5. **code-examples/gantt-component.jsx** - React Gantt UI
