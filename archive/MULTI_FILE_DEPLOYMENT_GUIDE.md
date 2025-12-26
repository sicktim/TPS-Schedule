# Multi-File Google Apps Script Deployment Guide

## 📋 Overview

This guide shows you how to set up your TPS-Schedule project in Google Apps Script with multiple versions that you can easily switch between.

---

## 🎯 Final Structure

```
Your Apps Script Project: "TPS-Schedule"
├─ Main.gs                     ← Router (doGet) - THIS IS THE ENTRY POINT
├─ Simplified.gs               ← v4.0 No cache (doGet_Simplified)
├─ Optimized.gs                ← v3.1 With cache (doGet_Optimized)
└─ (Optional future files)     ← Your experimental features
```

**Key concept:**
- Only **Main.gs** has the `doGet()` function (the web app entry point)
- Other files have renamed functions: `doGet_Simplified()` and `doGet_Optimized()`
- Main.gs routes to the correct version based on configuration

---

## 🚀 Step-by-Step Setup

### Step 1: Access Your Apps Script Project

1. Go to your Google Sheet: https://docs.google.com/spreadsheets/d/1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU/edit
2. Click **Extensions** → **Apps Script**
3. You'll see your current script (probably has one file)

---

### Step 2: Create New Files

1. **In the left sidebar**, look for the "Files" section
2. **Click the + (plus icon)** next to "Files"
3. **Create these files** (one at a time):
   - `Main.gs` (click +, type name, press Enter)
   - `Simplified.gs`
   - `Optimized.gs`

**Your sidebar should now look like:**
```
Files
├─ Code.gs (your original file - we'll delete this later)
├─ Main.gs (NEW)
├─ Simplified.gs (NEW)
└─ Optimized.gs (NEW)
```

---

### Step 3: Copy Code Into Files

#### A. Main.gs
1. Click **Main.gs** in the sidebar
2. **Delete everything** in the editor (Ctrl+A, Delete)
3. **Copy the entire contents** of `Main.gs` from this repo
4. **Paste** into the Google Apps Script editor
5. **Save** (Ctrl+S or File → Save)

#### B. Simplified.gs
1. Click **Simplified.gs** in the sidebar
2. **Copy the entire contents** of `TPS-Schedule-SIMPLIFIED.gs` from this repo
3. **Paste** into the editor
4. **Find this line** (around line 164):
   ```javascript
   function doGet(e) {
   ```
5. **Change it to:**
   ```javascript
   function doGet_Simplified(e) {
   ```
6. **Save** (Ctrl+S)

#### C. Optimized.gs
1. Click **Optimized.gs** in the sidebar
2. **Copy the entire contents** of `TPS-Schedule-OPTIMIZED.gs` from this repo
3. **Paste** into the editor
4. **Find this line** (around line 164):
   ```javascript
   function doGet(e) {
   ```
5. **Change it to:**
   ```javascript
   function doGet_Optimized(e) {
   ```
6. **Save** (Ctrl+S)

---

### Step 4: Delete Original File (Optional)

1. Click **Code.gs** (your original file) in the sidebar
2. Click the **⋮ (three dots)** next to the filename
3. Click **Remove**
4. Confirm deletion

**NOTE:** If you're nervous about deleting, just rename it to `Backup.gs` instead

---

### Step 5: Test Before Deploying

**IMPORTANT:** Always test before deploying!

1. In the toolbar at the top, there's a **dropdown menu** (currently says "Select function")
2. **Click the dropdown** and select `testRouter`
3. **Click Run ▶️** (the play button)
4. You may need to **authorize** the script (click "Review Permissions", select your account, click "Advanced", "Go to TPS-Schedule", "Allow")
5. **Check the Execution log** (bottom of screen) - you should see:
   ```
   🧪 TESTING ROUTER
   ✅ SUCCESS:
      Version: 4.0
      Simplified: true
   ```

**If you see errors**, check:
- Did you rename `doGet()` to `doGet_Simplified()` in Simplified.gs?
- Did you rename `doGet()` to `doGet_Optimized()` in Optimized.gs?
- Did you save all files?

---

### Step 6: Deploy

#### First Time Deployment:

1. Click **Deploy** → **New deployment**
2. Click **⚙️ (gear icon)** next to "Select type"
3. Select **Web app**
4. Fill in the settings:
   - **Description:** "TPS-Schedule Multi-Version Router"
   - **Execute as:** Me (your-email@gmail.com)
   - **Who has access:** Anyone
5. Click **Deploy**
6. **Copy the Web app URL** (looks like: `https://script.google.com/.../exec`)
7. **Save this URL** - this is your permanent endpoint!

#### Updating Deployment (After Changes):

1. Click **Deploy** → **Manage deployments**
2. Click the **✏️ (pencil/edit icon)** on your active deployment
3. Click **Version** dropdown → Select **New version**
4. Click **Deploy**
5. **URL stays the same!** No need to update your app

---

### Step 7: Test the Live Deployment

Open this URL in your browser (replace with your actual URL):
```
https://script.google.com/macros/s/YOUR_ID/exec?name=Sick&days=4
```

You should see JSON response:
```json
{
  "searchName": "Sick",
  "version": "4.0",
  "simplified": true,
  "totalEvents": 5,
  "events": [...]
}
```

---

## 🔄 How to Switch Versions

### Method 1: Change Active Version (Permanent Switch)

1. Open **Main.gs**
2. Find this line (near the top):
   ```javascript
   const ACTIVE_VERSION = "SIMPLIFIED";  // Options: "SIMPLIFIED", "OPTIMIZED"
   ```
3. Change to:
   ```javascript
   const ACTIVE_VERSION = "OPTIMIZED";  // Options: "SIMPLIFIED", "OPTIMIZED"
   ```
4. **Save** (Ctrl+S)
5. **Deploy → Manage deployments → Edit (✏️) → Deploy**
6. Done! All requests now use OPTIMIZED version

### Method 2: URL Parameter (Temporary Override)

If you have `ALLOW_VERSION_OVERRIDE = true` in Main.gs, you can switch via URL:

```
# Use simplified (default)
?name=Sick&days=4

# Force optimized version
?name=Sick&days=4&version=optimized

# Force simplified version
?name=Sick&days=4&version=simplified
```

This doesn't require redeployment!

---

## 🧪 Testing Functions

Google Apps Script editor has built-in test functions. Here's how to use them:

### Run a Test Function:

1. Click the **function dropdown** (top toolbar)
2. Select a test function:
   - `testRouter` - Test current active version
   - `testSimplified` - Test simplified version directly
   - `testOptimized` - Test optimized version directly
   - `testBothVersions` - Compare both versions
   - `showRouterInfo` - Show current configuration
3. Click **Run ▶️**
4. Check **Execution log** (View → Logs or Ctrl+Enter)

### Useful Test Functions:

```javascript
testRouter()           // Test whichever version is active
testSimplified()       // Test v4.0 directly
testOptimized()        // Test v3.1 directly
testBothVersions()     // Run both and compare
showRouterInfo()       // Show config and help
testVersionSwitching() // Test URL parameter switching
```

---

## 📱 Using in Your Android/iOS App

Your app should use the **same URL** regardless of which version is active:

```
Base URL: https://script.google.com/macros/s/YOUR_ID/exec

Request:
  ?name={userName}&days=4

Example:
  ?name=Sick&days=4
  ?name=Montes&days=5
  ?name=Johnson&days=3
```

**The JSON response format is identical** for both versions, so your app code doesn't need to change when you switch versions!

---

## 🎯 Common Use Cases

### Use Case 1: Testing New Features

1. Create a new file: `Experimental.gs`
2. Copy one of the existing versions as a starting point
3. Rename the function: `doGet_Experimental(e)`
4. Add your experimental code
5. Test with: `testExperimental()` function (create one in Main.gs)
6. When ready, update `ACTIVE_VERSION = "EXPERIMENTAL"` in Main.gs

### Use Case 2: A/B Testing

Set `ALLOW_VERSION_OVERRIDE = true` in Main.gs, then:

```javascript
// In your app, randomly assign users to versions
const version = Math.random() < 0.5 ? "simplified" : "optimized";
const url = `${baseUrl}?name=${userName}&days=4&version=${version}`;
```

### Use Case 3: Gradual Rollout

1. Start with `ACTIVE_VERSION = "OPTIMIZED"` (existing version)
2. Test new version with URL parameter: `?version=simplified`
3. Once confident, switch: `ACTIVE_VERSION = "SIMPLIFIED"`
4. Old version still available as backup: `?version=optimized`

