# 🚀 Complete File Copy Guide - Ready to Deploy

## ⚠️ THIS WAS THE PROBLEM

The Simplified and Optimized files in the repo had `function doGet(e)` instead of the renamed versions. This created conflicts when all files were in the same project.

**✅ NOW FIXED!** All files have correct function names. Just copy and paste - no manual editing needed!

---

## 📦 Files to Copy (In Order)

Copy these **5 files** from the repo to Google Apps Script:

### 1. Config.gs
```
✅ Copy as-is (no changes needed)
✅ Contains SEARCH_CONFIG shared by all versions
```

### 2. Main.gs
```
✅ Copy as-is (no changes needed)
✅ Has function doGet(e) - the router
✅ Routes to all 3 versions
```

### 3. TPS-Schedule-SIMPLIFIED.gs → Simplified.gs
```
✅ Copy as-is (no changes needed)
✅ Has function doGet_Simplified(e) ← Already renamed!
✅ No cache, simple parsing
```

### 4. TPS-Schedule-OPTIMIZED.gs → Optimized.gs
```
✅ Copy as-is (no changes needed)
✅ Has function doGet_Optimized(e) ← Already renamed!
✅ With cache, simple parsing
```

### 5. Enhanced.gs
```
✅ Copy as-is (no changes needed)
✅ Has function doGet_Enhanced(e) ← Already renamed!
✅ No cache, advanced structured parsing
```

---

## 🎯 Step-by-Step Copy Instructions

### Step 1: Delete Old Files (If You Have Them)

