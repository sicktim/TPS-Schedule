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
    const showAcademics = e.parameter.showAcademics === 'true';
    const showGroupedEvents = e.parameter.showGroupedEvents === 'true';

    const results = getEventsForWidget_Enhanced(searchName, daysAhead, testDate, showAcademics, showGroupedEvents);

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
function getEventsForWidget_Enhanced(searchName, daysAhead, testDate = null, showAcademics = false, showGroupedEvents = false) {
  const upcomingDays = getNextNWeekdays(daysAhead, testDate);
  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  const events = [];
  const searchedSheets = [];
  let personType = null;  // Will store if person is Alpha/Bravo student, etc.

  console.log(`⚡ ENHANCED VERSION - Searching for: "${searchName}"`);
  console.log(`Days to search: ${upcomingDays.length}`);
  console.log(`Show Academics: ${showAcademics}, Show Grouped Events: ${showGroupedEvents}`);

  // Get person type once at the start (only needed if academics or grouped events are enabled)
  if (showAcademics || showGroupedEvents) {
    try {
      // Get any available sheet to look up person type
      const firstDay = upcomingDays[0];
      const firstSheetName = generateSheetName(firstDay);
      const firstSheet = spreadsheet.getSheetByName(firstSheetName);

      if (firstSheet) {
        personType = getPersonType(firstSheet, searchName);
        console.log(`Person type determined: ${personType}`);
      } else {
        console.warn(`Could not find sheet ${firstSheetName} to determine person type`);
      }
    } catch (e) {
      console.warn(`Error determining person type: ${e}`);
    }
  }

  upcomingDays.forEach(date => {
    const sheetName = generateSheetName(date);
    console.log(`Looking for sheet: "${sheetName}"`);

    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      console.log(`Sheet not found: ${sheetName}`);
      searchedSheets.push({
        date: formatDateISO(date),
        sheetName: sheetName,
        eventsFound: 0
      });
      return;  // Skip this day
    }

    // Parse all sections with enhanced detail
    const dayEvents = searchNameInSheet_Enhanced(
      spreadsheet,
      sheetName,
      searchName
    );

    // Add academics if enabled and person is a student
    if (showAcademics && personType) {
      const academics = getAcademicsForStudent(personType, formatDateISO(date));
      if (academics.length > 0) {
        console.log(`Adding ${academics.length} academic events for ${personType}`);
        dayEvents.push(...academics);
      }
    }

    // Add grouped events if enabled
    if (showGroupedEvents && personType) {
      const groupedEvents = getGroupedEventsForPerson(sheet, personType, formatDateISO(date));
      if (groupedEvents.length > 0) {
        console.log(`Adding ${groupedEvents.length} grouped events for ${personType}`);
        dayEvents.push(...groupedEvents);
      }
    }

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


/**
 * getPersonType() - Find person's category from Student/Staff list (rows 120-169)
 *
 * Categories include: "Students (Alpha)", "Students (Bravo)", "Staff IP",
 * "Staff IFTE/ICSO", "STC Staff", "Attached/Support"
 *
 * @param {Sheet} sheet - Any sheet from the spreadsheet
 * @param {string} searchName - Name to search for
 * @returns {string|null} Person's category or null if not found
 */
function getPersonType(sheet, searchName) {
  try {
    // Student/Staff list is in rows 120-169
    const listRange = sheet.getRange('A120:Z169');
    const listValues = listRange.getDisplayValues();

    // Search for the person's name in this area
    for (let rowIndex = 0; rowIndex < listValues.length; rowIndex++) {
      const row = listValues[rowIndex];

      // Check if any cell in this row contains the search name
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];

        if (cell && typeof cell === 'string' &&
            cell.toLowerCase().includes(searchName.toLowerCase())) {

          // Found the person! Now find their category
          // Category is typically in the first column or a header above
          // Look backwards in the same column to find category header
          for (let headerRow = rowIndex; headerRow >= 0; headerRow--) {
            const potentialCategory = listValues[headerRow][0]; // Column A

            if (potentialCategory && (
              potentialCategory.includes('Students') ||
              potentialCategory.includes('Staff') ||
              potentialCategory.includes('Attached') ||
              potentialCategory.includes('STC')
            )) {
              console.log(`Found person type: ${potentialCategory} for ${searchName}`);
              return potentialCategory;
            }
          }

          // If we found the person but no category, return a generic indicator
          console.log(`Found ${searchName} but couldn't determine category`);
          return 'Unknown';
        }
      }
    }

    console.log(`Could not find ${searchName} in student/staff list`);
    return null;

  } catch (e) {
    console.warn(`Error getting person type: ${e}`);
    return null;
  }
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


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                    ACADEMICS AND GROUPED EVENTS                            ║
// ║                                                                            ║
// ║  Academics: Show class times for Alpha/Bravo students                     ║
// ║  Grouped Events: Show ALL and STAFF ONLY events for relevant people       ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Get academic schedule for a student based on their type
 * 
 * @param {string} personType - Type of student ("Students (Alpha)", "Students (Bravo)", etc.)
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Array} Array of academic event objects
 */
