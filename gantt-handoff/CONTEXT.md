# Project Context and Background

## What Is TPS Schedule?

TPS (Test Pilot School) Schedule is a web application that displays individual schedules extracted from a shared Google Sheet. The sheet is maintained by schedulers and contains:

- Daily schedule sheets (one per day)
- Flying events, ground training, supervision duties
- Student roster organized by class and category
- NA (Not Available) entries for leave, TDY, etc.

## Current Architecture (TPS-Schedule)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Google Sheet   │────▶│  Google Apps Script  │────▶│  Static HTML    │
│  (Source Data)  │     │  (API + Caching)     │     │  (React UI)     │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ CacheService │
                        │  (6hr TTL)   │
                        └──────────────┘
```

### How It Works Now

1. **BatchProcessor.gs** runs every 15 minutes (skips overnight 8PM-7AM)
2. Reads roster from all sheets in the 7-day window
3. For each person, extracts events from each day's sheet
4. Caches results in Google's CacheService (6-hour TTL)
5. Frontend fetches individual schedules via `?search=Name` or bulk via `?viewCache=bulk`

### What Works Well

- Individual schedule lookup is fast (cache hit)
- Batch processing handles ~180 people across 7 sheets
- Configurable sheet structure via `SheetConfig.gs`
- Handles date-based changeover in sheet structure

### Limitations for Gantt Chart

1. **Only 7 days forward** - No historical data
2. **Google CacheService limits** - 6-hour TTL max, 10MB total
3. **Tightly coupled** - Hard to extend without affecting main app
4. **No versioning** - Can't track schedule changes over time

## The Gantt Chart Requirement

A colleague requested a view showing an entire class's schedule for the week:

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Class View: [Class 26A ▼] [Staff IP ▼]           Week of Jan 6-10, 2025   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Name        │ Monday    │ Tuesday   │ Wednesday │ Thursday  │ Friday      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Adams       │ ████████  │           │ ████      │ ████████  │             │
│  Baker       │     ████  │ ████████  │           │ ████      │ ████████    │
│  Carter      │ ████      │ ████      │ ████████  │           │ ████        │
│  ...         │           │           │           │           │             │
└─────────────────────────────────────────────────────────────────────────────┘

Legend: [Flying] [Ground] [NA] [Supervision]
```

### Requirements

| Requirement | Description |
|-------------|-------------|
| **Time range** | 2 weeks: 1 week historical + 1 week future |
| **Categories** | Multi-select: Class 26A, 26B, FTC-A, FTC-B, STC-A, STC-B, Staff IP, etc. |
| **People** | Show ALL people in selected categories (even without events) |
| **Events** | Flying, Ground, NA, Supervision with time-based positioning |
| **Sorting** | Alphabetical by last name within each category |
| **Export** | Print-friendly view |

### Why Separate from TPS-Schedule?

1. **Different data window** - TPS-Schedule shows current week; Gantt needs historical
2. **Different access pattern** - TPS-Schedule is individual; Gantt is bulk
3. **Different update frequency** - TPS-Schedule can be slightly stale; Gantt may need fresher data
4. **Risk isolation** - Changes to Gantt shouldn't affect working TPS-Schedule

## Google Sheet Structure

### Sheet Naming Convention

Sheets are named by date in various formats:
- `6 Jan` (day + month abbreviation)
- `6 Jan 25` (day + month + year)
- `6-Jan` or `6-Jan-25` (with dashes)

### Sheet Layout (Current Structure)

