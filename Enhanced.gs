/**
 * TPS Schedule - Enhanced Processor
 *
 * Advanced parsing of squadron schedule with detailed metadata.
 * Returns structured JSON with all event details.
 *
 * Section ranges are defined in Config.gs and support automatic
 * changeover on STRUCTURE_CHANGEOVER_DATE.
 */

/**
 * doGet_Enhanced(e) - Entry point for Enhanced version
 *
 * @param {Object} e - Event object from Google Apps Script
 * @returns {TextOutput} JSON response with enhanced event data
 */
function doGet_Enhanced(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;
    const daysAhead = parseInt(e.parameter.days) || 3;

    const results = getEventsForWidget_Enhanced(searchName, daysAhead);

    return ContentService
      .createTextOutput(JSON.stringify(results))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: true,
        message: error.toString(),
        stack: error.stack
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main orchestration for enhanced parsing
 *
 * @param {string} searchName - Name to search for
 * @param {number} daysAhead - Number of days to search
 * @returns {Object} Enhanced response with detailed event metadata
 */
function getEventsForWidget_Enhanced(searchName, daysAhead) {
  const upcomingDays = getNextNWeekdays(daysAhead);
  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  const events = [];
  const searchedSheets = [];

  console.log(`Enhanced search for: "${searchName}"`);

  upcomingDays.forEach(date => {
    const sheetName = generateSheetName(date);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      searchedSheets.push({
        date: formatDateISO(date),
        sheetName: sheetName,
        eventsFound: 0
      });
      return;
    }

    const dayEvents = searchNameInSheet_Enhanced(spreadsheet, sheetName, searchName);

    searchedSheets.push({
      date: formatDateISO(date),
      sheetName: sheetName,
      eventsFound: dayEvents.length
    });

    if (dayEvents.length > 0) {
      events.push({
        date: formatDateISO(date),
        dayName: getDayName(date),
        sheetName: sheetName,
        events: dayEvents
      });
    }
  });

  const now = new Date();
  const localTimeString = Utilities.formatDate(
    now,
    SEARCH_CONFIG.timezone,
    "yyyy-MM-dd HH:mm:ss z"
  );

  return {
    searchName: searchName,
    generatedAt: new Date().toISOString(),
    localTime: localTimeString,
    timezone: SEARCH_CONFIG.timezone,
    daysAhead: daysAhead,
    daysSearched: upcomingDays.length,
    searchedSheets: searchedSheets,
    events: events,
    totalEvents: events.reduce((sum, day) => sum + day.events.length, 0),
    enhanced: true,
    version: "5.0"
  };
}

/**
 * Enhanced parsing of all sheet sections
 * Uses getSectionRanges() to handle structure changes
 *
 * @param {Spreadsheet} spreadsheet - Pre-opened spreadsheet
 * @param {string} sheetName - Sheet tab name
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of enhanced event objects
 */
function searchNameInSheet_Enhanced(spreadsheet, sheetName, searchName) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  // Get section ranges from config
  const sections = getSectionRanges();

  const matches = [];

  matches.push(...parseSupervisionSection(sheet, searchName, sections.supervision.range));
  matches.push(...parseFlyingEventsEnhanced(sheet, searchName, sections.flying.range));
  matches.push(...parseGroundEventsEnhanced(sheet, searchName, sections.ground.range));
  matches.push(...parseNAsEnhanced(sheet, searchName, sections.na.range));

  return matches;
}

/**
 * Parse Supervision section
 */
function parseSupervisionSection(sheet, searchName, range) {
  const matches = [];
  const values = sheet.getRange(range).getDisplayValues();

  values.forEach(row => {
    const dutyType = row[0];
    if (!dutyType || dutyType === "" || dutyType === "Supervision") return;

    for (let col = 1; col < row.length - 2; col += 3) {
      const poc = row[col];
      const start = row[col + 1];
      const end = row[col + 2];

      if (!poc && !start && !end) continue;

      if (poc && poc.toLowerCase().includes(searchName.toLowerCase())) {
        const isAuth = dutyType.toUpperCase().includes("AUTH");

        matches.push({
          time: isAuth ? "" : start,
          description: isAuth
            ? `${dutyType} | ${poc}`
            : `${dutyType} | ${poc} | ${start}-${end}`,
          rangeSource: "Supervision",
          enhanced: {
            section: "Supervision",
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
 * Parse Flying Events
 */
function parseFlyingEventsEnhanced(sheet, searchName, range) {
  const matches = [];
  const values = sheet.getRange(range).getDisplayValues();

  values.forEach(row => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchName.toLowerCase())) return;

    const model = row[0];
    const briefStart = row[1];
    const etd = row[2];
    const eta = row[3];
    const debriefEnd = row[4];
    const event = row[5];

    const crewColumns = row.slice(6, -3);
    const crew = crewColumns.filter(c => c && c !== "");

    const effective = parseBooleanValue(row[row.length - 3]);
    const cancelled = parseBooleanValue(row[row.length - 2]);
    const partiallyEffective = parseBooleanValue(row[row.length - 1]);

    const notes = row[row.length - 4] || "";

    matches.push({
      time: briefStart,
      description: [model, event, ...crew].filter(x => x).join(" | "),
      rangeSource: "Flying Events",
      enhanced: {
        section: "Flying Events",
        model: model,
        briefStart: briefStart,
        etd: etd,
        eta: eta,
        debriefEnd: debriefEnd,
        event: event,
        crew: crew,
        notes: notes,
        status: {
          effective: effective,
          cancelled: cancelled,
          partiallyEffective: partiallyEffective
        }
      }
    });
  });

  return matches;
}

/**
 * Parse Ground Events
 */
function parseGroundEventsEnhanced(sheet, searchName, range) {
  const matches = [];
  const values = sheet.getRange(range).getDisplayValues();

  values.forEach(row => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchName.toLowerCase())) return;

    const event = row[0];
    const start = row[1];
    const end = row[2];

    const peopleColumns = row.slice(3, -3);
    const people = peopleColumns.filter(p => p && p !== "");

    const effective = parseBooleanValue(row[row.length - 3]);
    const cancelled = parseBooleanValue(row[row.length - 2]);
    const partiallyEffective = parseBooleanValue(row[row.length - 1]);

    const notes = row[row.length - 4] || "";

    matches.push({
      time: start,
      description: [event, ...people].filter(x => x).join(" | "),
      rangeSource: "Ground Events",
      enhanced: {
        section: "Ground Events",
        event: event,
        start: start,
        end: end,
        people: people,
        notes: notes,
        status: {
          effective: effective,
          cancelled: cancelled,
          partiallyEffective: partiallyEffective
        }
      }
    });
  });

  return matches;
}

/**
 * Parse NAs / Non-Availabilities
 */
function parseNAsEnhanced(sheet, searchName, range) {
  const matches = [];
  const values = sheet.getRange(range).getDisplayValues();

  values.forEach(row => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchName.toLowerCase())) return;

    const reason = row[0];
    const start = row[1];
    const end = row[2];

    const peopleColumns = row.slice(3);
    const people = peopleColumns.filter(p => p && p !== "");

    matches.push({
      time: start,
      description: [reason, ...people].filter(x => x).join(" | "),
      rangeSource: "Not Available",
      enhanced: {
        section: "NA",
        reason: reason,
        start: start,
        end: end,
        people: people
      }
    });
  });

  return matches;
}

/**
 * Parse boolean from checkbox value
 */
function parseBooleanValue(value) {
  if (!value) return false;
  const valStr = String(value).toUpperCase().trim();
  return valStr === "TRUE" || valStr === "✓" || valStr === "X" || valStr === "✔";
}
