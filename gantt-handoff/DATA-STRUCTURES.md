# Data Structures and Formats

## Current Bulk API Response

The TPS-Schedule bulk endpoint (`?viewCache=bulk`) returns:

```json
{
  "viewCache": true,
  "mode": "bulk",
  "metadata": {
    "lastRun": "2025-01-09T14:30:00.000Z",
    "duration": 2.45,
    "sheetsProcessed": 7,
    "peopleProcessed": 183,
    "eventsFound": 1247,
    "cacheSizeMB": "0.85",
    "errors": 0
  },
  "categories": [
    "Class 26A",
    "Class 26B",
    "FTC-A",
    "FTC-B",
    "STC-A",
    "STC-B",
    "Staff IP",
    "Staff STC",
    "Attached",
    "Support"
  ],
  "peopleCount": 183,
  "schedules": [
    {
      "name": "Adams",
      "category": "Class 26A",
      "events": [
        {
          "date": "2025-01-06",
          "time": "0700",
          "type": "Flying Events",
          "description": "T-38 | DACT | Adams | Baker | Carter",
          "rangeSource": "Flying Events",
          "enhanced": {
            "section": "Flying Events",
            "model": "T-38",
            "briefStart": "0700",
            "etd": "0800",
            "eta": "0930",
            "debriefEnd": "1030",
            "event": "DACT",
            "crew": ["Adams", "Baker", "Carter"],
            "notes": "",
            "status": {
              "effective": false,
              "cancelled": false,
              "partiallyEffective": false
            }
          }
        }
      ]
    }
  ]
}
```

## Individual Person Cache Entry

Each person's schedule is cached with this structure:

```json
{
  "person": "Adams",
  "class": "Class 26A",
  "type": "student",
  "events": [
    {
      "date": "2025-01-06",
      "time": "0700",
      "type": "Flying Events",
      "description": "T-38 | DACT | Adams | Baker | Carter",
      "rangeSource": "Flying Events",
      "enhanced": {
        "section": "Flying Events",
        "model": "T-38",
        "briefStart": "0700",
        "etd": "0800",
        "eta": "0930",
        "debriefEnd": "1030",
        "event": "DACT",
        "crew": ["Adams", "Baker", "Carter"],
        "notes": "",
        "status": {
          "effective": false,
          "cancelled": false,
          "partiallyEffective": false
        }
      }
    }
  ],
  "days": ["2025-01-06", "2025-01-07", "2025-01-08"],
  "lastUpdated": "2025-01-09T14:30:00.000Z",
  "version": "5.0-tiered"
}
```

## Event Types

### Flying Event

```json
{
  "date": "2025-01-06",
  "time": "0700",
  "type": "Flying Events",
  "description": "T-38 | DACT | Adams | Baker | Carter",
  "rangeSource": "Flying Events",
  "enhanced": {
    "section": "Flying Events",
    "model": "T-38",
    "briefStart": "0700",
    "etd": "0800",
    "eta": "0930",
    "debriefEnd": "1030",
    "event": "DACT",
    "crew": ["Adams", "Baker", "Carter"],
    "notes": "Weather backup: 1300",
    "status": {
      "effective": false,
      "cancelled": false,
      "partiallyEffective": false
    }
  }
}
```

### Ground Event

```json
{
  "date": "2025-01-06",
  "time": "1300",
  "type": "Ground Events",
  "description": "Systems Class | Adams | Baker | Carter",
  "rangeSource": "Ground Events",
  "enhanced": {
    "section": "Ground Events",
    "event": "Systems Class",
    "start": "1300",
    "end": "1500",
    "people": ["Adams", "Baker", "Carter"]
  }
}
```

### NA (Not Available) Event

```json
{
  "date": "2025-01-06",
  "time": "0700",
  "type": "NA",
  "description": "Leave | Adams",
  "rangeSource": "NA",
  "enhanced": {
    "section": "NA",
    "reason": "Leave",
    "start": "0700",
    "end": "1600",
    "people": ["Adams"]
  }
}
```

### Supervision Event

```json
{
  "date": "2025-01-06",
  "time": "0600",
  "type": "Supervision",
  "description": "SOF | Adams | 0600-1400",
  "rangeSource": "Supervision",
  "enhanced": {
    "section": "Supervision",
    "duty": "SOF",
    "poc": "Adams",
    "start": "0600",
    "end": "1400",
    "isAuth": false
  }
}
```

### Auth (No Time) Supervision

