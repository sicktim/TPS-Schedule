/**
 * TPS Schedule - Simplified Processor
 *
 * Fetches squadron events from Google Sheets whiteboard.
 * Returns filtered results as JSON for the web widget.
 *
 * Sections parsed:
 *   - Supervision (rows 1-10)
 *   - Flying Events (rows 11-51)
 *   - Ground Events (rows 55-79)
 *   - Not Available (rows 82-112)
 */

/**
 * doGet_Simplified(e) - Entry point for simplified version
 *
 * @param {Object} e - Event object with URL parameters
 * @returns {TextOutput} JSON response
 */
function doGet_Simplified(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;
    const daysAhead = parseInt(e.parameter.days) || 3;

    const results = getEventsForWidget(searchName, daysAhead);

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
 * Get events for widget - main orchestration function
 *
 * @param {string} searchName - Name to search for
 * @param {number} daysAhead - Number of days to search
 * @returns {Object} Response with events grouped by day
 */
function getEventsForWidget(searchName, daysAhead) {
  const upcomingDays = getNextNWeekdays(daysAhead);
  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  const events = [];
  const searchedSheets = [];

  console.log(`Searching for: "${searchName}", Days: ${daysAhead}`);

  upcomingDays.forEach(date => {
    const sheetName = generateSheetName(date);
    const dayEvents = searchNameInSheet(spreadsheet, sheetName, searchName);

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
    daysSearched: upcomingDays.length,
    searchedSheets: searchedSheets,
    events: events,
    totalEvents: events.reduce((sum, day) => sum + day.events.length, 0),
    simplified: true,
    version: "4.0"
  };
}

/**
 * Search for a name in a specific sheet
 *
 * @param {Spreadsheet} spreadsheet - Pre-opened spreadsheet
 * @param {string} sheetName - Sheet tab name
 * @param {string} searchName - Name to search for
 * @returns {Array} Array of event objects
 */
function searchNameInSheet(spreadsheet, sheetName, searchName) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    console.log(`Sheet not found: ${sheetName}`);
    return [];
  }

  const searchRanges = [
    { range: "A1:N10",   name: "Supervision" },
    { range: "A11:R51",  name: "Flying Events" },
    { range: "A55:Q79",  name: "Ground Events" },
    { range: "A82:N112", name: "Not Available" }
  ];

  const rangeAddresses = searchRanges.map(sr => sr.range);
  const rangeList = sheet.getRangeList(rangeAddresses);
  const allRangeData = rangeList.getRanges().map(r => r.getDisplayValues());

  const matches = [];

  allRangeData.forEach((values, rangeIndex) => {
    const searchRange = searchRanges[rangeIndex];

    values.forEach(row => {
      const rowText = row.join('|').toLowerCase();
      const nameToFind = searchName.toLowerCase();

      if (rowText.includes(nameToFind)) {
        const eventData = row
          .filter(cell => {
            if (!cell || cell === "") return false;
            const cellStr = String(cell).toLowerCase();
            return cellStr !== 'true' && cellStr !== 'false';
          })
          .map(cell => formatCellValue(cell));

        if (eventData.length > 0) {
          const firstItem = eventData[0];
          const isTime = /^\d{2}:\d{2}$/.test(firstItem) || /^\d{4}$/.test(firstItem);

          matches.push({
            time: isTime ? firstItem : "",
            description: isTime ? eventData.slice(1).join(" | ") : eventData.join(" | "),
            rangeSource: searchRange.name
          });
        }
      }
    });
  });

  return matches;
}

/**
 * Get next N weekdays starting from today
 *
 * @param {number} n - Number of weekdays to get
 * @returns {Array<Date>} Array of Date objects
 */
function getNextNWeekdays(n) {
  const weekdays = [];
  const now = new Date();
  const localDateStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, "yyyy-MM-dd");
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
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdays.push(new Date(currentDate));
    }
  }

  return weekdays;
}

/**
 * Generate sheet name from date
 *
 * @param {Date} date - The date
 * @returns {string} Sheet name (e.g., "Mon 5 Jan")
 */
function generateSheetName(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Get full day name
 *
 * @param {Date} date - The date
 * @returns {string} Full day name (e.g., "Monday")
 */
function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 *
 * @param {Date} date - The date
 * @returns {string} ISO formatted date
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format cell value for display
 *
 * @param {any} cell - Cell value
 * @returns {string} Formatted string
 */
function formatCellValue(cell) {
  if (!cell) return "";

  const cellStr = cell.toString().trim();

  // Already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(cellStr)) {
    return cellStr;
  }

  // 4-digit time (e.g., "0800" -> "08:00")
  if (/^\d{4}$/.test(cellStr)) {
    return cellStr.substring(0, 2) + ':' + cellStr.substring(2, 4);
  }

  // Time without leading zero (e.g., "8:00" -> "08:00")
  const timeMatch = cellStr.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    return timeMatch[1].padStart(2, '0') + ':' + timeMatch[2];
  }

  return cellStr;
}
