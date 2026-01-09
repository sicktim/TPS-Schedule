/**
 * TPS Schedule - Batch Processor
 *
 * Pre-processes all schedules and caches results for instant retrieval.
 * Runs every 15 minutes during work hours, automatically skips overnight.
 *
 * TRIGGER CONFIGURATION:
 * - 15-minute trigger: batchProcessSchedule() - skips overnight hours
 * - Daily 2 AM trigger: overnightCacheRefresh() - keeps cache alive overnight
 * - Overnight skip: 8 PM - 7 AM Pacific (saves quota)
 *
 * Cache Limits (Google Apps Script):
 * - CacheService: 1MB per entry, 10MB total, 6 hour max TTL
 * - The 2 AM refresh prevents cache expiration during 11-hour overnight skip
 */

/**
 * Check if current time is in overnight hours (8 PM - 7 AM Pacific)
 * @returns {boolean} True if overnight hours
 */
function isOvernightHours() {
  const now = new Date();
  const pacificTimeStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, 'HH');
  const pacificHour = parseInt(pacificTimeStr);
  return pacificHour >= 20 || pacificHour < 7;
}

/**
 * Overnight cache refresh - run via daily trigger at 2 AM
 * Keeps cache alive during overnight skip period
 */
function overnightCacheRefresh() {
  console.log('Overnight cache refresh triggered at 2 AM');
  return batchProcessAll(7);
}

/**
 * Main batch processor entry point
 * Run this every 15 minutes via time-based trigger
 */
function batchProcessSchedule() {
  if (isOvernightHours()) {
    const now = new Date();
    const pacificTimeStr = Utilities.formatDate(now, SEARCH_CONFIG.timezone, 'hh:mm a');
    console.log(`Skipping batch process - overnight hours (${pacificTimeStr} Pacific)`);
    return { skipped: true, reason: 'overnight_hours', time: pacificTimeStr };
  }
  return batchProcessAll(7);
}

/**
 * Process all upcoming schedule days
 * @param {number} daysToProcess - Number of days to process
 */
