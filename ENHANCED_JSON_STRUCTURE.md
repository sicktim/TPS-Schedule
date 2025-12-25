# Enhanced JSON Structure (v5.0)

## 📋 Overview

The Enhanced version (v5.0) returns structured, detailed metadata for all schedule sections while maintaining backwards compatibility with the simple format.

---

## 🎯 Key Features

- ✅ **Backwards Compatible** - Legacy `time` and `description` fields preserved
- ✅ **Structured Metadata** - Detailed objects in `enhanced` field
- ✅ **Section Awareness** - Each event knows its section (Supervision, Flying Events, etc.)
- ✅ **Status Detection** - Parses Effective/Cancelled/Partially Effective checkboxes
- ✅ **Rich Details** - Crew lists, times, event types, reasons, etc.

---

## 📊 Response Structure

### Top-Level Response

```json
{
  "searchName": "Harms, J *",
  "generatedAt": "2025-12-25T12:00:00.000Z",
  "localTime": "2025-12-25 04:00:00 PST",
  "timezone": "America/Los_Angeles",
  "daysAhead": 4,
  "daysSearched": 5,
  "searchedSheets": [
    {
      "date": "2025-12-15",
      "sheetName": "Mon 15 Dec",
      "eventsFound": 3
    }
  ],
  "events": [...],  // Array of day objects (see below)
  "totalEvents": 3,
  "enhanced": true,
  "version": "5.0",
  "testMode": true,  // if testDate was used
  "simulatedToday": "2025-12-15"  // if testDate was used
}
```

---

## 📅 Day Object Structure

Each day with events:

```json
{
  "date": "2025-12-15",
  "dayName": "Monday",
  "sheetName": "Mon 15 Dec",
  "events": [...]  // Array of event objects (see sections below)
}
```

---

## 🔍 Event Object Structure

Each event has both **legacy** and **enhanced** formats:

### Common Fields (All Events)

```json
{
  // Legacy format (backwards compatible)
  "time": "07:30",
  "description": "C-12 | CSO PERF ME HQ | Harms, J * | Duede | Bean, P",
  "rangeSource": "Flying Events",

  // Enhanced format (new!)
  "enhanced": {
    // ... section-specific fields (see below)
  }
}
```

---

## 📦 Section-Specific Enhanced Formats

### 1. Supervision Events

```json
{
  "time": "07:30",
  "description": "SOF | 416th | 07:30-12:00",
  "rangeSource": "Supervision",

  "enhanced": {
    "section": "Supervision",
    "duty": "SOF",           // SOF, OS, ODO, F-16 FDO, T-38 TDO, A-29 ADO, C-12 TDO, AUTH
    "poc": "416th",          // Person of Contact
    "start": "07:30",        // Start time (null for AUTH)
    "end": "12:00",          // End time (null for AUTH)
    "isAuth": false          // true if this is AUTH (flight authorization signer)
  }
}
```

**Special Case - AUTH:**
```json
{
  "time": "",
  "description": "AUTH | Colen",
  "rangeSource": "Supervision",

  "enhanced": {
    "section": "Supervision",
    "duty": "AUTH",
    "poc": "Colen",
    "start": null,          // No specific times for AUTH
    "end": null,
    "isAuth": true
  }
}
```

---

### 2. Flying Events

```json
{
  "time": "07:30",
  "description": "C-12 | CSO PERF ME HQ | Harms, J * | Duede | Bean, P",
  "rangeSource": "Flying Events",

  "enhanced": {
    "section": "Flying Events",
    "model": "C-12",                     // Aircraft model
    "briefStart": "07:30",               // Brief start time
    "etd": "09:30",                      // Estimated Time of Departure
    "eta": "11:30",                      // Estimated Time of Arrival
    "debriefEnd": "12:15",               // Debrief end time
    "event": "CSO PERF ME HQ",           // Event name/type
    "crew": [                            // Crew members (in order)
      "Harms, J *",
      "Duede",
      "Bean, P"
    ],
    "notes": "Ops Canx",                 // Notes column
    "status": {
      "effective": false,                // TRUE/FALSE from checkbox
      "cancelled": true,                 // TRUE/FALSE from checkbox
      "partiallyEffective": false        // TRUE/FALSE from checkbox
    }
  }
}
```

