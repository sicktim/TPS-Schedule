/**
 * TPS Schedule - Batch Processor
 *
 * Pre-processes all schedules and caches results for instant retrieval.
 * Runs every 15 minutes during work hours, automatically skips overnight.
 *
 * TRIGGER CONFIGURATION:
 * - Single trigger: Every 15 minutes
 * - Processes: All 7 days of schedules
 * - Overnight skip: 8 PM - 5 AM Pacific (saves 36% quota)
 * - Quota usage: ~54 min/day (60% of 90 min daily limit)
 *
 * DATA FRESHNESS:
 * - All days: Up to 15 minutes old (during work hours)
 * - Overnight: Up to ~9 hours old (until 5 AM)
 *
 * Cache Limits (Google Apps Script):
 * - CacheService: 1MB per entry, 10MB total, 6 hour max TTL
 * - PropertiesService: 500KB TOTAL (all properties combined), persistent
 * - Recommendation: Use CacheService primary, Spreadsheet backup
 */

// ====================
// BATCH PROCESSOR
// ====================

/**
 * Check if current time is in overnight hours (8 PM - 5 AM Pacific)
 * During these hours, schedules are not updated, so skip batch processing
 * @returns {boolean} True if overnight hours, false otherwise
 */
function isOvernightHours() {
  const now = new Date();
  const pacificTimeStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, 'HH');
  const pacificHour = parseInt(pacificTimeStr);

  // Overnight hours: 8 PM (20) to 5 AM (4)
  return pacificHour >= 20 || pacificHour < 5;
}

/**
 * Main batch processor - processes all upcoming schedule days
 * Run this every 15 minutes via time-based trigger
 *
 * Uses smart sheet finding to automatically start from the next available sheet
 * (handles gaps due to weekends, holidays, etc.)
 *
 * Skips processing during overnight hours (8 PM - 5 AM Pacific) to save quota
 */
function batchProcessSchedule() {
  // Skip processing during overnight hours (schedules don't change)
  if (isOvernightHours()) {
    const now = new Date();
    const pacificTimeStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, 'hh:mm a');
    console.log(`⏸️  Skipping batch process - overnight hours (${pacificTimeStr} Pacific)`);
    console.log('   Next update: 5:00 AM Pacific');
    return {
      skipped: true,
      reason: 'overnight_hours',
      time: pacificTimeStr
    };
  }

  return batchProcessAll(7); // Process 7 days worth of schedules
}

/**
 * Process all upcoming schedule days using smart sheet finding
 * @param {number} daysToProcess - Number of days to process
 */