function getAcademicsForStudent(personType, date) {
  const academics = [];
  
  // Alpha students: 07:30-17:00
  if (personType && personType.toLowerCase().includes('alpha')) {
    academics.push({
      date: date,
      time: '0730-1700',
      description: 'ACADEMICS | Alpha | 07:30-17:00',
      enhanced: {
        section: 'Academics',
        type: 'Alpha',
        start: '07:30',
        end: '17:00',
        status: 'Effective'
      }
    });
  }
  
  // Bravo students: 07:00-07:30, 08:30-09:30, 15:00-17:00
  if (personType && personType.toLowerCase().includes('bravo')) {
    academics.push({
      date: date,
      time: '0700-0730',
      description: 'ACADEMICS | Bravo | 07:00-07:30',
      enhanced: {
        section: 'Academics',
        type: 'Bravo',
        start: '07:00',
        end: '07:30',
        status: 'Effective'
      }
    });
    academics.push({
      date: date,
      time: '0830-0930',
      description: 'ACADEMICS | Bravo | 08:30-09:30',
      enhanced: {
        section: 'Academics',
        type: 'Bravo',
        start: '08:30',
        end: '09:30',
        status: 'Effective'
      }
    });
    academics.push({
      date: date,
      time: '1500-1700',
      description: 'ACADEMICS | Bravo | 15:00-17:00',
      enhanced: {
        section: 'Academics',
        type: 'Bravo',
        start: '15:00',
        end: '17:00',
        status: 'Effective'
      }
    });
  }
  
  return academics;
}

/**
 * Check if a person should see grouped events based on their type
 * 
 * EXTENSIBILITY GUIDE:
 * To add new event categories, modify this function:
 * 1. Add a new case for the event type (e.g., "INSTRUCTORS ONLY")
 * 2. Add the person types that should see it
 * 3. The rest happens automatically
 * 
 * @param {string} eventType - Type of grouped event ("ALL", "STAFF ONLY", etc.)
 * @param {string} personType - Type of person ("Staff IP", "Students (Alpha)", etc.)
 * @returns {boolean} True if person should see this event
 */
function shouldShowGroupedEvent(eventType, personType) {
  if (!eventType || !personType) return false;
  
  const eventTypeUpper = eventType.toUpperCase();
  const personTypeLower = personType.toLowerCase();
  
  // ALL events: show to everyone
  if (eventTypeUpper === 'ALL') {
    return true;
  }
  
  // STAFF ONLY events: show to staff categories
  if (eventTypeUpper === 'STAFF ONLY' || eventTypeUpper === 'STAFF_ONLY') {
    return (
      personTypeLower.includes('staff ip') ||
      personTypeLower.includes('staff ifte/icso') ||
      personTypeLower.includes('stc staff') ||
      personTypeLower.includes('attached/support')
    );
  }
  
  // EXTENSIBILITY EXAMPLE:
  // Add new categories here following this pattern:
  //
  // if (eventTypeUpper === 'INSTRUCTORS ONLY') {
  //   return (
  //     personTypeLower.includes('staff ip') ||
  //     personTypeLower.includes('staff ifte/icso')
  //   );
  // }
  //
  // if (eventTypeUpper === 'STUDENTS ONLY') {
  //   return (
  //     personTypeLower.includes('students (alpha)') ||
  //     personTypeLower.includes('students (bravo)')
  //   );
  // }
  
  return false;
}

