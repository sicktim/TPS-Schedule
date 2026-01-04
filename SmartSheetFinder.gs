/**
 * Smart Sheet Finder
 *
 * Finds next available sheets intelligently.
 * Handles gaps in schedule (weekends, holidays, etc.)
 */

/**
 * Find the next available sheet starting from today
 *
 * @param {Date} startDate - The date to start searching from (defaults to today)
 * @returns {Object} { sheet, date, sheetName, daysFromToday, isoDate } or null
 */
function findNextAvailableSheet(startDate = null) {
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const today = startDate || getCurrentDate();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Search up to 30 days ahead
  for (let daysOffset = 0; daysOffset < 30; daysOffset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysOffset);

    const dayName = dayNames[targetDate.getDay()];
    const dayNameShort = dayNamesShort[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const day = targetDate.getDate();

    // Try multiple sheet name formats
    const sheetName1 = `${dayNameShort} ${day} ${monthName}`;
    const sheetName2 = `${dayName}, ${day} ${monthName}`;
    const sheetName3 = `${dayName} ${monthName} ${day}`;
    const sheetName4 = `${dayName} ${day} ${monthName}`;

    const sheet = ss.getSheetByName(sheetName1) ||
                  ss.getSheetByName(sheetName2) ||
                  ss.getSheetByName(sheetName3) ||
                  ss.getSheetByName(sheetName4);

    if (sheet) {
      console.log(`Found next available sheet: "${sheet.getName()}" (${daysOffset} days from today)`);
      return {
        sheet: sheet,
        sheetName: sheet.getName(),
        date: targetDate,
        daysFromToday: daysOffset,
        isoDate: targetDate.toISOString().split('T')[0]
      };
    }
  }

  console.warn('No available sheets found in the next 30 days');
  return null;
}

/**
 * Get N days worth of available sheets starting from the next available sheet
 *
 * @param {number} daysToGet - Number of days worth of sheets to retrieve
 * @param {Date} startDate - Optional start date (defaults to today)
 * @returns {Array} Array of sheet info objects
 */
function getSmartSheetRange(daysToGet = 7, startDate = null) {
  const sheets = [];
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  const firstSheet = findNextAvailableSheet(startDate);

  if (!firstSheet) {
    console.warn('No sheets found');
    return [];
  }

  console.log(`Starting from: ${firstSheet.sheetName} (${firstSheet.isoDate})`);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let dayOffset = 0; dayOffset < daysToGet; dayOffset++) {
    const targetDate = new Date(firstSheet.date);
    targetDate.setDate(firstSheet.date.getDate() + dayOffset);

    const dayName = dayNames[targetDate.getDay()];
    const dayNameShort = dayNamesShort[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const day = targetDate.getDate();

    const sheetName1 = `${dayNameShort} ${day} ${monthName}`;
    const sheetName2 = `${dayName}, ${day} ${monthName}`;
    const sheetName3 = `${dayName} ${monthName} ${day}`;
    const sheetName4 = `${dayName} ${day} ${monthName}`;

    const sheet = ss.getSheetByName(sheetName1) ||
                  ss.getSheetByName(sheetName2) ||
                  ss.getSheetByName(sheetName3) ||
                  ss.getSheetByName(sheetName4);

    if (sheet) {
      sheets.push({
        sheetName: sheet.getName(),
        date: targetDate.toISOString().split('T')[0],
        dayName: dayName,
        dayOffset: dayOffset,
        sheet: sheet
      });
    }
  }

  console.log(`Found ${sheets.length} available sheets out of ${daysToGet} days requested`);
  return sheets;
}

/**
 * Get current date in the configured timezone
 * @returns {Date} Current date with timezone adjustment
 */
function getCurrentDate() {
  const now = new Date();
  const tzString = Utilities.formatDate(now, SEARCH_CONFIG.timezone, "yyyy-MM-dd");
  const parts = tzString.split('-');

  return new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2]),
    12, 0, 0
  );
}