function batchProcessAll(daysToProcess = 7) {
  const metrics = {
    startTime: new Date(),
    sheetsProcessed: 0,
    peopleProcessed: 0,
    eventsFound: 0,
    cacheSize: 0,
    errors: []
  };

  try {
    console.log(`\n=== Starting Batch Processing ===`);
    console.log(`Requested: ${daysToProcess} days`);

    const cache = CacheService.getScriptCache();

    // Set refreshing flag (5 min TTL as safety in case of crash)
    cache.put('batch_processing', 'true', 300);

    const sheets = getSmartSheetRange(daysToProcess);
    console.log(`Found ${sheets.length} available sheets\n`);

    if (sheets.length === 0) {
      console.warn('No sheets found');
      return metrics;
    }

    const people = getAllPeople();
    console.log(`Processing ${people.length} people...`);

    if (people.length === 0) {
      throw new Error('No people found');
    }

    // Clear old cached data
    const previousPeopleJson = cache.get('batch_people_list');
    if (previousPeopleJson) {
      const previousPeople = JSON.parse(previousPeopleJson);
      console.log(`Clearing ${previousPeople.length} old cache entries...`);
      previousPeople.forEach(name => cache.remove(`schedule_${name}`));
    }

    // Process each sheet
    const allSchedules = {};

    sheets.forEach(sheetInfo => {
      const sheetStart = new Date();
      try {
        console.log(`\nProcessing: ${sheetInfo.sheetName} (${sheetInfo.date})`);
        const sheetResults = processSheet(sheetInfo, people);

        Object.keys(sheetResults).forEach(personName => {
          if (!allSchedules[personName]) {
            allSchedules[personName] = { events: [], days: [] };
          }
          allSchedules[personName].events.push(...sheetResults[personName].events);
          if (!allSchedules[personName].days.includes(sheetInfo.date)) {
            allSchedules[personName].days.push(sheetInfo.date);
          }
        });

        const duration = (new Date() - sheetStart) / 1000;
        console.log(`  Completed in ${duration.toFixed(2)}s`);

      } catch (error) {
        console.error(`  ERROR: ${error.toString()}`);
        metrics.errors.push(`Sheet ${sheetInfo.sheetName}: ${error.toString()}`);
      }
    });

    metrics.sheetsProcessed = sheets.length;

    // Cache results - cache ALL people, even those without events
    console.log('\n=== Updating Caches ===');
    const updateTimestamp = new Date().toISOString();
    const cachedPeopleNames = [];

    people.forEach(person => {
      const schedule = allSchedules[person.name] || { events: [], days: [] };

      const cacheData = {
        person: person.name,
        class: person.class || '',
        type: person.type || '',
        events: schedule.events,
        days: schedule.days.sort(),
        lastUpdated: updateTimestamp,
        version: '5.0-tiered'
      };

      const json = JSON.stringify(cacheData);
      cache.put(`schedule_${person.name}`, json, SEARCH_CONFIG.cacheTTL);
      cachedPeopleNames.push(person.name);

      metrics.eventsFound += schedule.events.length;
      metrics.cacheSize += json.length;
    });

    metrics.peopleProcessed = people.length;
    cache.put('batch_people_list', JSON.stringify(cachedPeopleNames), SEARCH_CONFIG.cacheTTL);

    // Store metadata
    const completionTime = new Date();
    metrics.totalDuration = (completionTime - metrics.startTime) / (1000 * 60);

    const metadata = {
      lastRun: completionTime.toISOString(),
      duration: metrics.totalDuration,
      sheetsProcessed: metrics.sheetsProcessed,
      peopleProcessed: metrics.peopleProcessed,
      eventsFound: metrics.eventsFound,
      cacheSizeMB: (metrics.cacheSize / (1024 * 1024)).toFixed(2),
      errors: metrics.errors.length
    };

    cache.put('batch_metadata', JSON.stringify(metadata), SEARCH_CONFIG.cacheTTL);

    // Clear refreshing flag
    cache.remove('batch_processing');

    console.log('\n=== Batch Processing Complete ===');
    console.log(`Duration: ${metrics.totalDuration.toFixed(2)} minutes`);
    console.log(`Sheets: ${metrics.sheetsProcessed}`);
    console.log(`People: ${metrics.peopleProcessed}`);
    console.log(`Events: ${metrics.eventsFound}`);

    return metrics;

  } catch (error) {
    console.error('FATAL ERROR:', error.toString());
    metrics.errors.push(`FATAL: ${error.toString()}`);
    // Clear refreshing flag on error too
    CacheService.getScriptCache().remove('batch_processing');
    throw error;
  }
}

/**
 * Get all people from the student/staff list
 * Uses getRosterConfig() to handle structure changes
 */
function getAllPeople() {
  const sheets = getSmartSheetRange(7);

  if (sheets.length === 0) {
    throw new Error('No sheets found');
  }

  const peopleMap = new Map();

  // Patterns to filter out - headers and event names that appear in roster ranges
  const headerPatterns = [
    'bravo students', 'stc students', 'alpha students', 'ftc-b', 'stc-b', 'ftc-a', 'stc-a',
    'staff ip', 'stc staff', 'staff stc', 'attached', 'support', 'ifte', 'icso', 'future'
  ];

  // Event/section names that should NOT be treated as people
  const eventNamePatterns = [
    'academics', 'events', 'ground events', 'flying events', 'supervision',
    'groot', 'mtg', 'meeting', 'interview', 'brief', 'debrief',
    'ccep', 'checkride', 'sim', 'flight', 'sortie', 'mission',
    'training', 'class', 'lecture', 'exam', 'test', 'eval',
    'leave', 'tdy', 'appointment', 'admin', 'standby', 'alert',
    'holiday', 'down day', 'weekend', 'maintenance', 'wx', 'weather'
  ];

  const rosterConfig = getRosterConfig();

  sheets.forEach(sheetInfo => {
    const sheet = sheetInfo.sheet;

    // Handle legacy structure (single range with columns)
    if (rosterConfig.range && rosterConfig.columns) {
      const data = sheet.getRange(rosterConfig.range).getDisplayValues();

      rosterConfig.columns.forEach(colDef => {
        data.forEach(row => {
          const name = row[colDef.col] ? row[colDef.col].trim() : '';
          addPersonToMap(name, colDef.name, colDef.type, peopleMap, headerPatterns, eventNamePatterns);
        });
      });
    }

    // Handle new structure (multiple ranges)
    if (rosterConfig.ranges) {
      rosterConfig.ranges.forEach(rangeConfig => {
        const data = sheet.getRange(rangeConfig.range).getDisplayValues();

        data.forEach(row => {
          const name = row[rangeConfig.nameCol] ? row[rangeConfig.nameCol].trim() : '';
          addPersonToMap(name, rangeConfig.name, rangeConfig.type, peopleMap, headerPatterns, eventNamePatterns);
        });
      });
    }
  });

  const people = Array.from(peopleMap.values());
  console.log(`Found ${people.length} unique people`);
  return people;
}

