/**
 * TPS Schedule - Shared Configuration
 *
 * This config is shared by ALL versions (Simplified, Enhanced, BatchProcessor)
 * Define settings once here to avoid duplication.
 */

const SEARCH_CONFIG = {
  // Default name to search for (can be overridden by URL parameter)
  searchTerm: "Sick",

  // The Google Sheets spreadsheet ID
  // Found in the spreadsheet URL: https://docs.google.com/spreadsheets/d/[THIS_PART]/edit
  spreadsheetId: "1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU",

  // Timezone for date calculations
  // CRITICAL: Must match user's timezone to ensure "today" is correct
  timezone: "America/Los_Angeles",

  // Cache TTL in seconds (6 hours)
  cacheTTL: 21600
};
