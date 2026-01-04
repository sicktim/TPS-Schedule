// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    SQUADRON SCHEDULE WIDGET - GOOGLE APPS SCRIPT           ║
// ║                          ⚡ ENHANCED VERSION ⚡                             ║
// ║                                                                            ║
// ║  Purpose: Advanced parsing of squadron schedule with detailed metadata     ║
// ║           Returns structured JSON with all event details                   ║
// ║                                                                            ║
// ║  Last Modified: December 25, 2025                                          ║
// ║  Version: 5.0 (ENHANCED)                                                   ║
// ║                                                                            ║
// ║  ENHANCEMENTS OVER v4.0:                                                   ║
// ║  ✅ Parses Supervision section with time slots                            ║
// ║  ✅ Extracts Flying Events with full metadata (model, times, crew, status)║
// ║  ✅ Parses Ground Events with people and status                           ║
// ║  ✅ Extracts NAs (Non-Availabilities) with reason and times               ║
// ║  ✅ Detects status checkboxes (Effective/Cancelled/Partially Effective)   ║
// ║  ✅ Returns both legacy format + enhanced objects                         ║
// ║  ✅ Backwards compatible with existing apps                               ║
// ║                                                                            ║
// ║  PERFORMANCE:                                                              ║
// ║  - ~30 seconds per request (no caching)                                   ║
// ║  - 2.5x faster than original                                              ║
// ║  - Always fresh data                                                       ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ┌────────────────────────────────────────────────────────────────────────────┐
// │                              SHEET LAYOUT                                  │
// ├────────────────────────────────────────────────────────────────────────────┤
// │                                                                            │
// │  Supervision:        Rows 1-9      (Multiple time slots per duty)          │
// │  Flying Events:      Rows 11-52    (Model, times, crew, status)            │
// │  Ground Events:      Rows 54-80    (Event, times, people, status)          │
// │  NAs:                Rows 82-113   (Reason, times, people)                 │
// │  Student/Staff List: Rows 120-169  (For future Rainbow app)                │
// │                                                                            │
// └────────────────────────────────────────────────────────────────────────────┘

// Configuration is in Config.gs (shared across all versions)


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                         MAIN WEB APP ENDPOINT                              ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * doGet_Enhanced(e) - Main entry point for Enhanced version
 *
 * Called by Main.gs router when version=enhanced or ACTIVE_VERSION="ENHANCED"
 *
 * @param {Object} e - Event object from Google Apps Script
 * @returns {TextOutput} JSON response with enhanced event data
 */
