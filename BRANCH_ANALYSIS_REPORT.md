# TPS-Schedule Repository Branch Analysis Report

**Analysis Date**: December 30, 2025
**Analyzed By**: Claude (AI Assistant)
**Main Branch State**: Stable (with features in backend, frontend incomplete)

---

## 📊 Executive Summary

**Main branch** is a **merged version** of `Stable-Schedule-(no-grouped-or-academic-events)` that contains:
- ✅ **Backend functionality** for Academics and Grouped Events (Enhanced.gs, BatchProcessor.gs)
- ❌ **No frontend UI** for toggling these features
- ⚠️ **Critical bug**: TriggerSetup.gs missing Ground Events range (line 310)
- ❌ **No centralized range configuration** (WHITEBOARD_RANGES)
- ❌ **No separate OPTIMIZED/SIMPLIFIED files** (embedded in TriggerSetup.gs)
- ✅ **Documentation**: Comprehensive README.md

**Status**: Despite the branch name suggesting "no grouped or academic events", main actually **HAS** these features in the backend, but **NOT** in the frontend.

---

## 🌳 Branch Inventory

| Branch | Purpose | State | Key Files |
|--------|---------|-------|-----------|
| **main** | Production/Stable | ✅ Active | 7 .gs files, README.md, index.html |
| **Stable-Schedule-(no-grouped-or-academic-events)** | Same as main | ✅ Merged | Identical to main |
| **claude/flight-ground-nas-stable-lrFZo** | Range centralization | 🔧 Experimental | Has WHITEBOARD_RANGES, separate SIMPLIFIED/OPTIMIZED |
| **claude/analyze-tps-schedule-performance-hI4IM** | Performance analysis | 📊 Analysis | DiagnosticChecks.gs, performance docs |
| **claude/stable-pre-academics-hI4IM** | Pre-academics baseline | 📦 Archive | Smaller Enhanced.gs (22KB vs 38KB) |
| **claude/stable-readme-docs-lrFZo** | README only | 📄 Documentation | Just README.md |
| **claude/understand-repo-structure-lrFZo** | Frontend only | 🎨 Frontend | No .gs files, only index.html |

---

## 🔍 Main Branch Detailed Analysis

### Files Present

```
main/
├── Config.gs                  (3,220 bytes)  - Shared configuration
├── Main.gs                   (27,387 bytes)  - HTTP router (SIMPLIFIED active)
├── Enhanced.gs               (38,973 bytes)  - Advanced parser with academics/grouped events ⭐
├── BatchProcessor.gs         (54,468 bytes)  - Background caching with academics/grouped events ⭐
├── TriggerSetup.gs           (42,766 bytes)  - SIMPLIFIED processor (MISSING Ground Events range) ⚠️
├── SmartSheetFinder.gs        (6,409 bytes)  - Sheet finding utility
├── README.md                 (23,069 bytes)  - System architecture documentation
└── docs/
    ├── .nojekyll
    └── index.html            (44,028 bytes)  - Web interface (NO academics/grouped toggles)
```

### Features Present in Main

#### ✅ **IMPLEMENTED (Backend Only)**

**Academics Feature:**
- `Enhanced.gs`: `getAcademicsForStudent()` (lines 596-656)
  - Alpha students: 07:30-17:00
  - Bravo students: 07:00-07:30, 08:30-09:30, 15:00-17:00
- `BatchProcessor.gs`: `getAcademicsForStudent_Batch()` (lines 1093-1150)
- URL parameter support: `&showAcademics=true`

**Grouped Events Feature:**
- `Enhanced.gs`:
  - `shouldShowGroupedEvent()` (lines 671-710) - Permission logic
  - `getGroupedEventsForPerson()` (lines 723-733) - Main function
  - `parseGroundEventsForGroups()` (lines 745-807)
  - `parseFlyingEventsForGroups()` (lines 822-890)
  - `parseSupervisionForGroups()` (lines 899-950)
