# Batch Processing Setup & Testing Guide

## Overview

The batch processing system pre-processes all squadron members' schedules every 5 minutes and caches the results for instant retrieval (<100ms).

**User Experience:**
- **Before:** 60 seconds to load schedule ❌
- **After:** <100ms to load schedule ✅

---

## Setup Steps

### 1. Add BatchProcessor.gs to Your Project

1. Open your Google Apps Script project
2. **Files** → **+ → Script**
3. Name it: `BatchProcessor.gs`
4. Copy the entire content of `BatchProcessor.gs` from the repo
5. Click **Save**

### 2. Update Main.gs

The Main.gs file has been updated to check cache first before routing to other versions.

**What it does:**
```
User requests schedule
     ↓
Check CacheService (FAST)
     ↓
Cache HIT? → Return instantly (<100ms) ✅
     ↓
Cache MISS? → Process in real-time (~30s) → Cache result
```

### 3. Set Up Time-Based Trigger

This is the magic that keeps the cache fresh!

#### Steps:
1. In Apps Script Editor, click **Triggers** (clock icon on left)
2. Click **+ Add Trigger** (bottom right)
3. Configure:
   - **Function:** `batchProcessAllSchedules`
   - **Event source:** Time-driven
   - **Type of time based trigger:** Minutes timer
   - **Select minute interval:** Every 5 minutes
4. Click **Save**
5. Authorize permissions if prompted

