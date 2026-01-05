# TPS Schedule System Architecture

A real-time squadron schedule viewer that extracts data from a Google Sheets whiteboard and displays it in a modern web interface.

---

## 📊 **System Overview**

```
┌─────────────────────┐
│  Google Sheets      │
│  "Whiteboard"       │
│  (Data Source)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   GOOGLE APPS SCRIPT                        │
│                    (Backend Engine)                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Main.gs    │  │ TriggerSetup │  │BatchProcessor│     │
│  │   (Router)   │→ │  .gs         │  │    .gs       │     │
│  │              │  │ (SIMPLIFIED) │  │  (Caching)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                           │                   │             │
│                           ▼                   ▼             │
│                    ┌──────────────────────────────┐        │
│                    │   JSON Response / Cache      │        │
│                    └──────────────────────────────┘        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  docs/index.html │
                    │  (Web Interface) │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   User's Browser │
                    └──────────────────┘
```

---

## 🗓️ **Part 1: The Whiteboard (Data Source)**

The squadron schedule lives in a **Google Sheets spreadsheet** with one sheet per day.

### Sheet Structure

Each daily sheet (e.g., "Mon 15 Dec") has **4 main sections**:

```
┌─────────────────────────────────────────────────────────────┐
│ SUPERVISION SECTION (Rows 1-9)                              │
│ ┌───────────┬──────────┬─────────┬─────────┐               │
│ │ Duty Type │ Person   │  Start  │   End   │               │
│ ├───────────┼──────────┼─────────┼─────────┤               │
│ │ SOF       │ Coleman  │  07:30  │  12:00  │               │
│ │ OS        │ Smith    │  08:00  │  16:00  │               │
│ │ ODO       │ Johnson  │  07:00  │  19:00  │               │
│ └───────────┴──────────┴─────────┴─────────┘               │
├─────────────────────────────────────────────────────────────┤
│ FLYING EVENTS SECTION (Rows 11-52)                          │
│ ┌───────┬────────┬─────┬─────┬────────┬────────┬──────┐   │
│ │ Model │ Brief  │ ETD │ ETA │Debrief │ Event  │ Crew │   │
│ ├───────┼────────┼─────┼─────┼────────┼────────┼──────┤   │
│ │ T-38  │ 08:00  │09:00│11:00│  12:00 │ BFM    │Harms │   │
│ │ T-38  │ 13:00  │14:00│16:00│  17:00 │ Form   │Sick  │   │
│ └───────┴────────┴─────┴─────┴────────┴────────┴──────┘   │
├─────────────────────────────────────────────────────────────┤
│ GROUND EVENTS SECTION (Rows 54-80)                          │
│ ┌─────────────────┬────────┬────────┬────────────┐         │
│ │ Event           │ Start  │  End   │  People    │         │
│ ├─────────────────┼────────┼────────┼────────────┤         │
│ │ Staff Meeting   │ 10:00  │ 11:00  │ ALL        │         │
│ │ Flight Briefing │ 14:00  │ 15:00  │ Olvera     │         │
│ └─────────────────┴────────┴────────┴────────────┘         │
├─────────────────────────────────────────────────────────────┤
│ NOT AVAILABLE SECTION (Rows 82-113)                         │
│ ┌─────────────┬────────┬────────┬────────────┐             │
│ │ Reason      │ Start  │  End   │  People    │             │
│ ├─────────────┼────────┼────────┼────────────┤             │
│ │ Leave       │ 0700   │ 1600   │ Martinez   │             │
│ │ Medical     │ 0900   │ 1100   │ Thompson   │             │
│ └─────────────┴────────┴────────┴────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Sheet Naming Convention

- **Format**: `Day DD Mon` (e.g., "Mon 15 Dec", "Tue 16 Dec")
- **Frequency**: One sheet per weekday (Mon-Fri)
- **Location**: All in the same spreadsheet

---

## ⚙️ **Part 2: Data Extraction (Google Apps Script)**

The backend runs on **Google Apps Script** and consists of several components:

### 📂 **File Structure**

| File | Purpose | Role |
|------|---------|------|
| **Config.gs** | Configuration settings | Stores spreadsheet ID, timezone, search settings |
| **Main.gs** | HTTP request router | Receives web requests and routes to correct processor |
| **TriggerSetup.gs** | SIMPLIFIED processor | Extracts schedule data for a specific person |
| **BatchProcessor.gs** | Background caching | Pre-processes schedules every 15 minutes |
| **SmartSheetFinder.gs** | Sheet finder utility | Finds next available sheets (handles gaps) |
| **Enhanced.gs** | ENHANCED processor | Advanced parser with structured metadata (optional) |

---

### 🔄 **Data Flow: Real-Time Request**

When a user opens the web app, here's what happens:

```
1. USER OPENS WEB APP
   └─> index.html loads in browser

