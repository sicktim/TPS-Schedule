# Quick Fix: "SEARCH_CONFIG has already been declared" Error

## 🔴 The Problem

You're seeing this error:
```
SyntaxError: Identifier 'SEARCH_CONFIG' has already been declared
```

**Why it happens:**
- Google Apps Script treats ALL .gs files as ONE big file
- Both `Simplified.gs` and `Optimized.gs` have `const SEARCH_CONFIG = {...}`
- You can't declare the same `const` twice!

---

## ✅ The Solution - Create Shared Config File

### Step 1: Create Config.gs

1. In Google Apps Script, click **+ (plus)** next to "Files"
2. Name it: `Config.gs`
3. **Copy and paste** the entire contents from `Config.gs` in this repo
4. **Save** (Ctrl+S)

---

### Step 2: Remove SEARCH_CONFIG from Simplified.gs

1. Open **Simplified.gs** in Google Apps Script
2. **Find these lines** (around lines 71-117):
   ```javascript
   const SEARCH_CONFIG = {
     searchTerm: "Sick",
     recipientEmail: "your-email@gmail.com",
     spreadsheetId: "1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU",
     timezone: "America/Los_Angeles",
     testMode: false,
     testDate: "2025-12-15"
   };
   ```
3. **DELETE all those lines** (from `const SEARCH_CONFIG = {` to `};`)
4. **Save** (Ctrl+S)

---

### Step 3: Remove SEARCH_CONFIG from Optimized.gs

1. Open **Optimized.gs** in Google Apps Script
2. **Find these lines** (around lines 71-117):
   ```javascript
   const SEARCH_CONFIG = {
     searchTerm: "Sick",
     recipientEmail: "your-email@gmail.com",
     spreadsheetId: "1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU",
     timezone: "America/Los_Angeles",
     cacheTTL: 600,
     testMode: false,
     testDate: "2025-12-15"
   };
   ```
3. **DELETE all those lines** (from `const SEARCH_CONFIG = {` to `};`)
4. **Save** (Ctrl+S)

---

### Step 4: Test Again

1. Select **testRouter** from the function dropdown
2. Click **Run ▶️**
3. Check Execution log - should now see **✅ SUCCESS**

---

## 📁 Your Final File Structure

```
Your Apps Script Project
├─ Config.gs           ← SEARCH_CONFIG lives here (shared by all)
├─ Main.gs             ← Router (doGet)
├─ Simplified.gs       ← v4.0 (doGet_Simplified) - NO SEARCH_CONFIG
└─ Optimized.gs        ← v3.1 (doGet_Optimized) - NO SEARCH_CONFIG
```

---

## 🎯 Why This Works

**Google Apps Script file behavior:**
- All .gs files are like chapters in one book
- They all share the same global scope
- If you declare `const X` in File1.gs, you can use `X` in File2.gs
- But you CAN'T declare `const X` again in File2.gs!

**The fix:**
- Declare `SEARCH_CONFIG` **once** in Config.gs
- All other files (Main.gs, Simplified.gs, Optimized.gs) can **use** it
- No duplicate declarations = no errors!

---

## 🔧 Alternative: Comment Out Instead of Delete

If you're nervous about deleting, you can **comment out** the config instead:

**In Simplified.gs and Optimized.gs:**
```javascript
// Config moved to Config.gs - DO NOT UNCOMMENT
/*
const SEARCH_CONFIG = {
  searchTerm: "Sick",
  ...
};
*/
```

This keeps it as a backup reference.

---

## ✅ After the Fix

Once you've done this, you can:
1. ✅ Test with `testRouter()`
2. ✅ Test with `testSimplified()`
3. ✅ Test with `testOptimized()`
4. ✅ Deploy your web app

All files will share the same SEARCH_CONFIG from Config.gs!

---

## 🎓 Pro Tip: What Else Can Go in Config.gs?

You can move ANY shared constants or functions to Config.gs:

```javascript
// Config.gs - Shared configuration and utilities

const SEARCH_CONFIG = { ... };

const APP_VERSION = "1.0.0";

const DEBUG_MODE = false;

// Shared helper function
function logDebug(message) {
  if (DEBUG_MODE) {
    console.log(message);
  }
}
```

Then all files can use `logDebug()`, `APP_VERSION`, etc. without redeclaring them!

---

**That should fix your error! Let me know if you still see issues after following these steps.**