---

## ❗ Common Issues & Solutions

### Issue: "ReferenceError: doGet_Simplified is not defined"

**Solution:** You forgot to rename `doGet()` to `doGet_Simplified()` in Simplified.gs

**Fix:**
1. Open Simplified.gs
2. Find `function doGet(e) {`
3. Change to `function doGet_Simplified(e) {`
4. Save and redeploy

---

### Issue: "Cannot read property 'parameter' of undefined"

**Solution:** You're testing with the wrong function

**Fix:** Don't run `doGet_Simplified()` or `doGet_Optimized()` directly from the dropdown - use the test functions:
- Instead of running `doGet_Simplified`, run `testSimplified()`
- Instead of running `doGet_Optimized`, run `testOptimized()`

---

### Issue: Changes Not Showing After Deployment

**Solution:** You need to create a NEW version when deploying

**Fix:**
1. Deploy → Manage deployments
2. Click ✏️ (edit icon)
3. **Important:** Click "Version" dropdown → Select "New version"
4. Click Deploy
5. Clear your browser cache or add `?nocache=123` to URL

---

### Issue: "Script function not found: doGet"

**Solution:** Main.gs is not the active file or wasn't saved

**Fix:**
1. Make sure Main.gs exists and has `function doGet(e) {`
2. Save all files (Ctrl+S)
3. Redeploy with new version

---

## 📊 File Size Considerations

Google Apps Script has a **50 MB total project size limit**.

Your current files:
- Main.gs: ~20 KB
- Simplified.gs: ~25 KB
- Optimized.gs: ~30 KB
- **Total: ~75 KB** (you're fine!)

You can have **hundreds** of files before hitting the limit.

---

## 🔐 Security Notes

### Current Settings (Recommended):
```
Execute as: Me (your account)
Who has access: Anyone
```

**This means:**
- Script runs with YOUR permissions (can access YOUR spreadsheet)
- Anyone with the URL can call it (no login required)
- Perfect for mobile apps (no OAuth required)

### If You Need to Restrict Access:

Change "Who has access" to:
- **Anyone with Google account** - Requires Google sign-in
- **Only myself** - Only you can use it

**NOTE:** Mobile apps will need OAuth implementation for restricted access.

---

## 🎓 Learning Resources

### Understanding Apps Script File Structure:
- All .gs files in one project share the **same global scope**
- Functions in any file can call functions in any other file
- No imports needed (unlike JavaScript modules)
- Files are like "chapters" in one big book

### Deployment Versions:
- Each deployment creates a **version ID** (@1, @2, @3, etc.)
- The **HEAD** version (@HEAD) always points to your latest code
- Production deployment should use **specific version** (@1, @2)
- After editing, you must **deploy new version** to see changes

---

## 💡 Next Steps

1. ✅ **Set up multi-file structure** (you are here)
2. ✅ **Deploy and test** both versions
3. ✅ **Update your app** to use the deployment URL
4. 📱 **Build Android/iOS app** using this API
5. 🎯 **Add new features** in separate files
6. 🚀 **Deploy incrementally** without breaking production

---

## 📞 Quick Reference

### File Naming Convention:
```
Main.gs              → doGet(e)               Router
Simplified.gs        → doGet_Simplified(e)    v4.0 implementation
Optimized.gs         → doGet_Optimized(e)     v3.1 implementation
YourFeature.gs       → doGet_YourFeature(e)   Your custom version
```

### Switch Active Version:
```javascript
// In Main.gs, line ~35
const ACTIVE_VERSION = "SIMPLIFIED";  // ← Change this
```

### Test Functions:
```
testRouter()          - Test active version
testSimplified()      - Test v4.0
testOptimized()       - Test v3.1
testBothVersions()    - Compare all
showRouterInfo()      - Show help
```

### Deployment:
```
First time:  Deploy → New deployment → Web app → Deploy
Updates:     Deploy → Manage deployments → ✏️ → New version → Deploy
```

---

**You're all set! 🎉**

The multi-file structure gives you:
- ✅ Easy version switching
- ✅ Safe backups of all versions
- ✅ Room to experiment
- ✅ One stable deployment URL
- ✅ Professional project organization
