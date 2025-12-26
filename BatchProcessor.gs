/**
 * TPS Schedule - Batch Processor
 *
 * Pre-processes all schedules and caches results for instant retrieval.
 * Runs every 5 minutes via time-based trigger.
 *
 * Cache Limits (Google Apps Script):
 * - CacheService: 1MB per entry, 10MB total, 6 hour max TTL
 * - PropertiesService: 500KB TOTAL (all properties combined), persistent
 * - Recommendation: Use CacheService primary, Spreadsheet backup
 */

// ====================
// MAIN BATCH PROCESSOR
// ====================

/**
 * Main function to batch process all schedules
 * Call this from a time-based trigger (every 5 minutes)
 */
function batchProcessAllSchedules() {
  const metrics = {
    startTime: new Date(),
    totalDuration: 0,
    sheetsProcessed: 0,
    peopleProcessed: 0,
    eventsFound: 0,
    cacheSize: 0,
    errors: [],
    sheetMetrics: [],
    personMetrics: []
  };

  try {
    console.log('=== Starting Batch Processing ===');

    // 1. Get all relevant sheets (today + next 4 days)
    const sheets = getRelevantSheets();
    console.log(`Processing ${sheets.length} sheets...`);

    // 2. Get list of all people to process
    const people = getAllPeople();
    console.log(`Processing ${people.length} people...`);

    if (people.length === 0) {
      throw new Error('No people found in Student/Staff List');
    }

    // 3. Process each sheet
    const cache = CacheService.getScriptCache();
    const allSchedules = {}; // personName -> { events: [], days: [] }

    sheets.forEach(sheetInfo => {
      const sheetStart = new Date();

      try {
        console.log(`\nProcessing sheet: ${sheetInfo.sheetName}`);

        // Process this sheet for all people
        const sheetResults = processSheet(sheetInfo, people);

        // Merge results into allSchedules
        Object.keys(sheetResults).forEach(personName => {
          if (!allSchedules[personName]) {
            allSchedules[personName] = { events: [], days: [] };
          }
          allSchedules[personName].events.push(...sheetResults[personName].events);
          if (!allSchedules[personName].days.includes(sheetInfo.date)) {
            allSchedules[personName].days.push(sheetInfo.date);
          }
        });

        const sheetDuration = (new Date() - sheetStart) / 1000;
        metrics.sheetMetrics.push({
          sheet: sheetInfo.sheetName,
          date: sheetInfo.date,
          duration: sheetDuration,
          eventsFound: Object.values(sheetResults).reduce((sum, p) => sum + p.events.length, 0)
        });

        metrics.sheetsProcessed++;
        console.log(`✓ Sheet processed in ${sheetDuration.toFixed(2)}s`);

      } catch (e) {
        console.error(`✗ Error processing sheet ${sheetInfo.sheetName}: ${e}`);
        metrics.errors.push({ sheet: sheetInfo.sheetName, error: e.toString() });
      }
    });

    // 4. Cache each person's complete schedule
    console.log('\n=== Caching Results ===');

    people.forEach(person => {
      const personStart = new Date();

      try {
        const schedule = allSchedules[person.name] || { events: [], days: [] };

        // Build final JSON
        const result = {
          person: person.name,
          class: person.class,
          type: person.type,
          events: schedule.events,
          days: schedule.days.sort(),
          lastUpdated: new Date().toISOString(),
          version: '5.0-batch'
        };

        const json = JSON.stringify(result);
        const sizeBytes = Utilities.newBlob(json).getBytes().length;
        const sizeKB = (sizeBytes / 1024).toFixed(2);

        // Cache it
        cache.put(`schedule_${person.name}`, json, 21600); // 6 hours

        metrics.peopleProcessed++;
        metrics.eventsFound += schedule.events.length;
        metrics.cacheSize += sizeBytes;

        const personDuration = (new Date() - personStart) / 1000;
        metrics.personMetrics.push({
          name: person.name,
          events: schedule.events.length,
          sizeKB: parseFloat(sizeKB),
          duration: personDuration
        });

        if (sizeBytes > 100000) { // > 100KB
          console.log(`⚠ Large cache for ${person.name}: ${sizeKB} KB`);
        }

      } catch (e) {
        console.error(`✗ Error caching ${person.name}: ${e}`);
        metrics.errors.push({ person: person.name, error: e.toString() });
      }
    });

    metrics.totalDuration = (new Date() - metrics.startTime) / 1000;

    // 5. Store batch metadata
    const metadata = {
      lastRun: metrics.startTime.toISOString(),
      duration: metrics.totalDuration,
      sheetsProcessed: metrics.sheetsProcessed,
      peopleProcessed: metrics.peopleProcessed,
      eventsFound: metrics.eventsFound,
      totalCacheSizeMB: (metrics.cacheSize / 1024 / 1024).toFixed(2),
      averagePersonSizeKB: (metrics.cacheSize / metrics.peopleProcessed / 1024).toFixed(2),
      errors: metrics.errors.length
    };

    cache.put('batch_metadata', JSON.stringify(metadata), 21600);

    // 6. Log summary
    console.log('\n=== Batch Processing Complete ===');
    console.log(`Total Duration: ${metrics.totalDuration.toFixed(2)}s`);
    console.log(`Sheets Processed: ${metrics.sheetsProcessed}/${sheets.length}`);
    console.log(`People Processed: ${metrics.peopleProcessed}/${people.length}`);
    console.log(`Events Found: ${metrics.eventsFound}`);
    console.log(`Total Cache Size: ${metadata.totalCacheSizeMB} MB`);
    console.log(`Average Per Person: ${metadata.averagePersonSizeKB} KB`);
    console.log(`Errors: ${metrics.errors.length}`);

    // 7. Log to spreadsheet for tracking
    logMetricsToSheet(metrics);

    return metrics;

  } catch (e) {
    console.error('FATAL ERROR in batch processing:', e);
    metrics.errors.push({ fatal: true, error: e.toString() });
    metrics.totalDuration = (new Date() - metrics.startTime) / 1000;

    // Try to log error
    try {
      logMetricsToSheet(metrics);
    } catch (logError) {
      console.error('Could not log metrics:', logError);
    }

    throw e;
  }
}