/**
 * Find and process grouped events (ALL, STAFF ONLY, etc.) from a sheet
 *
 * Uses structure-aware parsing to correctly extract event details based on
 * the known column layout of each section.
 *
 * @param {Sheet} sheet - The schedule sheet
 * @param {string} personType - Type of person viewing the schedule
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Array} Array of grouped event objects
 */
function getGroupedEventsForPerson(sheet, personType, date) {
  const groupedEvents = [];

  // Parse each section using structure-aware methods
  groupedEvents.push(...parseGroundEventsForGroups(sheet, personType, date));
  groupedEvents.push(...parseFlyingEventsForGroups(sheet, personType, date));
  groupedEvents.push(...parseSupervisionForGroups(sheet, personType, date));

  console.log(`Found ${groupedEvents.length} grouped events for ${personType}`);
  return groupedEvents;
}

/**
 * Parse Ground Events section for grouped events (ALL, STAFF ONLY, etc.)
 *
 * Ground Events Structure (rows 54-80):
 *   Column A: Event Name
 *   Column B: Start Time
 *   Column C: End Time
 *   Column D+: People (this is where "ALL", "STAFF ONLY" appear)
 *   Last 3 cols: Status checkboxes
 */
function parseGroundEventsForGroups(sheet, personType, date) {
  const matches = [];
  const values = sheet.getRange('A54:Q80').getDisplayValues();

  values.forEach((row, rowIndex) => {
    const event = row[0];  // A: Event name
    const start = row[1];  // B: Start time
    const end = row[2];    // C: End time

    // Skip empty rows
    if (!event && !start) return;

    // People are in columns D onwards, stop before last 3 status columns
    const peopleColumns = row.slice(3, -3);

    // Check if any person column contains a group indicator
    const hasGroupIndicator = peopleColumns.some(person => {
      if (!person) return false;
      const personUpper = person.toUpperCase();
      return personUpper === 'ALL' || personUpper === 'STAFF ONLY' || personUpper === 'STAFF_ONLY';
    });

    if (!hasGroupIndicator) return;

    // Find which group indicator(s) are present
    peopleColumns.forEach(person => {
      if (!person) return;
      const personUpper = person.toUpperCase();

      if (personUpper === 'ALL' || personUpper === 'STAFF ONLY' || personUpper === 'STAFF_ONLY') {
        // Check if this person should see this grouped event
        if (shouldShowGroupedEvent(person, personType)) {

          // Status checkboxes in last 3 columns
          const effective = parseBoolean(row[row.length - 3]);
          const cancelled = parseBoolean(row[row.length - 2]);
          const partiallyEffective = parseBoolean(row[row.length - 1]);

          matches.push({
            time: start,
            description: `${event} | ${person}`,
            enhanced: {
              section: 'Ground Events',
              event: event,
              start: start,
              end: end,
              groupType: person,
              status: {
                effective: effective,
                cancelled: cancelled,
                partiallyEffective: partiallyEffective
              }
            }
          });

          console.log(`✓ Grouped Ground Event: ${event} for ${person}`);
        }
      }
    });
  });

  return matches;
}

/**
 * Parse Flying Events section for grouped events (ALL, STAFF ONLY, etc.)
 *
 * Flying Events Structure (rows 11-52):
 *   Column A: Model
 *   Column B: Brief Start
 *   Column C: ETD
 *   Column D: ETA
 *   Column E: Debrief End
 *   Column F: Event
 *   Column G+: Crew (this is where "ALL", "STAFF ONLY" appear)
 *   Last 3 cols: Status checkboxes
 */
