/**
 * Sheet Parser - Core logic for extracting data from TPS Google Sheet
 *
 * This file contains the parsing logic extracted from BatchProcessor.gs,
 * adapted for use in a Node.js/browser environment.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Section ranges within each daily sheet
 * These define where each type of data lives in the spreadsheet
 *
 * NOTE: Structure changed on Dec 9, 2024. Use getSectionRanges() for dynamic config.
 */
const SECTION_RANGES = {
  supervision: { range: 'A1:J7', startRow: 1, endRow: 7 },
  flying: { range: 'A10:R50', startRow: 10, endRow: 50 },
  ground: { range: 'A52:N80', startRow: 52, endRow: 80 },
  na: { range: 'A82:N110', startRow: 82, endRow: 110 }
};

/**
 * Get section ranges based on sheet date (handles structure changes)
 */
function getSectionRanges(sheetDate) {
  const changeoverDate = new Date('2024-12-09');
  const date = new Date(sheetDate);

  if (date >= changeoverDate) {
    // New structure (after Dec 9, 2024)
    return {
      supervision: { range: 'A1:J7', startRow: 1, endRow: 7 },
      flying: { range: 'A10:R50', startRow: 10, endRow: 50 },
      ground: { range: 'A52:N80', startRow: 52, endRow: 80 },
      na: { range: 'A82:N110', startRow: 82, endRow: 110 }
    };
  } else {
    // Old structure (before Dec 9, 2024)
    return {
      supervision: { range: 'A1:J7', startRow: 1, endRow: 7 },
      flying: { range: 'A9:R45', startRow: 9, endRow: 45 },
      ground: { range: 'A47:N75', startRow: 47, endRow: 75 },
      na: { range: 'A77:N105', startRow: 77, endRow: 105 }
    };
  }
}

/**
 * Roster configuration - where to find people by category
 * Adjust these ranges based on your sheet structure
 */
function getRosterConfig() {
  return {
    ranges: [
      { range: 'T3:T30', nameCol: 0, name: 'Class 26A', type: 'student' },
      { range: 'U3:U30', nameCol: 0, name: 'Class 26B', type: 'student' },
      { range: 'V3:V30', nameCol: 0, name: 'FTC-A', type: 'student' },
      { range: 'W3:W30', nameCol: 0, name: 'FTC-B', type: 'student' },
      { range: 'X3:X30', nameCol: 0, name: 'STC-A', type: 'student' },
      { range: 'Y3:Y30', nameCol: 0, name: 'STC-B', type: 'student' },
      { range: 'Z3:Z50', nameCol: 0, name: 'Staff IP', type: 'staff' }
    ]
  };
}

// =============================================================================
// SHEET DATE PARSING
// =============================================================================

/**
 * Parse sheet name to extract date
 * Handles various formats: "6 Jan", "6 Jan 25", "6-Jan", "6-Jan-25"
 */