function doGet_Enhanced(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;
    const daysAhead = parseInt(e.parameter.days) || 3;
    const testDate = e.parameter.testDate || null;

    const results = getEventsForWidget_Enhanced(searchName, daysAhead, testDate);

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


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                         CORE DATA FUNCTIONS                                ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * getEventsForWidget_Enhanced() - Main orchestration with enhanced parsing
 *
 * @param {string} searchName - Name to search for
 * @param {number} daysAhead - Number of days to search
 * @param {string} testDate - Optional test date (YYYY-MM-DD)
 * @returns {Object} Enhanced response with detailed event metadata
 */
function getEventsForWidget_Enhanced(searchName, daysAhead, testDate = null) {
  const upcomingDays = getNextNWeekdays(daysAhead, testDate);
  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  const events = [];
  const searchedSheets = [];

  console.log(`⚡ ENHANCED VERSION - Searching for: "${searchName}"`);
  console.log(`Days to search: ${upcomingDays.length}`);

  upcomingDays.forEach(date => {
    const sheetName = generateSheetName(date);
    console.log(`Looking for sheet: "${sheetName}"`);

    // Parse all sections with enhanced detail
    const dayEvents = searchNameInSheet_Enhanced(
      spreadsheet,
      sheetName,
      searchName
    );

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
    enhanced: true,
    version: "5.0"
  };

  if (testDate || SEARCH_CONFIG.testMode) {
    response.testMode = true;
    response.simulatedToday = testDate || SEARCH_CONFIG.testDate;
  }

  return response;
}


/**
 * searchNameInSheet_Enhanced() - Enhanced parsing of all sheet sections
 *
 * Parses 4 main sections:
 * 1. Supervision (rows 1-9)
 * 2. Flying Events (rows 11-52)
 * 3. Ground Events (rows 54-80)
 * 4. NAs (rows 82-113)
 *
 * @param {Spreadsheet} spreadsheet - Pre-opened spreadsheet
 * @param {string} sheetName - Sheet tab name
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of enhanced event objects
 */
function searchNameInSheet_Enhanced(spreadsheet, sheetName, searchName) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    console.log(`Sheet not found: ${sheetName}`);
    return [];
  }

  console.log(`🔍 ENHANCED PARSING: ${sheetName}`);

  const matches = [];

  // Parse each section
  matches.push(...parseSupervisionSection(sheet, searchName));
  matches.push(...parseFlyingEventsEnhanced(sheet, searchName));
  matches.push(...parseGroundEventsEnhanced(sheet, searchName));
  matches.push(...parseNAsEnhanced(sheet, searchName));

  console.log(`Found ${matches.length} enhanced matches for "${searchName}"`);

  return matches;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                    SECTION PARSERS - ENHANCED                              ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * parseSupervisionSection() - Parse Supervision (rows 1-9)
 *
 * Layout: Each row has duty type + multiple time slots (POC, Start, End) horizontally
 * Example: SOF | 416th | 07:30 | 12:00 | Coleman | 12:00 | 16:30 | ...
 *
 * Returns separate events for each time slot
 *
 * @param {Sheet} sheet - The sheet object
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of supervision events
 */
function parseSupervisionSection(sheet, searchName) {
  const matches = [];
  const values = sheet.getRange("A1:N9").getDisplayValues();

  values.forEach((row, rowIndex) => {
    const dutyType = row[0]; // Column A: SOF, OS, ODO, etc.
    if (!dutyType || dutyType === "" || dutyType === "Supervision") return;

    // Parse time slots (groups of 3 columns: POC, Start, End)
    // Starting from column B (index 1)
    for (let col = 1; col < row.length - 2; col += 3) {
      const poc = row[col];
      const start = row[col + 1];
      const end = row[col + 2];

      // Skip empty slots
      if (!poc && !start && !end) continue;

      // Check if search name matches POC
      if (poc && poc.toLowerCase().includes(searchName.toLowerCase())) {
        // Special handling for AUTH (no times)
        const isAuth = dutyType.toUpperCase().includes("AUTH");

        matches.push({
          // Legacy format (for backwards compatibility)
          time: isAuth ? "" : start,
          description: isAuth
            ? `${dutyType} | ${poc}`
            : `${dutyType} | ${poc} | ${start}-${end}`,
          rangeSource: "Supervision",

          // Enhanced format
          enhanced: {
            section: "Supervision",
            duty: dutyType,
            poc: poc,
            start: isAuth ? null : start,
            end: isAuth ? null : end,
            isAuth: isAuth
          }
        });

        console.log(`✓ Supervision: ${dutyType} - ${poc} ${start}-${end}`);
      }
    }
  });

  return matches;
}


/**
 * parseFlyingEventsEnhanced() - Parse Flying Events (rows 11-52)
 *
 * Columns:
 * A: Model
 * B: Brief Start
 * C: ETD (Estimated Time of Departure)
 * D: ETA (Estimated Time of Arrival)
 * E: Debrief End
 * F: Event
 * G+: Crew (multiple columns)
 * Last 3 cols: Effective, C/X/Non-E, Partially E (TRUE/FALSE)
 *
 * @param {Sheet} sheet - The sheet object
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of flying event objects
 */
function parseFlyingEventsEnhanced(sheet, searchName) {
  const matches = [];
  const values = sheet.getRange("A11:R52").getDisplayValues();

  values.forEach((row, rowIndex) => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchName.toLowerCase())) return;

    const model = row[0];  // A: Model
    const briefStart = row[1];  // B: Brief Start
    const etd = row[2];  // C: ETD
    const eta = row[3];  // D: ETA
    const debriefEnd = row[4];  // E: Debrief End
    const event = row[5];  // F: Event

    // Crew: columns G onwards, stop before last 3 status columns
    const crewColumns = row.slice(6, -3);
    const crew = crewColumns.filter(c => c && c !== "");

    // Status: last 3 columns (Effective, Cancelled, Partially Effective)
    const effective = parseBoolean(row[row.length - 3]);
    const cancelled = parseBoolean(row[row.length - 2]);
    const partiallyEffective = parseBoolean(row[row.length - 1]);

    // Notes column (if exists between crew and status)
    const notes = row[row.length - 4] || "";

    matches.push({
      // Legacy format
      time: briefStart,
      description: [model, event, ...crew].filter(x => x).join(" | "),
      rangeSource: "Flying Events",

      // Enhanced format
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

    console.log(`✓ Flying: ${model} ${briefStart} - ${crew.join(', ')}`);
  });

  return matches;
}


