# TPS Schedule - Smart Schedule Display System

**Version:** 6.3 (Academics & Grouped Events)
**Last Updated:** December 26, 2025
**Status:** ✅ Production Ready

---

## 📋 Overview

TPS Schedule is an intelligent squadron schedule display system that:
- **Automatically finds** the next available schedule sheet (handles holidays/gaps)
- **Displays N days** of schedule starting from that sheet
- **Caches results** for instant page loads (<100ms)
- **Updates automatically** via background batch processing
- **Shows academics** for Alpha/Bravo students (optional)
- **Shows grouped events** (ALL, STAFF ONLY) based on person type (optional)

### Key Features

✅ **Smart Sheet Finding** - Automatically starts from next available sheet
✅ **Handles Gaps** - Works with weekends, holidays, irregular schedules
✅ **Instant Loads** - <100ms response time via cache
✅ **Auto-Updates** - Single trigger runs every 15 minutes (work hours only)
✅ **Overnight Skip** - Automatically pauses 8 PM - 5 AM Pacific to save quota
✅ **Mobile Optimized** - Works great on phones/tablets
✅ **Force Refresh** - Triple-tap header to trigger batch processing
✅ **Academics Display** - Shows class times for Alpha/Bravo students
✅ **Grouped Events** - Shows ALL and STAFF ONLY events based on person type

---

## 📁 Project Structure

### Active Files (Google Apps Script)

| File | Purpose | Status |
|------|---------|--------|
| **Main.gs** | API router and cache handler | ✅ Active |
| **Config.gs** | Configuration (spreadsheet ID, timezone) | ✅ Active |
| **Enhanced.gs** | Enhanced data processor with academics/grouped events | ✅ Active |
| **BatchProcessor.gs** | Background batch processing | ✅ Active |
| **SmartSheetFinder.gs** | Intelligent sheet discovery | ✅ Active |
| **TriggerSetup.gs** | Automated trigger configuration | ✅ Active |

### Active Files (Frontend)

| File | Purpose |
|------|---------|
| **docs/index.html** | Mobile-friendly web interface with academics/grouped events support |

### Documentation

| File | Purpose |
|------|---------|
| **README.md** | This file - project overview |
| **DEPLOYMENT.md** | Step-by-step deployment guide |

### Archive