---

### 3. Ground Events

```json
{
  "time": "08:00",
  "description": "GUARDIAN | Olvera, J | Roberts, J | Stacia, I | ...",
  "rangeSource": "Ground Events",

  "enhanced": {
    "section": "Ground Events",
    "event": "GUARDIAN",              // Event name
    "start": "08:00",                 // Start time
    "end": "12:00",                   // End time
    "people": [                       // People involved (in order)
      "Olvera, J",
      "Roberts, J",
      "Stacia, I",
      "Toth, E",
      "Williams, J",
      "Coolican",
      "Miller, E",
      "Hamidani",
      "Ricci"
    ],
    "notes": "",                      // Notes column
    "status": {
      "effective": true,              // TRUE/FALSE from checkbox
      "cancelled": false,             // TRUE/FALSE from checkbox
      "partiallyEffective": false     // TRUE/FALSE from checkbox
    }
  }
}
```

---

### 4. NA (Non-Availability) Events

```json
{
  "time": "09:00",
  "description": "Fit Physical | Kalampouk",
  "rangeSource": "Not Available",

  "enhanced": {
    "section": "NA",
    "reason": "Fit Physical",         // Reason for non-availability
    "start": "09:00",                 // Start time
    "end": "14:00",                   // End time
    "people": [                       // People affected
      "Kalampouk"
    ]
  }
}
```

---

## 🎨 Complete Example Response

```json
{
  "searchName": "Harms, J *",
  "generatedAt": "2025-12-25T12:00:00.000Z",
  "localTime": "2025-12-25 04:00:00 PST",
  "timezone": "America/Los_Angeles",
  "daysAhead": 1,
  "daysSearched": 1,
  "searchedSheets": [
    {
      "date": "2025-12-15",
      "sheetName": "Mon 15 Dec",
      "eventsFound": 2
    }
  ],
  "events": [
    {
      "date": "2025-12-15",
      "dayName": "Monday",
      "sheetName": "Mon 15 Dec",
      "events": [
        {
          "time": "07:30",
          "description": "C-12 | CSO PERF ME HQ | Harms, J * | Duede | Bean, P",
          "rangeSource": "Flying Events",
          "enhanced": {
            "section": "Flying Events",
            "model": "C-12",
            "briefStart": "07:30",
            "etd": "09:30",
            "eta": "11:30",
            "debriefEnd": "12:15",
            "event": "CSO PERF ME HQ",
            "crew": ["Harms, J *", "Duede", "Bean, P"],
            "notes": "Ops Canx",
            "status": {
              "effective": false,
              "cancelled": true,
              "partiallyEffective": false
            }
          }
        },
        {
          "time": "",
          "description": "AUTH | Harms, J *",
          "rangeSource": "Supervision",
          "enhanced": {
            "section": "Supervision",
            "duty": "AUTH",
            "poc": "Harms, J *",
            "start": null,
            "end": null,
            "isAuth": true
          }
        }
      ]
    }
  ],
  "totalEvents": 2,
  "enhanced": true,
  "version": "5.0",
  "testMode": true,
  "simulatedToday": "2025-12-15"
}
```

---

## 📱 Using Enhanced Data in Your App

### Example: Display Flying Event Details

```javascript
// JavaScript/TypeScript example
const response = await fetch(url);
const data = await response.json();

data.events.forEach(day => {
  console.log(`${day.dayName}, ${day.date}`);

  day.events.forEach(event => {
    if (event.enhanced.section === "Flying Events") {
      const e = event.enhanced;

      console.log(`  ${e.model} ${e.event}`);
      console.log(`  Brief: ${e.briefStart}, ETD: ${e.etd}, ETA: ${e.eta}`);
      console.log(`  Crew: ${e.crew.join(', ')}`);
      console.log(`  Status: ${e.status.cancelled ? 'CANCELLED' : 'ACTIVE'}`);
    }
  });
});
```