- `BatchProcessor.gs`:
  - `parseGroundEventsForGroups_Batch()` (lines 1177-1224)
  - `parseFlyingEventsForGroups_Batch()` (lines 1226-1279)
  - `parseSupervisionForGroups_Batch()` (lines 1281-1340)
- URL parameter support: `&showGroupedEvents=true`

**Person Type Detection:**
- `Enhanced.gs`: `getPersonType()` (lines 473-521)
- Scans rows 120-169 for student/staff categorization
- Categories: "Students (Alpha)", "Students (Bravo)", "Staff IP", "Staff IFTE/ICSO", "STC Staff", "Attached/Support"

**Background Batch Processing:**
- Runs every 15 minutes
- Skips overnight hours (8 PM - 5 AM)
- Pre-processes all schedules for instant retrieval
- Includes academics and grouped events in cache

#### ❌ **NOT IMPLEMENTED**

**Frontend UI:**
- No toggle buttons for academics
- No toggle buttons for grouped events
- No visual indicators (badges) for event categories
- No client-side filtering based on showAcademics/showGroupedEvents

**Range Centralization:**
- No `WHITEBOARD_RANGES` constant in Config.gs
- Ranges are hardcoded across multiple files
- **INCONSISTENT ranges** between files (documented in README)

**Separate Processor Files:**
- No `TPS-Schedule-SIMPLIFIED.gs`
- No `TPS-Schedule-OPTIMIZED.gs`
- SIMPLIFIED processor embedded in `TriggerSetup.gs`
- OPTIMIZED processor does not exist as separate file

**Documentation Files:**
- No `DEPLOYMENT.md`
- No `PERFORMANCE_ANALYSIS.md`
- No `DiagnosticChecks.gs`
- No archive folder with detailed guides

---

## 🐛 Critical Bugs in Main

### 1. **Missing Ground Events Range in TriggerSetup.gs**

**Location**: `TriggerSetup.gs` line 310
**Impact**: Ground Events section is NOT searched by SIMPLIFIED processor
**Severity**: 🔴 **CRITICAL**

```javascript
// Current (BROKEN):
const searchRanges = [
  { range: "A1:N10",   name: "Supervision" },
  { range: "A11:R51",  name: "Flying Events" },
  // LINE 310 IS BLANK - Ground Events missing!
  { range: "A82:N112", name: "Not Available" }
];

// Should be:
const searchRanges = [
  { range: "A1:N10",   name: "Supervision" },
  { range: "A11:R51",  name: "Flying Events" },
  { range: "A54:Q80",  name: "Ground Events" },  // MISSING!
  { range: "A82:N112", name: "Not Available" }
];
```

**Result**: When using SIMPLIFIED processor (which is ACTIVE_VERSION), Ground Events are **never returned** in search results.

### 2. **Range Inconsistencies Across Files**

| Section | TriggerSetup.gs (ACTIVE) | Enhanced.gs | BatchProcessor.gs |
|---------|-------------------------|-------------|-------------------|
| Supervision | `A1:N10` ⚠️ | `A1:N9` | `A1:N9` |
| Flying Events | `A11:R51` ⚠️ | `A11:R52` | `A11:R52` |
| Ground Events | **MISSING** 🔴 | `A54:Q80` | `A54:M80` ⚠️ |
| Not Available | `A82:N112` ⚠️ | `A82:N113` | `A82:K113` ⚠️ |

**Impact**: Different processors return different results for the same person/day.

### 3. **Backend Features Without Frontend**

**Symptom**:
- Backend has full academics and grouped events support
- Frontend has no UI to enable/disable these features
- Users cannot access these features through web interface

**Impact**: Dead code in production, wasted backend quota processing unused features.

---

## 🔀 Feature Comparison Across Branches

### Academics & Grouped Events