function parseSheetDate(sheetName) {
  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  // Clean up the sheet name
  const cleaned = sheetName.trim().toLowerCase();

  // Try various patterns
  const patterns = [
    /^(\d{1,2})[\s\-]([a-z]{3})[\s\-]?(\d{2,4})?$/i,  // "6 Jan" or "6-Jan-25"
    /^([a-z]{3})[\s\-](\d{1,2})[\s\-]?(\d{2,4})?$/i   // "Jan 6" or "Jan-6-25"
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let day, monthStr, year;

      if (/^\d/.test(match[1])) {
        // Day first: "6 Jan"
        day = parseInt(match[1]);
        monthStr = match[2];
        year = match[3];
      } else {
        // Month first: "Jan 6"
        monthStr = match[1];
        day = parseInt(match[2]);
        year = match[3];
      }

      const month = monthMap[monthStr.toLowerCase()];
      if (month === undefined) continue;

      // Handle year
      if (!year) {
        // Infer year from current date
        year = new Date().getFullYear();
      } else if (year.length === 2) {
        year = 2000 + parseInt(year);
      } else {
        year = parseInt(year);
      }

      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// ROSTER PARSING
// =============================================================================

/**
 * Patterns to filter out - these are NOT people names
 */
const HEADER_PATTERNS = [
  'bravo students', 'stc students', 'alpha students', 'ftc-b', 'stc-b', 'ftc-a', 'stc-a',
  'staff ip', 'stc staff', 'staff stc', 'attached', 'support', 'ifte', 'icso', 'future'
];

const EVENT_NAME_PATTERNS = [
  'academics', 'events', 'ground events', 'flying events', 'supervision',
  'groot', 'mtg', 'meeting', 'interview', 'brief', 'debrief',
  'ccep', 'checkride', 'sim', 'flight', 'sortie', 'mission',
  'training', 'class', 'lecture', 'exam', 'test', 'eval',
  'leave', 'tdy', 'appointment', 'admin', 'standby', 'alert',
  'holiday', 'down day', 'weekend', 'maintenance', 'wx', 'weather'
];

/**
 * Check if a string is a valid person name
 */
function isValidPersonName(name) {
  if (!name || name === '.' || name === '' || name.length < 2) return false;

  const nameLower = name.toLowerCase();

  // Filter out common non-name values
  if (['false', 'true', 'yes', 'no', 'n/a', 'tbd'].includes(nameLower)) return false;

  // Filter out pure numbers
  if (/^\d+$/.test(name)) return false;

  // Filter out header patterns
  if (HEADER_PATTERNS.some(p => nameLower.includes(p))) return false;

  // Filter out event/section names
  if (EVENT_NAME_PATTERNS.some(p => nameLower.includes(p))) return false;

  // Filter out all-caps entries that look like event codes
  if (/^[A-Z0-9\s\-\/]+$/.test(name) && name === name.toUpperCase() && name.length > 3) {
    // Allow if it looks like a last name (single word, no numbers)
    if (!/^[A-Z]+$/.test(name)) return false;
  }

  return true;
}

/**
 * Extract roster from sheet data
 * @param {Array} sheetData - 2D array of cell values
 * @param {Object} rosterConfig - Configuration for roster ranges
 * @returns {Object} - Map of categories to arrays of person names
 */
function extractRoster(sheetData, rosterConfig) {
  const roster = {};

  rosterConfig.ranges.forEach(rangeConfig => {
    const category = rangeConfig.name;
    roster[category] = [];

    // Parse range to get row/col bounds
    const { startRow, startCol, endRow, endCol } = parseRange(rangeConfig.range);

    for (let row = startRow; row <= endRow && row < sheetData.length; row++) {
      const name = sheetData[row]?.[startCol + rangeConfig.nameCol]?.trim();
      if (isValidPersonName(name)) {
        roster[category].push({
          name,
          category,
          type: rangeConfig.type
        });
      }
    }
  });

  return roster;
}

// =============================================================================
// EVENT PARSING
// =============================================================================

/**
 * Parse supervision section for a specific person
 */
function parseSupervision(data, searchName, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  data.forEach(row => {
    const dutyType = row[0];
    if (!dutyType) return;

    // Check each shift (3 columns per shift: POC, Start, End)
    for (let col = 1; col < row.length - 2; col += 3) {
      const poc = row[col];
      const start = row[col + 1];
      const end = row[col + 2];

      if (poc && poc.toLowerCase().includes(searchLower)) {
        const isAuth = dutyType.toUpperCase().includes('AUTH');

        matches.push({
          date: date,
          time: isAuth ? '' : start,
          type: 'Supervision',
          description: isAuth ? `${dutyType} | ${poc}` : `${dutyType} | ${poc} | ${start}-${end}`,
          enhanced: {
            section: 'Supervision',
            duty: dutyType,
            poc: poc,
            start: isAuth ? null : start,
            end: isAuth ? null : end,
            isAuth: isAuth
          }
        });
      }
    }
  });

  return matches;
}

/**
 * Parse flying events for a specific person
 */
function parseFlyingEvents(data, searchName, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  data.forEach(row => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchLower)) return;

    const model = row[0];
    const briefStart = row[1];
    const etd = row[2];
    const eta = row[3];
    const debriefEnd = row[4];
    const event = row[5];

    // Crew is in columns 6-13 (8 positions)
    const crewColumns = row.slice(6, -3);
    const crew = crewColumns.filter(c => c && c !== '');

    // Status checkboxes in last 3 columns
    const effective = parseBoolean(row[row.length - 3]);
    const cancelled = parseBoolean(row[row.length - 2]);
    const partiallyEffective = parseBoolean(row[row.length - 1]);

    matches.push({
      date: date,
      time: briefStart,
      type: 'Flying Events',
      description: [model, event, ...crew].filter(x => x).join(' | '),
      enhanced: {
        section: 'Flying Events',
        model: model,
        briefStart: briefStart,
        etd: etd,
        eta: eta,
        debriefEnd: debriefEnd,
        event: event,
        crew: crew,
        notes: row[row.length - 4] || '',
        status: { effective, cancelled, partiallyEffective }
      }
    });
  });

  return matches;
}

