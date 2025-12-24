# 🧪 Test Mode Guide - TPS-Schedule v3.1

## Overview

Test Mode allows you to simulate any date as "today" for testing purposes. This is perfect for:
- **Holidays** when there are no scheduled events
- **Testing** with historical data that you know has events
- **Development** without waiting for actual scheduled days
- **Demonstrations** showing the widget with real data

---

## 🚀 Quick Start

### Easiest Way: Run `testMon15Dec()`

1. Open your Google Apps Script editor
2. Select **`testMon15Dec`** from the function dropdown
3. Click **▶️ Run**
4. View results in execution log

This tests with Mon 15 Dec 2024 (which has events in your whiteboard) as "today".

---

## 📋 Three Ways to Use Test Mode

### Method 1: Helper Functions (Recommended)

Run these in the Apps Script editor:

```javascript
// Quick test with Mon 15 Dec as "today"
testMon15Dec()

// Test with any date
testWithDate("2024-12-15")                    // Mon 15 Dec, search "Sick", 4 days
testWithDate("2024-12-15", "Montes")          // Mon 15 Dec, search "Montes"
testWithDate("2024-12-15", "Sick", 3)         // Mon 15 Dec, 3 days ahead
testWithDate("2024-12-16")                    // Tue 16 Dec
testWithDate("2024-12-11")                    // Thu 11 Dec

// Simulate web request with test date
testWebRequestWithDate("2024-12-15")
testWebRequestWithDate("2024-12-15", "Montes", 3)

// Compare test vs live
compareTestVsLive("2024-12-15", "Sick")
```

### Method 2: URL Parameter (For Widget Testing)

Add `&testDate=YYYY-MM-DD` to your widget's API call:

```javascript
// In your index.html widget
const url = `${config.webAppUrl}?name=Sick&days=4&testDate=2024-12-15`;
```

**Example URLs:**
```
?name=Sick&days=4&testDate=2024-12-15         // Mon 15 Dec as "today"
?name=Montes&days=3&testDate=2024-12-16       // Tue 16 Dec as "today"
?name=Sick&days=4&testDate=2024-12-11         // Thu 11 Dec as "today"
```

### Method 3: Enable in Config (Permanent)

In `TPS-Schedule-OPTIMIZED.gs`, modify `SEARCH_CONFIG`:

```javascript
const SEARCH_CONFIG = {
  // ... other config ...

  // Enable test mode
  testMode: true,              // ← Set to true
  testDate: "2024-12-15"       // ← Your test date
};
```

**Important:** Remember to set `testMode: false` before deploying to production!

---

## 🧪 Test Functions

### `testMon15Dec()` - Quick Test
The fastest way to test with known good data.

```javascript
testMon15Dec()
```

**Output:**
```
🧪 QUICK TEST: Mon 15 Dec 2024
============================================================
   Simulated Today: 2024-12-15
   Search Name: Sick
   Days Ahead: 4

📊 SUMMARY:
   🧪 Test Mode: ENABLED
   📅 Simulated Today: 2024-12-15
   🔍 Search name: Sick
   📆 Days searched: 4
   📅 Days with events: 3
   📋 Total events: 7

🔍 SHEETS SEARCHED:
   ✓ Mon 15 Dec (2024-12-15): 3 events
   ✓ Tue 16 Dec (2024-12-16): 2 events
   ✓ Wed 17 Dec (2024-12-17): 2 events
   ✗ Thu 18 Dec (2024-12-18): 0 events
```

---

### `testWithDate(date, name, days)` - Custom Test
Test with any date and parameters.

```javascript
testWithDate("2024-12-15", "Montes", 3)
```

**Parameters:**
- `date` (required): "YYYY-MM-DD" format
- `name` (optional): Name to search, default "Sick"
- `days` (optional): Days ahead, default 4

**Output:** Full test results with events listed

---

### `testWebRequestWithDate(date, name, days)` - Simulate API Call
Simulates exactly what happens when your widget calls the API.

```javascript
testWebRequestWithDate("2024-12-15")
```

**Output:**
```
🧪 Simulating Web Request with Test Date
============================================================

Simulated URL: ?name=Sick&days=4&testDate=2024-12-15

✅ SUCCESS:
   🧪 Test Mode: ENABLED
   📅 Simulated Today: 2024-12-15
   🔍 Search name: Sick
   📋 Total events: 7
   📦 Version: 3.1 (OPTIMIZED)
```

---

### `compareTestVsLive(date, name)` - Compare Results
See differences between test date and actual today.

```javascript
compareTestVsLive("2024-12-15", "Sick")
```