/**
 * parseGroundEventsEnhanced() - Parse Ground Events (rows 54-80)
 *
 * Columns:
 * A: Event
 * B: Start
 * C: End
 * D+: Person(s) (multiple columns)
 * Last 3 cols: Effective, C/X/Non-E, Partially E
 *
 * @param {Sheet} sheet - The sheet object
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of ground event objects
 */
function parseGroundEventsEnhanced(sheet, searchName) {
  const matches = [];
  const values = sheet.getRange("A54:Q80").getDisplayValues();

  values.forEach((row, rowIndex) => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchName.toLowerCase())) return;

    const event = row[0];  // A: Event
    const start = row[1];  // B: Start
    const end = row[2];  // C: End

    // People: columns D onwards, stop before last 3 status columns
    const peopleColumns = row.slice(3, -3);
    const people = peopleColumns.filter(p => p && p !== "");

    // Status: last 3 columns
    const effective = parseBoolean(row[row.length - 3]);
    const cancelled = parseBoolean(row[row.length - 2]);
    const partiallyEffective = parseBoolean(row[row.length - 1]);

    // Notes (if exists)
    const notes = row[row.length - 4] || "";

    matches.push({
      // Legacy format
      time: start,
      description: [event, ...people].filter(x => x).join(" | "),
      rangeSource: "Ground Events",

      // Enhanced format
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

    console.log(`✓ Ground: ${event} ${start}-${end} - ${people.join(', ')}`);
  });

  return matches;
}


/**
 * parseNAsEnhanced() - Parse NAs / Non-Availabilities (rows 82-113)
 *
 * Columns:
 * A: Reason
 * B: Start
 * C: End
 * D+: Person(s) (multiple columns)
 *
 * @param {Sheet} sheet - The sheet object
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of NA objects
 */
function parseNAsEnhanced(sheet, searchName) {
  const matches = [];
  const values = sheet.getRange("A82:N113").getDisplayValues();

  values.forEach((row, rowIndex) => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchName.toLowerCase())) return;

    const reason = row[0];  // A: Reason
    const start = row[1];  // B: Start
    const end = row[2];  // C: End

    // People: columns D onwards
    const peopleColumns = row.slice(3);
    const people = peopleColumns.filter(p => p && p !== "");

    matches.push({
      // Legacy format
      time: start,
      description: [reason, ...people].filter(x => x).join(" | "),
      rangeSource: "Not Available",

      // Enhanced format
      enhanced: {
        section: "NA",
        reason: reason,
        start: start,
        end: end,
        people: people
      }
    });

    console.log(`✓ NA: ${reason} ${start}-${end} - ${people.join(', ')}`);
  });

  return matches;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                         HELPER FUNCTIONS                                   ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * parseBoolean() - Convert cell value to boolean
 *
 * Google Sheets checkboxes appear as "TRUE" or "FALSE" text
 *
 * @param {string} value - Cell value
 * @returns {boolean} Parsed boolean value
 */