/**
 * Helper to add a person to the map with validation
 */
function addPersonToMap(name, className, type, peopleMap, headerPatterns, eventNamePatterns) {
  if (!name || name === '.' || name === '' || name.length < 2) return;

  const nameLower = name.toLowerCase();

  // Filter out common non-name values
  if (['false', 'true', 'yes', 'no', 'n/a', 'tbd'].includes(nameLower)) return;

  // Filter out pure numbers
  if (/^\d+$/.test(name)) return;

  // Filter out header patterns (column headers in roster)
  if (headerPatterns.some(p => nameLower.includes(p))) return;

  // Filter out event/section names that aren't people
  if (eventNamePatterns && eventNamePatterns.some(p => nameLower.includes(p))) return;

  // Real names typically have at least one space or are single proper names
  // Filter out entries that look like event codes (all caps with numbers or special chars)
  if (/^[A-Z0-9\s\-\/]+$/.test(name) && name === name.toUpperCase() && name.length > 3) {
    // Allow if it looks like a last name (single word, no numbers)
    if (!/^[A-Z]+$/.test(name)) return;
  }

  if (!peopleMap.has(name)) {
    peopleMap.set(name, { name, class: className, type: type });
  }
}

/**
 * Process a single sheet for all people
 * Uses getSectionRanges() to handle structure changes
 */
function processSheet(sheetInfo, people) {
  const sheet = sheetInfo.sheet;
  const results = {};

  people.forEach(person => {
    results[person.name] = { events: [] };
  });

  // Get section ranges based on sheet date
  const sections = getSectionRanges(sheetInfo.date);

  // Read all sections once
  const allData = {
    supervision: sheet.getRange(sections.supervision.range).getDisplayValues(),
    flying: sheet.getRange(sections.flying.range).getDisplayValues(),
    ground: sheet.getRange(sections.ground.range).getDisplayValues(),
    na: sheet.getRange(sections.na.range).getDisplayValues()
  };

  // Process each person
  people.forEach(person => {
    const events = [];

    events.push(...parseSupervisionForPerson(person.name, allData.supervision, sheetInfo.date));
    events.push(...parseFlyingForPerson(person.name, allData.flying, sheetInfo.date));
    events.push(...parseGroundForPerson(person.name, allData.ground, sheetInfo.date));
    events.push(...parseNAForPerson(person.name, allData.na, sheetInfo.date));

    results[person.name].events = events;
  });

  return results;
}

/**
 * Parse supervision section for a specific person
 */
function parseSupervisionForPerson(searchName, supervisionData, date) {
  const matches = [];
  const searchLower = searchName.toLowerCase();

  supervisionData.forEach(row => {
    const dutyType = row[0];
    if (!dutyType) return;

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

  flyingData.forEach(row => {
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
        status: { effective, cancelled, partiallyEffective }
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

  groundData.forEach(row => {
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

  naData.forEach(row => {
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
