# Stable State - Pre-Academics/Grouped Events

**Branch:** `claude/stable-pre-academics-hI4IM`
**Base Commit:** `afee0b1` (Remove redundant 'Days Ahead' setting)
**Date:** December 26, 2025

---

## Overview

This branch contains the stable, production-ready state of the TPS Schedule system **before** the academics and grouped events features were added.

All experimental features (academics for students, grouped events for ALL/STAFF ONLY) have been removed and the system is in a clean, tested state.

---

## Files in Stable State

### Backend (Google Apps Script)

| File | Status | Description |
|------|--------|-------------|
| **Config.gs** | ✅ Stable | Configuration settings |
| **Main.gs** | ✅ Stable | API router and cache handler |
| **Enhanced.gs** | ✅ Reverted | Clean enhanced parser (no academics/grouped) |
| **BatchProcessor.gs** | ✅ Reverted | Clean batch processor (no academics/grouped) |
| **SmartSheetFinder.gs** | ✅ Stable | Smart sheet finding logic |
| **TriggerSetup.gs** | ✅ Stable | Trigger configuration |

### Frontend

| File | Status | Description |
|------|--------|-------------|
| **docs/index.html** | ✅ Reverted | Clean UI (no academics/grouped toggles) |
| **docs/.nojekyll** | ✅ Stable | GitHub Pages config |

---

## Features Included (Stable)

✅ **Smart Sheet Finding** - Automatically finds next available schedule sheet
✅ **Batch Processing** - Processes 7 days of schedules every 15 minutes
✅ **Caching** - 6-hour TTL, instant page loads
✅ **Overnight Skip** - Pauses processing 8 PM - 5 AM Pacific
✅ **Force Refresh** - Triple-tap header to trigger batch processing
✅ **Enhanced Parsing** - Structured event data with status flags
✅ **Mobile UI** - Responsive design optimized for phones/tablets

---

## Features Removed (From Experimental)

❌ **Academics** - Student class time blocks (Alpha/Bravo)
❌ **Grouped Events** - ALL and STAFF ONLY event handling
❌ **Event Categories** - eventCategory flags
❌ **Person Type Detection** - getPersonType() function
❌ **Toggle Switches** - Show Academics / Show Grouped Events
❌ **Client-Side Filtering** - Event filtering based on category

**Total Lines Removed:** 1,117 lines

---

## System Configuration

### Triggers
- **Single Trigger:** `batchProcessSchedule()` every 15 minutes
- **Work Hours Only:** 5 AM - 8 PM Pacific (skips overnight)
- **Quota Usage:** ~54 min/day (60% of daily limit)

### Cache
- **TTL:** 6 hours
- **Size:** ~0.70 MB (7% of limit)
- **Content:** 7 days of schedules for all people

### API
- **Endpoint:** `/exec?name=PersonName`
- **Parameters:**
  - `name` (required) - Person to search for
  - `version` (optional) - Processor version (default: "enhanced")
  - `forceRefresh` (optional) - Trigger batch processing

---

## Deployment Instructions

### Google Apps Script

1. Copy these files to your Apps Script project:
   ```
   Config.gs
   Main.gs
   Enhanced.gs
   BatchProcessor.gs
   SmartSheetFinder.gs
   TriggerSetup.gs
   ```

2. Update `Config.gs` with your spreadsheet ID

3. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone

4. Run `setupAllTriggers()` to enable batch processing

### Frontend (GitHub Pages)

1. Copy `docs/index.html` and `docs/.nojekyll` to your repository

2. Enable GitHub Pages:
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: main (or your branch)
   - Folder: /docs

3. Update `webAppUrl` in first-time setup or localStorage

---

## Testing

After deployment, verify:

```javascript
// In Apps Script console:

// Test batch processing
batchProcessSchedule();

// Check cache
viewAllCachedData();

// Test smart sheet finding
testFindNextSheet();
testSmartSheetRange();
```

---

## Known Issues

None - this is a stable, tested state.

---

## Version History

- **v6.2** - Simplified trigger system (single 15-min trigger)
- **v6.1** - Overnight hours optimization and force refresh
- **v6.0** - Smart sheet finding and batch processing

---

## Support

For issues:
1. Check execution logs in Apps Script
2. Run `viewAllCachedData()` to inspect cache
3. Verify triggers are running: `ScriptApp.getProjectTriggers()`
4. Check timezone in Config.gs

---

## Migration to Experimental

If you want to try the academics/grouped events features:

1. Switch to branch: `claude/analyze-tps-schedule-performance-hI4IM`
2. Deploy updated files
3. Enable feature toggles in UI settings

**Note:** Experimental branch is not fully tested and toggles may have issues.

---

**This stable state is ready for production deployment.** ✅
