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

/**
 * Sheet structure changeover date
 * Format: 'YYYY-MM-DD'
 * On this date and after, the new sheet structure will be used
 */
const STRUCTURE_CHANGEOVER_DATE = '2026-01-12';

/**
 * Sheet structure configurations
 * Rows are 1-indexed to match Google Sheets UI
 */
const SHEET_STRUCTURES = {
  // Current structure (before changeover date)
  legacy: {
    sections: {
      supervision: { startRow: 1, endRow: 9, range: 'A1:N9' },
      flying: { startRow: 11, endRow: 52, range: 'A11:R52' },
      ground: { startRow: 54, endRow: 80, range: 'A54:M80' },
      na: { startRow: 82, endRow: 113, range: 'A82:K113' }
    },
    roster: {
      range: 'A120:R168',
      columns: [
        { col: 0, name: 'Bravo Students', type: 'student' },    // Column A
        { col: 4, name: 'Alpha Students', type: 'student' },    // Column E
        { col: 8, name: 'Staff IP', type: 'staff' },            // Column I
        { col: 12, name: 'Staff IFTE/ICSO', type: 'staff' },    // Column M
        { col: 16, name: 'Attached/Support', type: 'staff' }    // Column Q
      ]
    }
  },

  // New structure (on/after changeover date)
  current: {
    sections: {
      supervision: { startRow: 1, endRow: 11, range: 'A1:N11' },
      flying: { startRow: 13, endRow: 134, range: 'A13:R134' },
      ground: { startRow: 136, endRow: 237, range: 'A136:M237' },
      na: { startRow: 239, endRow: 340, range: 'A239:K340' }
    },
    roster: {
      // Multiple ranges for the new roster structure
      ranges: [
        { range: 'A348:D448', name: 'FTC-B', type: 'student', nameCol: 0 },
        { range: 'A449:D549', name: 'STC-B', type: 'student', nameCol: 0 },
        { range: 'E348:H448', name: 'FTC-A', type: 'student', nameCol: 0 },
        { range: 'E449:H549', name: 'STC-A', type: 'student', nameCol: 0 },
        { range: 'I348:L448', name: 'Staff IP', type: 'staff', nameCol: 0 },
        { range: 'I449:L549', name: 'Staff STC', type: 'staff', nameCol: 0 },
        { range: 'M348:P448', name: 'Staff IFTE/ICSO', type: 'staff', nameCol: 0 },
        { range: 'Q348:T448', name: 'Attached/Support', type: 'staff', nameCol: 0 },
        { range: 'M449:P549', name: 'Future Category 1', type: 'staff', nameCol: 0 },
        { range: 'Q449:T549', name: 'Future Category 2', type: 'staff', nameCol: 0 }
      ]
    }
  }
};

/**
 * Get the active sheet structure based on current date
 * @returns {Object} The active sheet structure configuration
 */
function getActiveSheetStructure() {
  const now = new Date();
  const todayStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, 'yyyy-MM-dd');

  if (todayStr >= STRUCTURE_CHANGEOVER_DATE) {
    console.log(`Using NEW sheet structure (changeover: ${STRUCTURE_CHANGEOVER_DATE})`);
    return SHEET_STRUCTURES.current;
  } else {
    console.log(`Using LEGACY sheet structure (until: ${STRUCTURE_CHANGEOVER_DATE})`);
    return SHEET_STRUCTURES.legacy;
  }
}

/**
 * Get section ranges for current structure
 * @returns {Object} Section configuration with ranges
 */
function getSectionRanges() {
  return getActiveSheetStructure().sections;
}

/**
 * Get roster configuration for current structure
 * @returns {Object} Roster configuration
 */
function getRosterConfig() {
  return getActiveSheetStructure().roster;
}