// =============================
// SHEET AND PEOPLE EXTRACTION
// =============================

/**
 * Get list of ALL date sheets available in the spreadsheet
 * Finds all sheets matching date patterns (e.g., "Mon 15 Dec", "Tuesday, 16 Dec")
 */
function getRelevantSheets(startDate) {
  const sheets = [];
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const allSheets = ss.getSheets();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Regex patterns to match date sheets
  // Matches: "Mon 15 Dec", "Monday, 15 Dec", "Monday Dec 15", "Monday 15 Dec"
  const dayPattern = `(${dayNamesShort.join('|')}|${dayNames.join('|')})`;
  const monthPattern = `(${monthNames.join('|')})`;
  const datePattern = new RegExp(`^${dayPattern},?\\s+\\d{1,2}\\s+${monthPattern}$|^${dayPattern}\\s+${monthPattern}\\s+\\d{1,2}$`, 'i');

  // Scan all sheets and find date sheets
  allSheets.forEach(sheet => {
    const sheetName = sheet.getName();

    // Check if sheet name matches date pattern
    if (datePattern.test(sheetName)) {
      // Parse the date from sheet name
      const parsedDate = parseDateFromSheetName(sheetName, dayNames, dayNamesShort, monthNames);

      if (parsedDate) {
        sheets.push({
          sheetName: sheetName,
          date: parsedDate.toISOString().split('T')[0],
          dayName: dayNames[parsedDate.getDay()],
          sheet: sheet,
          sortKey: parsedDate.getTime() // For sorting
        });
      }
    }
  });

  // Sort by date (earliest first)
  sheets.sort((a, b) => a.sortKey - b.sortKey);

  console.log(`Found ${sheets.length} date sheets: ${sheets.map(s => s.sheetName).join(', ')}`);

  return sheets;
}

/**
 * Parse a date from sheet name like "Mon 15 Dec" or "Monday, 15 Dec"
 */
function parseDateFromSheetName(sheetName, dayNames, dayNamesShort, monthNames) {
  try {
    // Extract day number and month name
    const dayMatch = sheetName.match(/\d{1,2}/);
    const monthMatch = sheetName.match(new RegExp(monthNames.join('|'), 'i'));

    if (!dayMatch || !monthMatch) return null;

    const day = parseInt(dayMatch[0]);
    const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthMatch[0].toLowerCase());

    if (monthIndex === -1 || day < 1 || day > 31) return null;

    // Assume current year (or next year if month has passed)
    const now = new Date();
    let year = now.getFullYear();

    // If the month is in the past, assume next year
    if (monthIndex < now.getMonth()) {
      year++;
    }

    return new Date(year, monthIndex, day);
  } catch (e) {
    console.warn(`Could not parse date from sheet name: ${sheetName}`);
    return null;
  }
}