2. JAVASCRIPT FETCHES DATA
   └─> fetch("https://script.google.com/.../exec?name=Sick")

3. MAIN.GS RECEIVES REQUEST
   └─> doGet(e) function is triggered
   └─> Checks: Is there cached data?

4a. CACHE HIT (< 100ms) ⚡
   └─> Return pre-processed data from cache
   └─> User sees schedule instantly!

4b. CACHE MISS (~30 seconds) ⏱️
   └─> Route to SIMPLIFIED processor (TriggerSetup.gs)
   └─> doGet_Simplified(e) is called

5. SIMPLIFIED PROCESSOR RUNS
   └─> Opens spreadsheet once (reuse for all days)
   └─> For each day (Mon-Fri):
       ├─> Generate sheet name: "Mon 15 Dec"
       ├─> Open that sheet
       ├─> Search 4 sections (Supervision, Flying, Ground, NA)
       ├─> Extract rows containing "Sick"
       └─> Format as JSON

6. RETURN JSON RESPONSE
   └─> {
         "searchName": "Sick",
         "events": [
           {
             "date": "2025-12-29",
             "dayName": "Monday",
             "events": [
               { "time": "08:00", "description": "T-38 | BFM | Sick" },
               { "time": "14:00", "description": "Flight Briefing | Sick" }
             ]
           }
         ],
         "totalEvents": 2
       }

7. INDEX.HTML RECEIVES JSON
   └─> Parses JSON
   └─> Renders event cards
   └─> User sees their schedule!
```

---

### ⏰ **Background Process: Batch Caching**

To make the app **fast**, a background process runs every **15 minutes**:

```
┌──────────────────────────────────────────────────────────┐
│  TIME-BASED TRIGGER (Every 15 minutes)                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │ batchProcessSchedule()  │
           │ (BatchProcessor.gs)     │
           └──────────┬──────────────┘
                      │
                      ├─> Check: Is it overnight? (8 PM - 5 AM)
                      │   └─> YES: Skip (save quota)
                      │   └─> NO: Continue
                      │
                      ▼
           ┌─────────────────────────┐
           │  Get next 7 days of     │
           │  available sheets       │
           │  (SmartSheetFinder.gs)  │
           └──────────┬──────────────┘
                      │
                      ▼
           ┌─────────────────────────┐
           │  Get list of all people │
           │  from rows 120-169      │
           └──────────┬──────────────┘
                      │
                      ▼
           ┌─────────────────────────────────────┐
           │  FOR EACH SHEET (Mon, Tue, Wed...): │
           │                                      │
           │  FOR EACH PERSON (Sick, Harms...):  │
           │    1. Parse Supervision section     │
           │    2. Parse Flying Events section   │
           │    3. Parse Ground Events section   │
           │    4. Parse NA section              │
           │    5. Combine results               │
           │                                      │
           │  Store in cache for 6 hours         │
           └─────────────────────────────────────┘
                      │
                      ▼
           ┌─────────────────────────┐
           │  Result: All schedules  │
           │  cached in memory!      │
           │                         │
           │  Next request = <100ms  │
           └─────────────────────────┘
```

**Key Benefits:**
- ⚡ **Speed**: Requests return in < 100ms (vs 30 seconds)
- 💾 **Efficiency**: Process once, serve many times
- 🔋 **Smart Scheduling**: Skips overnight hours (saves 36% quota)

---

### 🔍 **How Data Extraction Works**

The SIMPLIFIED processor (`TriggerSetup.gs`) reads the whiteboard using **cell ranges**:

```javascript
// Define where each section lives in the sheet
const searchRanges = [
  { range: "A1:N10",   name: "Supervision" },      // Rows 1-10
  { range: "A11:R51",  name: "Flying Events" },    // Rows 11-51
  { range: "A54:Q80",  name: "Ground Events" },    // Rows 54-80 (MISSING!)
  { range: "A82:N112", name: "Not Available" }     // Rows 82-112
];

// Read all ranges at once (batch operation)
const allData = sheet.getRangeList(searchRanges)
                    .getRanges()
                    .map(r => r.getDisplayValues());

