// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    SHARED CONFIGURATION                                    ║
// ║                                                                            ║
// ║  This config is shared by ALL versions (Simplified, Optimized, etc.)       ║
// ║  Define it once here to avoid "already declared" errors                    ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * SEARCH_CONFIG - Global configuration shared across all versions
 *
 * IMPORTANT: This is declared ONCE and used by all .gs files
 * Do NOT redeclare this in other files!
 */
const SEARCH_CONFIG = {
  // Default name to search for (can be overridden by URL parameter)
  searchTerm: "Sick",

  // Email address for optional email reports (not used by widget)
  recipientEmail: "your-email@gmail.com",

  // The Google Sheets spreadsheet ID
  // Found in the spreadsheet URL: https://docs.google.com/spreadsheets/d/[THIS_PART]/edit
  spreadsheetId: "1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU",

  // Timezone for date calculations
  // CRITICAL: This must match the user's timezone to ensure "today" is correct
  // Common values: "America/Los_Angeles" (Pacific), "America/Denver" (Mountain),
  //                "America/Chicago" (Central), "America/New_York" (Eastern)
  // Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  timezone: "America/Los_Angeles",

  // Cache TTL (only used by Optimized version)
  cacheTTL: 600,  // 10 minutes

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧪 TEST MODE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  // Use this to test the script with a specific date as "today"
  // Useful during holidays or when testing with historical data
  //
  // USAGE:
  // Option 1: Enable testMode and set testDate here
  //   testMode: true,
  //   testDate: "2025-12-15"  // Mon 15 Dec 2025
  //
  // Option 2: Pass testDate as URL parameter (overrides config)
  //   ?name=Sick&days=4&testDate=2025-12-15
  //
  // FORMAT: "YYYY-MM-DD" (ISO date format)
  // EXAMPLE DATES:
  //   "2025-12-15" = Mon 15 Dec 2025 (has events in your whiteboard)
  //   "2025-12-16" = Tue 16 Dec 2025
  //   "2025-12-11" = Thu 11 Dec 2025
  //
  testMode: false,              // Set to true to enable test mode
  testDate: "2025-12-15"        // The date to simulate as "today"
};

// ═══════════════════════════════════════════════════════════════════════════
// 📍 SHEET RANGE CONFIGURATION (DATE-BASED)
// ═══════════════════════════════════════════════════════════════════════════
// The whiteboard structure changes over time as schedulers add/remove rows.
// This configuration allows automatic switching between range sets based on date.
//
// ⚠️ IMPORTANT: Update RANGE_TRANSITION_DATE when the whiteboard changes!
//
// HOW TO UPDATE WHEN WHITEBOARD CHANGES:
// 1. Set RANGE_TRANSITION_DATE to the effective date of the change
// 2. Update the "new" ranges to match the new whiteboard structure
// 3. Keep "old" ranges for historical sheet compatibility
// 4. All processors will automatically use correct ranges based on sheet date
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * RANGE_TRANSITION_DATE - Date when whiteboard structure changes
 *
 * Sheets dated ON OR AFTER this date will use NEW_RANGES
 * Sheets dated BEFORE this date will use OLD_RANGES
 *
 * Format: "YYYY-MM-DD"
 * Example: "2026-01-12" means Jan 12, 2026 and later use new ranges
 */
const RANGE_TRANSITION_DATE = "2026-01-12";

/**
 * OLD_RANGES - Cell ranges for sheets BEFORE transition date
 *
 * These are the current ranges used before the whiteboard restructure.
 * Keep these for backward compatibility with historical sheets.
 */
const OLD_RANGES = {
  // Supervision section (SOF, OS, ODO, etc.)
  supervision: "A1:N9",

  // Flying Events section (aircraft operations)
  flyingEvents: "A11:R52",

  // Ground Events section (meetings, training, etc.)
  groundEvents: "A54:Q80",

  // Not Available section (leave, medical, etc.)
  notAvailable: "A82:N113",

  // Student/Staff list (for person type detection)
  peopleList: "A120:Z169"
};

/**
 * NEW_RANGES - Cell ranges for sheets ON OR AFTER transition date
 *
 * UPDATE THESE when the whiteboard structure changes!
 * These will be used for all sheets dated Jan 12, 2026 and later.
 *
 * Example: If schedulers add 10 rows to Flying Events:
 *   OLD: "A11:R52"  (42 rows)
 *   NEW: "A11:R62"  (52 rows)
 */
const NEW_RANGES = {
  // TODO: Update these ranges to match new whiteboard structure
  // For now, they're the same as OLD_RANGES (change as needed)

  supervision: "A1:N9",        // Update if supervision section changes
  flyingEvents: "A11:R52",     // Update if flying events section changes
  groundEvents: "A54:Q80",     // Update if ground events section changes
  notAvailable: "A82:N113",    // Update if NA section changes
  peopleList: "A120:Z169"      // Update if people list location changes
};

/**
 * getRangesForDate() - Get correct cell ranges based on sheet date
 *
 * Automatically selects OLD_RANGES or NEW_RANGES based on whether the
 * sheet date is before or after RANGE_TRANSITION_DATE.
 *
 * @param {string|Date} sheetDate - Date of the sheet (YYYY-MM-DD or Date object)
 * @returns {Object} Appropriate range configuration (OLD_RANGES or NEW_RANGES)
 *
 * @example
 * const ranges = getRangesForDate("2026-01-10");  // Returns OLD_RANGES
 * const ranges = getRangesForDate("2026-01-15");  // Returns NEW_RANGES
 */
function getRangesForDate(sheetDate) {
  try {
    // Convert sheetDate to Date object if it's a string
    let dateObj;
    if (typeof sheetDate === 'string') {
      dateObj = new Date(sheetDate);
    } else if (sheetDate instanceof Date) {
      dateObj = sheetDate;
    } else {
      console.warn(`Invalid date format: ${sheetDate}, using OLD_RANGES as fallback`);
      return OLD_RANGES;
    }

    // Parse transition date
    const transitionDate = new Date(RANGE_TRANSITION_DATE);

    // Compare dates (ignoring time component)
    const sheetDateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const transitionDateOnly = new Date(transitionDate.getFullYear(), transitionDate.getMonth(), transitionDate.getDate());

    // Use NEW_RANGES if sheet date is on or after transition date
    if (sheetDateOnly >= transitionDateOnly) {
      console.log(`Sheet date ${sheetDate} >= transition date ${RANGE_TRANSITION_DATE}: using NEW_RANGES`);
      return NEW_RANGES;
    } else {
      console.log(`Sheet date ${sheetDate} < transition date ${RANGE_TRANSITION_DATE}: using OLD_RANGES`);
      return OLD_RANGES;
    }

  } catch (error) {
    console.error(`Error in getRangesForDate: ${error.toString()}`);
    console.log('Falling back to OLD_RANGES');
    return OLD_RANGES;
  }
}

/**
 * getCurrentRanges() - Get ranges for today's date
 *
 * Convenience function that calls getRangesForDate with current date.
 * Respects SEARCH_CONFIG.testMode and testDate.
 *
 * @returns {Object} Appropriate range configuration for today
 */
function getCurrentRanges() {
  let today;

  // Check if test mode is enabled
  if (SEARCH_CONFIG.testMode && SEARCH_CONFIG.testDate) {
    today = SEARCH_CONFIG.testDate;
    console.log(`Test mode: using testDate ${today} for range selection`);
  } else {
    // Use actual current date in configured timezone
    const now = new Date();
    today = Utilities.formatDate(now, SEARCH_CONFIG.timezone, "yyyy-MM-dd");
  }

  return getRangesForDate(today);
}