/**
 * Extract all people from all 5 columns across all sheets (rows 120-168)
 *
 * Reads from:
 * - Students (Bravo): A120:A168
 * - Students (Alpha): E120:E168
 * - Staff IP: I120:I168
 * - Staff IFTE/ICSO: M120:M168
 * - Attached/Support: O120:O168
 *
 * Filters out: blanks, ".", headers like "Bravo Students", "STC Students", etc.
 */
function getAllPeople() {
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  // Get all sheets to collect people from each
  const sheets = getRelevantSheets();
  if (sheets.length === 0) {
    throw new Error('No sheets found');
  }

  const peopleMap = new Map(); // Use Map to deduplicate
  const headerPatterns = [
    'bravo students', 'stc students', 'alpha students',
    'staff ip', 'stc staff', 'attached', 'support'
  ];

  // Process each sheet to collect all unique people
  sheets.forEach(sheetInfo => {
    const sheet = sheetInfo.sheet;

    // Read all 5 columns at once (A, E, I, M, O from rows 120-168)
    const data = sheet.getRange('A120:O168').getDisplayValues();

    // Column definitions with their indices and types
    const columns = [
      { col: 0, name: 'Bravo Students', type: 'student' },      // A
      { col: 4, name: 'Alpha Students', type: 'student' },      // E
      { col: 8, name: 'Staff IP', type: 'staff' },              // I
      { col: 12, name: 'Staff IFTE/ICSO', type: 'staff' },      // M
      { col: 14, name: 'Attached/Support', type: 'staff' }      // O
    ];

    // Process each column
    columns.forEach(colDef => {
      data.forEach((row, idx) => {
        const name = row[colDef.col] ? row[colDef.col].trim() : '';

        // Skip if empty, just a dot, or blank
        if (!name || name === '.' || name === '') {
          return;
        }

        // Skip boolean values and common non-names
        const nameLower = name.toLowerCase();
        if (nameLower === 'false' || nameLower === 'true' ||
            nameLower === 'yes' || nameLower === 'no' ||
            nameLower === 'n/a' || nameLower === 'tbd') {
          return;
        }

        // Skip if it's too short to be a name (likely a typo or placeholder)
        if (name.length < 2) {
          return;
        }

        // Skip if it's just numbers
        if (/^\d+$/.test(name)) {
          return;
        }

        // Skip if it's a header row
        if (headerPatterns.some(pattern => nameLower.includes(pattern))) {
          return;
        }

        // Add to map (will deduplicate automatically)
        if (!peopleMap.has(name)) {
          peopleMap.set(name, {
            name: name,
            class: colDef.name,
            type: colDef.type
          });
        }
      });
    });
  });

  const people = Array.from(peopleMap.values());
  console.log(`Found ${people.length} unique people across ${sheets.length} sheets`);

  return people;
}

// =====================
// SHEET PROCESSING
// =====================

/**
 * Process a single sheet for all people
 * Returns: { personName: { events: [] }, ... }
 */
function processSheet(sheetInfo, people) {
  const sheet = sheetInfo.sheet;
  const results = {};

  // Initialize results for all people
  people.forEach(person => {
    results[person.name] = { events: [] };
  });

  // Read all sections ONCE
  const allData = {
    supervision: sheet.getRange('A1:N9').getDisplayValues(),
    flying: sheet.getRange('A11:R52').getDisplayValues(),
    ground: sheet.getRange('A54:M80').getDisplayValues(),
    na: sheet.getRange('A82:K113').getDisplayValues()
  };

  // Process each section for all people
  people.forEach(person => {
    const events = [];

    // Parse supervision
    const supervisionEvents = parseSupervisionForPerson(person.name, allData.supervision, sheetInfo.date);
    events.push(...supervisionEvents);

    // Parse flying
    const flyingEvents = parseFlyingForPerson(person.name, allData.flying, sheetInfo.date);
    events.push(...flyingEvents);

    // Parse ground
    const groundEvents = parseGroundForPerson(person.name, allData.ground, sheetInfo.date);
    events.push(...groundEvents);

    // Parse NA
    const naEvents = parseNAForPerson(person.name, allData.na, sheetInfo.date);
    events.push(...naEvents);

    results[person.name].events = events;
  });

  return results;
}

