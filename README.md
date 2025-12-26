# TPS Schedule - Smart Schedule Display System

**Version:** 6.2 (Simplified Single Trigger)
**Last Updated:** December 26, 2025
**Status:** ✅ Production Ready

---

## 📋 Overview

TPS Schedule is an intelligent squadron schedule display system that:
- **Automatically finds** the next available schedule sheet (handles holidays/gaps)
- **Displays N days** of schedule starting from that sheet
- **Caches results** for instant page loads (<100ms)
- **Updates automatically** via background batch processing

### Key Features

✅ **Smart Sheet Finding** - Automatically starts from next available sheet
✅ **Handles Gaps** - Works with weekends, holidays, irregular schedules
✅ **Instant Loads** - <100ms response time via cache
✅ **Auto-Updates** - Single trigger runs every 15 minutes (work hours only)
✅ **Overnight Skip** - Automatically pauses 8 PM - 5 AM Pacific to save quota
✅ **Mobile Optimized** - Works great on phones/tablets
✅ **Hidden Refresh** - Triple-tap header to re-fetch from cache (same as refresh button)
✅ **No Test Modes** - Always shows live, current data

---

## 📁 Project Structure

### Active Files (Google Apps Script)

| File | Purpose | Status |
|------|---------|--------|
| **Main.gs** | API router and cache handler | ✅ Active |
| **Config.gs** | Configuration (spreadsheet ID, timezone) | ✅ Active |
| **BatchProcessor.gs** | Background batch processing | ✅ Active |
| **SmartSheetFinder.gs** | Intelligent sheet discovery | ✅ Active |
| **TriggerSetup.gs** | Automated trigger configuration | ✅ Active |
| **DiagnosticChecks.gs** | Troubleshooting utilities | ✅ Active |
| **Enhanced.gs** | Enhanced data processor | ✅ Active |
| **TPS-Schedule-SIMPLIFIED.gs** | Simplified processor (fallback) | ✅ Active |
| **TPS-Schedule-OPTIMIZED.gs** | Optimized processor (fallback) | ✅ Active |

### Active Files (Frontend)

| File | Purpose |
|------|---------|
| **docs/index.html** | Mobile-friendly web interface |
| **WebApp.html** | Alternative Apps Script HTML deployment |

### Documentation

| File | Purpose |
|------|---------|
| **README.md** | This file - project overview |
| **DEPLOYMENT.md** | Step-by-step deployment guide |
| **PERFORMANCE_ANALYSIS.md** | Performance metrics and analysis |

### Archive