function batchProcessAll(daysToProcess = 7) {
  const metrics = {
    startTime: new Date(),
    tier: 'all',
    dayRange: `smart-${daysToProcess}days`,
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
    console.log(`\n=== Starting Batch Processing (Smart Sheet Finding) ===`);
    console.log(`Requested: ${daysToProcess} days worth of schedules`);

    const cache = CacheService.getScriptCache();

    // Use smart sheet finding to get available sheets
    const sheets = getSmartSheetRange(daysToProcess);
    console.log(`Found ${sheets.length} available sheets\n`);

    if (sheets.length === 0) {
      console.warn('No sheets found - cannot process');
      return metrics;
    }

    // Get all people
    const people = getAllPeople();
    console.log(`Processing ${people.length} people...`);

    if (people.length === 0) {
      throw new Error('No people found');
    }

    // Clear old cached data first (prevents stale cache)
    const previousPeopleJson = cache.get('batch_people_list');
    if (previousPeopleJson) {
      const previousPeople = JSON.parse(previousPeopleJson);
      console.log(`Clearing ${previousPeople.length} old cache entries...`);
      previousPeople.forEach(name => {
        cache.remove(`schedule_${name}`);
      });
    }

    // Process each sheet
    const allSchedules = {}; // personName -> { events: [], days: [] }

    sheets.forEach(sheetInfo => {
      const sheetStart = new Date();

      try {
        console.log(`\nProcessing sheet: ${sheetInfo.sheetName} (${sheetInfo.date})`);
        const sheetResults = processSheet(sheetInfo, people);

        // Merge results
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

        console.log(`  Completed in ${sheetDuration.toFixed(2)}s`);

      } catch (error) {
        const errorMsg = `Sheet ${sheetInfo.sheetName}: ${error.toString()}`;
        console.error(`  ERROR: ${errorMsg}`);
        metrics.errors.push(errorMsg);
      }
    });

    metrics.sheetsProcessed = sheets.length;

    // Cache results
    console.log('\n=== Updating Caches ===');
    const updateTimestamp = new Date().toISOString();
    const cachedPeopleNames = [];

    people.forEach(person => {
      const schedule = allSchedules[person.name];

      if (schedule && schedule.events.length > 0) {
        const cacheData = {
          person: person.name,
          class: person.class || '',
          type: person.type || '',
          events: schedule.events,
          days: schedule.days.sort(),
          lastUpdated: updateTimestamp,
          version: '5.0-smart',
          tier: 'all',
          dayRange: `${daysToProcess} days`
        };

        const json = JSON.stringify(cacheData);
        const cacheKey = `schedule_${person.name}`;

        cache.put(cacheKey, json, 21600); // 6 hours
        cachedPeopleNames.push(person.name);

        metrics.eventsFound += schedule.events.length;
        metrics.cacheSize += Utilities.newBlob(json).getBytes().length;

        metrics.personMetrics.push({
          person: person.name,
          eventsFound: schedule.events.length,
          daysWithEvents: schedule.days.length,
          cacheSize: json.length
        });
      }
    });

    metrics.peopleProcessed = people.length;

    // Store people list for next cleanup
    cache.put('batch_people_list', JSON.stringify(cachedPeopleNames), 21600);

    // Store metadata
    const completionTime = new Date();
    metrics.totalDuration = (completionTime - metrics.startTime) / (1000 * 60); // minutes

    const metadata = {
      lastRun: completionTime.toISOString(),
      startTime: metrics.startTime.toISOString(),
      tier: 'all',
      dayRange: `smart-${daysToProcess}days`,
      duration: metrics.totalDuration,
      sheetsProcessed: metrics.sheetsProcessed,
      peopleProcessed: metrics.peopleProcessed,
      eventsFound: metrics.eventsFound,
      cacheSizeMB: (metrics.cacheSize / (1024 * 1024)).toFixed(2),
      errors: metrics.errors.length
    };

    cache.put('batch_metadata', JSON.stringify(metadata), 21600);

    // Log summary
    console.log('\n=== Batch Processing Complete ===');
    console.log(`Duration: ${metrics.totalDuration.toFixed(2)} minutes`);
    console.log(`Sheets processed: ${metrics.sheetsProcessed}`);
    console.log(`People processed: ${metrics.peopleProcessed}`);
    console.log(`Events found: ${metrics.eventsFound}`);
    console.log(`Cache size: ${metadata.cacheSizeMB} MB`);
    console.log(`Errors: ${metrics.errors.length}`);

    if (metrics.errors.length > 0) {
      console.log('\nErrors:');
      metrics.errors.forEach(err => console.log(`  • ${err}`));
    }

    return metrics;

  } catch (error) {
    console.error('❌ FATAL ERROR in batch processing:');
    console.error(error.toString());
    console.error(error.stack);
    metrics.errors.push(`FATAL: ${error.toString()}`);
    throw error;
  }
}

/**
 * Generic batch processor for a specific day range (LEGACY - kept for backwards compatibility)
 * @param {number} startDay - Day offset to start (0 = today)
 * @param {number} endDay - Day offset to end (exclusive)
 * @param {string} tier - Tier name ('recent' or 'upcoming')
 */