/**
 * Parse ground events for a specific person
 */
function parseGroundEvents(data, searchName, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  data.forEach(row => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchLower)) return;

    const event = row[0];
    const start = row[1];
    const end = row[2];

    const peopleColumns = row.slice(3);
    const people = peopleColumns.filter(c => c && c !== '');

    matches.push({
      date: date,
      time: start,
      type: 'Ground Events',
      description: [event, ...people].filter(x => x).join(' | '),
      enhanced: {
        section: 'Ground Events',
        event: event,
        start: start,
        end: end,
        people: people
      }
    });
  });

  return matches;
}

/**
 * Parse NA (Not Available) section for a specific person
 */
function parseNA(data, searchName, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  data.forEach(row => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchLower)) return;

    const reason = row[0];
    const start = row[1];
    const end = row[2];

    const peopleColumns = row.slice(3);
    const people = peopleColumns.filter(c => c && c !== '');

    matches.push({
      date: date,
      time: start,
      type: 'NA',
      description: [reason, ...people].filter(x => x).join(' | '),
      enhanced: {
        section: 'NA',
        reason: reason,
        start: start,
        end: end,
        people: people
      }
    });
  });

  return matches;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Parse boolean from various representations
 */
function parseBoolean(value) {
  if (!value) return false;
  const valStr = String(value).toUpperCase().trim();
  return valStr === 'TRUE' || valStr === '✓' || valStr === 'X' || valStr === '✔';
}

/**
 * Parse A1 notation range to row/col indices
 * Example: "A1:J7" -> { startRow: 0, startCol: 0, endRow: 6, endCol: 9 }
 */
function parseRange(rangeStr) {
  const match = rangeStr.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/i);
  if (!match) return null;

  const colToIndex = (col) => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return index - 1;
  };

  return {
    startCol: colToIndex(match[1].toUpperCase()),
    startRow: parseInt(match[2]) - 1,
    endCol: colToIndex(match[3].toUpperCase()),
    endRow: parseInt(match[4]) - 1
  };
}

/**
 * Parse time string to minutes since midnight
 * "0730" -> 450, "1430" -> 870
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr.length < 4) return null;
  const hours = parseInt(timeStr.substring(0, 2));
  const minutes = parseInt(timeStr.substring(2, 4));
  return hours * 60 + minutes;
}

/**
 * Format time for display
 * "0730" -> "7:30 AM"
 */
function formatTimeDisplay(timeStr) {
  if (!timeStr || timeStr.length < 4) return '';
  const hours = parseInt(timeStr.substring(0, 2));
  const minutes = parseInt(timeStr.substring(2, 4));
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Configuration
  getSectionRanges,
  getRosterConfig,
  SECTION_RANGES,

  // Date utilities
  parseSheetDate,
  formatDateLocal,

  // Roster parsing
  isValidPersonName,
  extractRoster,

  // Event parsing
  parseSupervision,
  parseFlyingEvents,
  parseGroundEvents,
  parseNA,

  // Utilities
  parseBoolean,
  parseRange,
  parseTimeToMinutes,
  formatTimeDisplay
};
