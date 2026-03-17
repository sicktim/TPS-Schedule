# TPS Schedule System

A Google Apps Script web app that reads a Google Sheets "Whiteboard" squadron schedule and serves it as JSON for an individual schedule viewer.

## File Structure

| File | Purpose |
|------|---------|
| **Config.gs** | Settings, sheet structures, section row ranges |
| **Code.gs** | All application logic (router, batch processing, parsing, caching, utilities) |
| **docs/index.html** | Frontend — individual schedule view |

## API Endpoints

All endpoints are served by `doGet()` in Code.gs:

| Parameter | Description |
|-----------|-------------|
| `?name=X` | Individual schedule for person X (from per-person cache) |
| `?mode=full` | Full schedule data for all people (from per-sheet cache) |
| `?mode=benchmark` | Run pipeline and return timing data |
| `?mode=roster-check` | Check if the roster sheet exists |
| `?forceRefresh=true` | Trigger an immediate batch reprocess |
| `?viewCache=true` | Cache diagnostic summary |

## How It Works

### Batch Processing (every 15 minutes)

A time-based trigger runs `batchProcessSchedule()` which:

1. Reads the roster from the "Data v3" sheet
2. Auto-discovers non-roster people found in schedule sections
3. Processes 7 days of schedule sheets (one sheet per day, named like "Mon 16 Mar")
4. Parses four sections per sheet: Supervision, Flying Events, Ground Events, Not Available
5. Writes two caches:
   - **Approach A** — per-person cache (keyed by name, used by `?name=X`)
   - **Approach B** — per-sheet full data cache (used by `?mode=full`)

Batch processing completes in approximately 23 seconds (down from 2.2 minutes in v5).

### Optimized Sheet Reads

Each sheet read targets only the rows and columns needed per section (~8,580 cells per sheet vs ~422,910 previously). Section ranges are defined in Config.gs and vary based on a configurable structure-change date.

### Overnight Skip

Batch processing is skipped between 11 PM and 5 AM Pacific to conserve Apps Script quota.

### Individual Schedule View

`docs/index.html` fetches `?name=X` from the deployed web app and renders a card-based schedule grouped by day. It supports configurable day counts and auto-refreshes on the same 15-minute cycle.

## Features

- **Academics**: Parsed as data; filtered and displayed in the individual schedule view
- **Personnel notes**: Parsed as data from schedule sections
- **Roster change detection**: Warns when the roster sheet is missing or renamed
- **Non-roster discovery**: People appearing in schedule sections but not on the roster are automatically included in batch processing

## Configuration

All settings live in `Config.gs`, including:

- Spreadsheet ID and timezone
- Roster sheet name ("Data v3")
- Cache TTL (6 hours, the GAS maximum)
- Days to process (7)
- Section row/column ranges per sheet structure version

## Deployment

The Google Apps Script is deployed as a web app:

- **Execute as**: Owner account (has spreadsheet access)
- **Who has access**: Anyone (allows unauthenticated JSON fetches)

The frontend at `docs/index.html` is served via GitHub Pages.

---

**Version**: 6.2