function batchProcessDayRange(startDay, endDay, tier) {
  const metrics = {
    startTime: new Date(),
    tier: tier,
    dayRange: `${startDay}-${endDay-1}`,
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
    console.log(`\n=== Starting Batch Processing [${tier.toUpperCase()}] ===`);

    const cache = CacheService.getScriptCache();

    // Use smart sheet finding to get available sheets
    // This finds the next available sheet and gets N days from there
    const daysToProcess = endDay - startDay;
    const sheets = getSmartSheetRange(daysToProcess);
    console.log(`Processing ${sheets.length} sheets (requested ${daysToProcess} days)...`);

    if (sheets.length === 0) {
      console.warn('No sheets found for this day range');
      return metrics;
    }

    // Get all people (need to process all people for each tier)
    const people = getAllPeople();
    console.log(`Processing ${people.length} people...`);

    if (people.length === 0) {
      throw new Error('No people found');
    }

    // Process each sheet
    const allSchedules = {}; // personName -> { events: [], days: [] }

    sheets.forEach(sheetInfo => {
      const sheetStart = new Date();

      try {
        console.log(`\nProcessing sheet: ${sheetInfo.sheetName}`);
        const sheetResults = processSheet(sheetInfo, people);

        // Merge results
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

    // Update caches with per-day freshness
    console.log('\n=== Updating Caches ===');
    const updateTimestamp = new Date().toISOString();

    people.forEach(person => {
      const personStart = new Date();

      try {
        // Get existing cache (if any) to merge with
        const existingCacheJson = cache.get(`schedule_${person.name}`);
        let existingData = existingCacheJson ? JSON.parse(existingCacheJson) : null;

        const schedule = allSchedules[person.name] || { events: [], days: [] };

        // Build result with per-day freshness tracking
        const result = {
          person: person.name,
          class: person.class,
          type: person.type,
          events: schedule.events,
          days: schedule.days.sort(),
          lastUpdated: updateTimestamp,
          version: '5.0-batch-tiered',
          tier: tier,
          dayRange: `days ${startDay}-${endDay-1}`,
          freshnessTimestamp: updateTimestamp
        };

        // If merging with existing data from other tiers, combine events
        if (existingData && existingData.events) {
          // Remove events from this day range, keep others
          const daysInThisRange = new Set(schedule.days);
          const otherEvents = existingData.events.filter(e => {
            const eventDateStr = e.date || `${e.day} ${e.date}`; // Approximate
            return !schedule.days.some(d => eventDateStr.includes(d));
          });

          result.events = [...otherEvents, ...schedule.events];
          result.days = [...new Set([...existingData.days || [], ...schedule.days])].sort();
        }

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

        if (sizeBytes > 100000) {
          console.log(`⚠ Large cache for ${person.name}: ${sizeKB} KB`);
        }

      } catch (e) {
        console.error(`✗ Error caching ${person.name}: ${e}`);
        metrics.errors.push({ person: person.name, error: e.toString() });
      }
    });

    const completionTime = new Date();
    metrics.totalDuration = (completionTime - metrics.startTime) / 1000;

    // Store tier-specific metadata
    const metadata = {
      lastRun: completionTime.toISOString(),
      startTime: metrics.startTime.toISOString(),
      tier: tier,
      dayRange: metrics.dayRange,
      duration: metrics.totalDuration,
      sheetsProcessed: metrics.sheetsProcessed,
      peopleProcessed: metrics.peopleProcessed,
      eventsFound: metrics.eventsFound,
      totalCacheSizeMB: (metrics.cacheSize / 1024 / 1024).toFixed(2),
      errors: metrics.errors.length
    };

    cache.put(`batch_metadata_${tier}`, JSON.stringify(metadata), 21600);

    // Log summary
    console.log(`\n=== Batch Processing Complete [${tier.toUpperCase()}] ===`);
    console.log(`Day Range: ${startDay}-${endDay-1}`);
    console.log(`Total Duration: ${metrics.totalDuration.toFixed(2)}s`);
    console.log(`Sheets Processed: ${metrics.sheetsProcessed}/${sheets.length}`);
    console.log(`People Processed: ${metrics.peopleProcessed}/${people.length}`);
    console.log(`Events Found: ${metrics.eventsFound}`);
    console.log(`Errors: ${metrics.errors.length}`);

    return metrics;

  } catch (e) {
    console.error(`FATAL ERROR in ${tier} batch processing:`, e);
    metrics.errors.push({ fatal: true, error: e.toString() });
    metrics.totalDuration = (new Date() - metrics.startTime) / 1000;
    throw e;
  }
}

// ====================
// LEGACY BATCH PROCESSOR (ALL DAYS)
// ====================

/**
 * Legacy function to batch process all schedules (all 7 days at once)
 * Use the tiered functions above for better quota management
 * Call this from a time-based trigger (every 1-2 hours)
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

    // 0. Clear ALL existing caches to prevent stale data
    // This ensures removed people don't stay cached indefinitely
    const cache = CacheService.getScriptCache();

    // Get list of previously cached people
    const previousPeopleJson = cache.get('batch_people_list');
    if (previousPeopleJson) {
      const previousPeople = JSON.parse(previousPeopleJson);
      console.log(`Removing ${previousPeople.length} previous cache entries...`);
      previousPeople.forEach(name => {
        cache.remove(`schedule_${name}`);
      });
      console.log('✓ Cleared all existing caches (prevents stale data)');
    }

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
    // (cache already declared above for cleanup)
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

    const completionTime = new Date();
    metrics.totalDuration = (completionTime - metrics.startTime) / 1000;

    // 5. Store batch metadata and people list
    const metadata = {
      lastRun: completionTime.toISOString(), // Use completion time, not start time
      startTime: metrics.startTime.toISOString(),
      duration: metrics.totalDuration,
      sheetsProcessed: metrics.sheetsProcessed,
      peopleProcessed: metrics.peopleProcessed,
      eventsFound: metrics.eventsFound,
      totalCacheSizeMB: (metrics.cacheSize / 1024 / 1024).toFixed(2),
      averagePersonSizeKB: (metrics.cacheSize / metrics.peopleProcessed / 1024).toFixed(2),
      errors: metrics.errors.length
    };

    cache.put('batch_metadata', JSON.stringify(metadata), 21600);

    // Store list of cached people (for cleanup on next run)
    const cachedPeopleNames = people.map(p => p.name);
    cache.put('batch_people_list', JSON.stringify(cachedPeopleNames), 21600);

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
 * Get list of date sheets within a specific day range
 * @param {number} startDayOffset - Days from today to start (0 = today)
 * @param {number} endDayOffset - Days from today to end (inclusive)
 * @param {Date} baseDate - Optional: Base date for testing (default: today)
 * @returns {Array} Array of sheet objects within the range
 */
function getRelevantSheets(startDayOffset = 0, endDayOffset = 7, baseDate = null) {
  const sheets = [];
  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const today = baseDate || new Date();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Process each day in the range
  for (let dayOffset = startDayOffset; dayOffset < endDayOffset; dayOffset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayOffset);

    const dayName = dayNames[targetDate.getDay()];
    const dayNameShort = dayNamesShort[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const day = targetDate.getDate();

    // Try multiple sheet name formats
    const sheetName1 = `${dayNameShort} ${day} ${monthName}`;  // "Mon 15 Dec" (most common)
    const sheetName2 = `${dayName}, ${day} ${monthName}`;      // "Monday, 15 Dec"
    const sheetName3 = `${dayName} ${monthName} ${day}`;       // "Monday Dec 15"
    const sheetName4 = `${dayName} ${day} ${monthName}`;       // "Monday 15 Dec"

    let sheet = ss.getSheetByName(sheetName1) ||
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
    } else {
      console.warn(`Sheet not found for day +${dayOffset}: Tried "${sheetName1}", "${sheetName2}", "${sheetName3}", "${sheetName4}"`);
    }
  }

  console.log(`Found ${sheets.length} date sheets (days ${startDayOffset}-${endDayOffset-1}): ${sheets.map(s => s.sheetName).join(', ')}`);

  return sheets;
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
  // Use smart sheet finding to get available sheets
  const sheets = getSmartSheetRange(7);
  if (sheets.length === 0) {
    throw new Error('No sheets found - check if any schedule sheets exist');
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

    // Add academics for students
    // Note: Frontend can choose to show/hide via settings
    if (person.class || person.type) {
      const personType = person.class || person.type;
      const academics = getAcademicsForStudent_Batch(personType, sheetInfo.date);
      events.push(...academics);
    }

    // Add grouped events
    // Note: Frontend can choose to show/hide via settings
    if (person.class || person.type) {
      const personType = person.class || person.type;
      const groupedEvents = getGroupedEventsForPerson_Batch(sheet, allData, personType, sheetInfo.date);
      events.push(...groupedEvents);
    }

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

// ==========================================
// ACADEMICS AND GROUPED EVENTS (for batch)
// ==========================================

/**
 * Get academics for a student (batch processor version)
 * Identical to Enhanced.gs version
 */
function getAcademicsForStudent_Batch(personType, date) {
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
 * Get grouped events (ALL, STAFF ONLY) for batch processor
 * Uses pre-read allData arrays for efficiency
 */
function getGroupedEventsForPerson_Batch(sheet, allData, personType, date) {
  const groupedEvents = [];

  // Parse ground events for groups
  groupedEvents.push(...parseGroundEventsForGroups_Batch(allData.ground, personType, date));

  // Parse flying events for groups
  groupedEvents.push(...parseFlyingEventsForGroups_Batch(allData.flying, personType, date));

  // Parse supervision for groups
  groupedEvents.push(...parseSupervisionForGroups_Batch(allData.supervision, personType, date));

  return groupedEvents;
}

/**
 * Parse ground events data for group indicators
 */
function parseGroundEventsForGroups_Batch(groundData, personType, date) {
  const matches = [];

  groundData.forEach((row, rowIndex) => {
    const event = row[0];  // A: Event
    const start = row[1];  // B: Start
    const end = row[2];    // C: End

    if (!event && !start) return;

    // People in columns D onwards (index 3+)
    const peopleColumns = row.slice(3);

    peopleColumns.forEach(person => {
      if (!person) return;
      const personUpper = person.toUpperCase();

      if (personUpper === 'ALL' || personUpper === 'STAFF ONLY' || personUpper === 'STAFF_ONLY') {
        if (shouldShowGroupedEvent_Batch(person, personType)) {
          matches.push({
            date: date,
            time: start,
            type: 'Ground Events',
            description: `${event} | ${person}`,
            rangeSource: 'Ground Events',
            enhanced: {
              section: 'Ground Events',
              event: event,
              start: start,
              end: end,
              groupType: person,
              status: {
                effective: true,
                cancelled: false,
                partiallyEffective: false
              }
            }
          });
        }
      }
    });
  });

  return matches;
}

/**
 * Parse flying events data for group indicators
 */
function parseFlyingEventsForGroups_Batch(flyingData, personType, date) {
  const matches = [];

  flyingData.forEach((row, rowIndex) => {
    const model = row[0];       // A: Model
    const briefStart = row[1];  // B: Brief
    const etd = row[2];         // C: ETD
    const eta = row[3];         // D: ETA
    const debriefEnd = row[4];  // E: Debrief
    const event = row[5];       // F: Event

    if (!model && !event) return;

    // Crew in columns G onwards (index 6+)
    const crewColumns = row.slice(6);

    crewColumns.forEach(crew => {
      if (!crew) return;
      const crewUpper = crew.toUpperCase();

      if (crewUpper === 'ALL' || crewUpper === 'STAFF ONLY' || crewUpper === 'STAFF_ONLY') {
        if (shouldShowGroupedEvent_Batch(crew, personType)) {
          matches.push({
            date: date,
            time: briefStart,
            type: 'Flying Events',
            description: `${model} | ${event} | ${crew}`,
            rangeSource: 'Flying Events',
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
                effective: true,
                cancelled: false,
                partiallyEffective: false
              }
            }
          });
        }
      }
    });
  });

  return matches;
}

/**
 * Parse supervision data for group indicators
 */
function parseSupervisionForGroups_Batch(supervisionData, personType, date) {
  const matches = [];

  supervisionData.forEach((row, rowIndex) => {
    const dutyType = row[0];
    if (!dutyType || dutyType === '' || dutyType === 'Supervision') return;

    // Time slots (POC, Start, End) repeating
    for (let col = 1; col < row.length - 2; col += 3) {
      const poc = row[col];
      const start = row[col + 1];
      const end = row[col + 2];

      if (!poc && !start && !end) continue;

      if (poc) {
        const pocUpper = poc.toUpperCase();

        if (pocUpper === 'ALL' || pocUpper === 'STAFF ONLY' || pocUpper === 'STAFF_ONLY') {
          if (shouldShowGroupedEvent_Batch(poc, personType)) {
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
                isAuth: isAuth,
                groupType: poc
              }
            });
          }
        }
      }
    }
  });

  return matches;
}