**Output:**
```
🧪 COMPARISON: Test Date vs Live Date
============================================================

📅 FETCHING WITH TEST DATE: 2024-12-15
📅 FETCHING WITH LIVE DATE (actual today)

📊 COMPARISON RESULTS:
============================================================

🧪 TEST MODE (2024-12-15):
   Sheets searched: Mon 15 Dec, Tue 16 Dec, Wed 17 Dec, Thu 18 Dec
   Events found: 7

✅ LIVE MODE (actual today):
   Sheets searched: Tue 24 Dec, Wed 25 Dec, Thu 26 Dec, Fri 27 Dec
   Events found: 0

💡 INSIGHT:
   ✅ Test date has events, live date has none
   → This is expected during holidays or off-schedule periods
   → Use test mode to verify the script works correctly
```

---

## 🌐 Testing from Your Widget

### Option 1: Temporary Test Mode

Modify your widget's fetch call to include testDate:

```javascript
// In index.html, around line 242
const fetchSchedule = async (searchName) => {
  // Add testDate parameter for testing
  const url = `${config.webAppUrl}?name=${encodeURIComponent(searchName)}&days=${config.daysAhead}&testDate=2024-12-15`;

  const response = await fetch(url);
  // ... rest of code
};
```

### Option 2: Add Test Mode Toggle to Widget

Add a test mode toggle to your widget UI:

```javascript
// Add to DEFAULT_CONFIG
const DEFAULT_CONFIG = {
  searchName: 'Sick',
  daysAhead: 4,
  webAppUrl: 'https://...',
  testMode: false,           // ← NEW
  testDate: '2024-12-15'     // ← NEW
};

// Update fetchSchedule
const fetchSchedule = async (searchName) => {
  let url = `${config.webAppUrl}?name=${encodeURIComponent(searchName)}&days=${config.daysAhead}`;

  // Add testDate if test mode is enabled
  if (config.testMode && config.testDate) {
    url += `&testDate=${config.testDate}`;
  }

  const response = await fetch(url);
  // ... rest of code
};
```

Then add a toggle in your settings panel.

---

## 📊 Understanding Test Mode Output

### JSON Response Changes

When test mode is active, the API response includes additional fields:

```json
{
  "searchName": "Sick",
  "events": [...],
  "totalEvents": 7,
  "optimized": true,
  "version": "3.1",
  "testMode": true,              // ← NEW: Indicates test mode is active
  "simulatedToday": "2024-12-15" // ← NEW: The date being used as "today"
}
```

### Console Log Indicators

Look for these in Apps Script execution logs:

```
🧪 TEST MODE: Using URL parameter testDate = 2024-12-15
🧪 TEST MODE: Using config testDate = 2024-12-15
✅ LIVE MODE: Using actual date = 2024-12-24
```

---

## 🎯 Common Test Scenarios

### Scenario 1: Testing During Holidays

**Problem:** Today is Dec 24 (holiday), no events scheduled
**Solution:** Test with Mon 15 Dec which has events

```javascript
testMon15Dec()
```

### Scenario 2: Demonstrating the Widget

**Problem:** Need to show widget to someone but no events today
**Solution:** Use URL parameter

```
https://your-script-url.../exec?name=Sick&days=4&testDate=2024-12-15
```

### Scenario 3: Verifying Cache Works

**Problem:** Want to test caching but keep getting cache misses
**Solution:** Run same test twice

```javascript
// First run (cache miss)
testWithDate("2024-12-15")

// Second run (cache hit - should be <1s)
testWithDate("2024-12-15")
```

### Scenario 4: Testing Different Names

**Problem:** Want to test with different personnel
**Solution:**

```javascript
testWithDate("2024-12-15", "Montes")
testWithDate("2024-12-15", "Johnson")
testWithDate("2024-12-15", "Sick")
```

### Scenario 5: Debugging Sheet Name Mismatches

**Problem:** Script can't find sheets for certain dates
**Solution:** Use test mode to see what sheet names are generated

```javascript
testWithDate("2024-12-15")  // Check the "SHEETS SEARCHED" section
```

---

## ⚠️ Important Notes

### Cache Behavior with Test Mode

Test mode requests are cached separately from live requests:

```
Cache key format: events_{sheetName}_{searchName}_v3

Examples:
- Live mode: "events_Tue 24 Dec_sick_v3"
- Test mode: "events_Mon 15 Dec_sick_v3"
```

This means test mode won't pollute your live cache.

### Production Deployment Checklist

Before deploying to production:

- [ ] Set `testMode: false` in SEARCH_CONFIG
- [ ] Remove any hardcoded `testDate` parameters from widget
- [ ] Remove test mode toggles from UI (unless you want users to have it)
- [ ] Test with live data first
- [ ] Deploy new version

### URL Parameter Priority

The order of precedence for determining "today":

1. **URL parameter `testDate`** (highest priority)
2. **Config `SEARCH_CONFIG.testMode` and `testDate`**
3. **Actual current date** (lowest priority)

This means:
- URL parameter always wins
- Config setting only applies if no URL parameter
- Live date used if neither test mode option is set

---

## 🔍 Debugging Test Mode

### Check If Test Mode Is Active

Run any test function and look for these in the output:

