/**
 * API Route Example - Vercel/Next.js serverless function
 *
 * This shows how to create an API endpoint that fetches from Google Sheets
 * and returns processed schedule data for the Gantt chart.
 *
 * File location: pages/api/schedule.js (Next.js) or api/schedule.js (Vercel)
 */

// For Vercel Edge Runtime (faster, global)
export const config = {
  runtime: 'edge',
};

// =============================================================================
// CONFIGURATION
// =============================================================================

const SHEET_ID = process.env.GOOGLE_SHEETS_ID || 'your-sheet-id';
const CACHE_TTL = 300; // 5 minutes in seconds

// =============================================================================
// GOOGLE SHEETS FETCHING
// =============================================================================

async function fetchSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${sheetName}`);
  }

  const text = await response.text();
  const jsonStr = text.substring(47).slice(0, -2);
  const data = JSON.parse(jsonStr);

  return data.table.rows.map(row =>
    row.c.map(cell => cell?.v ?? '')
  );
}

// =============================================================================
// DATA PROCESSING
// =============================================================================

/**
 * Section ranges (adjust based on your sheet structure)
 */
const SECTIONS = {
  supervision: { startRow: 0, endRow: 6 },
  flying: { startRow: 9, endRow: 49 },
  ground: { startRow: 51, endRow: 79 },
  na: { startRow: 81, endRow: 109 }
};

const ROSTER_CONFIG = {
  ranges: [
    { col: 19, name: 'Class 26A', type: 'student' },  // Column T
    { col: 20, name: 'Class 26B', type: 'student' },  // Column U
    { col: 21, name: 'FTC-A', type: 'student' },      // Column V
    { col: 22, name: 'FTC-B', type: 'student' },      // Column W
    { col: 23, name: 'STC-A', type: 'student' },      // Column X
    { col: 24, name: 'STC-B', type: 'student' },      // Column Y
    { col: 25, name: 'Staff IP', type: 'staff' },     // Column Z
  ],
  startRow: 2,
  endRow: 50
};

/**
 * Extract roster from sheet data
 */
function extractRoster(sheetData) {
  const roster = {};

  ROSTER_CONFIG.ranges.forEach(({ col, name, type }) => {
    roster[name] = [];

    for (let row = ROSTER_CONFIG.startRow; row <= ROSTER_CONFIG.endRow; row++) {
      const cellValue = sheetData[row]?.[col]?.toString().trim();
      if (cellValue && isValidPersonName(cellValue)) {
        roster[name].push({
          name: cellValue,
          category: name,
          type
        });
      }
    }
  });

  return roster;
}

/**
 * Patterns to filter out non-person names
 */
const FILTER_PATTERNS = [
  'academics', 'events', 'ground events', 'flying events', 'supervision',
  'groot', 'mtg', 'meeting', 'interview', 'brief', 'students', 'staff'
];

function isValidPersonName(name) {
  if (!name || name.length < 2) return false;
  const lower = name.toLowerCase();
  if (FILTER_PATTERNS.some(p => lower.includes(p))) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

/**
 * Extract events for a person from sheet data
 */
function extractEventsForPerson(sheetData, personName, date) {
  const events = [];
  const searchLower = personName.toLowerCase();

  // Flying events
  for (let row = SECTIONS.flying.startRow; row <= SECTIONS.flying.endRow; row++) {
    const rowData = sheetData[row];
    if (!rowData) continue;

    const rowText = rowData.join('|').toLowerCase();
    if (rowText.includes(searchLower)) {
      events.push({
        date,
        time: rowData[1] || '',
        type: 'Flying Events',
        description: [rowData[0], rowData[5], ...rowData.slice(6, 14).filter(Boolean)].join(' | '),
        enhanced: {
          model: rowData[0],
          briefStart: rowData[1],
          etd: rowData[2],
          eta: rowData[3],
          debriefEnd: rowData[4],
          event: rowData[5]
        }
      });
    }
  }

  // Ground events
  for (let row = SECTIONS.ground.startRow; row <= SECTIONS.ground.endRow; row++) {
    const rowData = sheetData[row];
    if (!rowData) continue;

    const rowText = rowData.join('|').toLowerCase();
    if (rowText.includes(searchLower)) {
      events.push({
        date,
        time: rowData[1] || '',
        type: 'Ground Events',
        description: rowData[0] || '',
        enhanced: {
          event: rowData[0],
          start: rowData[1],
          end: rowData[2]
        }
      });
    }
  }

  // NA events
  for (let row = SECTIONS.na.startRow; row <= SECTIONS.na.endRow; row++) {
    const rowData = sheetData[row];
    if (!rowData) continue;

    const rowText = rowData.join('|').toLowerCase();
    if (rowText.includes(searchLower)) {
      events.push({
        date,
        time: rowData[1] || '',
        type: 'NA',
        description: rowData[0] || '',
        enhanced: {
          reason: rowData[0],
          start: rowData[1],
          end: rowData[2]
        }
      });
    }
  }

  // Supervision
  for (let row = SECTIONS.supervision.startRow; row <= SECTIONS.supervision.endRow; row++) {
    const rowData = sheetData[row];
    if (!rowData) continue;

    const rowText = rowData.join('|').toLowerCase();
    if (rowText.includes(searchLower)) {
      const duty = rowData[0];
      events.push({
        date,
        time: rowData[2] || '',
        type: 'Supervision',
        description: `${duty} | ${rowData[1]}`,
        enhanced: {
          duty,
          poc: rowData[1],
          start: rowData[2],
          end: rowData[3]
        }
      });
    }
  }

  return events;
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

function formatSheetName(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(weekOffset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + (weekOffset * 7));

  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const dates = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

// =============================================================================
// API HANDLER
// =============================================================================

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const weekOffset = parseInt(searchParams.get('week') || '0');
  const categories = searchParams.get('categories')?.split(',') || [];

  try {
    // Get dates for requested week
    const dates = getWeekDates(weekOffset);

    // Fetch all sheets for the week
    const sheetsData = {};
    for (const date of dates) {
      const sheetName = formatSheetName(date);
      try {
        sheetsData[formatDateStr(date)] = await fetchSheetData(sheetName);
      } catch (err) {
        console.warn(`Failed to fetch ${sheetName}:`, err.message);
        sheetsData[formatDateStr(date)] = null;
      }
    }

    // Extract roster from first available sheet
    const firstSheet = Object.values(sheetsData).find(s => s !== null);
    if (!firstSheet) {
      throw new Error('No sheets available for requested week');
    }

    const roster = extractRoster(firstSheet);
    const allCategories = Object.keys(roster);

    // Filter categories if specified
    const targetCategories = categories.length > 0
      ? categories.filter(c => allCategories.includes(c))
      : allCategories;

    // Build schedules for each person in target categories
    const schedules = [];

    for (const category of targetCategories) {
      for (const person of roster[category]) {
        const personSchedule = {
          name: person.name,
          category: person.category,
          events: []
        };

        // Collect events from all sheets
        for (const [dateStr, sheetData] of Object.entries(sheetsData)) {
          if (sheetData) {
            const events = extractEventsForPerson(sheetData, person.name, dateStr);
            personSchedule.events.push(...events);
          }
        }

        schedules.push(personSchedule);
      }
    }

    // Sort by name
    schedules.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({
      success: true,
      weekOffset,
      dates: dates.map(d => formatDateStr(d)),
      categories: allCategories,
      peopleCount: schedules.length,
      schedules,
      metadata: {
        lastRun: new Date().toISOString(),
        sheetsProcessed: Object.values(sheetsData).filter(Boolean).length
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${CACHE_TTL}, stale-while-revalidate`,
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// =============================================================================
// USAGE
// =============================================================================

/*
Deploy to Vercel and call:

GET /api/schedule
  - Returns current week, all categories

GET /api/schedule?week=-1
  - Returns previous week

GET /api/schedule?week=1
  - Returns next week

GET /api/schedule?categories=Class%2026A,Staff%20IP
  - Returns only specified categories
*/