| Branch | Enhanced.gs Size | Has Academics? | Has Grouped Events? | Frontend UI? |
|--------|------------------|----------------|---------------------|--------------|
| main | 38,973 bytes | ✅ Yes | ✅ Yes | ❌ No |
| Stable-Schedule | 38,973 bytes | ✅ Yes | ✅ Yes | ❌ No |
| claude/stable-pre-academics-hI4IM | 22,371 bytes | ❌ No | ❌ No | ❌ No |
| claude/analyze-tps-schedule-performance-hI4IM | 34,648 bytes | ✅ Partial | ✅ Partial | ❌ No |
| claude/flight-ground-nas-stable-lrFZo | 22,455 bytes | ❌ No | ❌ No | ❌ No |

**Observation**: The 16KB difference in Enhanced.gs (38KB vs 22KB) is entirely due to academics and grouped events code (lines 580-950).

### Range Configuration

| Branch | Has WHITEBOARD_RANGES? | Config.gs Size | Ranges Centralized? |
|--------|------------------------|----------------|---------------------|
| main | ❌ No | 3,220 bytes | ❌ No |
| Stable-Schedule | ❌ No | 3,220 bytes | ❌ No |
| claude/flight-ground-nas-stable-lrFZo | ✅ **Yes** | 4,901 bytes | ✅ **Yes** |
| claude/analyze-tps-schedule-performance-hI4IM | ❌ No | 3,220 bytes | ❌ No |

**Observation**: Only `claude/flight-ground-nas-stable-lrFZo` has centralized range configuration.

### Processor Architecture

| Branch | Separate SIMPLIFIED.gs? | Separate OPTIMIZED.gs? | DiagnosticChecks.gs? |
|--------|------------------------|------------------------|----------------------|
| main | ❌ No | ❌ No | ❌ No |
| Stable-Schedule | ❌ No | ❌ No | ❌ No |
| claude/flight-ground-nas-stable-lrFZo | ✅ Yes (42,850 bytes) | ✅ Yes (47,122 bytes) | ✅ Yes |
| claude/analyze-tps-schedule-performance-hI4IM | ✅ Yes (42,766 bytes) | ✅ Yes (47,038 bytes) | ✅ Yes |

**Observation**: Main has SIMPLIFIED embedded in TriggerSetup.gs, while experimental branches separated concerns.

### Documentation

| Branch | README.md | DEPLOYMENT.md | PERFORMANCE_ANALYSIS.md | Archive Folder? |
|--------|-----------|---------------|-------------------------|-----------------|
| main | ✅ 23KB (architecture) | ❌ No | ❌ No | ❌ No |
| claude/flight-ground-nas-stable-lrFZo | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes (10 files) |
| claude/analyze-tps-schedule-performance-hI4IM | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes (10 files) |

---

## 🎯 Feature Evolution Timeline

### Phase 1: Initial Stable State (Pre-Academics)
**Branch**: `claude/stable-pre-academics-hI4IM`
**Enhanced.gs**: 22,371 bytes
**Features**: Basic schedule parsing (Supervision, Flying, Ground, NA)

### Phase 2: Academics & Grouped Events Added
**Branch**: `main`, `Stable-Schedule-(no-grouped-or-academic-events)` (misleading name!)
**Enhanced.gs**: 38,973 bytes
**Features Added**:
- ✅ Academics for Alpha/Bravo students
- ✅ Grouped events (ALL, STAFF ONLY)
- ✅ Person type detection
- ✅ BatchProcessor integration

**Features NOT Added**:
- ❌ Frontend toggles
- ❌ UI indicators

### Phase 3: Performance Analysis & Separation (Experimental)
**Branches**: `claude/analyze-tps-schedule-performance-hI4IM`, `claude/flight-ground-nas-stable-lrFZo`
**Features Added**:
- ✅ Separate SIMPLIFIED.gs and OPTIMIZED.gs files
- ✅ DiagnosticChecks.gs for troubleshooting
- ✅ Extensive documentation
- ✅ Range centralization (flight-ground-nas only)

### Phase 4: Documentation (Stable Branch)
**Branch**: `main` (after merge)
**Features Added**:
- ✅ Comprehensive README.md explaining system architecture

---

## 📋 What Was Attempted vs What Succeeded