// Search each section for the person's name
allData.forEach((values, sectionIndex) => {
  values.forEach(row => {
    if (row.join('|').toLowerCase().includes(searchName.toLowerCase())) {
      // Found a match! Extract the data
      events.push({
        time: row[1],  // Start time
        description: row.filter(cell => cell).join(" | "),
        section: searchRanges[sectionIndex].name
      });
    }
  });
});
```

---

## 🌐 **Part 3: The Web Interface (index.html)**

### User Interface Features

```
┌─────────────────────────────────────────────────────────┐
│  TPS SCHEDULE                                     [⚙️]  │
├─────────────────────────────────────────────────────────┤
│  Search:  [Sick                            ] [Search]   │
│  Days:    [○ 3] [○ 4] [● 5] [○ 7]                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📅 Monday, Dec 29, 2025                                │
│  ┌──────────────────────────────────────────┐          │
│  │ 08:00 │ T-38 | BFM | Sick               │          │
│  └──────────────────────────────────────────┘          │
│  ┌──────────────────────────────────────────┐          │
│  │ 14:00 │ Flight Briefing | Sick           │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  📅 Tuesday, Dec 30, 2025                               │
│  ┌──────────────────────────────────────────┐          │
│  │ 10:00 │ SOF | Sick | 10:00-16:00        │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  Total Events: 3                                        │
│  Last Updated: 12:45 PM                                 │
└─────────────────────────────────────────────────────────┘
```

### How It Works

1. **Load Configuration**
   - Reads `config.webAppUrl` (deployed Google Apps Script URL)
   - Reads `config.searchName` from localStorage (persists user's search)

2. **Fetch Data**
   ```javascript
   const url = `${config.webAppUrl}?name=${searchName}&days=5`;
   const response = await fetch(url);
   const data = await response.json();
   ```

3. **Render Events**
   - Groups events by day
   - Creates event cards with time and description
   - Shows badges for different sections (Flying, Ground, etc.)

4. **Auto-Refresh**
   - Refreshes every 15 minutes (matches batch processing)
   - Manual refresh via button

---

## 📈 **Performance Optimization**

### Why It's Fast

| Optimization | Benefit |
|--------------|---------|
| **Batch Range Reads** | Reads all 4 sections at once (4 calls → 1) |
| **getDisplayValues()** | 40-50% faster than getValues() |
| **Spreadsheet Reuse** | Opens spreadsheet once, reuses for all days |
| **Background Caching** | Pre-processes schedules every 15 minutes |
| **Overnight Skip** | Skips 8 PM - 5 AM (saves 36% daily quota) |

### Performance Numbers

| Scenario | Response Time |
|----------|---------------|
| **Cache Hit** | < 100ms ⚡ |
| **Cache Miss** | ~30 seconds ⏱️ |
| **Background Process** | Runs every 15 min during work hours |

---

## 🔧 **Configuration**

### Important Settings (Config.gs)

```javascript
const SEARCH_CONFIG = {
  // Google Sheets ID (from URL)
  spreadsheetId: "1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU",

  // Timezone (CRITICAL for "today" calculation)
  timezone: "America/Los_Angeles",

  // Default search term
  searchTerm: "Sick",

  // Cache duration (6 hours)
  cacheTTL: 21600
};
```

### Sheet Structure Configuration

The sheet structure is **configurable** in Config.gs with automatic changeover support:

```javascript
// Changeover date - sheets on/after this date use new structure
const STRUCTURE_CHANGEOVER_DATE = '2026-01-12';

