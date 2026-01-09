/**
 * Google Sheets Fetching - Methods for accessing public Google Sheets
 *
 * This file demonstrates how to fetch data from a publicly viewable Google Sheet
 * without requiring Google Apps Script.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Replace with your actual sheet ID (from the URL)
const SHEET_ID = 'your-google-sheet-id-here';

// Optional: API key for Google Sheets API v4 (not needed for JSONP method)
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

// =============================================================================
// METHOD 1: JSONP/Visualization API (No Auth Required)
// =============================================================================

/**
 * Fetch sheet data using Google's Visualization API
 * This works for any publicly viewable sheet without an API key
 *
 * @param {string} sheetName - Name of the sheet tab (e.g., "6 Jan")
 * @returns {Promise<Array<Array<string>>>} - 2D array of cell values
 */
async function fetchSheetJsonp(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const text = await response.text();

  // Response is JSONP wrapped: google.visualization.Query.setResponse({...})
  // Extract the JSON object (remove the wrapper)
  const jsonStr = text.substring(47).slice(0, -2);
  const data = JSON.parse(jsonStr);

  // Convert to simple 2D array
  return data.table.rows.map(row =>
    row.c.map(cell => cell?.v ?? '')
  );
}

/**
 * Fetch a specific range using the Visualization API with query
 *
 * @param {string} sheetName - Sheet tab name
 * @param {string} range - A1 notation range (e.g., "A1:Z100")
 * @returns {Promise<Array<Array<string>>>} - 2D array of cell values
 */
async function fetchRangeJsonp(sheetName, range) {
  const encodedRange = encodeURIComponent(`${sheetName}!${range}`);
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&range=${encodedRange}`;

  const response = await fetch(url);
  const text = await response.text();

  const jsonStr = text.substring(47).slice(0, -2);
  const data = JSON.parse(jsonStr);

  return data.table.rows.map(row =>
    row.c.map(cell => cell?.v ?? '')
  );
}

// =============================================================================
// METHOD 2: CSV Export (Simple but Less Flexible)
// =============================================================================

/**
 * Fetch sheet data as CSV
 *
 * @param {string} sheetName - Name of the sheet tab
 * @returns {Promise<Array<Array<string>>>} - 2D array of cell values
 */
async function fetchSheetCsv(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  const csv = await response.text();

  return parseCSV(csv);
}

/**
 * Simple CSV parser
 */
function parseCSV(csv) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else if (char === '"') {
        // End of quoted string
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }

  // Handle last row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

// =============================================================================
// METHOD 3: Google Sheets API v4 (Requires API Key)
// =============================================================================

/**
 * Fetch sheet data using Google Sheets API v4
 * Requires an API key but provides more control and better error handling
 *
 * @param {string} sheetName - Sheet tab name
 * @param {string} range - A1 notation range (e.g., "A1:Z100")
 * @returns {Promise<Array<Array<string>>>} - 2D array of cell values
 */
async function fetchWithApi(sheetName, range) {
  if (!API_KEY) {
    throw new Error('API_KEY is required for this method');
  }

  const encodedRange = encodeURIComponent(`${sheetName}!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodedRange}?key=${API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch sheet data');
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Get list of all sheet names in the spreadsheet
 * Requires API key
 */
async function getSheetNames() {
  if (!API_KEY) {
    throw new Error('API_KEY is required for this method');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.sheets.map(s => s.properties.title);
}

/**
 * Batch fetch multiple ranges in one request
 * More efficient than multiple individual requests
 */
async function fetchMultipleRanges(ranges) {
  if (!API_KEY) {
    throw new Error('API_KEY is required for this method');
  }

  const encodedRanges = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${encodedRanges}&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.valueRanges.map(vr => vr.values || []);
}

// =============================================================================
// HIGH-LEVEL FETCHING FUNCTIONS
// =============================================================================

/**
 * Fetch all schedule data for a date range
 *
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Promise<Object>} - Schedule data organized by date
 */
async function fetchScheduleRange(startDate, endDate) {
  const schedules = {};
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Skip weekends
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const sheetName = formatSheetName(currentDate);

      try {
        const data = await fetchSheetJsonp(sheetName);
        schedules[formatDateLocal(currentDate)] = {
          sheetName,
          data,
          success: true
        };
      } catch (error) {
        console.warn(`Failed to fetch ${sheetName}:`, error.message);
        schedules[formatDateLocal(currentDate)] = {
          sheetName,
          error: error.message,
          success: false
        };
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedules;
}

/**
 * Format date as sheet name (e.g., "6 Jan")
 */
function formatSheetName(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// CACHING WRAPPER
// =============================================================================

/**
 * Simple in-memory cache for fetched data
 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch with caching
 */
async function fetchWithCache(sheetName, fetchFn = fetchSheetJsonp) {
  const cacheKey = `sheet_${sheetName}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFn(sheetName);

  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

/**
 * Clear cache (call when you want fresh data)
 */
function clearCache() {
  cache.clear();
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Low-level fetch methods
  fetchSheetJsonp,
  fetchRangeJsonp,
  fetchSheetCsv,
  fetchWithApi,
  getSheetNames,
  fetchMultipleRanges,

  // High-level functions
  fetchScheduleRange,
  formatSheetName,
  formatDateLocal,

  // Caching
  fetchWithCache,
  clearCache,

  // Configuration
  SHEET_ID
};

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// Example 1: Fetch a single sheet (no auth required)
const data = await fetchSheetJsonp('6 Jan');
console.log('Row count:', data.length);
console.log('First row:', data[0]);

// Example 2: Fetch a specific range
const flyingEvents = await fetchRangeJsonp('6 Jan', 'A10:R50');

// Example 3: Fetch two weeks of data
const twoWeeksAgo = new Date();
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);

const allData = await fetchScheduleRange(twoWeeksAgo, nextWeek);

// Example 4: Use with caching
const cachedData = await fetchWithCache('6 Jan');
// Second call returns cached data instantly
const cachedAgain = await fetchWithCache('6 Jan');
*/
