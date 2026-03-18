/**
 * TPS Schedule v6.0 — Configuration
 *
 * All settings in one place. Edit this file to change behavior.
 * See Code.gs for logic. See the spec doc for architecture details.
 *
 * TRIGGER SETUP (run once from GAS editor):
 *   1. Open Code.gs in the Apps Script editor
 *   2. Select setupTriggers() from the function dropdown
 *   3. Click Run and authorize when prompted
 *   This creates a 15-minute trigger for batchProcessSchedule()
 */

const CONFIG = {
  /** Google Sheets spreadsheet ID (from the URL) */
  spreadsheetId: '1m5-6FxgCpgjlbcYYXlFMXrJ0sgyBPFwql9sG7WDI1MU',

  /** Timezone for all date calculations */
  timezone: 'America/Los_Angeles',

  /** Roster sheet name — if renamed/missing, frontend shows a warning */
  rosterSheetName: 'Data v3',

  /** Cache TTL in seconds (6 hours = GAS maximum) */
  cacheDuration: 21600,

  /** How many days of schedule sheets to process */
  /** How many days forward to process from today */
  daysToProcess: 7,

  /** Include days back to Sunday of the current week (for workload counting) */
  includePastDays: true,

  /** Date when sheet structure changed (YYYY-MM-DD). Sheets on/after use 'current' structure. */
  structureChangeoverDate: '2026-01-19',

  /**
   * Feature flags — toggle data extraction.
   * Academics: included in data but filtered out of individual view by frontend.
   * Personnel notes: included in data, no frontend display yet.
   */
  features: {
    personnelNotes: true,
    academics: true
  },

  /**
   * Overnight skip window (Pacific time, 24-hour format).
   * Processing costs ~30s, so a 6-hour skip window is sufficient.
   * Cache math: last run ~10:45 PM + 6hr TTL = valid until ~4:45 AM.
   * First run at 5:00 AM refreshes before expiry.
   */
  overnight: {
    skipStart: 23,
    skipEnd: 5
  },

  /** Roster column layout on the "Data v3" sheet */
  rosterStructure: [
    { header: 'FTC-B Students',    category: 'FTC-B',             col: 0 },
    { header: 'STC-B Students',    category: 'STC-B',             col: 1 },
    { header: 'FTC-A Students',    category: 'FTC-A',             col: 2 },
    { header: 'STC-A Students',    category: 'STC-A',             col: 3 },
    { header: 'Staff IP',          category: 'Staff IP',           col: 4 },
    { header: 'Staff IFTE/IWSO',   category: 'Staff IFTE/ICSO',   col: 5 },
    { header: 'Staff STC',         category: 'Staff STC',          col: 6 },
    { header: 'Attached/Support',  category: 'Attached/Support',   col: 7 },
    { header: 'Future Category 1', category: 'Future Category 1',  col: 8 },
    { header: 'Future Category 2', category: 'Future Category 2',  col: 9 }
  ],

  /**
   * Sheet structure definitions — section row/col ranges.
   * Values are 0-indexed for direct array access after getRange(1,1,maxRow,maxCol).
   * The getRange call reads from row 1, col 1 — so array[0] = sheet row 1.
   */
  sheetStructures: {
    /** Structure for sheets BEFORE structureChangeoverDate */
    legacy: {
      sections: {
        supervision: { startRow: 2,   endRow: 11,  startCol: 0, endCol: 14 },
        flying:      { startRow: 12,  endRow: 134, startCol: 0, endCol: 18 },
        ground:      { startRow: 135, endRow: 237, startCol: 0, endCol: 13 },
        na:          { startRow: 238, endRow: 340, startCol: 0, endCol: 11 }
      }
    },

    /** Structure for sheets ON or AFTER structureChangeoverDate */
    current: {
      sections: {
        supervision: { startRow: 2,   endRow: 11,  startCol: 0,  endCol: 14 },
        flying:      { startRow: 13,  endRow: 94,  startCol: 0,  endCol: 18 },
        ground:      { startRow: 96,  endRow: 157, startCol: 0,  endCol: 17 },
        na:          { startRow: 159, endRow: 220, startCol: 0,  endCol: 14 },
        academics:   { startRow: 7,   endRow: 11,  startCol: 15, endCol: 18 }
      },
      personnelNoteStructure: {
        ranges: [
          { startRow: 227, endRow: 328, startCol: 0,  endCol: 4,  nameCol: 0, noteCol: 3 },
          { startRow: 227, endRow: 328, startCol: 4,  endCol: 8,  nameCol: 0, noteCol: 3 },
          { startRow: 227, endRow: 328, startCol: 8,  endCol: 12, nameCol: 0, noteCol: 3 },
          { startRow: 227, endRow: 328, startCol: 12, endCol: 16, nameCol: 0, noteCol: 3 },
          { startRow: 227, endRow: 328, startCol: 16, endCol: 20, nameCol: 0, noteCol: 3 },
          { startRow: 328, endRow: 429, startCol: 0,  endCol: 4,  nameCol: 0, noteCol: 3 },
          { startRow: 328, endRow: 429, startCol: 4,  endCol: 8,  nameCol: 0, noteCol: 3 },
          { startRow: 328, endRow: 429, startCol: 8,  endCol: 12, nameCol: 0, noteCol: 3 },
          { startRow: 328, endRow: 429, startCol: 12, endCol: 16, nameCol: 0, noteCol: 3 },
          { startRow: 328, endRow: 429, startCol: 16, endCol: 20, nameCol: 0, noteCol: 3 }
        ]
      }
    }
  }
};

/**
 * Get the active sheet structure for a given date.
 * Returns 'current' structure for dates on/after changeover, 'legacy' otherwise.
 * @param {string} isoDate - Date string in YYYY-MM-DD format
 * @returns {Object} The sheet structure configuration
 */
function getActiveSheetStructure(isoDate) {
  return (isoDate >= CONFIG.structureChangeoverDate)
    ? CONFIG.sheetStructures.current
    : CONFIG.sheetStructures.legacy;
}
