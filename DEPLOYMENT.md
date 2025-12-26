# TPS Schedule - Deployment Guide

**Version:** 6.0 (Smart Sheet Finding)
**Last Updated:** December 26, 2025

This guide walks you through deploying the TPS Schedule system from scratch.

---

## 📋 Prerequisites

- ✅ Google account with access to your squadron schedule spreadsheet
- ✅ Spreadsheet ID (from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/...`)
- ✅ Basic familiarity with Google Apps Script
- ✅ (Optional) GitHub account for hosting frontend

---

## 🚀 Part 1: Deploy Google Apps Script Backend

### Step 1: Create Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **"New project"**
3. Rename project to "TPS-Schedule" (click "Untitled project" at top)

### Step 2: Add Script Files

Copy these files to your Apps Script project in this order:

#### File 1: Config.gs
```javascript
// Copy entire contents of Config.gs
```
- Click **+** next to "Files"
- Select "Script"
- Name it "Config"
- Paste contents

#### File 2: Main.gs
- **Already exists!** Just replace the contents
- Paste entire Main.gs content

#### File 3-9: Remaining Files
Repeat the process for:
3. BatchProcessor.gs
4. SmartSheetFinder.gs
5. TriggerSetup.gs
6. DiagnosticChecks.gs
7. Enhanced.gs
8. TPS-Schedule-SIMPLIFIED.gs
9. TPS-Schedule-OPTIMIZED.gs

**Important:** Keep the exact file names!

### Step 3: Configure Settings

1. Open **Config.gs**
2. Update these values:

```javascript
const SEARCH_CONFIG = {
  // REQUIRED: Your spreadsheet ID
  spreadsheetId: 'PASTE_YOUR_SPREADSHEET_ID_HERE',

  // REQUIRED: Your timezone
  // Find yours at: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  timezone: 'America/Los_Angeles',

  // Optional: Default search name
  searchTerm: 'Sick',

  // Leave these as-is:
  testMode: false,
  testDate: null
};
```

3. **Save** (Ctrl/Cmd + S)

### Step 4: Test Configuration

1. Select function: `testFindNextSheet`
2. Click **Run** (▶️)
3. **First run:** You'll need to authorize:
   - Click "Review permissions"
   - Choose your Google account
   - Click "Advanced" → "Go to TPS-Schedule (unsafe)"
   - Click "Allow"
4. Check **Execution log** for output:
   ```
   ✅ Found next available sheet: "Mon 5 Jan" (11 days from 2025-12-25)
   ```

**If you see errors:**
- "Spreadsheet not found" → Check your spreadsheet ID
- "No sheets found" → Run `checkAvailableSheets()` to see what exists

### Step 5: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click gear icon ⚙️ next to "Select type"
3. Select **"Web app"**
4. Configure:
   - **Description:** "TPS Schedule API v6.0"
   - **Execute as:** "Me" (your account)
   - **Who has access:** "Anyone" (or "Anyone with Google account" for restricted access)
5. Click **Deploy**
6. **Copy the Web App URL** - you'll need this!
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### Step 6: Test API Endpoint

Test in browser or terminal:
```bash
curl "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?name=Sick&days=7"
```

You should get JSON response with events.

### Step 7: Set Up Batch Processing

1. In Apps Script editor, select function: `setupAllTriggers`
2. Click **Run** (▶️)
3. Check **Execution log**:
   ```
   ✅ Created trigger: batchProcessSchedule (every 15 minutes)
   ```

4. Verify triggers:
   - Click ⏰ (clock icon) in left sidebar
   - You should see:
     - `batchProcessSchedule` - Time-driven, Every 15 minutes

5. **First batch run:** Select `batchProcessSchedule` and click Run
   - This populates the cache initially
   - Takes ~1 minute
   - Check log for:
     ```
     === Batch Processing Complete ===
     Duration: 0.89 minutes
     People processed: 292
     Events found: 1234
     ```

### Step 8: Verify Cache is Working

1. Select function: `checkCacheDateFormats`
2. Click **Run**
3. Should show cached data:
   ```
   Person: Sick
   Days array: ["2026-01-05","2026-01-06",...]
   Last updated: 2025-12-26T12:30:00.000Z
   ✅ Date is in ISO format (YYYY-MM-DD)
   ```

**If cache is empty:**
- Run `batchProcessSchedule()` manually
- Check for errors in execution log

---

## 🌐 Part 2: Deploy Frontend

### Option A: GitHub Pages (Recommended)

#### Prerequisites
- GitHub repository for your project
- GitHub Pages enabled

#### Steps

1. **Update API URL in index.html**

```javascript
// File: docs/index.html
// Line ~94

const CORRECT_API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

2. **Commit and Push**

```bash
git add docs/index.html
git commit -m "Update API URL for deployment"
git push origin main
```

3. **Enable GitHub Pages**
   - Go to repository → Settings → Pages
   - Source: Deploy from branch
   - Branch: `main` → `/docs` folder
   - Click Save

4. **Access Your Site**
   - URL will be: `https://YOUR_USERNAME.github.io/TPS-Schedule/`
   - Wait 1-2 minutes for first deployment

#### Test
- Open the URL in browser
- Enter a name (e.g., "Sick")
- Should load schedule instantly (<1 second)
- Check browser console for migration messages:
  ```
  🔄 Migrating to new API URL with batch cache...
  🔄 Removing test mode (now using live dates)...
  ```

---

### Option B: Apps Script HTML Service

Simpler, no GitHub needed, but less flexible.

#### Steps

1. **Add HTML File to Apps Script**
   - In your Apps Script project
   - Click **+** → HTML file
   - Name it "WebApp"
   - Copy entire contents of `WebApp.html`

2. **Auto-Detection**
   - WebApp.html automatically detects the correct API URL
   - No configuration needed!

3. **Deploy**
   - Already done! (Same deployment as backend)
   - Access URL from deployment:
     ```
     https://script.google.com/macros/s/YOUR_ID/exec
     ```

4. **Test**
   - Open URL in browser
   - Simpler UI, but fully functional

---

## ✅ Part 3: Verification & Testing

### Verification Checklist

Run these checks to ensure everything works:

#### 1. Backend Health Check
```javascript
runAllDiagnostics();
```

Expected output:
- ✅ Triggers: 1 active (`batchProcessSchedule`)
- ✅ Last batch run: < 15 minutes ago
- ✅ Cache: Populated with 292 people
- ✅ Sheets: 5-7 available sheets found

#### 2. Smart Sheet Finding
```javascript
testSmartSheetRange();
```

Expected output:
```
Found next available sheet: "Mon 5 Jan" (11 days from 2025-12-25)
Looking for 7 days worth of sheets

  ✅ Day +0: Mon 5 Jan (2026-01-05)
  ✅ Day +1: Tue 6 Jan (2026-01-06)
  ✅ Day +2: Wed 7 Jan (2026-01-07)
  ...

Found 7 available sheets out of 7 days requested
```

#### 3. API Response Time

Test cache hit (should be <1 second):
```bash
time curl "https://script.google.com/macros/s/YOUR_ID/exec?name=Sick"
```

#### 4. Frontend Loading

- Open frontend URL
- Search for a name
- Should load instantly with:
  - ⚡ "Cached" indicator
  - Tier badge (green "all")
  - Update timestamp (within last 15 min)

---

## 🔧 Part 4: Customization

### Adjust Number of Days Displayed

**Frontend (docs/index.html):**
```javascript
const DEFAULT_CONFIG = {
  searchName: 'Sick',
  daysAhead: 7,  // Change this number
  ...
};
```

**Backend (BatchProcessor.gs):**
```javascript
function batchProcessSchedule() {
  return batchProcessAll(7); // Change this number
}
```

**Note:** Keep frontend and backend in sync!

### Change Batch Processing Frequency

**Current:** Every 15 minutes during work hours (5 AM - 8 PM Pacific)

**Overnight Hours Optimization:**
- Batch processing automatically skips 8 PM - 5 AM Pacific (9 hours)
- Saves quota when schedules don't change overnight
- Frontend shows "Next update: 5:00 AM" during overnight hours

**To change interval:**
```javascript
// TriggerSetup.gs

function setupAllTriggers() {
  // ... existing code ...

  ScriptApp.newTrigger('batchProcessSchedule')
    .timeBased()
    .everyMinutes(15)  // Change to: 1, 5, 10, 15, or 30
    .create();
}
```

**Valid intervals:** 1, 5, 10, 15, 30 minutes

**Quota impact (with overnight skip):**
- Trigger fires: 96 times/day (every 15 min × 24 hours)
- Actually processes: ~60 times/day (15 hours work × 4 runs/hour)
- Quota used: 60 runs × 0.9 min = **54 min/day (60% quota)**
- Saved vs 24/7: 32 min/day (36% savings)

**Without overnight skip (if disabled):**
- Every 15 min: 96 runs × 0.9 min = 86 min/day (96% quota)
- Every 30 min: 48 runs × 0.9 min = 43 min/day (48% quota)

### Change Default Search Name

```javascript
// Config.gs
const SEARCH_CONFIG = {
  searchTerm: 'YourNameHere',  // Change default name
  ...
};
```

### Adjust Cache TTL

**Current:** 6 hours (21,600 seconds)

```javascript
// BatchProcessor.gs
// Line ~164

cache.put(cacheKey, json, 21600); // Change seconds here
```

**Note:** Google Apps Script max TTL is 6 hours (21,600 seconds)

### Hidden Manual Refresh Feature

**What it does:**
- Allows users to force a fresh data fetch without waiting for auto-refresh
- Hidden feature activated by triple-tapping the "Squadron Schedule" header

**How to use:**
1. Open the web app in your browser
2. Quickly tap "Squadron Schedule" three times
3. You'll see a 🔄 icon appear briefly
4. Fresh data is fetched from the API

**Technical details:**
- Frontend feature only (fetches from cache, doesn't trigger batch process)
- Shows visual feedback during refresh
- Tap detection window: 500ms
- Resets after successful triple-tap or timeout

**Note:** This fetches the latest cached data from the API. To truly refresh the cache, run `batchProcessSchedule()` manually in Apps Script.

---

## 🐛 Troubleshooting

### Issue: "Spreadsheet not found"

**Cause:** Wrong spreadsheet ID or no access

**Fix:**
1. Verify spreadsheet ID in Config.gs
2. Make sure your Google account has access to the spreadsheet
3. Try opening the spreadsheet URL directly:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_ID/edit
   ```

---

### Issue: "No sheets found"

**Cause:** Sheet names don't match expected format

**Fix:**
1. Run `checkAvailableSheets()` to see actual sheet names
2. Verify sheets are named like: "Mon 5 Jan" or "Monday, 5 Jan"
3. Check that dates in sheet names are current (not old dates)

---

### Issue: Triggers not running

**Symptoms:**
- Cache is stale (>1 hour old)
- `checkTriggerExecutionStatus()` shows old timestamp

**Fix:**
1. Check trigger execution logs:
   - Apps Script → ⏰ → Executions tab
   - Look for errors
2. Re-create triggers:
   ```javascript
   deleteAllBatchTriggers();
   setupAllTriggers();
   ```
3. Check quotas:
   - Apps Script → ⚙️ → Project settings
   - Scroll to "Quotas"
   - Ensure you haven't hit 90 min/day limit

---

### Issue: "Failed to fetch" on frontend

**Cause:** CORS or wrong API URL

**Fix:**
1. Clear browser localStorage:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
2. Verify API URL in code matches deployment
3. Test API directly in browser:
   ```
   https://script.google.com/macros/s/YOUR_ID/exec?name=Test
   ```

---

### Issue: Events showing on wrong dates

**Cause:** Timezone mismatch

**Fix:**
1. Check timezone in Config.gs:
   ```javascript
   timezone: 'America/Los_Angeles'  // Must match your location
   ```
2. Find correct timezone:
   - https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
3. Run `checkCacheDateFormats()` to verify

---

## 📊 Monitoring

### Daily Health Check

Run this once a day to monitor system health:

```javascript
runAllDiagnostics();
```

Watch for:
- ⚠️ Cache older than 30 minutes
- ⚠️ Quota usage above 80%
- ⚠️ Errors in execution log

### Weekly Maintenance

1. **Check execution logs** for errors
2. **Verify cache is updating** (< 15 min old)
3. **Review quota usage** (should be ~50-60%)
4. **Test frontend** loads quickly

---

## 🔄 Updating

### To Update Code

1. **Make changes** in Apps Script editor
2. **Test** with diagnostic functions
3. **Create new deployment:**
   - Deploy → Manage deployments
   - Click ✏️ (edit) on active deployment
   - Version → New version
   - Description: "v6.1 - Your changes"
   - Deploy

4. **Update frontend** (if API URL changed):
   - Update `CORRECT_API_URL` in index.html
   - Commit and push

### To Roll Back

1. Deploy → Manage deployments
2. Click ✏️ on deployment
3. Version → Select older version
4. Deploy

---

## 📝 Next Steps

After deployment:

1. ✅ Bookmark diagnostic functions for quick access
2. ✅ Set calendar reminder to run weekly health check
3. ✅ Share frontend URL with your team
4. ✅ Consider adding authentication if needed
5. ✅ Monitor execution logs for first week

---

## 🆘 Getting Help

If you encounter issues:

1. **Run diagnostics:**
   ```javascript
   runAllDiagnostics();
   ```

2. **Check execution logs:**
   - Apps Script → ⏰ → Executions
   - Look for red error entries

3. **Test individual components:**
   ```javascript
   testFindNextSheet();     // Sheet finding
   testSmartSheetRange();   // Range finding
   batchProcessSchedule();  // Batch processing
   ```

4. **Review configuration:**
   - Spreadsheet ID correct?
   - Timezone correct?
   - Triggers active?

---

**Deployment complete! 🎉**

Your TPS Schedule system should now be running with:
- ✅ Smart sheet finding
- ✅ Automatic batch processing every 15 minutes
- ✅ Instant cache-based page loads
- ✅ Mobile-friendly frontend

Happy scheduling! 📅