// =====================
// SECTION PARSERS
// =====================

/**
 * Parse supervision section for a specific person
 */
function parseSupervisionForPerson(searchName, supervisionData, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  supervisionData.forEach((row, rowIndex) => {
    const dutyType = row[0];
    if (!dutyType) return;

    // Parse time slots (groups of 3: POC, Start, End)
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
          rangeSource: 'Supervision',
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
function parseFlyingForPerson(searchName, flyingData, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  flyingData.forEach((row, rowIndex) => {
    const rowText = row.join('|').toLowerCase();
    if (!rowText.includes(searchLower)) return;

    const model = row[0];
    const briefStart = row[1];
    const etd = row[2];
    const eta = row[3];
    const debriefEnd = row[4];
    const event = row[5];

    const crewColumns = row.slice(6, -3);
    const crew = crewColumns.filter(c => c && c !== '');

    const effective = parseBoolean(row[row.length - 3]);
    const cancelled = parseBoolean(row[row.length - 2]);
    const partiallyEffective = parseBoolean(row[row.length - 1]);

    matches.push({
      date: date,
      time: briefStart,
      type: 'Flying Events',
      description: [model, event, ...crew].filter(x => x).join(' | '),
      rangeSource: 'Flying Events',
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
 * Parse ground events for a specific person
 */
function parseGroundForPerson(searchName, groundData, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  groundData.forEach((row, rowIndex) => {
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
      rangeSource: 'Ground Events',
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
 * Parse NA section for a specific person
 */
function parseNAForPerson(searchName, naData, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  naData.forEach((row, rowIndex) => {
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
      rangeSource: 'NA',
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

/**
 * Parse boolean from checkbox value
 */
function parseBoolean(value) {
  if (!value) return false;
  const valStr = String(value).toUpperCase().trim();
  return valStr === 'TRUE' || valStr === '✓' || valStr === 'X' || valStr === '✔';
}

// =====================
// METRICS LOGGING
// =====================

/**
 * Log metrics to a spreadsheet for tracking
 */
function logMetricsToSheet(metrics) {
  try {
    const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
    let logSheet = ss.getSheetByName('BatchProcessingLog');

    // Create log sheet if it doesn't exist
    if (!logSheet) {
      logSheet = ss.insertSheet('BatchProcessingLog');
      logSheet.appendRow([
        'Timestamp',
        'Duration (s)',
        'Sheets Processed',
        'People Processed',
        'Events Found',
        'Cache Size (MB)',
        'Avg Person Size (KB)',
        'Errors',
        'Status'
      ]);
      logSheet.getRange('A1:I1').setFontWeight('bold');
    }

    // Add metrics row
    logSheet.appendRow([
      metrics.startTime,
      metrics.totalDuration.toFixed(2),
      metrics.sheetsProcessed,
      metrics.peopleProcessed,
      metrics.eventsFound,
      (metrics.cacheSize / 1024 / 1024).toFixed(2),
      (metrics.cacheSize / metrics.peopleProcessed / 1024).toFixed(2),
      metrics.errors.length,
      metrics.errors.length === 0 ? 'SUCCESS' : 'ERRORS'
    ]);

  } catch (e) {
    console.error('Could not log to sheet:', e);
  }
}

// =====================
// TESTING FUNCTIONS
// =====================

/**
 * Test the batch processor with detailed metrics
 */
function testBatchProcessor() {
  console.log('=== Testing Batch Processor ===\n');

  const result = batchProcessAllSchedules();

  console.log('\n=== Detailed Sheet Metrics ===');
  result.sheetMetrics.forEach(sm => {
    console.log(`${sm.sheet}: ${sm.duration.toFixed(2)}s, ${sm.eventsFound} events`);
  });

  console.log('\n=== Top 10 Largest Caches ===');
  const sortedPeople = result.personMetrics.sort((a, b) => b.sizeKB - a.sizeKB);
  sortedPeople.slice(0, 10).forEach(pm => {
    console.log(`${pm.name}: ${pm.sizeKB} KB, ${pm.events} events`);
  });

  console.log('\n=== Cache Size Analysis ===');
  const totalSizeMB = result.cacheSize / 1024 / 1024;
  const avgSizeKB = result.cacheSize / result.peopleProcessed / 1024;
  const maxSizeKB = Math.max(...result.personMetrics.map(p => p.sizeKB));

  console.log(`Total: ${totalSizeMB.toFixed(2)} MB`);
  console.log(`Average: ${avgSizeKB.toFixed(2)} KB per person`);
  console.log(`Maximum: ${maxSizeKB.toFixed(2)} KB`);
  console.log(`CacheService limit: 1024 KB per entry, 10 MB total`);
  console.log(`Within limits: ${maxSizeKB < 1024 ? 'YES ✓' : 'NO ✗'}`);

  return result;
}

/**
 * Test cache retrieval speed
 */
function testCacheRetrievalSpeed() {
  console.log('=== Testing Cache Retrieval Speed ===\n');

  const cache = CacheService.getScriptCache();
  const people = ['Vantiger', 'Payne', 'Sick', 'Coleman', 'Lovell'];

  people.forEach(name => {
    const start = new Date();
    const cached = cache.get(`schedule_${name}`);
    const duration = new Date() - start;

    if (cached) {
      const data = JSON.parse(cached);
      const sizeKB = (Utilities.newBlob(cached).getBytes().length / 1024).toFixed(2);
      console.log(`${name}: ${duration}ms, ${sizeKB} KB, ${data.events.length} events`);
    } else {
      console.log(`${name}: CACHE MISS`);
    }
  });
}

/**
 * Clear all caches (for testing)
 */
function clearAllCaches() {
  const cache = CacheService.getScriptCache();
  const people = getAllPeople();

  console.log(`Clearing cache for ${people.length} people...`);

  people.forEach(person => {
    cache.remove(`schedule_${person.name}`);
  });

  cache.remove('batch_metadata');

  console.log('✓ All caches cleared');
}

/**
 * Get current batch metadata
 */
function getBatchMetadata() {
  const cache = CacheService.getScriptCache();
  const metadata = cache.get('batch_metadata');

  if (metadata) {
    console.log(JSON.parse(metadata));
  } else {
    console.log('No batch metadata found');
  }
}

/**
 * Test batch processor with FIXED TEST DATES (Dec 15-19, 2025)
 * Use this during development/testing when today's sheets don't exist
 */
function testBatchProcessorWithTestDates() {
  console.log('=== Testing Batch Processor (Fixed Test Dates: Dec 15-19, 2025) ===\n');

  // Override getRelevantSheets to use test dates
  const originalGetRelevantSheets = getRelevantSheets;

  // Temporarily replace with test date version
  getRelevantSheets = function() {
    const testStartDate = new Date('2025-12-15'); // Monday, Dec 15, 2025
    return originalGetRelevantSheets(testStartDate);
  };

  try {
    const result = batchProcessAllSchedules();

    console.log('\n=== Detailed Sheet Metrics ===');
    result.sheetMetrics.forEach(sm => {
      console.log(`${sm.sheet}: ${sm.duration.toFixed(2)}s, ${sm.eventsFound} events`);
    });

    console.log('\n=== Top 10 Largest Caches ===');
    const sortedPeople = result.personMetrics.sort((a, b) => b.sizeKB - a.sizeKB);
    sortedPeople.slice(0, 10).forEach(pm => {
      console.log(`${pm.name}: ${pm.sizeKB} KB, ${pm.events} events`);
    });

    console.log('\n=== Cache Size Analysis ===');
    const totalSizeMB = result.cacheSize / 1024 / 1024;
    const avgSizeKB = result.cacheSize / result.peopleProcessed / 1024;
    const maxSizeKB = Math.max(...result.personMetrics.map(p => p.sizeKB));

    console.log(`Total: ${totalSizeMB.toFixed(2)} MB`);
    console.log(`Average: ${avgSizeKB.toFixed(2)} KB per person`);
    console.log(`Maximum: ${maxSizeKB.toFixed(2)} KB`);
    console.log(`CacheService limit: 1024 KB per entry, 10 MB total`);
    console.log(`Within limits: ${maxSizeKB < 1024 ? 'YES ✓' : 'NO ✗'}`);

    return result;

  } finally {
    // Restore original function
    getRelevantSheets = originalGetRelevantSheets;
  }
}