| Folder | Contents |
|--------|----------|
| **archive/** | Obsolete files from previous versions |
| **archive/old-versions/** | TPS-Schedule-OPTIMIZED.gs, TPS-Schedule-SIMPLIFIED.gs |

---

## 🚀 Quick Start

### 1. Deploy to Google Apps Script

1. Create new Google Apps Script project
2. Copy these files from root directory:
   - Config.gs
   - Main.gs
   - Enhanced.gs
   - BatchProcessor.gs
   - SmartSheetFinder.gs
   - TriggerSetup.gs

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

// Test person type detection
testPersonTypeDetection(); // Verify person categories work

// View cached data
viewAllCachedData();      // See all cached schedules
viewAllCachedData('Vantiger'); // See specific person's cache
```

### 3. Deploy Frontend

Option A: **GitHub Pages** (recommended)
- Push `docs/index.html` to GitHub
- Enable GitHub Pages from `docs/` folder
- Update `webAppUrl` in localStorage or first-time setup

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
  4. Extract people from sheets
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

### Academics Feature

Shows hardcoded class times for students based on their type:

**Alpha Students:** 07:30-17:00 (single block)
**Bravo Students:**
  - 07:00-07:30
  - 08:30-09:30
  - 15:00-17:00

**Toggle:** Off by default, user can enable in settings

### Grouped Events Feature

Shows events marked with group indicators in the person/crew column:

**ALL:** Shows to everyone
**STAFF ONLY:** Shows only to:
  - Staff IP
  - Staff IFTE/ICSO
  - STC Staff
  - Attached/Support

**Toggle:** Off by default, user can enable in settings

**How it works:**
1. Backend searches person/crew columns for "ALL", "STAFF ONLY"
2. Checks if person should see event via `shouldShowGroupedEvent()`
3. If yes, adds event to their schedule with proper details

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

---

## 🐛 Troubleshooting

### Cache Not Updating

```javascript
// Check trigger status
const triggers = ScriptApp.getProjectTriggers();
console.log('Active triggers:', triggers.length);

// Manually refresh cache
batchProcessSchedule();
```

### No Sheets Found

```javascript
// Check what sheets are available
const sheets = getSmartSheetRange(7);
console.log('Available sheets:', sheets.map(s => s.sheetName));

// Test smart sheet finder
testFindNextSheet();
```

### Academics/Grouped Events Not Showing

```javascript
// Test person type detection
testPersonTypeDetection();

// View cached data for a person
viewAllCachedData('PersonName');

// Test academics feature
testAcademicsFeature();

// Test grouped events feature
testGroupedEventsFeature();
```

---

## 📚 API Documentation

### Web App Endpoint

```
GET https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?name=Sick&days=7&showAcademics=true&showGroupedEvents=true
```

**Parameters:**
- `name` (required): Person's name to search for
- `days` (optional): Number of days to display (default: 7)
- `version` (optional): Processor version (default: "simplified")
- `showAcademics` (optional): Show academic times for students (default: false)
- `showGroupedEvents` (optional): Show ALL/STAFF ONLY events (default: false)
- `forceRefresh` (optional): Trigger batch processing (default: false)

**Response:**
```json
{
  "searchName": "Sick",
  "events": [
    {
      "date": "2026-01-05",
      "dayName": "Monday",
      "sheetName": "Mon 5 Jan",
      "events": [
        {
          "time": "0700-0730",
          "description": "ACADEMICS | Bravo | 07:00-07:30",
          "enhanced": {
            "section": "Academics",
            "type": "Bravo",
            "start": "07:00",
            "end": "07:30",
            "status": "Effective"
          }
        },
        {
          "time": "1000",
          "description": "Staff Meeting | ALL",
          "enhanced": {
            "section": "Ground Events",
            "event": "Staff Meeting",
            "start": "1000",
            "end": "1100",
            "groupType": "ALL",
            "status": {
              "effective": true,
              "cancelled": false,
              "partiallyEffective": false
            }
          }
        }
      ]
    }
  ],
  "totalEvents": 2,
  "lastUpdated": "2025-12-26T12:30:00.000Z",
  "version": "5.0",
  "enhanced": true
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

## 📝 Change Log

### Version 6.3 (December 26, 2025)
- ✨ **Academics Feature** - Show class times for Alpha/Bravo students
- ✨ **Grouped Events Feature** - Show ALL and STAFF ONLY events
- 🔧 **Structure-Aware Parsing** - Correctly extract grouped events from all sections
- 🎨 **Frontend Display** - Added rendering for academics and grouped events
- 📚 **Archived Old Files** - Moved TPS-Schedule-OPTIMIZED.gs, TPS-Schedule-SIMPLIFIED.gs, DiagnosticChecks.gs to archive/
- 🧹 **Cleaned Documentation** - Updated README and archived outdated docs

### Version 6.2 (December 26, 2025)
- 🔧 **Simplified trigger system** - Removed tiered processing, single trigger only
- 🗑️ **Removed legacy functions** - Cleaned up `batchProcessRecent()` and `batchProcessUpcoming()`
- 📚 **Updated documentation** - Clarified quota usage and trigger configuration

### Version 6.1 (December 26, 2025)
- ✨ Added overnight hours optimization (8 PM - 5 AM Pacific skip)
- ✨ Implemented force refresh (triple-tap header triggers batch processing)
- ⚡ Reduced quota usage by 36% with overnight skip

### Version 6.0 (December 26, 2025)
- ✨ Implemented smart sheet finding logic
- ✨ Removed test date functionality (always live dates)
- ✨ Simplified batch processing (single 15-min trigger)

---

## 📄 License

This project is provided as-is for use within the organization. Modify and deploy as needed.

---

## 🤝 Contributing

To make changes:
1. Test thoroughly with test functions
2. Update documentation
3. Maintain backwards compatibility where possible
4. Archive obsolete files to `archive/` folder

---

## 📞 Contact

For issues or questions:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for setup help
2. Run test functions and review output
3. Check execution logs in Apps Script
4. Use `viewAllCachedData()` to inspect cache

---

**Happy Scheduling! 📅**
