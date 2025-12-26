/**
 * Smart Sheet Finder - Finds next available sheets intelligently
 *
 * Handles gaps in schedule (weekends, holidays, etc.)
 * Finds the next available sheet after today and displays N days from there
 */

/**
 * Find the next available sheet starting from today
 *
 * @param {Date} startDate - The date to start searching from (defaults to today)
 * @returns {Object} { sheet: Sheet, date: Date, sheetName: string } or null if none found
 */
function findNextAvailableSheet(startDate = null) {
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const today = startDate || getCurrentDate();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Search up to 30 days ahead to find the next available sheet
  for (let daysOffset = 0; daysOffset < 30; daysOffset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysOffset);

    const dayName = dayNames[targetDate.getDay()];
    const dayNameShort = dayNamesShort[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const day = targetDate.getDate();

    // Try multiple sheet name formats
    const sheetName1 = `${dayNameShort} ${day} ${monthName}`;  // "Mon 5 Jan"
    const sheetName2 = `${dayName}, ${day} ${monthName}`;      // "Monday, 5 Jan"
    const sheetName3 = `${dayName} ${monthName} ${day}`;       // "Monday Jan 5"
    const sheetName4 = `${dayName} ${day} ${monthName}`;       // "Monday 5 Jan"

    const sheet = ss.getSheetByName(sheetName1) ||
                  ss.getSheetByName(sheetName2) ||
                  ss.getSheetByName(sheetName3) ||
                  ss.getSheetByName(sheetName4);

    if (sheet) {
      console.log(`✅ Found next available sheet: "${sheet.getName()}" (${daysOffset} days from ${today.toISOString().split('T')[0]})`);
      return {
        sheet: sheet,
        sheetName: sheet.getName(),
        date: targetDate,
        daysFromToday: daysOffset,
        isoDate: targetDate.toISOString().split('T')[0]
      };
    }
  }

  console.warn('❌ No available sheets found in the next 30 days!');
  return null;
}

/**
 * Get N days worth of available sheets starting from the next available sheet
 *
 * Example:
 *   Today is Dec 25, 2025
 *   Next sheet is Jan 5, 2026
 *   Requesting 5 days will return: Jan 5, 6, 7, 8, 9
 *   (skipping sheets that don't exist but continuing the count)
 *
 * @param {number} daysToGet - Number of days worth of sheets to retrieve
 * @param {Date} startDate - Optional start date (defaults to today)
 * @returns {Array} Array of sheet info objects
 */
function getSmartSheetRange(daysToGet = 7, startDate = null) {
  const sheets = [];
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  // Find the next available sheet
  const firstSheet = findNextAvailableSheet(startDate);

  if (!firstSheet) {
    console.warn('No sheets found - returning empty array');
    return [];
  }

  console.log(`\n=== Smart Sheet Range ===`);
  console.log(`Starting from: ${firstSheet.sheetName} (${firstSheet.isoDate})`);
  console.log(`Looking for ${daysToGet} days worth of sheets\n`);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get N days starting from the first available sheet
  for (let dayOffset = 0; dayOffset < daysToGet; dayOffset++) {
    const targetDate = new Date(firstSheet.date);
    targetDate.setDate(firstSheet.date.getDate() + dayOffset);

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
      const sheetInfo = {
        sheetName: sheet.getName(),
        date: targetDate.toISOString().split('T')[0],
        dayName: dayName,
        dayOffset: dayOffset,
        sheet: sheet
      };

      sheets.push(sheetInfo);
      console.log(`  ✅ Day +${dayOffset}: ${sheetInfo.sheetName} (${sheetInfo.date})`);
    } else {
      console.log(`  ❌ Day +${dayOffset}: No sheet for ${targetDate.toISOString().split('T')[0]} (${dayNameShort} ${day} ${monthName})`);
    }
  }

  console.log(`\nFound ${sheets.length} available sheets out of ${daysToGet} days requested\n`);

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
    12, 0, 0  // Use noon to avoid timezone edge cases
  );
}

/**
 * TEST: Find next available sheet
 */
function testFindNextSheet() {
  console.log('=== TEST: Find Next Available Sheet ===\n');

  const result = findNextAvailableSheet();

  if (result) {
    console.log('Success!');
    console.log(`  Sheet: ${result.sheetName}`);
    console.log(`  Date: ${result.isoDate}`);
    console.log(`  Days from today: ${result.daysFromToday}`);
  } else {
    console.log('Failed - no sheets found');
  }
}

/**
 * TEST: Get smart sheet range
 */
function testSmartSheetRange() {
  console.log('=== TEST: Smart Sheet Range (7 days) ===\n');

  const sheets = getSmartSheetRange(7);

  console.log(`\nReturned ${sheets.length} sheets:`);
  sheets.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.sheetName} - ${s.date} (${s.dayName})`);
  });
}