**What this does:**
- Every 5 minutes, automatically processes all schedules
- Updates cache for all squadron members
- Takes 10-60 seconds in background (users don't wait)

---

## Testing

### Test 1: Batch Processor (Full Run)

```javascript
testBatchProcessor()
```

**Run from:** Apps Script Editor → Select function → Run

**Expected output:**
```
=== Starting Batch Processing ===
Processing 5 sheets...
Processing 50 people...

Processing sheet: Monday, 15 Dec
✓ Sheet processed in 5.23s

... (repeat for each sheet)

=== Caching Results ===
⚠ Large cache for Vantiger: 45.32 KB

=== Batch Processing Complete ===
Total Duration: 25.67s
Sheets Processed: 5/5
People Processed: 50/50
Events Found: 423
Total Cache Size: 1.23 MB
Average Per Person: 25.12 KB
Errors: 0

=== Detailed Sheet Metrics ===
Monday, 15 Dec: 5.23s, 87 events
Tuesday, 16 Dec: 4.98s, 82 events
...

=== Top 10 Largest Caches ===
Vantiger: 45.32 KB, 23 events
Payne: 38.21 KB, 19 events
...

=== Cache Size Analysis ===
Total: 1.23 MB
Average: 25.12 KB per person
Maximum: 45.32 KB
CacheService limit: 1024 KB per entry, 10 MB total
Within limits: YES ✓
```

**What to look for:**
- ✅ All sheets processed
- ✅ All people processed
- ✅ No errors
- ✅ Total cache size < 10 MB
- ✅ Max person size < 1024 KB
- ✅ Total duration < 300s (5 min)

**Troubleshooting:**
- **Errors:** Check sheet names match expected format
- **No people found:** Check Student/Staff List (rows 120-169)
- **Timeout:** Reduce number of days or optimize queries

---

### Test 2: Cache Retrieval Speed

```javascript
testCacheRetrievalSpeed()
```

**Expected output:**
```
=== Testing Cache Retrieval Speed ===

Vantiger: 12ms, 45.32 KB, 23 events
Payne: 8ms, 38.21 KB, 19 events
Sick: 15ms, 42.11 KB, 21 events
Coleman: 6ms, 31.44 KB, 15 events
Lovell: 9ms, 33.78 KB, 16 events
```

**What to look for:**
- ✅ All retrievals < 100ms
- ✅ Most < 20ms
- ✅ Cache HITs (no MISS)

---

### Test 3: Cache Size Analysis

```javascript
analyzeCacheSizes()
```

**Expected output:**
```
Top 10 largest caches:
Vantiger: 45.32 KB
Payne: 38.21 KB
Sick: 42.11 KB
...

Total: 1234.56 KB (1.21 MB)
Average: 24.69 KB
Maximum: 45.32 KB
CacheService 10MB limit: 12.1% used
```

**What to look for:**
- ✅ Total < 10 MB (10,000 KB)
- ✅ Max person < 1024 KB
- ✅ Reasonable % of limit used

**If limits exceeded:**
- See CACHE_STORAGE_ANALYSIS.md for solutions
- Consider compression (not needed for <80% usage)
- Use spreadsheet backup cache

---

### Test 4: End-to-End User Experience

**Simulate user request:**

1. **First request (cache miss):**
   ```
   https://script.google.com/.../exec?name=Vantiger&days=4
   ```
   Expected: ~30s (real-time processing)

2. **Second request (cache hit):**
   ```
   https://script.google.com/.../exec?name=Vantiger&days=4
   ```
   Expected: <100ms (instant!)

3. **After 5 min (cache refreshed):**
   ```
   https://script.google.com/.../exec?name=Vantiger&days=4
   ```
   Expected: <100ms (still cached, refreshed in background)

---

## Monitoring

### Check Batch Metadata

```javascript
getBatchMetadata()
```

**Output:**
```json
{
  "lastRun": "2025-12-25T04:15:32.456Z",
  "duration": 25.67,
  "sheetsProcessed": 5,
  "peopleProcessed": 50,
  "eventsFound": 423,
  "totalCacheSizeMB": "1.23",
  "averagePersonSizeKB": "25.12",
  "errors": 0
}
```

### Check Processing Log

1. Open your Google Sheet
2. Look for new sheet: **BatchProcessingLog**
3. Review recent runs

**Columns:**
- Timestamp
- Duration (s)
- Sheets Processed
- People Processed
- Events Found
- Cache Size (MB)
- Avg Person Size (KB)
- Errors
- Status

---

## Performance Expectations

### Batch Processing (Background)

| Squadron Size | Sheets | Total Events | Processing Time | Cache Size |
|---------------|--------|--------------|-----------------|------------|
| 20 people | 5 | ~400 | 10-20s | ~400 KB |
| 50 people | 5 | ~1,000 | 20-40s | ~1 MB |
| 100 people | 5 | ~2,000 | 40-80s | ~2 MB |
| 200 people | 5 | ~4,000 | 80-180s | ~4 MB |

**Trigger frequency:** Every 5 minutes
**Impact on users:** Zero (runs in background)

### User Requests (Foreground)

| Scenario | Response Time | Cache Status |
|----------|---------------|--------------|
| **Cache HIT** | <100ms | Served from cache ✅ |
| **Cache MISS** | ~30s | Real-time processing |
| **After batch run** | <100ms | Pre-populated cache ✅ |

**Expected cache hit rate:** >99% (refreshes every 5 min)

---

## Troubleshooting

### Issue: "No people found in Student/Staff List"

**Cause:** Rows 120-169 are empty or incorrectly formatted

**Fix:**
1. Check sheet has Student/Staff List in rows 120-169
2. Ensure column A has names
3. Ensure column B has class (Alpha, Bravo, etc.)

---

### Issue: "Sheet not found for Monday, 15 Dec"

**Cause:** Sheet name doesn't match expected format

**Fix:**
1. Check sheet names match: "Monday, 15 Dec" or "Monday Dec 15"
2. Ensure dates are current (today + next 4 days)
3. Check `getRelevantSheets()` function logic

---

### Issue: "Timeout during batch processing"

**Cause:** Processing taking > 6 minutes (Google Apps Script limit)

**Fix:**
1. Reduce number of days (5 → 3)
2. Reduce number of people processed per batch
3. Optimize queries (already using bulk reads)
4. Consider processing in chunks

---

### Issue: "Cache size exceeds limits"

**Cause:** Too much data per person

**Fix:**
1. Check CACHE_STORAGE_ANALYSIS.md
2. Verify cache sizes with `analyzeCacheSizes()`
3. If > 1024 KB per person: Implement compression
4. If > 10 MB total: Use spreadsheet backup cache

---

### Issue: "Cache not updating"

**Cause:** Trigger not running or error in batch processor

**Fix:**
1. Check **Triggers** page for errors
2. Check **Executions** page for recent runs
3. Run `testBatchProcessor()` manually
4. Check BatchProcessingLog sheet for errors

---

## Clearing Caches (For Testing)

```javascript
clearAllCaches()
```

**What it does:**
- Removes all cached schedules
- Removes batch metadata
- Forces fresh processing on next request

**When to use:**
- Testing batch processor
- Testing cache miss behavior
- Clearing stale data after major changes

---

## Deployment Checklist

- [ ] BatchProcessor.gs added to project
- [ ] Main.gs updated with cache retrieval logic
- [ ] Time-based trigger created (every 5 min)
- [ ] Trigger authorized with permissions
- [ ] Test batch processor runs successfully
- [ ] Test cache retrieval speed (<100ms)
- [ ] Test cache sizes within limits
- [ ] Test end-to-end user experience
- [ ] Check BatchProcessingLog sheet created
- [ ] Monitor first few runs for errors
- [ ] Deploy to production
- [ ] Update frontend to handle instant responses

---

## Next Steps After Setup

1. **Monitor Performance:**
   - Check BatchProcessingLog regularly
   - Watch for errors or slow runs
   - Verify cache hit rates

2. **Optimize If Needed:**
   - Reduce days if processing takes > 4 min
   - Implement compression if caches > 512 KB
   - Add spreadsheet backup if approaching 10 MB

3. **Update Frontend:**
   - Remove loading spinners (no longer needed!)
   - Show "Last updated: X min ago" from cache metadata
   - Handle instant responses properly

4. **Consider Enhancements:**
   - Add cache warming (pre-populate for common users)
   - Implement spreadsheet backup cache
   - Add monitoring dashboard
   - Set up email alerts for errors

---

## FAQ

### Q: What happens if the trigger fails?

**A:** Users get real-time processing (~30s) instead of cached data. The system degrades gracefully.

### Q: Can I change the trigger frequency?

**A:** Yes! 5 minutes is recommended, but you can use:
- 1 minute (more up-to-date, more quota usage)
- 10 minutes (less quota usage, less fresh data)
- 15 minutes (matches auto-refresh in app)

### Q: Does this use a lot of quota?

**A:** Quotas (per day):
- Script runtime: 6 hours (batch takes 30s every 5 min = ~2.4 hrs/day)
- URL fetch: 20,000 (not used)
- Email: 100 (not used)

**Verdict:** Well within limits for 5-min frequency

### Q: What if someone's schedule isn't cached?

**A:** They get real-time processing (~30s) and result is cached for next time.

### Q: Can I disable batch processing temporarily?

**A:** Yes! Disable the trigger in **Triggers** page. Users will get real-time processing.

---

## Success Criteria

✅ **Batch processing completes in < 5 minutes**
✅ **All people processed with no errors**
✅ **Cache sizes within limits (< 10 MB total, < 1 MB per person)**
✅ **User requests return in < 100ms (cache hit)**
✅ **Cache hit rate > 95%**
✅ **No timeout errors**
✅ **BatchProcessingLog shows successful runs**

---

**You've successfully implemented instant schedule loading! 🚀**

Users will now experience <100ms load times instead of 60 seconds!