```json
{
  "date": "2025-01-06",
  "time": "",
  "type": "Supervision",
  "description": "IP AUTH | Adams",
  "rangeSource": "Supervision",
  "enhanced": {
    "section": "Supervision",
    "duty": "IP AUTH",
    "poc": "Adams",
    "start": null,
    "end": null,
    "isAuth": true
  }
}
```

## Roster Data

### Category Structure

```json
{
  "categories": {
    "Class 26A": {
      "type": "student",
      "people": ["Adams", "Baker", "Carter", "Davis"]
    },
    "Class 26B": {
      "type": "student",
      "people": ["Edwards", "Franklin", "Garcia"]
    },
    "FTC-A": {
      "type": "student",
      "people": ["Harris", "Irving", "Johnson"]
    },
    "Staff IP": {
      "type": "staff",
      "people": ["King", "Lewis", "Miller"]
    }
  }
}
```

## Proposed Gantt Data Structure

For the Gantt chart, you'll want to transform the data into a more UI-friendly format:

```json
{
  "weekStart": "2025-01-06",
  "weekEnd": "2025-01-10",
  "categories": ["Class 26A", "Staff IP"],
  "people": [
    {
      "name": "Adams",
      "category": "Class 26A",
      "days": {
        "2025-01-06": [
          {
            "type": "Flying Events",
            "start": "07:00",
            "end": "10:30",
            "label": "T-38 DACT",
            "color": "#3B82F6"
          }
        ],
        "2025-01-07": [],
        "2025-01-08": [
          {
            "type": "Ground Events",
            "start": "13:00",
            "end": "15:00",
            "label": "Systems Class",
            "color": "#10B981"
          }
        ],
        "2025-01-09": [],
        "2025-01-10": []
      }
    }
  ]
}
```

## Time Format Conversion

Times in the sheet are stored as strings like:
- `"0700"` - 7:00 AM
- `"1430"` - 2:30 PM
- `"0600"` - 6:00 AM

Conversion helper:

```javascript
function parseTime(timeStr) {
  if (!timeStr || timeStr.length < 4) return null;
  const hours = parseInt(timeStr.substring(0, 2));
  const minutes = parseInt(timeStr.substring(2, 4));
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

function formatTimeDisplay(timeStr) {
  const parsed = parseTime(timeStr);
  if (!parsed) return '';
  const suffix = parsed.hours >= 12 ? 'PM' : 'AM';
  const displayHour = parsed.hours > 12 ? parsed.hours - 12 : parsed.hours || 12;
  return `${displayHour}:${String(parsed.minutes).padStart(2, '0')} ${suffix}`;
}
```

## Color Scheme

Suggested colors for event types:

```javascript
const EVENT_COLORS = {
  'Flying Events': {
    bg: '#DBEAFE',      // blue-100
    border: '#3B82F6',  // blue-500
    text: '#1E40AF'     // blue-800
  },
  'Ground Events': {
    bg: '#D1FAE5',      // green-100
    border: '#10B981',  // green-500
    text: '#065F46'     // green-800
  },
  'NA': {
    bg: '#FEE2E2',      // red-100
    border: '#EF4444',  // red-500
    text: '#991B1B'     // red-800
  },
  'Supervision': {
    bg: '#FEF3C7',      // yellow-100
    border: '#F59E0B',  // yellow-500
    text: '#92400E'     // yellow-800
  }
};
```

## Google Sheets API Response

When fetching directly from Google Sheets API, you'll get:

```json
{
  "range": "6 Jan!A1:Z100",
  "majorDimension": "ROWS",
  "values": [
    ["SOF", "Adams", "0600", "1400", "Baker", "1400", "2200", "", "", ""],
    ["Ops Sup", "Carter", "0600", "1400", "", "", "", "", "", ""],
    // ... more rows
  ]
}
```

## Sheet Info Metadata

Track which sheets exist and their dates:

```json
{
  "sheets": [
    { "name": "6 Jan", "date": "2025-01-06", "gid": "123456" },
    { "name": "7 Jan", "date": "2025-01-07", "gid": "234567" },
    { "name": "8 Jan", "date": "2025-01-08", "gid": "345678" }
  ],
  "lastUpdated": "2025-01-09T14:30:00.000Z"
}
```

## Error Response Format

```json
{
  "error": true,
  "message": "Sheet not found: 6 Jan",
  "code": "SHEET_NOT_FOUND",
  "details": {
    "requestedDate": "2025-01-06",
    "availableSheets": ["7 Jan", "8 Jan", "9 Jan"]
  }
}
```
