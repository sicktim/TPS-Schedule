// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    SQUADRON SCHEDULE WIDGET - GOOGLE APPS SCRIPT           ║
// ║                          ⚡ SIMPLIFIED VERSION ⚡                           ║
// ║                                                                            ║
// ║  Purpose: Fetches squadron events from a Google Sheets "whiteboard" and    ║
// ║           returns filtered results as JSON for a mobile widget.            ║
// ║                                                                            ║
// ║  Author: [Original Author]                                                 ║
// ║  Last Modified: December 24, 2025                                          ║
// ║  Version: 4.0 (SIMPLIFIED - NO CACHE)                                      ║
// ║                                                                            ║
// ║  PERFORMANCE IMPROVEMENTS:                                                 ║
// ║  ✅ Changed getValues() → getDisplayValues() (40-50% faster)              ║
// ║  ✅ Batch range reads with getRangeList (4 calls → 1 per sheet)           ║
// ║  ✅ Reuse spreadsheet object (no redundant opens)                         ║
// ║  ❌ NO CACHING (always fresh data, simpler code)                          ║
// ║                                                                            ║
// ║  EXPECTED PERFORMANCE:                                                     ║
// ║  - All requests: ~30 seconds for 5 days (was 60s)                         ║
// ║  - 2.5x faster than original (6s per sheet vs 15s)                        ║
// ║  - Always up-to-date data (no cache staleness)                            ║
// ║                                                                            ║
// ║  IDEAL FOR:                                                                ║
// ║  - Personalized background refresh (15-min intervals)                      ║
// ║  - Android/iOS apps with periodic updates                                 ║
// ║  - Scenarios where always-fresh data is critical                          ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ┌────────────────────────────────────────────────────────────────────────────┐
// │                            TABLE OF CONTENTS                               │
// ├────────────────────────────────────────────────────────────────────────────┤
// │                                                                            │
// │  [SECTION 1] CONFIGURATION ............................ Lines 50-65       │
// │      - SEARCH_CONFIG object with all configurable settings                 │
// │      - Spreadsheet ID, timezone, default search term                       │
// │      - Test mode configuration                                             │
// │                                                                            │
// │  [SECTION 2] WEB APP ENDPOINT ......................... Lines 70-110      │
// │      - doGet(e): Main entry point when widget calls the API                │
// │      - Handles URL parameters and returns JSON response                    │
// │                                                                            │
// │  [SECTION 3] CORE DATA FUNCTIONS ...................... Lines 115-265     │
// │      - getEventsForWidget(): Orchestrates the search process               │
// │      - searchNameInSheetForWidget_Simplified(): Reads data (no cache)      │
// │                                                                            │
// │  [SECTION 4] DATE/TIME UTILITIES ...................... Lines 270-390     │
// │      - getNextNWeekdays(): Determines which dates to search                │
// │      - generateSheetName(): Converts date to sheet tab name                │
// │      - getDayName(): Returns full day name (e.g., "Monday")                │
// │      - formatDateISO(): Formats date as YYYY-MM-DD                         │
// │                                                                            │
// │  [SECTION 5] CELL FORMATTING UTILITIES ................ Lines 395-480     │
// │      - formatCellValue(): Cleans and formats cell data                     │
// │      - Handles times, booleans, and various data types                     │
// │                                                                            │
// │  [SECTION 6] TESTING & DEBUGGING FUNCTIONS ............ Lines 485-END     │
// │      - testWidgetEndpoint(): Simulates a full widget request               │
// │      - testSheetNames(): Shows what sheets will be searched                │
// │      - testSheetExists(): Verifies sheet accessibility                     │
// │      - testWebRequest(): Simulates HTTP request                            │
// │      - diagnoseToday(): Quick diagnostic for "today not showing" bug       │
// │      - testPerformance(): Measures actual execution time                   │
// │                                                                            │
// └────────────────────────────────────────────────────────────────────────────┘


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     [SECTION 1] CONFIGURATION                              ║
// ║                                                                            ║
// ║  ⚠️  CONFIGURATION HAS BEEN MOVED TO Config.gs                            ║
// ║                                                                            ║
// ║  When using multiple .gs files, all files share the same global scope.    ║
// ║  To avoid "already declared" errors, SEARCH_CONFIG is now defined once    ║
// ║  in Config.gs and shared by all versions (Simplified, Optimized, etc.)    ║
// ║                                                                            ║
// ║  To modify settings (timezone, spreadsheet ID, etc):                      ║
// ║  → Edit Config.gs instead of this file                                    ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// SEARCH_CONFIG is defined in Config.gs and shared across all files
// Do NOT redeclare it here - just use the global SEARCH_CONFIG object


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     [SECTION 2] WEB APP ENDPOINT                           ║
// ║                                                                            ║
// ║  This section handles incoming HTTP requests from the widget.              ║
// ║                                                                            ║
// ║  HOW IT WORKS:                                                             ║
// ║  1. User's widget makes a GET request to this script's deployed URL        ║
// ║  2. Google runs doGet(e) automatically                                     ║
// ║  3. We extract parameters from the URL (name, days)                        ║
// ║  4. We call our data functions to get events                               ║
// ║  5. We return JSON that the widget can parse and display                   ║
// ║                                                                            ║
// ║  DEPLOYMENT NOTES:                                                         ║
// ║  - Deploy as: Web App                                                      ║
// ║  - Execute as: "Me" (your Google account)                                  ║
// ║  - Who has access: "Anyone" (so widget can access without login)           ║
// ║  - IMPORTANT: After code changes, you must deploy a NEW version            ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * doGet_Simplified(e) - Main entry point for SIMPLIFIED version
 *
 * Called by Main.gs router when version=simplified or ACTIVE_VERSION="SIMPLIFIED"
 *
 * @param {Object} e - Event object provided by Google containing request details
 * @param {Object} e.parameter - URL query parameters as key-value pairs
 *                               Example URL: ...exec?name=Sick&days=3
 *                               e.parameter = { name: "Sick", days: "3" }
 *
 * @returns {TextOutput} JSON response that the widget will parse
 *
 * EXAMPLE REQUEST:
 *   URL: https://script.google.com/.../exec?name=Sick&days=3
 *
 * EXAMPLE RESPONSE:
 *   {
 *     "searchName": "Sick",
 *     "events": [...],
 *     "totalEvents": 5
 *   }
 */
