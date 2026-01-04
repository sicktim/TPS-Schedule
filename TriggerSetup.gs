// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      TPS SCHEDULE - MAIN PROCESSOR                         ║
// ║                                                                            ║
// ║  Purpose: Fetch and parse squadron schedule data from Google Sheets        ║
// ║  Version: 4.0 - Simplified with Date-Based Ranges                         ║
// ║  Last Modified: January 4, 2026                                            ║
// ║                                                                            ║
// ║  Features:                                                                 ║
// ║  - Real-time data fetching (no caching)                                    ║
// ║  - Date-based range configuration (supports whiteboard structure changes)  ║
// ║  - Optimized batch range reads                                             ║
// ║  - getDisplayValues() for faster performance                               ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ┌────────────────────────────────────────────────────────────────────────────┐
// │                            TABLE OF CONTENTS                               │
// ├────────────────────────────────────────────────────────────────────────────┤
// │                                                                            │
// │  [1] MAIN WEB APP ENDPOINT ........................ Lines 30-60           │
// │      - doGet_Simplified(): Entry point for HTTP requests                   │
// │                                                                            │
// │  [2] CORE DATA FUNCTIONS .......................... Lines 65-200          │
// │      - getEventsForWidget(): Main orchestration                            │
// │      - searchNameInSheetForWidget_Simplified(): Search and parse           │
// │                                                                            │
// │  [3] DATE/TIME UTILITIES .......................... Lines 205-280         │
// │      - getNextNWeekdays(): Find weekdays to search                         │
// │      - generateSheetName(): Create sheet name from date                    │
// │      - getDayName(): Get full day name                                     │
// │      - formatDateISO(): Format date as YYYY-MM-DD                          │
// │                                                                            │
// │  [4] CELL FORMATTING .............................. Lines 285-340         │
// │      - formatCellValue(): Clean and format cell data                       │
// │                                                                            │
// └────────────────────────────────────────────────────────────────────────────┘


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      [1] MAIN WEB APP ENDPOINT                             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * doGet_Simplified() - Main entry point for HTTP requests
 *
 * Called when someone accesses the deployed web app URL.
 * Fetches real-time schedule data without caching.
 */
function doGet_Simplified(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;
    const daysAhead = parseInt(e.parameter.days) || 3;
    const testDate = e.parameter.testDate || null;

    const results = getEventsForWidget(searchName, daysAhead, testDate);

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
// ║                      [2] CORE DATA FUNCTIONS                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * getEventsForWidget() - Main orchestration function
 *
 * Opens spreadsheet once and searches multiple days for schedule events.
 * Uses date-based range configuration for future-proofing.
 */
function getEventsForWidget(searchName, daysAhead, testDate = null) {
  const upcomingDays = getNextNWeekdays(daysAhead, testDate);
  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  const events = [];
  const searchedSheets = [];

  console.log(`Searching for: "${searchName}" across ${upcomingDays.length} days`);

  upcomingDays.forEach(date => {
    const sheetName = generateSheetName(date);
    const dayEvents = searchNameInSheetForWidget_Simplified(
      spreadsheet,
      sheetName,
      searchName,
      date
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
    simplified: true,
    version: "4.0"
  };

  if (testDate || SEARCH_CONFIG.testMode) {
    response.testMode = true;
    response.simulatedToday = testDate || SEARCH_CONFIG.testDate;
  }

  return response;
}

/**
 * searchNameInSheetForWidget_Simplified() - Search and parse a single sheet
 *
 * Uses date-based ranges from Config.gs to support whiteboard structure changes.
 * Optimized with batch range reads and getDisplayValues().
 */
function searchNameInSheetForWidget_Simplified(spreadsheet, sheetName, searchName, sheetDate) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    console.log(`Sheet not found: ${sheetName}`);
    return [];
  }

  // Get correct ranges based on sheet date (automatically switches OLD/NEW ranges)
  const ranges = getRangesForDate(sheetDate);

  const searchRanges = [
    { range: ranges.supervision,   name: "Supervision" },
    { range: ranges.flyingEvents,  name: "Flying Events" },
    { range: ranges.groundEvents,  name: "Ground Events" },
    { range: ranges.notAvailable,  name: "Not Available" }
  ];

  // Batch read all ranges at once (performance optimization)
  const rangeAddresses = searchRanges.map(sr => sr.range);
  const rangeList = sheet.getRangeList(rangeAddresses);
  const allRangeData = rangeList.getRanges().map(r => r.getDisplayValues());

  const matches = [];

  allRangeData.forEach((values, rangeIndex) => {
    const searchRange = searchRanges[rangeIndex];

    try {
      values.forEach((row) => {
        const rowText = row.join('|').toLowerCase();
        const nameToFind = searchName.toLowerCase();

        if (rowText.includes(nameToFind)) {
          const eventData = row
            .filter(cell => {
              if (cell === "" || cell === null || cell === undefined) return false;
              if (typeof cell === 'boolean') return false;
              const cellStr = String(cell).toLowerCase();
              if (cellStr === 'true' || cellStr === 'false') return false;
              return true;
            })
            .map(cell => formatCellValue(cell));

          if (eventData.length > 0) {
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
          }
        }
      });
    } catch (error) {
      console.error(`Error in range ${searchRange.range}: ${error.toString()}`);
    }
  });

  return matches;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      [3] DATE/TIME UTILITIES                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * getNextNWeekdays() - Get today and the next N weekdays
 *
 * Returns array of Date objects for weekdays only (Mon-Fri).
 * Skips weekends. Supports test mode with simulated dates.
 */
function getNextNWeekdays(n, testDate = null) {
  const weekdays = [];

  let localDateStr;
  if (testDate) {
    localDateStr = testDate;
    console.log(`Test mode: Using testDate = ${testDate}`);
  } else if (SEARCH_CONFIG.testMode) {
    localDateStr = SEARCH_CONFIG.testDate;
    console.log(`Test mode: Using config testDate = ${SEARCH_CONFIG.testDate}`);
  } else {
    const now = new Date();
    localDateStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, "yyyy-MM-dd");
  }

  const localParts = localDateStr.split('-');
  let currentDate = new Date(
    parseInt(localParts[0]),
    parseInt(localParts[1]) - 1,
    parseInt(localParts[2]),
    12, 0, 0
  );

  // Include today if it's a weekday
  const todayDayOfWeek = currentDate.getDay();
  if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
    weekdays.push(new Date(currentDate));
  }

  // Add more weekdays until we have enough
  const targetCount = n + 1;
  let safetyCounter = 0;

  while (weekdays.length < targetCount && safetyCounter < 30) {
    currentDate.setDate(currentDate.getDate() + 1);
    safetyCounter++;

    const dayOfWeek = currentDate.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday) {
      weekdays.push(new Date(currentDate));
    }
  }

  return weekdays;
}

/**
 * generateSheetName() - Convert Date to sheet tab name format
 *
 * Format: "Day DD Mon" (e.g., "Mon 15 Jan")
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
 * getDayName() - Get full day name from Date
 */
function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * formatDateISO() - Format Date as ISO string (YYYY-MM-DD)
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      [4] CELL FORMATTING                                   ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * formatCellValue() - Clean and format a single cell value
 *
 * Handles times, booleans, dates, and various data types from Google Sheets.
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