const SHEET_STRUCTURES = {
  legacy: {
    sections: {
      supervision: { range: 'A1:N9' },
      flying: { range: 'A11:R52' },
      ground: { range: 'A54:M80' },
      na: { range: 'A82:K113' }
    },
    roster: { range: 'A120:R168', columns: [...] }
  },
  current: {
    sections: {
      supervision: { range: 'A1:N11' },
      flying: { range: 'A13:R134' },
      ground: { range: 'A136:M237' },
      na: { range: 'A239:K340' }
    },
    roster: { ranges: [...] }  // Multiple ranges for FTC-B, STC-B, etc.
  }
};
```

**How It Works:**
- Structure is determined **per sheet** based on the sheet's date
- Sheets before changeover date → legacy structure
- Sheets on/after changeover date → current structure
- All processors call `getSectionRanges(sheetDate)` to get correct ranges

### URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `?name=` | Person to search for | `?name=Sick` |
| `?days=` | Number of days to search | `?days=5` |
| `?forceRefresh=true` | Trigger batch cache refresh | `?forceRefresh=true` |
| `?viewCache=true` | View all cached people | `?viewCache=true` |
| `?viewCache=person&name=` | View cache for specific person | `?viewCache=person&name=Sick` |

### Active Version (Main.gs)

```javascript
// Controls which processor handles requests
const ACTIVE_VERSION = "SIMPLIFIED";
// Options: "SIMPLIFIED", "ENHANCED"
```

**Current Setup**:
- ✅ SIMPLIFIED version is active
- ✅ Batch processor handles caching (6 hour TTL)
- ✅ Cache miss returns error (saves quota)

---

## ✅ **Resolved Issues**

### Range Inconsistencies - FIXED

Previously, cell ranges were hardcoded and inconsistent across files. This has been resolved:

**Solution Implemented:**
- All section ranges are now centralized in `Config.gs`
- All processors call `getSectionRanges(sheetDate)` to get correct ranges
- Supports automatic changeover between legacy and current structures
- To update ranges, edit `SHEET_STRUCTURES` in Config.gs only

---

## 🛠️ **Maintenance Guide**

### When Schedulers Change Sheet Structure

**Process (Config.gs only):**
1. Open `Config.gs`
2. Update `SHEET_STRUCTURES.current.sections` with new ranges
3. Set `STRUCTURE_CHANGEOVER_DATE` to when the new structure takes effect
4. Deploy new version

**Example - Adding rows to Flying Events:**
```javascript
// In Config.gs, update the 'current' structure:
current: {
  sections: {
    supervision: { range: 'A1:N11' },
    flying: { range: 'A13:R150' },  // Changed from R134
    ground: { range: 'A152:M253' }, // Shifted down
    na: { range: 'A255:K356' }      // Shifted down
  }
}
```

### Adding a New Changeover Date

If the structure changes again in the future:
1. Rename `current` to something like `jan2026`
2. Add a new `current` structure with the new ranges
3. Update the changeover logic in `getActiveSheetStructure()`

---

## 🔐 **Security & Access**

### Deployment Settings

The Google Apps Script must be deployed with:
- **Execute as**: Your account (has access to spreadsheet)
- **Who has access**: Anyone (so web app can fetch without login)

### Data Privacy

- ✅ Read-only access to schedule
- ✅ No data modification
- ✅ No personal information stored in web app
- ✅ All data stays in Google ecosystem

---

## 📊 **System Health Monitoring**

### Check If System Is Working

1. **Test Web App**
   - Open index.html
   - Should load in < 5 seconds
   - Events should display

2. **Test Backend**
   - Open Google Apps Script editor
   - Run: `testRouter()`
   - Should return events without errors

3. **Check Batch Processing**
   - View Executions tab in Apps Script
   - Should see `batchProcessSchedule()` running every 15 min
   - Should NOT see errors

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "No events found" | Sheet name format changed | Update `generateSheetName()` function |
| Slow response (30s) | Cache miss or disabled | Check batch processor is running |
| Missing events | Wrong cell ranges | Update ranges in `.gs` files |
| "Sheet not found" | Weekend or holiday | Normal - no sheets for non-workdays |

---

## 📚 **Appendix: Function Reference**

### Main Request Flow

```
doGet(e)                               [Main.gs]
  ├─> Check cache
  ├─> Route to version
  └─> doGet_Simplified(e)              [TriggerSetup.gs]
        └─> getEventsForWidget()       [TriggerSetup.gs]
              ├─> getNextNWeekdays()   [Get dates to search]
              └─> For each day:
                    └─> searchNameInSheetForWidget_Simplified()
                          └─> Returns events for that day
```

### Background Batch Process

```
batchProcessSchedule()                 [BatchProcessor.gs]
  ├─> isOvernightHours()               [Check if 8PM-5AM]
  └─> batchProcessAll(7)               [Process 7 days]
        ├─> getSmartSheetRange()       [SmartSheetFinder.gs]
        ├─> getAllPeople()             [Get list from rows 120-169]
        └─> For each sheet + person:
              └─> processSheet()       [Parse all 4 sections]
                    ├─> parseSupervisionForPerson()
                    ├─> parseFlyingForPerson()
                    ├─> parseGroundForPerson()
                    └─> parseNAForPerson()
```

---

## 🎯 **Quick Reference**

### File Locations
- **Frontend**: `docs/index.html`
- **Backend**: `*.gs` files (deployed to Google Apps Script)
- **Whiteboard**: Google Sheets spreadsheet

### Key URLs
- **Web App**: `https://script.google.com/macros/s/AKfycbw.../exec`
- **Spreadsheet**: `https://docs.google.com/spreadsheets/d/1m5-6Fxg.../edit`

### Active Components
- ✅ Main.gs (router)
- ✅ TriggerSetup.gs (SIMPLIFIED processor)
- ✅ BatchProcessor.gs (caching)
- ✅ SmartSheetFinder.gs (utilities)
- ⚠️ Enhanced.gs (optional, not currently active)

---

**Last Updated**: January 5, 2026
**Version**: Stable Schedule with configurable sheet structure and changeover date support