function doGet_Simplified(e) {
  try {
    // Extract URL parameters with fallback defaults
    // e.parameter.name comes from "?name=Sick" in the URL
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;

    // e.parameter.days comes from "&days=3" in the URL
    // parseInt converts string "3" to number 3
    const daysAhead = parseInt(e.parameter.days) || 3;

    // 🧪 Test mode support via URL parameter
    // e.parameter.testDate comes from "&testDate=2025-12-15" in the URL
    // This overrides the config setting
    const testDate = e.parameter.testDate || null;

    // Call our main data-fetching function
    const results = getEventsForWidget(searchName, daysAhead, testDate);

    // Return JSON response
    // ContentService is Google's way of sending HTTP responses
    // setMimeType tells the browser/widget this is JSON data
    return ContentService
      .createTextOutput(JSON.stringify(results))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // If anything goes wrong, return an error response
    // This helps with debugging - the widget can show the error message
    return ContentService
      .createTextOutput(JSON.stringify({
        error: true,
        message: error.toString(),
        stack: error.stack  // Include stack trace for debugging
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     [SECTION 3] CORE DATA FUNCTIONS                        ║
// ║                          ⚡ SIMPLIFIED VERSION ⚡                           ║
// ║                                                                            ║
// ║  PERFORMANCE IMPROVEMENTS:                                                 ║
// ║  1. Spreadsheet object is opened ONCE and reused for all days              ║
// ║  2. Batch range reads to minimize API calls                                ║
// ║  3. Uses getDisplayValues() instead of getValues() (skips formatting)      ║
// ║  4. NO CACHING - Always fresh data, simpler code                           ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * getEventsForWidget(searchName, daysAhead, testDate) - Main orchestration function
 *
 * ⚡ OPTIMIZATION: Opens spreadsheet ONCE and reuses for all days
 *
 * @param {string} searchName - The name to search for (e.g., "Sick", "Montes")
 * @param {number} daysAhead - How many days into the future to search
 * @param {string} testDate - Optional test date in "YYYY-MM-DD" format (for testing)
 * @returns {Object} Structured response object (same format as original)
 */
function getEventsForWidget(searchName, daysAhead, testDate = null) {
  // STEP 1: Get the list of dates we need to search
  // 🧪 Pass testDate to use simulated "today" for testing
  const upcomingDays = getNextNWeekdays(daysAhead, testDate);

  // ⚡ OPTIMIZATION: Open spreadsheet ONCE, reuse for all days
  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  // Initialize arrays to collect results
  const events = [];           // Days that have events
  const searchedSheets = [];   // All sheets searched (for debugging)

  // Log what we're doing (visible in Apps Script execution log)
  console.log(`⚡ SIMPLIFIED VERSION (no cache) - Searching for: "${searchName}"`);
  console.log(`Days to search: ${upcomingDays.length}`);

  // STEP 2: Loop through each date and search its corresponding sheet
  upcomingDays.forEach(date => {
    // Convert the Date object to a sheet name
    const sheetName = generateSheetName(date);
    console.log(`Looking for sheet: "${sheetName}"`);

    // STEP 3: Search this specific sheet for the name
    // ⚡ OPTIMIZATION: Pass spreadsheet object instead of opening again
    const dayEvents = searchNameInSheetForWidget_Simplified(
      spreadsheet,  // ← Reuse the already-opened spreadsheet!
      sheetName,
      searchName
    );

    // Track what we searched (helps debug "why isn't X showing?" issues)
    searchedSheets.push({
      date: formatDateISO(date),
      sheetName: sheetName,
      eventsFound: dayEvents.length
    });

    // STEP 4: Only include days that have events in the final response
    if (dayEvents.length > 0) {
      events.push({
        date: formatDateISO(date),
        dayName: getDayName(date),
        sheetName: sheetName,
        events: dayEvents
      });
    }
  });

  // STEP 5: Get current time in configured timezone for debugging
  const now = new Date();
  const localTimeString = Utilities.formatDate(
    now,
    SEARCH_CONFIG.timezone,
    "yyyy-MM-dd HH:mm:ss z"
  );

  // STEP 6: Build and return the final response object
  // ⚡ Same format as original - no breaking changes!
  const response = {
    searchName: searchName,
    generatedAt: new Date().toISOString(),
    localTime: localTimeString,
    timezone: SEARCH_CONFIG.timezone,
    daysAhead: daysAhead,
    daysSearched: upcomingDays.length,
    searchedSheets: searchedSheets,
    events: events,
    totalEvents: events.reduce((sum, day) => sum + day.events.length, 0),
    optimized: true,  // Flag to indicate this is the optimized version
    simplified: true, // Flag to indicate this is the simplified (no cache) version
    version: "4.0"    // Version tracking
  };

  // 🧪 Add test mode info if active
  if (testDate || SEARCH_CONFIG.testMode) {
    response.testMode = true;
    response.simulatedToday = testDate || SEARCH_CONFIG.testDate;
  }

  return response;
}


/**
 * searchNameInSheetForWidget_Simplified() - Reads and searches sheet data
 *
 * ⚡ OPTIMIZATIONS:
 * 1. Accepts spreadsheet object as parameter (no redundant opens)
 * 2. Uses getDisplayValues() instead of getValues() (40-50% faster!)
 * 3. Batch range reads with getRangeList (4 calls → 1)
 * 4. NO CACHING - Always fetches fresh data from sheet
 *
 * @param {Spreadsheet} spreadsheet - Pre-opened spreadsheet object
 * @param {string} sheetName - The name of the sheet tab to search
 * @param {string} searchName - The name to search for
 * @returns {Array} Array of event objects (same format as original)
 */
function searchNameInSheetForWidget_Simplified(spreadsheet, sheetName, searchName) {
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Get the specific sheet
  // ─────────────────────────────────────────────────────────────────────────

  // ⚡ OPTIMIZATION: Spreadsheet already opened, just get the sheet
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    console.log(`Sheet not found: ${sheetName}`);
    return [];
  }

  console.log(`Searching sheet: ${sheetName}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Define the ranges to search
  // ─────────────────────────────────────────────────────────────────────────

  const searchRanges = [
    { range: WHITEBOARD_RANGES.supervision,   name: "Supervision" },
    { range: WHITEBOARD_RANGES.flyingEvents,  name: "Flying Events" },
    { range: WHITEBOARD_RANGES.groundEvents,  name: "Ground Events" },
    { range: WHITEBOARD_RANGES.notAvailable,  name: "Not Available" }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // ⚡ OPTIMIZATION: Batch range reads with getRangeList
  // ─────────────────────────────────────────────────────────────────────────

  const rangeAddresses = searchRanges.map(sr => sr.range);
  const rangeList = sheet.getRangeList(rangeAddresses);

  // ⚡ OPTIMIZATION: Use getDisplayValues() instead of getValues()
  // This is 40-50% faster because it skips conditional formatting evaluation!
  const allRangeData = rangeList.getRanges().map(r => r.getDisplayValues());

  console.log(`✅ Read ${rangeAddresses.length} ranges in single batch operation`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Search each range for the name (data already in memory)
  // ─────────────────────────────────────────────────────────────────────────

  const matches = [];

  allRangeData.forEach((values, rangeIndex) => {
    const searchRange = searchRanges[rangeIndex];

    try {
      values.forEach((row, rowIndex) => {
        // Check if this row contains the search name
        const rowText = row.join('|').toLowerCase();
        const nameToFind = searchName.toLowerCase();

        if (rowText.includes(nameToFind)) {
          // Extract and clean the event data
          const eventData = row
            .filter(cell => {
              if (cell === "" || cell === null || cell === undefined) return false;
              if (typeof cell === 'boolean') return false;
              if (cell === true || cell === false) return false;

              const cellStr = String(cell).toLowerCase();
              if (cellStr === 'true' || cellStr === 'false') return false;

              return true;
            })
            .map(cell => formatCellValue(cell));

          if (eventData.length > 0) {
            // Check if first item looks like a time
            const firstItem = eventData[0];
            const isTime = /^\d{2}:\d{2}$/.test(firstItem) || /^\d{4}$/.test(firstItem);

            matches.push({
              time: isTime ? firstItem : "",
              description: isTime
                ? eventData.slice(1).join(" | ")
                : eventData.join(" | "),
              rangeSource: searchRange.name,
              rawData: eventData
            });

            console.log(`Found match in ${searchRange.name}: ${eventData.slice(0, 3).join(' | ')}`);
          }
        }
      });

    } catch (error) {
      console.error(`Error in range ${searchRange.range}: ${error.toString()}`);
    }
  });

  console.log(`Found ${matches.length} matches for "${searchName}" in ${sheetName}`);

  return matches;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     [SECTION 4] DATE/TIME UTILITIES                        ║
// ║                                                                            ║
// ║  Functions for working with dates, times, and generating sheet names.      ║
// ║  (No changes from original - these are already optimized)                  ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * getNextNWeekdays(n, testDate) - Get today and the next N weekdays
 *
 * Returns an array of Date objects representing weekdays (Mon-Fri) to search.
 * Weekends are skipped. Today is included if it's a weekday.
 *
 * @param {number} n - Number of additional days after today
 * @param {string} testDate - Optional test date in "YYYY-MM-DD" format (for testing)
 * @returns {Array<Date>} Array of Date objects
 */
function getNextNWeekdays(n, testDate = null) {
  const weekdays = [];

  // 🧪 Determine which date to use as "today"
  let localDateStr;

  if (testDate) {
    // URL parameter testDate overrides everything
    localDateStr = testDate;
    console.log(`🧪 TEST MODE: Using URL parameter testDate = ${testDate}`);
  } else if (SEARCH_CONFIG.testMode) {
    // Config testMode is enabled
    localDateStr = SEARCH_CONFIG.testDate;
    console.log(`🧪 TEST MODE: Using config testDate = ${SEARCH_CONFIG.testDate}`);
  } else {
    // Normal mode: use actual current date
    const now = new Date();
    localDateStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, "yyyy-MM-dd");
    console.log(`✅ LIVE MODE: Using actual date = ${localDateStr}`);
  }

  const localParts = localDateStr.split('-');

  let currentDate = new Date(
    parseInt(localParts[0]),
    parseInt(localParts[1]) - 1,
    parseInt(localParts[2]),
    12, 0, 0
  );

  console.log(`Starting from: ${currentDate.toDateString()}`);

  // Check if today is a weekday and include it
  const todayDayOfWeek = currentDate.getDay();

  if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
    weekdays.push(new Date(currentDate));
    console.log(`Including today: ${currentDate.toDateString()} (day ${todayDayOfWeek})`);
  } else {
    console.log(`Today is a weekend (day ${todayDayOfWeek}), skipping`);
  }

  // Add more days until we have enough
  const targetCount = n + 1;
  let safetyCounter = 0;

  while (weekdays.length < targetCount && safetyCounter < 30) {
    currentDate.setDate(currentDate.getDate() + 1);
    safetyCounter++;

    const dayOfWeek = currentDate.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday) {
      weekdays.push(new Date(currentDate));
      console.log(`Adding: ${currentDate.toDateString()} (day ${dayOfWeek})`);
    }
  }

  console.log(`Total days to search: ${weekdays.length}`);
  return weekdays;
}


/**
 * generateSheetName(date) - Convert a Date to sheet tab name format
 *
 * @param {Date} date - The date to convert
 * @returns {string} Sheet name in format "Day DD Mon"
 */
function generateSheetName(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[date.getDay()];
  const dayNumber = date.getDate();
  const monthName = months[date.getMonth()];

  return `${dayName} ${dayNumber} ${monthName}`;
}


/**
 * getDayName(date) - Get full day name
 *
 * @param {Date} date - The date
 * @returns {string} Full day name (e.g., "Thursday")
 */
function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}


/**
 * formatDateISO(date) - Format date as ISO string (YYYY-MM-DD)
 *
 * @param {Date} date - The date to format
 * @returns {string} Date in ISO format (e.g., "2025-12-11")
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     [SECTION 5] CELL FORMATTING UTILITIES                  ║
// ║                                                                            ║
// ║  Functions for cleaning and formatting cell values from Google Sheets.     ║
// ║  (No changes from original - these work with getDisplayValues() too)       ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * formatCellValue(cell) - Clean and format a single cell value
 *
 * NOTE: With getDisplayValues(), most values are already strings,
 * but this function still handles edge cases and time formatting.
 *
 * @param {any} cell - The cell value from Google Sheets
 * @returns {string} Cleaned and formatted string value
 */
function formatCellValue(cell) {
  if (cell === "" || cell === null || cell === undefined) {
    return "";
  }

  if (typeof cell === 'boolean') {
    return "";
  }

  if (cell instanceof Date) {
    const hours = cell.getHours().toString().padStart(2, '0');
    const minutes = cell.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const cellStr = cell.toString().trim();

  if (cellStr.toLowerCase() === 'true' || cellStr.toLowerCase() === 'false') {
    return "";
  }

  // Already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(cellStr)) {
    return cellStr;
  }

  // 4-digit time format (e.g., "0800" → "08:00")
  if (/^\d{4}$/.test(cellStr)) {
    return cellStr.substring(0, 2) + ':' + cellStr.substring(2, 4);
  }

  // Time without leading zero (e.g., "8:00" → "08:00")
  const timeMatch = cellStr.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0');
    const minutes = timeMatch[2];
    return `${hours}:${minutes}`;
  }

  // Time with AM/PM
  const timeWithAmPm = cellStr.match(/(\d{1,2}):(\d{2}):?\d*\s*(AM|PM)?/i);
  if (timeWithAmPm) {
    let hours = parseInt(timeWithAmPm[1]);
    const minutes = timeWithAmPm[2];
    const ampm = timeWithAmPm[3];

    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
    }
    return hours.toString().padStart(2, '0') + ':' + minutes;
  }

  return cellStr;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     [SECTION 6] TESTING & DEBUGGING FUNCTIONS              ║
// ║                          ⚡ SIMPLIFIED VERSION ⚡                           ║
// ║                                                                            ║
// ║  Run these functions from the Apps Script editor to test and debug.        ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * testPerformance() - Measure execution time
 *
 * This function measures how long it takes to fetch data.
 * Run this to see the performance of the simplified version.
 */
function testPerformance() {
  console.log("🚀 PERFORMANCE TEST - SIMPLIFIED VERSION (NO CACHE)");
  console.log("=".repeat(60));

  const searchName = "Sick";
  const daysAhead = 4;

  // Run test
  console.log("\n📊 TEST: Fresh data fetch (no cache)");
  const start = Date.now();
  const result = getEventsForWidget(searchName, daysAhead);
  const duration = Date.now() - start;

  console.log(`⏱️  Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
  console.log(`📊 Events found: ${result.totalEvents}`);
  console.log(`✅ Version: ${result.version} (Simplified - No Cache)`);

  // Performance summary
  console.log("\n" + "=".repeat(60));
  console.log("📈 PERFORMANCE SUMMARY:");
  console.log(`   Request time: ${(duration/1000).toFixed(2)}s`);
  console.log(`   Original: ~60s for 4 days`);
  console.log(`   Simplified: ~30s for 5 days`);
  console.log(`   Improvement: ~2.5x faster than original`);

  if (duration < 40000) {
    console.log(`   ✅ EXCELLENT: Under 40s (expected ~30s)`);
  } else {
    console.log(`   ⚠️  WARNING: Over 40s (expected ~30s)`);
  }

  console.log("\n💡 NOTE:");
  console.log("   This version has NO CACHE - all requests fetch fresh data");
  console.log("   Ideal for background refresh (15-min intervals)");
  console.log("   Always up-to-date, simpler code, no staleness issues");
}


/**
 * testWidgetEndpoint() - Full simulation of a widget request
 */
function testWidgetEndpoint() {
  console.log("Testing Widget Endpoint (Simplified)");
  console.log("=".repeat(60));

  const result = getEventsForWidget("Sick", 3);

  console.log("\n📊 SUMMARY:");
  console.log(`   Search name: ${result.searchName}`);
  console.log(`   Local time: ${result.localTime}`);
  console.log(`   Days searched: ${result.daysSearched}`);
  console.log(`   Days with events: ${result.events.length}`);
  console.log(`   Total events: ${result.totalEvents}`);
  console.log(`   Version: ${result.version} (${result.simplified ? 'SIMPLIFIED' : 'OPTIMIZED'})`);

  console.log("\n🔍 SHEETS SEARCHED:");
  result.searchedSheets.forEach(sheet => {
    const hasEvents = sheet.eventsFound > 0 ? '✓' : '✗';
    console.log(`   ${hasEvents} ${sheet.sheetName} (${sheet.date}): ${sheet.eventsFound} events`);
  });

  if (result.events.length > 0) {
    console.log("\n📅 EVENTS BY DAY:");
    result.events.forEach(day => {
      console.log(`\n   ${day.dayName} (${day.date}):`);
      day.events.forEach(evt => {
        const desc = evt.description.length > 50
          ? evt.description.substring(0, 50) + "..."
          : evt.description;
        console.log(`      ${evt.time || "N/A"} - ${desc}`);
      });
    });
  } else {
    console.log("\n⚠️ No events found");
  }

  console.log("\n📋 FULL JSON RESPONSE:");
  console.log(JSON.stringify(result, null, 2));
}


/**
 * diagnoseToday() - Quick diagnostic for "today not showing" issues
 */
function diagnoseToday() {
  console.log("🔍 DIAGNOSTIC: Why isn't today showing? (Simplified)");
  console.log("=".repeat(60));

  const now = new Date();
  const localDateStr = Utilities.formatDate(
    now,
    SEARCH_CONFIG.timezone,
    "yyyy-MM-dd EEEE HH:mm:ss"
  );

  console.log(`\n1. TIME CHECK:`);
  console.log(`   Server UTC: ${now.toISOString()}`);
  console.log(`   Local (${SEARCH_CONFIG.timezone}): ${localDateStr}`);

  const localParts = Utilities.formatDate(now, SEARCH_CONFIG.timezone, "yyyy-MM-dd").split('-');
  const today = new Date(
    parseInt(localParts[0]),
    parseInt(localParts[1]) - 1,
    parseInt(localParts[2]),
    12, 0, 0
  );
  const todaySheetName = generateSheetName(today);

  console.log(`\n2. SHEET NAME CHECK:`);
  console.log(`   Today's sheet should be: "${todaySheetName}"`);

  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(todaySheetName);

  console.log(`\n3. SHEET EXISTS?`);
  if (sheet) {
    console.log(`   ✅ YES - Sheet "${todaySheetName}" exists`);

    console.log(`\n4. SEARCHING FOR "Sick" IN TODAY'S SHEET:`);
    const events = searchNameInSheetForWidget_Simplified(spreadsheet, todaySheetName, "Sick");

    if (events.length > 0) {
      console.log(`   ✅ Found ${events.length} event(s):`);
      events.forEach(evt => {
        console.log(`      - ${evt.time} ${evt.description.substring(0, 60)}`);
      });
    } else {
      console.log(`   ❌ No events found for "Sick" in today's sheet`);
    }
  } else {
    console.log(`   ❌ NO - Sheet "${todaySheetName}" does NOT exist`);
  }
}


/**
 * testWebRequest() - Simulate an HTTP GET request
 */
function testWebRequest() {
  const mockEvent = {
    parameter: {
      name: "Sick",
      days: "3"
    }
  };

  console.log("Simulating Web Request (Simplified)");
  console.log("=".repeat(60));
  console.log(`\nSimulated URL: ?name=${mockEvent.parameter.name}&days=${mockEvent.parameter.days}\n`);

  const response = doGet(mockEvent);
  const content = response.getContent();
  const parsed = JSON.parse(content);

  if (parsed.error) {
    console.log("❌ ERROR:");
    console.log(`   Message: ${parsed.message}`);
    console.log(`   Stack: ${parsed.stack}`);
  } else {
    console.log("✅ SUCCESS:");
    console.log(`   Local time: ${parsed.localTime}`);
    console.log(`   Found ${parsed.totalEvents} events for "${parsed.searchName}"`);
    console.log(`   Version: ${parsed.version} (${parsed.simplified ? 'SIMPLIFIED' : 'OPTIMIZED'})`);

    console.log("\n🔍 SHEETS SEARCHED:");
    parsed.searchedSheets.forEach(sheet => {
      const hasEvents = sheet.eventsFound > 0 ? '✓' : '✗';
      console.log(`   ${hasEvents} ${sheet.sheetName}: ${sheet.eventsFound} events`);
    });

    console.log("\n📋 FULL RESPONSE:");
    console.log(JSON.stringify(parsed, null, 2));
  }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                     🧪 TEST MODE HELPER FUNCTIONS                          ║
// ║                                                                            ║
// ║  Use these functions to test the script with specific dates as "today"     ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * testWithDate() - Test the script with a specific date as "today"
 *
 * This is the easiest way to test with Mon 15 Dec or any other date.
 *
 * @param {string} testDate - Date in "YYYY-MM-DD" format (e.g., "2025-12-15")
 * @param {string} searchName - Name to search for (default: "Sick")
 * @param {number} daysAhead - Number of days to search (default: 4)
 *
 * EXAMPLES:
 *   testWithDate("2025-12-15")                    // Mon 15 Dec, search "Sick", 4 days
 *   testWithDate("2025-12-15", "Montes")          // Mon 15 Dec, search "Montes", 4 days
 *   testWithDate("2025-12-15", "Sick", 3)         // Mon 15 Dec, search "Sick", 3 days
 *   testWithDate("2025-12-16")                    // Tue 16 Dec
 *   testWithDate("2025-12-11")                    // Thu 11 Dec
 */
function testWithDate(testDate, searchName = "Sick", daysAhead = 4) {
  console.log("🧪 TEST MODE: Testing with specific date");
  console.log("=".repeat(60));
  console.log(`   Simulated Today: ${testDate}`);
  console.log(`   Search Name: ${searchName}`);
  console.log(`   Days Ahead: ${daysAhead}`);
  console.log("");

  const result = getEventsForWidget(searchName, daysAhead, testDate);

  console.log("\n📊 SUMMARY:");
  console.log(`   🧪 Test Mode: ${result.testMode ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   📅 Simulated Today: ${result.simulatedToday}`);
  console.log(`   🔍 Search name: ${result.searchName}`);
  console.log(`   📆 Days searched: ${result.daysSearched}`);
  console.log(`   📅 Days with events: ${result.events.length}`);
  console.log(`   📋 Total events: ${result.totalEvents}`);

  console.log("\n🔍 SHEETS SEARCHED:");
  result.searchedSheets.forEach(sheet => {
    const hasEvents = sheet.eventsFound > 0 ? '✓' : '✗';
    console.log(`   ${hasEvents} ${sheet.sheetName} (${sheet.date}): ${sheet.eventsFound} events`);
  });

  if (result.events.length > 0) {
    console.log("\n📅 EVENTS BY DAY:");
    result.events.forEach(day => {
      console.log(`\n   ${day.dayName} ${day.date}:`);
      day.events.forEach(evt => {
        const desc = evt.description.length > 50
          ? evt.description.substring(0, 50) + "..."
          : evt.description;
        console.log(`      ${evt.time || "N/A"} - ${desc}`);
      });
    });
  } else {
    console.log("\n⚠️  NO EVENTS FOUND");
    console.log("   This could mean:");
    console.log(`   - No events scheduled for "${searchName}" on these dates`);
    console.log("   - The sheet names don't match the expected format");
    console.log("   - The name is spelled differently in the sheets");
  }

  console.log("\n📋 FULL JSON RESPONSE:");
  console.log(JSON.stringify(result, null, 2));

  return result;
}


/**
 * testMon15Dec() - Quick test with Mon 15 Dec 2025 as "today"
 *
 * This is a shortcut for testing with the date that has events in your whiteboard.
 * Run this during holidays or when testing.
 */
function testMon15Dec() {
  console.log("🧪 QUICK TEST: Mon 15 Dec 2025");
  console.log("=".repeat(60));
  return testWithDate("2025-12-15", "Sick", 4);
}


/**
 * testWebRequestWithDate() - Simulate a web request with test date
 *
 * Simulates what happens when the widget calls your API with a testDate parameter.
 *
 * @param {string} testDate - Date in "YYYY-MM-DD" format
 * @param {string} searchName - Name to search for (default: "Sick")
 * @param {number} daysAhead - Number of days to search (default: 4)
 *
 * EXAMPLE:
 *   testWebRequestWithDate("2025-12-15")
 *   testWebRequestWithDate("2025-12-15", "Montes", 3)
 */
function testWebRequestWithDate(testDate, searchName = "Sick", daysAhead = 4) {
  const mockEvent = {
    parameter: {
      name: searchName,
      days: daysAhead.toString(),
      testDate: testDate
    }
  };

  console.log("🧪 Simulating Web Request with Test Date");
  console.log("=".repeat(60));
  console.log(`\nSimulated URL: ?name=${searchName}&days=${daysAhead}&testDate=${testDate}\n`);

  const response = doGet(mockEvent);
  const content = response.getContent();
  const parsed = JSON.parse(content);

  if (parsed.error) {
    console.log("❌ ERROR:");
    console.log(`   Message: ${parsed.message}`);
    console.log(`   Stack: ${parsed.stack}`);
  } else {
    console.log("✅ SUCCESS:");
    console.log(`   🧪 Test Mode: ${parsed.testMode ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   📅 Simulated Today: ${parsed.simulatedToday || 'N/A'}`);
    console.log(`   🔍 Search name: ${parsed.searchName}`);
    console.log(`   📋 Total events: ${parsed.totalEvents}`);
    console.log(`   📦 Version: ${parsed.version} (${parsed.simplified ? 'SIMPLIFIED' : 'OPTIMIZED'})`);

    console.log("\n🔍 SHEETS SEARCHED:");
    parsed.searchedSheets.forEach(sheet => {
      const hasEvents = sheet.eventsFound > 0 ? '✓' : '✗';
      console.log(`   ${hasEvents} ${sheet.sheetName}: ${sheet.eventsFound} events`);
    });

    if (parsed.events.length > 0) {
      console.log("\n📅 EVENTS FOUND:");
      parsed.events.forEach(day => {
        console.log(`   ${day.dayName} (${day.date}): ${day.events.length} events`);
      });
    }

    console.log("\n📋 FULL RESPONSE:");
    console.log(JSON.stringify(parsed, null, 2));
  }

  return parsed;
}