### Example: Filter by Section

```javascript
// Get only supervision events
const supervisionEvents = data.events
  .flatMap(day => day.events)
  .filter(evt => evt.enhanced.section === "Supervision");

// Get only flying events that are cancelled
const cancelledFlights = data.events
  .flatMap(day => day.events)
  .filter(evt =>
    evt.enhanced.section === "Flying Events" &&
    evt.enhanced.status.cancelled
  );

// Get all NAs
const nonAvailabilities = data.events
  .flatMap(day => day.events)
  .filter(evt => evt.enhanced.section === "NA");
```

---

## 🔄 Migration from Simple to Enhanced

### Simple Format (v4.0):
```json
{
  "time": "07:30",
  "description": "C-12 | Harms, J * | Duede",
  "rangeSource": "Flying Events"
}
```

### Enhanced Format (v5.0):
```json
{
  // Legacy fields (still here!)
  "time": "07:30",
  "description": "C-12 | Harms, J * | Duede",
  "rangeSource": "Flying Events",

  // New enhanced object
  "enhanced": {
    "section": "Flying Events",
    "model": "C-12",
    "crew": ["Harms, J *", "Duede"],
    // ... more structured data
  }
}
```

**Your existing app keeps working!** Just ignore the `enhanced` field.

When ready to use rich features, access `event.enhanced` for structured data.

---

## ⚙️ Status Detection

The Enhanced version detects checkbox values from the sheet:

| Sheet Cell Value | Parsed Boolean |
|------------------|----------------|
| `TRUE` | `true` |
| `FALSE` | `false` |
| `✓` | `true` |
| `X` | `true` |
| `✔` | `true` |
| Empty cell | `false` |

**In your sheet:** Click the checkbox cell to see the actual value (TRUE/FALSE).

---

## 🎯 Use Cases

### Dashboard UI
```javascript
// Show cancelled flights in red
if (event.enhanced.section === "Flying Events" && event.enhanced.status.cancelled) {
  displayWithStyle(event, { color: 'red', strikethrough: true });
}
```

### Crew Notifications
```javascript
// Notify all crew members
if (event.enhanced.section === "Flying Events") {
  event.enhanced.crew.forEach(crewMember => {
    sendNotification(crewMember, `Brief at ${event.enhanced.briefStart}`);
  });
}
```

### Calendar Integration
```javascript
// Create calendar events with proper times
if (event.enhanced.section === "Ground Events") {
  calendar.addEvent({
    title: event.enhanced.event,
    start: event.enhanced.start,
    end: event.enhanced.end,
    attendees: event.enhanced.people
  });
}
```

---

## 📞 URL Usage

```bash
# Use Enhanced version
?name=Harms%2C%20J%20%2A&days=4&version=enhanced

# Or version=5.0
?name=Sick&days=4&version=5.0

# With test date
?name=Sick&days=4&version=enhanced&testDate=2025-12-15
```

---

## 🔍 Troubleshooting

### Q: I'm getting simple format, not enhanced?
**A:** Make sure you're using `?version=enhanced` or set `ACTIVE_VERSION = "ENHANCED"` in Main.gs

### Q: Status is always false?
**A:** Check that your sheet has actual TRUE/FALSE values in the checkbox columns. Click the cell to verify.

### Q: Crew array is empty?
**A:** The crew columns might be beyond the range we're reading. Verify the sheet layout matches rows 11-52, columns A-R.

### Q: AUTH events have null times?
**A:** This is intentional! AUTH is a day-level duty without specific time slots.

---

**Ready to use Enhanced v5.0!** 🚀

All the structured data you need for building rich user interfaces.