In Google Apps Script:
1. Delete any old .gs files EXCEPT the default Code.gs (we'll replace that)
2. Start fresh to avoid conflicts

### Step 2: Create Files

Click **+** next to "Files" and create:
- `Config.gs`
- `Main.gs`
- `Simplified.gs`
- `Optimized.gs`
- `Enhanced.gs`

### Step 3: Copy Content

For each file:

**Config.gs:**
1. Open Config.gs in the repo
2. Copy ALL content (Ctrl+A, Ctrl+C)
3. Paste into Google Apps Script Config.gs
4. Save (Ctrl+S)

**Main.gs:**
1. Open Main.gs in the repo
2. Copy ALL content
3. Paste into Google Apps Script Main.gs
4. Save

**Simplified.gs:**
1. Open TPS-Schedule-SIMPLIFIED.gs in the repo
2. Copy ALL content
3. Paste into Google Apps Script Simplified.gs
4. Save

**Optimized.gs:**
1. Open TPS-Schedule-OPTIMIZED.gs in the repo
2. Copy ALL content
3. Paste into Google Apps Script Optimized.gs
4. Save

**Enhanced.gs:**
1. Open Enhanced.gs in the repo
2. Copy ALL content
3. Paste into Google Apps Script Enhanced.gs
4. Save

### Step 4: Delete Code.gs (If It Exists)

If you still have the default Code.gs file:
1. Click the ⋮ (three dots) next to Code.gs
2. Click "Remove"
3. Confirm

---

## ✅ Verification Steps

### Test 1: Check Functions Exist

Run this in Apps Script editor (copy to any file temporarily):

```javascript
function verifyAllFunctions() {
  const functions = {
    "Main router": typeof doGet,
    "Simplified": typeof doGet_Simplified,
    "Optimized": typeof doGet_Optimized,
    "Enhanced": typeof doGet_Enhanced
  };

  console.log("Function Check:");
  Object.keys(functions).forEach(name => {
    const status = functions[name] === "function" ? "✅" : "❌";
    console.log(`${status} ${name}: ${functions[name]}`);
  });

  // All should say "function"
  const allGood = Object.values(functions).every(t => t === "function");
  console.log("\n" + (allGood ? "✅ ALL FUNCTIONS FOUND!" : "❌ MISSING FUNCTIONS"));

  return allGood;
}
```

Run `verifyAllFunctions()` - should see all ✅

### Test 2: Test Each Version

```javascript
// Test Simplified
function testSim() {
  const e = { parameter: { name: "Sick", days: "1", testDate: "2025-12-15" } };
  const result = JSON.parse(doGet_Simplified(e).getContent());
  console.log("Simplified version:", result.version); // Should be "4.0"
}

// Test Optimized
function testOpt() {
  const e = { parameter: { name: "Sick", days: "1", testDate: "2025-12-15" } };
  const result = JSON.parse(doGet_Optimized(e).getContent());
  console.log("Optimized version:", result.version); // Should be "3.1"
}

// Test Enhanced
function testEnh() {
  const e = { parameter: { name: "Sick", days: "1", testDate: "2025-12-15" } };
  const result = JSON.parse(doGet_Enhanced(e).getContent());
  console.log("Enhanced version:", result.version); // Should be "5.0"
  console.log("Has enhanced data:", result.enhanced); // Should be true
}
```

Run each test - should see correct versions.

### Test 3: Test Router

```javascript
function testRouterAll() {
  const tests = [
    { version: "simplified", expected: "4.0" },
    { version: "optimized", expected: "3.1" },
    { version: "enhanced", expected: "5.0" }
  ];

  tests.forEach(test => {
    const e = {
      parameter: {
        name: "Sick",
        days: "1",
        testDate: "2025-12-15",
        version: test.version
      }
    };

    const result = JSON.parse(doGet(e).getContent());
    const status = result.version === test.expected ? "✅" : "❌";
    console.log(`${status} version=${test.version} returned v${result.version} (expected ${test.expected})`);
  });
}
```

Run `testRouterAll()` - should see all ✅

---

## 🚀 Deploy

Once all tests pass:

1. **Deploy → New deployment**
2. Type: **Web app**
3. Description: "Multi-version with Enhanced (v5.0)"
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy**
7. **Copy the web app URL**

---

## 🧪 Test Deployed URL

Try these URLs (replace with your actual URL):

```bash
# Test Simplified
?name=Sick&days=1&version=simplified&testDate=2025-12-15

# Test Optimized
?name=Sick&days=1&version=optimized&testDate=2025-12-15

# Test Enhanced (should work now!)
?name=Sick&days=1&version=enhanced&testDate=2025-12-15
```

---

## 🎯 Expected Results

### Simplified (v4.0):
```json
{
  "version": "4.0",
  "simplified": true,
  "optimized": true,  // Legacy flag
  "events": [...]
}
```

### Optimized (v3.1):
```json
{
  "version": "3.1",
  "optimized": true,
  "events": [...]
}
```

### Enhanced (v5.0):
```json
{
  "version": "5.0",
  "enhanced": true,
  "events": [
    {
      "events": [
        {
          "enhanced": {
            "section": "Flying Events",  // ← Should see this!
            "model": "KC-46",
            "crew": [...],
            "status": {...}
          }
        }
      ]
    }
  ]
}
```

---

## ❗ Common Issues

### Issue: "doGet_Enhanced is not defined"
**Solution:** Enhanced.gs file wasn't copied or saved

### Issue: Still getting v4.0 even with ?version=enhanced
**Solution:** Didn't deploy a new version after copying files

### Issue: "SEARCH_CONFIG has already been declared"
**Solution:** Check that Config.gs is the ONLY file with SEARCH_CONFIG

---

## 📞 Quick Reference

**Function Names:**
- `doGet(e)` - Main router (in Main.gs only)
- `doGet_Simplified(e)` - Simplified version
- `doGet_Optimized(e)` - Optimized version
- `doGet_Enhanced(e)` - Enhanced version

**File Mapping:**
```
Repo File                      → Google Apps Script File
─────────────────────────────────────────────────────────
Config.gs                      → Config.gs
Main.gs                        → Main.gs
TPS-Schedule-SIMPLIFIED.gs     → Simplified.gs
TPS-Schedule-OPTIMIZED.gs      → Optimized.gs
Enhanced.gs                    → Enhanced.gs
```

**URL Parameters:**
- `?version=simplified` or `?version=4.0`
- `?version=optimized` or `?version=3.1`
- `?version=enhanced` or `?version=5.0`

---

**You're all set!** All files now have correct function names and are ready to copy directly! 🎉