```javascript
testWithDate("2024-12-15")

// Look for:
   🧪 Test Mode: ENABLED              // ← Should show ENABLED
   📅 Simulated Today: 2024-12-15     // ← Should show your test date
```

### Verify Sheets Are Being Searched

Look at the "SHEETS SEARCHED" section:

```
🔍 SHEETS SEARCHED:
   ✓ Mon 15 Dec (2024-12-15): 3 events   // ← ✓ = found sheet and events
   ✗ Tue 16 Dec (2024-12-16): 0 events   // ← ✗ = sheet not found OR no events
```

If you see all `✗`, the issue might be:
- Sheet names don't match expected format
- Date calculation is wrong
- Sheets don't exist for those dates

### Compare Sheet Names

```javascript
// See what sheet name is generated for a date
const parts = "2024-12-15".split('-');
const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
const sheetName = generateSheetName(date);
console.log(sheetName);  // Should output: "Mon 15 Dec"
```

Then check if that exact sheet name exists in your spreadsheet.

---

## 📅 Test Date Reference

Here are dates from your whiteboard that have events:

| Date | Day | Sheet Name | Has Events? |
|------|-----|------------|-------------|
| 2024-12-11 | Thursday | Thu 11 Dec | ✅ Yes |
| 2024-12-12 | Friday | Fri 12 Dec | ✅ Yes |
| 2024-12-15 | Monday | Mon 15 Dec | ✅ Yes (recommended for testing) |
| 2024-12-16 | Tuesday | Tue 16 Dec | ✅ Yes |
| 2024-12-17 | Wednesday | Wed 17 Dec | ✅ Yes |

**Recommended test date:** `2024-12-15` (Mon 15 Dec)

---

## 🎓 Examples

### Example 1: Basic Testing

```javascript
// Test with Mon 15 Dec
testMon15Dec()

// Expected: Should show events for Sick on Mon 15 Dec + 3 more days
```

### Example 2: Testing Performance

```javascript
// First run (cache miss)
console.log("=== FIRST RUN (cache miss) ===");
testWithDate("2024-12-15")

// Second run (cache hit)
console.log("\n=== SECOND RUN (cache hit) ===");
testWithDate("2024-12-15")

// Expected: Second run should be much faster (<1s)
```

### Example 3: Testing Widget Integration

```html
<!-- In your index.html -->
<script>
  // Add test mode configuration
  const DEFAULT_CONFIG = {
    searchName: 'Sick',
    daysAhead: 4,
    webAppUrl: 'https://script.google.com/.../exec',
    testDate: '2024-12-15'  // ← Add this
  };

  // Modify fetchSchedule
  const fetchSchedule = async (searchName) => {
    // Use testDate during development
    const url = `${config.webAppUrl}?name=${encodeURIComponent(searchName)}&days=${config.daysAhead}&testDate=${config.testDate}`;

    // For production, remove &testDate=...
    // const url = `${config.webAppUrl}?name=${encodeURIComponent(searchName)}&days=${config.daysAhead}`;

    const response = await fetch(url);
    const data = await response.json();

    console.log("Test mode active:", data.testMode);
    console.log("Simulated today:", data.simulatedToday);

    // ... rest of code
  };
</script>
```

---

## ✅ Verification Checklist

After enabling test mode, verify:

- [ ] `testMon15Dec()` returns events
- [ ] Console shows "🧪 TEST MODE: Using..."
- [ ] Response includes `"testMode": true`
- [ ] Response includes `"simulatedToday": "2024-12-15"`
- [ ] Sheet names match expected format (e.g., "Mon 15 Dec")
- [ ] Events are found (totalEvents > 0)
- [ ] Second run is faster (cache working)

---

## 🆘 Troubleshooting

### "No events found" when testing

**Check:**
1. Is the test date correct format? (YYYY-MM-DD)
2. Does that date exist in your whiteboard? (check sheet tabs)
3. Is the sheet name format correct? (e.g., "Mon 15 Dec" not "Monday 15 Dec")
4. Does "Sick" appear in events on that sheet?

### Test mode not activating

**Check:**
1. Did you set `testMode: true` in config? OR
2. Are you passing `testDate` parameter?
3. Look for "🧪 TEST MODE" in console logs
4. Check response has `testMode: true`

### Widget still shows no data with test mode

**Check:**
1. Did you add `&testDate=2024-12-15` to the URL?
2. Check browser console for errors
3. Verify API response includes test mode fields
4. Try testing directly in Apps Script first

---

## 🚀 Next Steps

1. **Test locally:** Run `testMon15Dec()` in Apps Script editor
2. **Test API:** Run `testWebRequestWithDate("2024-12-15")`
3. **Test widget:** Add `&testDate=2024-12-15` to widget URL
4. **Compare:** Run `compareTestVsLive()` to see the difference
5. **Deploy:** When satisfied, disable test mode and deploy

Happy testing! 🎉
