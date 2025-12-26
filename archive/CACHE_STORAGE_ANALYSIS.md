# Cache Storage Analysis & Strategy

## Google Apps Script Storage Limits

### CacheService (Primary - RECOMMENDED)
```
Per Entry: 1 MB (1,048,576 bytes)
Total Cache: 10 MB (all entries combined)
Expiration: 6 hours maximum
Speed: Very fast (<100ms)
Persistence: Volatile (cleared on redeploy)
```

**Verdict:** ✅ **Best option for our use case**
- 1MB per person is **huge** (typical JSON: 5-50 KB)
- 10MB total supports 200+ people easily
- 6 hour expiration perfect for schedule data (refreshes every 5 min anyway)

---

### PropertiesService (Backup - LIMITED)
```
Total Storage: 500 KB (524,288 bytes) FOR ALL PROPERTIES
Per Property: 9 KB (9,216 bytes)
Expiration: Never (persistent)
Speed: Slower (~200-500ms)
```

**Verdict:** ❌ **Too small for squadron-wide data**
- 500KB total = ~10-20 people max
- Not suitable as primary storage
- Could store metadata only

---

### Spreadsheet "Cache Sheet" (Alternative)
```
Total Storage: Unlimited
Per Cell: 50,000 characters
Speed: Moderate (~200-500ms)
Persistence: Permanent
```

**Verdict:** ✅ **Good backup option**
- Unlimited storage
- Slower than CacheService but acceptable
- Survives script redeployment
- Can be used as fallback

---

### External Storage (Advanced)
```
Options:
- Firebase Realtime Database (free tier: 1GB)
- Google Cloud Firestore (free tier: 1GB)
- MongoDB Atlas (free tier: 512MB)
- GitHub Gist/Repository
```

**Verdict:** 🤔 **Overkill for current needs**
- Requires external auth/setup
- Additional latency for API calls
- CacheService is sufficient

---

## Estimated Storage Requirements

### Typical Event JSON Size

**Single Event (Enhanced format):**
```javascript
{
  "date": "2025-12-15",
  "time": "07:00",
  "type": "Flying Events",
  "description": "T-38 - CCEP | Vantiger, Fogle, F",
  "rangeSource": "Flying Events",
  "enhanced": {
    "section": "Flying Events",
    "model": "T-38",
    "briefStart": "07:00",
    "etd": "11:30",
    "eta": "12:30",
    "debriefEnd": "13:30",
    "event": "CCEP",
    "crew": ["Vantiger", "Fogle", "F"],
    "notes": "Required for CFIT currency",
    "status": {
      "effective": false,
      "cancelled": false,
      "partiallyEffective": false
    }
  }
}
```

**Size:** ~450 bytes

---

### Person Schedule JSON Size Estimates

| Scenario | Events/Day | Days | Total Events | Estimated Size |
|----------|-----------|------|--------------|----------------|
| **Light** | 2 | 5 | 10 | ~5 KB |
| **Typical** | 4 | 5 | 20 | ~10 KB |
| **Busy** | 8 | 5 | 40 | ~20 KB |
| **Very Busy** | 15 | 5 | 75 | ~35 KB |
| **Extreme** | 30 | 5 | 150 | ~70 KB |

**Worst case (extremely busy person):** ~70 KB
**CacheService limit:** 1,024 KB (1 MB)

**Safety margin:** 14x headroom! ✅

---

### Squadron-Wide Storage Estimates

| Squadron Size | Avg Events/Person | Total Events | Total Cache Size | % of 10MB Limit |
|---------------|-------------------|--------------|------------------|-----------------|
| **20 people** | 20 | 400 | ~200 KB | 2% |
| **40 people** | 20 | 800 | ~400 KB | 4% |
| **60 people** | 20 | 1,200 | ~600 KB | 6% |
| **100 people** | 20 | 2,000 | ~1 MB | 10% |
| **200 people** | 20 | 4,000 | ~2 MB | 20% |

**Conclusion:** Even with 200 people, we only use **20% of CacheService**! ✅

---

## Compression Analysis

### JSON Compression Techniques

#### 1. **Minification (Remove Whitespace)**
```javascript
// Before (formatted):
{
  "name": "Vantiger",
  "events": [ ... ]
}

// After (minified):
{"name":"Vantiger","events":[...]}
```

**Savings:** ~20-30%
**Corruption risk:** None
**Implementation:** `JSON.stringify()` already minifies

---

#### 2. **Field Name Shortening**
```javascript
// Before:
{ "enhanced": { "section": "Flying Events" } }

// After:
{ "enh": { "sec": "FLY" } }
```

**Savings:** ~15-25%
**Corruption risk:** Medium (requires mapping)
**Recommendation:** ❌ Not needed, adds complexity