| Folder | Contents |
|--------|----------|
| **archive/** | Obsolete files from previous versions |

---

## 🚀 Quick Start

### 1. Deploy to Google Apps Script

1. Create new Google Apps Script project
2. Copy these files from root directory:
   - Config.gs
   - Main.gs
   - BatchProcessor.gs
   - SmartSheetFinder.gs
   - TriggerSetup.gs
   - DiagnosticChecks.gs
   - Enhanced.gs
   - TPS-Schedule-SIMPLIFIED.gs
   - TPS-Schedule-OPTIMIZED.gs

3. Update `Config.gs` with your spreadsheet ID
4. Deploy as Web App
5. Run `setupAllTriggers()` to enable batch processing

**See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.**

### 2. Test the System

```javascript
// In Google Apps Script editor:

// Test smart sheet finding
testFindNextSheet();      // Find next available sheet
testSmartSheetRange();    // Get 7 days worth

// Test batch processing
batchProcessSchedule();   // Run manual batch update

// Check system health
runAllDiagnostics();      // Full diagnostic check
```

### 3. Deploy Frontend

Option A: **GitHub Pages** (recommended)
- Push `docs/index.html` to GitHub
- Enable GitHub Pages from `docs/` folder

Option B: **Apps Script HTML**
- Copy `WebApp.html` to your Apps Script project
- Deploy as Web App

---

## 🎯 How It Works

### Smart Sheet Finding Logic

**Example Scenario:**
- Today: December 25, 2025 (Christmas)
- User requests: 7 days of schedule
- Sheets available: Jan 5, 6, 7, 8, 9, 12, 13

**What happens:**
1. System looks for sheet matching "Dec 25" → Not found
2. System searches forward and finds "Jan 5" → First available
3. System displays: Jan 5, 6, 7, 8, 9 (skips 10-11 weekend), 12, 13
4. Total: 7 days of schedule starting from next available sheet

### Batch Processing Flow

```
Single trigger every 15 minutes (work hours only):
  1. Check if overnight hours (8 PM - 5 AM) → Skip if yes
  2. Find next available sheet
  3. Get 7 days worth of available sheets
  4. Extract people from sheets (292 people)
  5. Process each sheet for each person
  6. Cache results (6-hour TTL)
  7. Update metadata
```

### API Request Flow

```
User requests schedule:
  1. Check CacheService for person → Found! Return in <100ms ✅
  2. If cache miss → Process in real-time (~30s)
  3. Cache result for next request
```

---

## 🔧 Configuration

### Config.gs

```javascript
const SEARCH_CONFIG = {
  spreadsheetId: 'YOUR_SPREADSHEET_ID_HERE',
  timezone: 'America/Los_Angeles',  // Adjust to your timezone
  searchTerm: 'Sick',  // Default search name
  testMode: false,  // Always false in production
  testDate: null    // Not used (legacy)
};
```

### Trigger Schedule

| Trigger | Function | Frequency | Purpose |
|---------|----------|-----------|---------|
| Batch Process | `batchProcessSchedule()` | Every 15 min (work hours only) | Update cache with fresh data |

**Work Hours:** 5 AM - 8 PM Pacific (automatically skips overnight)

**Quota Usage:** ~54 min/day (60% of 90 min daily limit)
- Skips overnight hours (8 PM - 5 AM) to save 36% quota
- Processes only when schedules can change

---

## 📊 Performance Metrics

### Speed
- **Cache Hit:** <100ms (99% of requests)
- **Cache Miss:** ~30s (initial request)
- **Batch Process:** ~0.9 minutes for 7 days

### Resource Usage
- **Cache Size:** ~0.70 MB (7% of 10 MB limit)
- **Spreadsheet Reads:** ~720/day (3.6% of 20,000 limit) - reduced by overnight skip
- **Trigger Runtime:** ~54 min/day (60% of 90 min limit) - includes overnight skip savings

**See [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md) for detailed metrics.**

---

## 🐛 Troubleshooting

### Cache Not Updating

```javascript
// Check trigger status
checkTriggerExecutionStatus();

// Manually refresh cache
batchProcessSchedule();
```

### No Sheets Found

```javascript
// Check what sheets are available
checkAvailableSheets();

// Test smart sheet finder
testFindNextSheet();
```

### Date Mismatch

```javascript
// Check date formats in cache
checkCacheDateFormats();

// Verify timezone settings
console.log(SEARCH_CONFIG.timezone);
```

**Run `runAllDiagnostics()` for comprehensive health check.**

---

## 📚 API Documentation

### Web App Endpoint

```
GET https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?name=Sick&days=7
```

**Parameters:**
- `name` (required): Person's name to search for
- `days` (optional): Number of days to display (default: 7)
- `version` (optional): Processor version (simplified/optimized/enhanced)

**Response:**
```json
{
  "person": "Sick",
  "class": "26A",
  "type": "Students (Bravo)",
  "events": [
    {
      "date": "2026-01-05",
      "day": "Monday",
      "time": "1400-1600",
      "event": "FORM/1",
      "section": "Flying Events",
      ...
    }
  ],
  "days": ["2026-01-05", "2026-01-06", ...],
  "lastUpdated": "2025-12-26T12:30:00.000Z",
  "version": "5.0-smart",
  "tier": "all",
  "cacheUpdated": "2025-12-26T12:30:00.000Z"
}
```

---

## 🔐 Security & Privacy

- **No Authentication:** Anyone with the URL can view schedules
- **Read-Only:** System only reads data, never writes to sheets
- **No User Data:** No personal data is collected or stored
- **Cache Only:** Temporary storage (6-hour TTL)

**Note:** If you need authentication, consider deploying with "Execute as: User accessing the web app" instead of "Me".

---

## 🆘 Support & Maintenance

### Diagnostic Functions

| Function | Purpose |
|----------|---------|
| `runAllDiagnostics()` | Complete system health check |
| `checkTriggerExecutionStatus()` | Verify triggers are running |
| `checkAvailableSheets()` | See what sheets exist |
| `checkCacheDateFormats()` | Inspect cache data |
| `testFindNextSheet()` | Test smart sheet finder |
| `testSmartSheetRange()` | Test range finding |

### Common Issues

**Problem:** "Failed to fetch" error
**Solution:** Check API URL in localStorage, clear cache

**Problem:** Cache is stale (2+ hours old)
**Solution:** Verify triggers are running, check execution logs

**Problem:** Events showing on wrong dates
**Solution:** Check timezone in Config.gs, run `checkCacheDateFormats()`

---

## 📝 Change Log

### Version 6.2 (December 26, 2025)
- 🔧 **Simplified trigger system** - Removed tiered processing, single trigger only
- 🗑️ **Removed legacy functions** - Cleaned up `batchProcessRecent()` and `batchProcessUpcoming()`
- 📚 **Updated documentation** - Clarified quota usage and trigger configuration
- ✅ **Eliminated redundancy** - Fixed issue where both triggers ran same process

### Version 6.1 (December 26, 2025)
- ✨ Added overnight hours optimization (8 PM - 5 AM Pacific skip)
- ✨ Implemented hidden manual refresh (triple-tap header, re-fetches from cache)
- ⚡ Reduced quota usage by 36% with overnight skip
- 🎨 Updated status bar to "Data Updated: MM/DD/YY H:MM AM/PM" format
- 🎨 Added "Next update: 5:00 AM" indicator during overnight hours
- 📚 Updated documentation with quota calculations and hidden features

### Version 6.0 (December 26, 2025)
- ✨ Implemented smart sheet finding logic
- ✨ Removed test date functionality (always live dates)
- ✨ Simplified batch processing (single 15-min trigger)
- ✨ Added comprehensive diagnostic tools
- 🐛 Fixed date display offset bug
- 🎨 Added first-time setup modal
- 📚 Reorganized project structure
- 📚 Updated all documentation

### Version 5.0 (December 24, 2025)
- ✨ Implemented tiered batch processing
- ✨ Added cache metadata display in UI
- ⚡ Achieved 600x performance improvement

### Version 4.0 (December 2025)
- ✨ Simplified version with no caching
- ⚡ 2.5x faster than original

---

## 📄 License

This project is provided as-is for use within the organization. Modify and deploy as needed.

---

## 🤝 Contributing

To make changes:
1. Test thoroughly with diagnostic functions
2. Update documentation
3. Maintain backwards compatibility where possible
4. Archive obsolete files to `archive/` folder

---

## 📞 Contact

For issues or questions:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for setup help
2. Run `runAllDiagnostics()` and review output
3. Check execution logs in Apps Script

---

**Happy Scheduling! 📅**
