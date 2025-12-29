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