```
┌────────────────────────────────────────────────────────────────────┐
│ Row 1-7: Supervision Section                                       │
│   Col A: Duty Type (SOF, Ops Sup, Safety, IP Auth, etc.)          │
│   Cols B-D, E-G, H-J: POC | Start | End (3 shifts)                │
├────────────────────────────────────────────────────────────────────┤
│ Row 10-50: Flying Events                                           │
│   Col A: Model (T-38, F-16, etc.)                                 │
│   Col B: Brief Start                                               │
│   Col C: ETD                                                       │
│   Col D: ETA                                                       │
│   Col E: Debrief End                                               │
│   Col F: Event Name                                                │
│   Cols G-N: Crew (8 positions)                                    │
│   Col O: Notes                                                     │
│   Cols P-R: Effective/Cancelled/Partial checkboxes                │
├────────────────────────────────────────────────────────────────────┤
│ Row 52-80: Ground Events                                           │
│   Col A: Event Name                                                │
│   Col B: Start Time                                                │
│   Col C: End Time                                                  │
│   Cols D+: Attendees                                               │
├────────────────────────────────────────────────────────────────────┤
│ Row 82-110: NA Section                                             │
│   Col A: Reason (Leave, TDY, Appointment, etc.)                   │
│   Col B: Start Time                                                │
│   Col C: End Time                                                  │
│   Cols D+: People                                                  │
├────────────────────────────────────────────────────────────────────┤
│ Cols T-Y: Roster (separate area)                                   │
│   Different columns for each category                              │
│   Class 26A, 26B, FTC-A/B, STC-A/B, Staff, etc.                   │
└────────────────────────────────────────────────────────────────────┘
```

### Roster Configuration

The roster location is configurable and may change. Current config example:

```javascript
function getRosterConfig() {
  return {
    ranges: [
      { range: 'T3:T30', nameCol: 0, name: 'Class 26A', type: 'student' },
      { range: 'U3:U30', nameCol: 0, name: 'Class 26B', type: 'student' },
      { range: 'V3:V30', nameCol: 0, name: 'FTC-A', type: 'student' },
      { range: 'W3:W30', nameCol: 0, name: 'FTC-B', type: 'student' },
      { range: 'X3:X30', nameCol: 0, name: 'STC-A', type: 'student' },
      { range: 'Y3:Y30', nameCol: 0, name: 'STC-B', type: 'student' },
      { range: 'Z3:Z50', nameCol: 0, name: 'Staff IP', type: 'staff' }
    ]
  };
}
```

## Key Challenges

### 1. Sheet Date Parsing

Sheets are named inconsistently. Need robust date parsing:

```javascript
// Examples to handle:
"6 Jan"      → 2025-01-06
"6 Jan 25"   → 2025-01-06
"6-Jan"      → 2025-01-06
"6-Jan-25"   → 2025-01-06
"16 Jan"     → 2025-01-16
```

### 2. Structure Changes Over Time

The sheet structure changed on December 9, 2024. Historical data may have different row ranges. The config system handles this:

```javascript
function getSectionRanges(sheetDate) {
  const changeoverDate = new Date('2024-12-09');
  const date = new Date(sheetDate);

  if (date >= changeoverDate) {
    return { /* new structure */ };
  } else {
    return { /* old structure */ };
  }
}
```

### 3. Filtering Event Names from Roster

The roster ranges sometimes pick up event names as people. Need filtering:

```javascript
const eventNamePatterns = [
  'academics', 'events', 'ground events', 'flying events', 'supervision',
  'groot', 'mtg', 'meeting', 'interview', 'brief', 'debrief',
  'ccep', 'checkride', 'sim', 'flight', 'sortie', 'mission'
  // ... more patterns
];
```

### 4. Time Zone Handling

Sheet times are Pacific. Date calculations must account for this:

```javascript
const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

## What You're Building

A standalone application that:

1. **Fetches** data from the public Google Sheet (directly or via API)
2. **Caches** results (could be file-based, Redis, or in-memory)
3. **Serves** a Gantt-style UI showing class schedules
4. **Supports** 2-week window (historical + future)
5. **Filters** by category with multi-select
6. **Shows** all roster members, even without events

## Success Criteria

- [ ] Can view any class's schedule for a 2-week window
- [ ] Shows all people in selected categories
- [ ] Events positioned correctly by time
- [ ] Works with publicly viewable Google Sheet
- [ ] Doesn't depend on or affect TPS-Schedule
- [ ] Print-friendly output
