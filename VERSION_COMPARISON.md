# TPS-Schedule Version Comparison

## Overview

Two optimized versions are available for different use cases:

---

## 📦 Version 4.0 - SIMPLIFIED (No Cache)
**File:** `TPS-Schedule-SIMPLIFIED.gs`

### Best For:
- ✅ **Personalized background refresh** (each user searches their own name)
- ✅ **15-minute refresh intervals** (cache expires before next refresh)
- ✅ **Android/iOS mobile apps** with periodic background updates
- ✅ **Always fresh data** requirements (no staleness tolerance)
- ✅ **Simpler codebase** (easier to port to other platforms)

### Performance:
- **~30 seconds** per request (all requests)
- **2.5x faster** than original (6s/sheet vs 15s/sheet)
- Always up-to-date data (no cache staleness)

### Optimizations:
1. ✅ `getDisplayValues()` instead of `getValues()` (40-50% faster)
2. ✅ Batch range reads with `getRangeList` (4 API calls → 1 per sheet)
3. ✅ Reuse spreadsheet object (opens once for all days)
4. ❌ **NO CACHING** - Always fetches fresh data

### Use Case Example:
```
Time 0:00  → Background refresh → 30s fetch → Fresh data
Time 0:15  → Background refresh → 30s fetch → Fresh data
Time 0:30  → Background refresh → 30s fetch → Fresh data
User opens app → Data already there (pulled 0-15 min ago)
```

---

## 📦 Version 3.1 - OPTIMIZED (With Cache)
**File:** `TPS-Schedule-OPTIMIZED.gs`

### Best For:
- ✅ **Shared dashboards** (multiple users viewing same data)
- ✅ **Public displays** (same search term for everyone)
- ✅ **Frequent manual refreshes** (< 10 minutes apart)
- ✅ **Supervisor views** (checking multiple people repeatedly)
- ✅ **Maximum performance** for repeated requests

### Performance:
- **~30 seconds** (first request - cache miss)
- **<1 second** (subsequent requests - cache hit)
- Cache TTL: **10 minutes** (configurable)

### Optimizations:
1. ✅ `getDisplayValues()` instead of `getValues()` (40-50% faster)
2. ✅ **Caching with CacheService** (10-minute TTL)
3. ✅ Batch range reads with `getRangeList` (4 API calls → 1 per sheet)
4. ✅ Reuse spreadsheet object (opens once for all days)

### Cache Behavior:
```
Time 9:00  → User A searches "Sick" → 30s (cache miss) → Cached
Time 9:05  → User B searches "Sick" → <1s (cache hit) ✅
Time 9:08  → User A searches "Sick" → <1s (cache hit) ✅
Time 9:11  → Schedule updated on sheet → Cache still serves old data until 9:10
```

**⚠️ Cache Staleness:**
- Sheet updates take **up to 10 minutes** to appear
- Manual cache clear: Run `clearCache()` function after major updates
- Or reduce `cacheTTL` to 60 seconds (1 minute) for fresher data

---

## 🎯 Quick Decision Guide

### Use SIMPLIFIED (v4.0) if:
- Each user searches for **their own name** (personalized)
- App refreshes in **background every X minutes**
- You need **always-fresh data** (no staleness acceptable)
- You're building **Android/iOS apps** (simpler to port)
- Cache hit rate would be **near 0%**

### Use OPTIMIZED (v3.1) if:
- Multiple users search for **same names** (shared)
- Users **manually refresh** frequently (< 10 min)
- You run a **public dashboard** or **supervisor view**
- You can tolerate **10 minutes** of staleness
- You want **sub-second performance** for repeated requests

---

## 📊 Performance Comparison

| Scenario | Original | Optimized (v3.1) | Simplified (v4.0) |
|----------|----------|------------------|-------------------|
| **First request** | 60s | 30s | 30s |
| **Repeat same search (5 min later)** | 60s | <1s (cache) | 30s |
| **Different user, same name (5 min later)** | 60s | <1s (cache) | 30s |
| **Background refresh (15 min later)** | 60s | 30s (cache expired) | 30s |
| **After sheet update** | 60s | 30s (stale for 10 min) | 30s (fresh) |

---

## 🔧 Migration Guide

### From v3.1 (Optimized) to v4.0 (Simplified):

1. **Copy code** from `TPS-Schedule-SIMPLIFIED.gs`
2. **Update config** (same as v3.1, `cacheTTL` removed)
3. **Deploy new version** in Apps Script
4. **Test** with `testPerformance()`

### Response JSON Changes:
```json
{
  "version": "4.0",
  "optimized": true,
  "simplified": true,  // NEW FLAG
  // ... rest unchanged
}
```

No breaking changes - all other fields identical to v3.1

---

## 💡 Recommendations

### For Your Use Case:
- **Background refresh every 15 minutes** → Use **SIMPLIFIED (v4.0)**
- Cache provides minimal benefit (0% hit rate)
- Always-fresh data guaranteed
- Simpler code for Android/iOS porting

### Performance Is Acceptable:
- 30 seconds every 15 minutes = 2 seconds/minute average
- User opens app → data already there (refreshed in background)
- No user-facing latency

---

## 📝 Version History

- **v1.0** - Original (60s, no optimizations)
- **v3.0** - Added all 4 optimizations including cache
- **v3.1** - Added test mode functionality
- **v4.0** - Simplified version (removed cache, kept 3 core optimizations)

---

**Current Status:** Both versions maintained
- Use **v4.0 SIMPLIFIED** for personalized background refresh
- Use **v3.1 OPTIMIZED** for shared dashboards with repeated queries