### ✅ Successfully Implemented

1. **Academics Backend Logic**
   - Alpha student schedules (07:30-17:00)
   - Bravo student schedules (3 time blocks)
   - Integration in both Enhanced and BatchProcessor

2. **Grouped Events Backend Logic**
   - Permission system (ALL, STAFF ONLY)
   - Person type detection from rows 120-169
   - Parsing for all 3 sections (Flying, Ground, Supervision)

3. **Background Batch Processing**
   - 15-minute interval processing
   - Overnight skip (quota optimization)
   - Smart sheet finding
   - Academics and grouped events included in cache

4. **Documentation**
   - System architecture README
   - Data flow diagrams
   - Known issues documented

### ❌ Attempted But Not Completed

1. **Frontend UI for Academics/Grouped Events**
   - No toggle switches in index.html
   - No visual badges (ACADEMICS, ALL, STAFF ONLY)
   - Backend is ready, frontend never implemented

2. **Range Centralization**
   - Attempted in `claude/flight-ground-nas-stable-lrFZo`
   - Not merged to main
   - Still hardcoded ranges with inconsistencies

3. **Processor File Separation**
   - Attempted in analysis branches
   - SIMPLIFIED and OPTIMIZED extracted to separate files
   - Not merged to main (remained embedded in TriggerSetup.gs)

4. **Comprehensive Deployment Documentation**
   - DEPLOYMENT.md created in experimental branches
   - PERFORMANCE_ANALYSIS.md created
   - Not merged to main

### 🔄 Partially Implemented

1. **Ground Events Processing**
   - Works in Enhanced.gs and BatchProcessor.gs
   - **BROKEN** in TriggerSetup.gs (SIMPLIFIED - the ACTIVE version)
   - Line 310 missing from searchRanges array

---

## 💡 Recommendations

### 🔴 Critical (Fix Immediately)

1. **Add missing Ground Events range to TriggerSetup.gs line 310**
   ```javascript
   { range: "A54:Q80", name: "Ground Events" },
   ```

2. **Decide on Academics/Grouped Events**:
   - **Option A**: Remove all academics/grouped code from Enhanced.gs and BatchProcessor.gs (save quota)
   - **Option B**: Implement frontend UI toggles in index.html (make features usable)
   - **Current state**: Dead code processing in background, wasting quota

### 🟡 High Priority (Should Address Soon)

3. **Merge Range Centralization from `claude/flight-ground-nas-stable-lrFZo`**
   - Adds WHITEBOARD_RANGES to Config.gs
   - Fixes range inconsistencies
   - Makes maintenance easier