/**
 * Check if person should see grouped event (batch version)
 * Identical logic to Enhanced.gs version
 */
function shouldShowGroupedEvent_Batch(eventType, personType) {
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

  return false;
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
 * View ALL cached data for troubleshooting
 *
 * Shows:
 * - All cached people and their event counts
 * - Cache sizes and metadata
 * - Batch processing info
 * - Specific person's full schedule (optional)
 *
 * Usage:
 *   viewAllCachedData();              // Show summary of all cached data
 *   viewAllCachedData('Vantiger');     // Show Vantiger's full cached schedule
 */
function viewAllCachedData(personName = null) {
  console.log('='.repeat(70));
  console.log('📦 CACHE VIEWER - All Cached Data');
  console.log('='.repeat(70));

  const cache = CacheService.getScriptCache();

  // 1. Get batch metadata
  console.log('\n📊 BATCH METADATA:');
  console.log('-'.repeat(70));
  const metadata = cache.get('batch_metadata');
  if (metadata) {
    const meta = JSON.parse(metadata);
    console.log(`Last Run: ${meta.lastRun}`);
    console.log(`Duration: ${meta.duration}s`);
    console.log(`People Processed: ${meta.peopleProcessed}`);
    console.log(`Events Found: ${meta.eventsFound}`);
    console.log(`Sheets Processed: ${meta.sheetsProcessed}`);
    console.log(`Total Cache Size: ${meta.totalCacheSizeMB} MB`);
    console.log(`Average Per Person: ${meta.averagePersonSizeKB} KB`);
    console.log(`Errors: ${meta.errors}`);
  } else {
    console.log('⚠️  No batch metadata found (batch processing may not have run yet)');
  }

  // 2. Get all people
  console.log('\n👥 CACHED PEOPLE:');
  console.log('-'.repeat(70));

  try {
    const people = getAllPeople();
    console.log(`Total people in sheets: ${people.length}`);

    let cachedCount = 0;
    let totalEvents = 0;
    let totalSize = 0;
    const cachedPeople = [];

    people.forEach(person => {
      const cached = cache.get(`schedule_${person.name}`);

      if (cached) {
        cachedCount++;
        const data = JSON.parse(cached);
        const sizeBytes = Utilities.newBlob(cached).getBytes().length;
        const sizeKB = (sizeBytes / 1024).toFixed(2);

        totalEvents += data.events ? data.events.length : 0;
        totalSize += sizeBytes;

        cachedPeople.push({
          name: person.name,
          class: person.class,
          type: person.type,
          events: data.events ? data.events.length : 0,
          days: data.days ? data.days.length : 0,
          sizeKB: parseFloat(sizeKB),
          lastUpdated: data.lastUpdated || 'Unknown'
        });
      }
    });

    console.log(`\nCached: ${cachedCount}/${people.length} people`);
    console.log(`Total events in cache: ${totalEvents}`);
    console.log(`Total cache size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // 3. Show top 10 largest caches
    console.log('\n🔝 TOP 10 LARGEST CACHES:');
    console.log('-'.repeat(70));
    const sortedBySize = cachedPeople.sort((a, b) => b.sizeKB - a.sizeKB);
    sortedBySize.slice(0, 10).forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name.padEnd(20)} - ${p.events} events, ${p.sizeKB} KB, ${p.class}`);
    });

    // 4. Show top 10 most events
    console.log('\n📅 TOP 10 MOST EVENTS:');
    console.log('-'.repeat(70));
    const sortedByEvents = [...cachedPeople].sort((a, b) => b.events - a.events);
    sortedByEvents.slice(0, 10).forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name.padEnd(20)} - ${p.events} events across ${p.days} days`);
    });

    // 5. Show people with NO cache
    const missingCache = people.filter(p => !cache.get(`schedule_${p.name}`));
    if (missingCache.length > 0) {
      console.log('\n⚠️  PEOPLE WITHOUT CACHE:');
      console.log('-'.repeat(70));
      missingCache.forEach(p => {
        console.log(`- ${p.name} (${p.class})`);
      });
    }

    // 6. If specific person requested, show their full data
    if (personName) {
      console.log('\n'.repeat(2));
      console.log('='.repeat(70));
      console.log(`📋 DETAILED VIEW: ${personName}`);
      console.log('='.repeat(70));

      const personCache = cache.get(`schedule_${personName}`);

      if (personCache) {
        const data = JSON.parse(personCache);
        const sizeBytes = Utilities.newBlob(personCache).getBytes().length;

        console.log(`\nPerson: ${data.person}`);
        console.log(`Class: ${data.class}`);
        console.log(`Type: ${data.type}`);
        console.log(`Last Updated: ${data.lastUpdated}`);
        console.log(`Version: ${data.version || 'Unknown'}`);
        console.log(`Days Covered: ${data.days ? data.days.join(', ') : 'None'}`);
        console.log(`Total Events: ${data.events ? data.events.length : 0}`);
        console.log(`Cache Size: ${(sizeBytes / 1024).toFixed(2)} KB`);

        if (data.events && data.events.length > 0) {
          console.log('\n📅 EVENTS:');
          console.log('-'.repeat(70));

          // Group by day
          const byDay = {};
          data.events.forEach(evt => {
            const day = evt.date || 'Unknown';
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(evt);
          });

          Object.keys(byDay).sort().forEach(day => {
            console.log(`\n${day}:`);
            byDay[day].forEach(evt => {
              const time = evt.time || 'TBD';
              const desc = evt.description || evt.type || 'No description';
              const section = evt.enhanced ? evt.enhanced.section : evt.type;
              console.log(`  ${time.padEnd(12)} [${section.padEnd(15)}] ${desc.substring(0, 60)}`);
            });
          });
        }

        console.log('\n📄 FULL JSON:');
        console.log('-'.repeat(70));
        console.log(JSON.stringify(data, null, 2));

      } else {
        console.log(`\n❌ No cached data found for "${personName}"`);
        console.log('\nDid you mean one of these?');
        const similar = people
          .filter(p => p.name.toLowerCase().includes(personName.toLowerCase()))
          .slice(0, 5);
        similar.forEach(p => console.log(`  - ${p.name} (${p.class})`));
      }
    }

  } catch (e) {
    console.error(`Error reading cache: ${e}`);
    console.error(e.stack);
  }

  console.log('\n' + '='.repeat(70));
  console.log('💡 TIP: Run viewAllCachedData("PersonName") to see full details for someone');
  console.log('='.repeat(70));
}

/**
 * Test TIERED batch processors with FIXED TEST DATES (Jan 5, 2026+)
 * Tests the two-tier system with proper day ranges
 */
function testTieredBatchProcessing() {
  console.log('=== Testing TIERED Batch Processing (Start: Jan 5, 2026) ===\n');

  const testStartDate = new Date('2026-01-05'); // Sunday, Jan 5, 2026

  // Override getRelevantSheets to use test dates
  const originalGetRelevantSheets = this.getRelevantSheets;

  this.getRelevantSheets = function(startDay, endDay) {
    return originalGetRelevantSheets(startDay, endDay, testStartDate);
  };

  try {
    // Test RECENT tier (days 0-2)
    console.log('\n===  TESTING TIER 1: RECENT (Days 0-2) ===');
    const recentMetrics = batchProcessRecent();

    console.log('\n=== TESTING TIER 2: UPCOMING (Days 3-7) ===');
    const upcomingMetrics = batchProcessUpcoming();

    console.log('\n=== COMBINED RESULTS ===');
    console.log(`Recent: ${recentMetrics.sheetsProcessed} sheets, ${recentMetrics.eventsFound} events, ${recentMetrics.totalDuration.toFixed(2)}s`);
    console.log(`Upcoming: ${upcomingMetrics.sheetsProcessed} sheets, ${upcomingMetrics.eventsFound} events, ${upcomingMetrics.totalDuration.toFixed(2)}s`);
    console.log(`Total Duration: ${(recentMetrics.totalDuration + upcomingMetrics.totalDuration).toFixed(2)}s`);

  } finally {
    // Restore original function
    this.getRelevantSheets = originalGetRelevantSheets;
  }
}

/**
 * Test batch processor with FIXED TEST DATES (Jan 5, 2026+)
 * Use this during development/testing when today's sheets don't exist
 */
function testBatchProcessorWithTestDates() {
  console.log('=== Testing Batch Processor (Fixed Test Dates: Jan 5-11, 2026) ===\n');

  const testStartDate = new Date('2026-01-05'); // Sunday, Jan 5, 2026

  // Override getRelevantSheets to use test dates
  const originalGetRelevantSheets = this.getRelevantSheets;

  this.getRelevantSheets = function(startDay = 0, endDay = 7) {
    return originalGetRelevantSheets(startDay, endDay, testStartDate);
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