function parseFlyingEventsForGroups(sheet, personType, date) {
  const matches = [];
  const values = sheet.getRange('A11:R52').getDisplayValues();

  values.forEach((row, rowIndex) => {
    const model = row[0];       // A: Model
    const briefStart = row[1];  // B: Brief Start
    const etd = row[2];         // C: ETD
    const eta = row[3];         // D: ETA
    const debriefEnd = row[4];  // E: Debrief End
    const event = row[5];       // F: Event

    // Skip empty rows
    if (!model && !event) return;

    // Crew columns: G onwards, stop before last 3 status columns
    const crewColumns = row.slice(6, -3);

    // Check if any crew column contains a group indicator
    const hasGroupIndicator = crewColumns.some(crew => {
      if (!crew) return false;
      const crewUpper = crew.toUpperCase();
      return crewUpper === 'ALL' || crewUpper === 'STAFF ONLY' || crewUpper === 'STAFF_ONLY';
    });

    if (!hasGroupIndicator) return;

    // Find which group indicator(s) are present
    crewColumns.forEach(crew => {
      if (!crew) return;
      const crewUpper = crew.toUpperCase();

      if (crewUpper === 'ALL' || crewUpper === 'STAFF ONLY' || crewUpper === 'STAFF_ONLY') {
        // Check if this person should see this grouped event
        if (shouldShowGroupedEvent(crew, personType)) {

          // Status checkboxes in last 3 columns
          const effective = parseBoolean(row[row.length - 3]);
          const cancelled = parseBoolean(row[row.length - 2]);
          const partiallyEffective = parseBoolean(row[row.length - 1]);

          matches.push({
            time: briefStart,
            description: `${model} | ${event} | ${crew}`,
            enhanced: {
              section: 'Flying Events',
              model: model,
              briefStart: briefStart,
              etd: etd,
              eta: eta,
              debriefEnd: debriefEnd,
              event: event,
              groupType: crew,
              status: {
                effective: effective,
                cancelled: cancelled,
                partiallyEffective: partiallyEffective
              }
            }
          });

          console.log(`✓ Grouped Flying Event: ${model} ${event} for ${crew}`);
        }
      }
    });
  });

  return matches;
}

/**
 * Parse Supervision section for grouped events (ALL, STAFF ONLY, etc.)
 *
 * Supervision Structure (rows 1-9):
 *   Column A: Duty Type (SOF, OS, ODO, etc.)
 *   Columns B+: Time slots (POC, Start, End) repeating
 */
function parseSupervisionForGroups(sheet, personType, date) {
  const matches = [];
  const values = sheet.getRange('A1:N9').getDisplayValues();

  values.forEach((row, rowIndex) => {
    const dutyType = row[0]; // Column A: SOF, OS, ODO, etc.
    if (!dutyType || dutyType === '' || dutyType === 'Supervision') return;

    // Parse time slots (groups of 3 columns: POC, Start, End)
    for (let col = 1; col < row.length - 2; col += 3) {
      const poc = row[col];
      const start = row[col + 1];
      const end = row[col + 2];

      // Skip empty slots
      if (!poc && !start && !end) continue;

      // Check if POC contains a group indicator
      if (poc) {
        const pocUpper = poc.toUpperCase();

        if (pocUpper === 'ALL' || pocUpper === 'STAFF ONLY' || pocUpper === 'STAFF_ONLY') {
          // Check if this person should see this grouped event
          if (shouldShowGroupedEvent(poc, personType)) {

            // Special handling for AUTH (no times)
            const isAuth = dutyType.toUpperCase().includes('AUTH');

            matches.push({
              time: isAuth ? '' : start,
              description: isAuth
                ? `${dutyType} | ${poc}`
                : `${dutyType} | ${poc} | ${start}-${end}`,
              enhanced: {
                section: 'Supervision',
                duty: dutyType,
                poc: poc,
                start: isAuth ? null : start,
                end: isAuth ? null : end,
                isAuth: isAuth,
                groupType: poc
              }
            });

            console.log(`✓ Grouped Supervision: ${dutyType} for ${poc}`);
          }
        }
      }
    }
  });

  return matches;
}