4. **Standardize Enhanced.gs Size**
   - If keeping academics: Ensure all branches are updated (main has it, others don't)
   - If removing: Revert Enhanced.gs to 22KB version from `claude/stable-pre-academics-hI4IM`

### 🟢 Nice to Have

5. **Consider Merging Documentation from Analysis Branches**
   - DEPLOYMENT.md is valuable
   - PERFORMANCE_ANALYSIS.md explains optimizations
   - Archive folder has useful guides

6. **Evaluate Processor File Separation**
   - Separate SIMPLIFIED and OPTIMIZED files improve clarity
   - Currently embedded in TriggerSetup.gs (confusing)
   - Cleaner architecture in experimental branches

---

## 🎭 Branch Name vs Actual Content Mismatch

### Misleading Branch Name

**Branch**: `Stable-Schedule-(no-grouped-or-academic-events)`
**Reality**: **HAS** grouped and academic events in backend!

**Confusion Created**:
- Name suggests these features are absent
- Backend code has full implementation
- Frontend has no UI for these features
- Documentation (README) says "no grouped or academic events"

**Possible Explanations**:
1. Branch was named before features were added
2. Features added but frontend never completed
3. Features were supposed to be removed but weren't
4. Name refers to frontend (no UI) not backend (has logic)

**Recommendation**: Rename branch to accurately reflect content:
- `stable-with-backend-academics-no-frontend` (descriptive)
- `main-stable-incomplete-features` (honest)
- Or remove the backend features entirely to match the name

---

## 📊 File Size Analysis

### Enhanced.gs Evolution

| Version | Size | Lines Added | Feature |
|---------|------|-------------|---------|
| Pre-academics | 22,371 bytes | Baseline | Basic parsing |
| Main (current) | 38,973 bytes | +16,602 bytes | Academics + Grouped Events |

**What accounts for 16KB increase:**
- Lines 580-656: `getAcademicsForStudent()` (~77 lines)
- Lines 671-710: `shouldShowGroupedEvent()` (~40 lines)
- Lines 723-950: Grouped event parsing (~227 lines)
- **Total**: ~344 lines of code for features with no frontend

### BatchProcessor.gs Evolution

Main's BatchProcessor is 54,468 bytes with academics/grouped events.
Comparison to pre-academics version not available (no small version in any branch).

---

## 🔧 Technical Debt Summary

1. **Dead Code**: Academics/grouped events backend with no frontend (16KB in Enhanced.gs)
2. **Broken Functionality**: Missing Ground Events range in active SIMPLIFIED processor
3. **Range Inconsistencies**: Different ranges across 3 files
4. **No Centralization**: WHITEBOARD_RANGES solution exists but not merged
5. **Misleading Branch Name**: Says "no academics" but has them
6. **Incomplete Feature**: Backend ready, frontend never built
7. **Documentation Gaps**: Missing deployment and performance guides from experimental branches

---

## 📈 Quota Impact Analysis

### Current Situation (Main Branch)

**Background Processing** (BatchProcessor.gs):
- Runs every 15 minutes during work hours (5 AM - 8 PM)
- 60 runs/day
- Each run processes:
  - 7 days of sheets
  - ~150 people
  - 4 sections (Supervision, Flying, Ground, NA)
  - **PLUS** academics for students
  - **PLUS** grouped events for everyone
- Estimated: 54 min/day quota usage

**Real-Time Requests** (doGet via TriggerSetup.gs):
- SIMPLIFIED processor (ACTIVE_VERSION)
- ~0.5-1.0 seconds per request
- **BUG**: Missing Ground Events range means less work (accidentally saves quota!)
- If 150 users × 1 request/hour × 16 hours = 2,400 requests/day
- Estimated: 40 min/day quota usage (if cache misses)

**Total Quota**: ~94 min/day (close to 90 min limit!)

### If Academics/Grouped Events Removed

**Background Processing**:
- Remove academics logic: saves ~5%
- Remove grouped events logic: saves ~10%
- New estimate: 48 min/day (-11%)

**Real-Time Requests**: Unchanged (already not using these features)

**Total Savings**: ~6 min/day (not significant)

### If Static JSON File Approach Used

**Background Processing**: 56 min/day (adds GitHub API calls)
**Real-Time Requests**: 0 min/day (static file served by GitHub Pages)

**Total Quota**: 56 min/day (-38 min savings!)

---

## 🏁 Conclusion

**Main branch is stable but incomplete**:
- ✅ Core functionality works (with Ground Events bug)
- ✅ Background caching optimized
- ✅ Documentation exists
- ⚠️ Has unfinished features (academics/grouped events backend only)
- ❌ Critical bug (missing Ground Events range)
- ❌ Range inconsistencies across files

**Immediate Action Required**:
1. Fix TriggerSetup.gs line 310 (add Ground Events range)
2. Decide: Keep or remove academics/grouped events backend code
3. If keeping: Build frontend UI
4. If removing: Revert Enhanced.gs to pre-academics version

**Strategic Decisions Needed**:
1. Merge range centralization from `claude/flight-ground-nas-stable-lrFZo`?
2. Merge documentation from analysis branches?
3. Rename main branch to reflect actual content?
4. Consider static JSON file approach to save quota?

---

**Report Generated**: December 30, 2025
**Branches Analyzed**: 7
**Files Compared**: 15
**Issues Identified**: 7 critical/high priority
**Recommendations**: 6