---

#### 3. **Gzip Compression**
```javascript
// Google Apps Script doesn't have native gzip
// Would need Utilities.base64Encode() + custom implementation
```

**Savings:** ~60-70%
**Corruption risk:** Low (if implemented correctly)
**Recommendation:** ⚠️ Only if needed (we're nowhere near limits)

---

### When to Compress?

**Current recommendation:** ❌ **Don't compress**

**Reasons:**
1. We're only using 2-20% of cache limits
2. JSON is already efficient
3. Compression adds complexity
4. Decompression adds latency
5. Risk of corruption

**If we exceed limits:** Use Spreadsheet backup instead

---

## Storage Strategy Recommendation

### **Primary: CacheService**
```javascript
// Store per-person schedules
cache.put(`schedule_${personName}`, json, 21600); // 6 hours
```

**Advantages:**
- Very fast (<100ms retrieval)
- 1MB per person (huge headroom)
- Automatic expiration (6 hours)
- Simple implementation

**Disadvantages:**
- Lost on script redeploy
- Requires periodic refresh

---

### **Backup: Spreadsheet Cache Sheet**
```javascript
// Create "ScheduleCache" sheet
// Columns: PersonName | JSON | LastUpdated

function cacheToSpreadsheet(personName, json) {
  const sheet = getOrCreateCacheSheet();
  const row = findPersonRow(personName);

  if (row) {
    sheet.getRange(row, 2).setValue(json);
    sheet.getRange(row, 3).setValue(new Date());
  } else {
    sheet.appendRow([personName, json, new Date()]);
  }
}

function getCachedFromSpreadsheet(personName) {
  const sheet = getCacheSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === personName) {
      return data[i][1]; // Return JSON
    }
  }

  return null;
}
```

**Advantages:**
- Unlimited storage
- Survives redeployment
- Can be manually reviewed/edited
- Permanent record

**Disadvantages:**
- Slower (~200-500ms vs <100ms)
- Requires sheet management
- Manual cleanup needed

---

### **Skip: PropertiesService**
**Why:** Only 500KB total - can fit ~10-20 people max. Not suitable.

---

## Fallback Strategy (3-Tier)

```javascript
function getSchedule(personName) {
  // Tier 1: CacheService (fastest)
  const cache = CacheService.getScriptCache();
  let json = cache.get(`schedule_${personName}`);

  if (json) {
    console.log('Cache HIT (CacheService)');
    return JSON.parse(json);
  }

  // Tier 2: Spreadsheet Cache (backup)
  json = getCachedFromSpreadsheet(personName);

  if (json) {
    console.log('Cache HIT (Spreadsheet)');
    // Refresh CacheService
    cache.put(`schedule_${personName}`, json, 21600);
    return JSON.parse(json);
  }

  // Tier 3: Real-time processing (last resort)
  console.log('Cache MISS - processing in real-time');
  const result = processScheduleInRealTime(personName);

  // Cache the result
  json = JSON.stringify(result);
  cache.put(`schedule_${personName}`, json, 21600);
  cacheToSpreadsheet(personName, json);

  return result;
}
```

---

## Performance Testing Plan

### Test 1: Single Sheet Processing Time
```javascript
function testSingleSheet() {
  const start = new Date();
  const sheetInfo = getRelevantSheets()[0];
  const people = getAllPeople();
  const results = processSheet(sheetInfo, people);
  const duration = (new Date() - start) / 1000;

  console.log(`Processed ${people.length} people in ${duration}s`);
  console.log(`Average: ${(duration / people.length * 1000).toFixed(2)}ms per person`);
}
```

**Expected:** ~2-10 seconds for 50 people (40-200ms per person)

---

### Test 2: Full Batch Processing Time
```javascript
function testFullBatch() {
  const result = batchProcessAllSchedules();

  console.log(`Total time: ${result.totalDuration}s`);
  console.log(`Sheets processed: ${result.sheetsProcessed}`);
  console.log(`People processed: ${result.peopleProcessed}`);
  console.log(`Average per sheet: ${(result.totalDuration / result.sheetsProcessed).toFixed(2)}s`);
}
```

**Expected:** ~10-50 seconds for 5 sheets × 50 people

---

### Test 3: Cache Size Analysis
```javascript
function analyzeCacheSizes() {
  const cache = CacheService.getScriptCache();
  const people = getAllPeople();
  const sizes = [];

  people.forEach(person => {
    const json = cache.get(`schedule_${person.name}`);
    if (json) {
      const sizeKB = (new Blob([json]).size / 1024).toFixed(2);
      sizes.push({ name: person.name, sizeKB: parseFloat(sizeKB) });
    }
  });

  sizes.sort((a, b) => b.sizeKB - a.sizeKB);

  console.log('Top 10 largest caches:');
  sizes.slice(0, 10).forEach(s => {
    console.log(`${s.name}: ${s.sizeKB} KB`);
  });

  const totalKB = sizes.reduce((sum, s) => sum + s.sizeKB, 0);
  const avgKB = totalKB / sizes.length;

  console.log(`\nTotal: ${totalKB.toFixed(2)} KB (${(totalKB/1024).toFixed(2)} MB)`);
  console.log(`Average: ${avgKB.toFixed(2)} KB`);
  console.log(`Maximum: ${sizes[0].sizeKB} KB`);
  console.log(`CacheService 10MB limit: ${((totalKB/1024)/10*100).toFixed(1)}% used`);
}
```

---

### Test 4: Retrieval Speed
```javascript
function testRetrievalSpeed() {
  const cache = CacheService.getScriptCache();
  const people = getAllPeople().slice(0, 20); // Test 20 people
  const times = [];

  people.forEach(person => {
    const start = new Date();
    const json = cache.get(`schedule_${person.name}`);
    const duration = new Date() - start;
    times.push(duration);
  });

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const max = Math.max(...times);

  console.log(`Average retrieval: ${avg.toFixed(2)}ms`);
  console.log(`Maximum retrieval: ${max}ms`);
  console.log(`Target: <100ms ✓`);
}
```

**Expected:** <20ms average, <100ms max

---

## Monitoring & Alerts

### Create Dashboard Sheet

```javascript
function createMonitoringDashboard() {
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  let dashboard = ss.getSheetByName('CacheMonitoring');

  if (!dashboard) {
    dashboard = ss.insertSheet('CacheMonitoring');

    // Headers
    dashboard.getRange('A1:E1').setValues([[
      'Metric',
      'Current Value',
      'Limit',
      '% Used',
      'Status'
    ]]);

    dashboard.getRange('A1:E1').setFontWeight('bold');
  }

  return dashboard;
}

function updateMonitoringDashboard() {
  const cache = CacheService.getScriptCache();
  const metadata = JSON.parse(cache.get('batch_metadata') || '{}');
  const dashboard = createMonitoringDashboard();

  const totalCacheMB = parseFloat(metadata.totalCacheSizeMB || 0);
  const avgPersonKB = parseFloat(metadata.averagePersonSizeKB || 0);

  dashboard.getRange('A2:E5').setValues([
    ['Total Cache Size', `${totalCacheMB} MB`, '10 MB', `${(totalCacheMB/10*100).toFixed(1)}%`, totalCacheMB < 8 ? 'OK' : 'WARNING'],
    ['Avg Person Size', `${avgPersonKB} KB`, '1024 KB', `${(avgPersonKB/1024*100).toFixed(1)}%`, avgPersonKB < 512 ? 'OK' : 'WARNING'],
    ['Last Batch Run', metadata.lastRun || 'Never', '-', '-', metadata.errors === 0 ? 'SUCCESS' : 'ERRORS'],
    ['Processing Time', `${metadata.duration || 0} s`, '300 s', `${((metadata.duration || 0)/300*100).toFixed(1)}%`, (metadata.duration || 0) < 300 ? 'OK' : 'SLOW']
  ]);
}
```

---

## Recommendations Summary

### ✅ **Use This Strategy:**

1. **Primary Storage:** CacheService
   - 1MB per person (huge headroom)
   - <100ms retrieval
   - 6 hour expiration (perfect for 5-min refresh)

2. **Backup Storage:** Spreadsheet cache sheet
   - Unlimited storage
   - Survives redeploys
   - ~200-500ms retrieval

3. **Fallback:** Real-time processing
   - If both caches miss
   - Same as current system

4. **Monitoring:** Dashboard sheet
   - Track cache sizes
   - Monitor batch performance
   - Alert on issues

### ❌ **Don't Do This:**

1. Don't use PropertiesService (too small)
2. Don't compress JSON (not needed)
3. Don't use external databases (overkill)
4. Don't over-engineer (KISS principle)

---

## Expected Performance

### Batch Processing (Every 5 min):
- **Time:** 10-60 seconds for 5 sheets × 50 people
- **Impact:** None (runs in background)

### User Request (On-demand):
- **Cache Hit:** <100ms ✅
- **Cache Miss:** ~60s (same as current)
- **Cache Hit Rate:** >99% (refreshes every 5 min)

### Storage:
- **50 people:** ~500 KB (5% of limit)
- **100 people:** ~1 MB (10% of limit)
- **200 people:** ~2 MB (20% of limit)

**Conclusion:** We have 5-10x headroom. No compression needed! ✅