function parseBoolean(value) {
  if (!value) return false;
  const valStr = String(value).toUpperCase().trim();
  return valStr === "TRUE" || valStr === "✓" || valStr === "X" || valStr === "✔";
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                         TESTING FUNCTIONS                                  ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * testEnhanced() - Test Enhanced version
 */
function testEnhanced() {
  console.log("🧪 TESTING ENHANCED VERSION (v5.0)");
  console.log("=".repeat(60));

  const mockEvent = {
    parameter: {
      name: "Harms, J *",
      days: "1",
      testDate: "2025-12-15"
    }
  };

  console.log("Calling doGet_Enhanced() with test date Mon 15 Dec 2025...\n");

  const response = doGet_Enhanced(mockEvent);
  const content = response.getContent();
  const parsed = JSON.parse(content);

  if (parsed.error) {
    console.log("❌ ERROR:");
    console.log(`   ${parsed.message}`);
  } else {
    console.log("✅ SUCCESS:");
    console.log(`   Version: ${parsed.version}`);
    console.log(`   Enhanced: ${parsed.enhanced}`);
    console.log(`   Total events: ${parsed.totalEvents}`);

    console.log("\n📅 EVENTS FOUND:");
    parsed.events.forEach(day => {
      console.log(`\n   ${day.dayName} (${day.date}):`);
      day.events.forEach(evt => {
        console.log(`      Section: ${evt.enhanced.section}`);
        console.log(`      Legacy: ${evt.time} - ${evt.description.substring(0, 50)}`);
        if (evt.enhanced.section === "Flying Events") {
          console.log(`      Enhanced: ${evt.enhanced.model} | ${evt.enhanced.event} | Crew: ${evt.enhanced.crew.length}`);
          console.log(`      Status: Eff=${evt.enhanced.status.effective} Canx=${evt.enhanced.status.cancelled}`);
        }
      });
    });
  }

  console.log("\n📋 FULL JSON RESPONSE:");
  console.log(JSON.stringify(parsed, null, 2));
}


/**
 * testEnhancedSections() - Test each section independently
 */
function testEnhancedSections() {
  console.log("🧪 TESTING ENHANCED SECTIONS");
  console.log("=".repeat(60));

  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const sheetName = "Mon 15 Dec";
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    console.log("❌ Sheet not found!");
    return;
  }

  console.log(`Testing sheet: ${sheetName}\n`);

  // Test each section
  console.log("1️⃣ SUPERVISION:");
  const supervision = parseSupervisionSection(sheet, "Coleman");
  console.log(`   Found ${supervision.length} events`);
  supervision.forEach(evt => console.log(`   - ${JSON.stringify(evt.enhanced)}`));

  console.log("\n2️⃣ FLYING EVENTS:");
  const flying = parseFlyingEventsEnhanced(sheet, "Harms");
  console.log(`   Found ${flying.length} events`);
  flying.forEach(evt => console.log(`   - ${JSON.stringify(evt.enhanced)}`));

  console.log("\n3️⃣ GROUND EVENTS:");
  const ground = parseGroundEventsEnhanced(sheet, "Olvera");
  console.log(`   Found ${ground.length} events`);
  ground.forEach(evt => console.log(`   - ${JSON.stringify(evt.enhanced)}`));

  console.log("\n4️⃣ NAs:");
  const nas = parseNAsEnhanced(sheet, "Kalampouk");
  console.log(`   Found ${nas.length} events`);
  nas.forEach(evt => console.log(`   - ${JSON.stringify(evt.enhanced)}`));
}
