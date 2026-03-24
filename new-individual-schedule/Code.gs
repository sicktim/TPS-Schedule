/**
 * TPS Schedule v6.4 — Main Logic
 *
 * All application logic in one file, organized by section headers.
 * Config is in Config.gs. Both files share the GAS global namespace.
 *
 * Sections:
 *   ROUTER (doGet)          — HTTP endpoint, routes to handlers
 *   BATCH PROCESSING        — Scheduled pipeline, builds both caches
 *   DATA FETCHING           — Reads roster and sheet data from Sheets API
 *   SECTION PARSING         — Extracts structured data from raw sheet arrays
 *   PERSON EXTRACTION       — Filters parsed sections for a specific person
 *   CACHE MANAGEMENT        — Size-checked writes, roster warning, helpers
 *   UTILITIES               — JSON response, date helpers, boolean parsing
 *   ONE-TIME SETUP          — Trigger management (run manually from editor)
 */


// ===== ROUTER (doGet) =====

/**
 * Main HTTP entry point for the web app.
 * Routes requests based on URL parameters.
 *
 * Endpoints:
 *   ?name=X           — Individual schedule from per-person cache
 *   ?mode=full        — Full schedule data from per-sheet cache
 *   ?mode=benchmark   — Run pipeline and return timing comparison
 *   ?mode=roster-check — Check if roster sheet exists
 *   ?forceRefresh=true — Trigger immediate batch reprocess
 *   ?viewCache=true   — Cache diagnostic summary
 *
 * @param {Object} e - GAS event object with URL parameters
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  try {
    var params = e.parameter;

    if (params.forceRefresh === 'true') return handleForceRefresh();
    if (params.viewCache === 'true')    return handleViewCache();
    if (params.mode === 'benchmark')    return handleBenchmark();
    if (params.mode === 'full')         return handleFullRequest();
    if (params.mode === 'roster-check') return handleRosterCheck();

    // Default: individual schedule lookup
    var name = params.name;
    if (!name) {
      return createJsonResponse({
        error: true,
        message: 'Missing ?name= parameter. Use ?name=YourName for individual schedule.',
        endpoints: {
          individual: '?name=X',
          full: '?mode=full',
          benchmark: '?mode=benchmark',
          rosterCheck: '?mode=roster-check',
          forceRefresh: '?forceRefresh=true',
          viewCache: '?viewCache=true'
        }
      });
    }

    return handleIndividualRequest(name);

  } catch (error) {
    console.error('Router error: ' + error.toString());
    return createJsonResponse({ error: true, message: error.toString() });
  }
}

/**
 * Serve individual schedule from per-person cache (Approach A).
 * Returns cached events for a single person, or a CACHE_MISS error.
 * @param {string} name - Person name to look up
 * @returns {TextOutput} JSON response
 */
function handleIndividualRequest(name) {
  var cache = CacheService.getScriptCache();
  var isRefreshing = cache.get('batch_processing') === 'true';
  var rosterWarning = getRosterWarning(cache);

  var cached = cache.get('schedule_' + name);

  if (!cached) {
    // If batch is running, tell the frontend to wait
    if (isRefreshing) {
      return createJsonResponse({
        isRefreshing: true,
        message: 'Cache is being refreshed, please wait...',
        rosterWarning: rosterWarning
      });
    }
    return createJsonResponse({
      error: true,
      errorType: 'CACHE_MISS',
      message: '"' + name + '" not found in cache.',
      searchName: name,
      isRefreshing: false,
      rosterWarning: rosterWarning
    });
  }

  var response = JSON.parse(cached);
  response.isRefreshing = isRefreshing;
  response.rosterWarning = rosterWarning;

  // Add batch metadata (when cache was last updated)
  var metadataJson = cache.get('batch_metadata');
  if (metadataJson) {
    var metadata = JSON.parse(metadataJson);
    response.cacheUpdated = metadata.lastRun;
  }

  return createJsonResponse(response);
}

/**
 * Serve full schedule data from per-sheet cache (Approach B).
 * Returns all days' schedule data plus roster categories.
 * @returns {TextOutput} JSON response
 */
function handleFullRequest() {
  var cache = CacheService.getScriptCache();
  var rosterWarning = getRosterWarning(cache);

  var sheetListJson = cache.get('sheet_list');
  if (!sheetListJson) {
    return createJsonResponse({
      error: true,
      message: 'No cached schedule data available. Run ?forceRefresh=true to populate.',
      rosterWarning: rosterWarning
    });
  }

  var sheetDates = JSON.parse(sheetListJson);
  var days = [];

  sheetDates.forEach(function(isoDate) {
    var sheetData = cache.get('sheet_' + isoDate);
    if (sheetData) {
      days.push(JSON.parse(sheetData));
    }
  });

  var rosterJson = cache.get('roster_cache');
  var roster = rosterJson ? JSON.parse(rosterJson) : null;

  // currentAsOf = when the batch processor last scanned the sheets, not when this request was made
  var metadataJson = cache.get('batch_metadata');
  var batchTime = metadataJson ? JSON.parse(metadataJson).lastRun : null;

  return createJsonResponse({
    metadata: {
      currentAsOf: batchTime,
      daysIncluded: days.length,
      rosterWarning: rosterWarning
    },
    roster: roster,
    days: days
  });
}

/**
 * Benchmark endpoint — runs the full pipeline and reports timing.
 * Checks concurrency guard before starting.
 * @returns {TextOutput} JSON with detailed timing breakdown for both approaches
 */
function handleBenchmark() {
  var cache = CacheService.getScriptCache();

  if (cache.get('batch_processing') === 'true') {
    return createJsonResponse({
      error: true,
      message: 'A batch process is already running. Try again in a few minutes.'
    });
  }

  var result = batchProcess(true);
  return createJsonResponse(result);
}

/**
 * Trigger immediate batch reprocess. Checks concurrency guard.
 * @returns {TextOutput} JSON with refresh result
 */
function handleForceRefresh() {
  var cache = CacheService.getScriptCache();

  if (cache.get('batch_processing') === 'true') {
    return createJsonResponse({
      error: true,
      message: 'A batch process is already running. Try again in a few minutes.'
    });
  }

  try {
    var result = batchProcess(false);
    return createJsonResponse({
      forceRefresh: true,
      status: 'success',
      duration: result.timing.total,
      sheetsProcessed: result.sheetsProcessed,
      peopleProcessed: result.peopleProcessed,
      eventsFound: result.eventsFound
    });
  } catch (error) {
    return createJsonResponse({
      forceRefresh: true,
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * Check if the roster sheet exists and return status.
 * @returns {TextOutput} JSON with roster status
 */
function handleRosterCheck() {
  var cache = CacheService.getScriptCache();
  var rosterWarning = getRosterWarning(cache);
  return createJsonResponse({
    rosterSheetName: CONFIG.rosterSheetName,
    rosterWarning: rosterWarning,
    status: rosterWarning ? 'missing' : 'ok'
  });
}

/**
 * View cache diagnostics — shows metadata, counts, and warning status.
 * @returns {TextOutput} JSON with cache summary
 */
function handleViewCache() {
  var cache = CacheService.getScriptCache();
  var metadataJson = cache.get('batch_metadata');
  var metadata = metadataJson ? JSON.parse(metadataJson) : null;

  var peopleListJson = cache.get('people_list');
  var peopleCount = peopleListJson ? JSON.parse(peopleListJson).length : 0;

  var sheetListJson = cache.get('sheet_list');
  var sheetCount = sheetListJson ? JSON.parse(sheetListJson).length : 0;

  return createJsonResponse({
    viewCache: true,
    metadata: metadata,
    cachedPeopleCount: peopleCount,
    cachedSheetsCount: sheetCount,
    rosterWarning: getRosterWarning(cache)
  });
}


// ===== BATCH PROCESSING =====

/**
 * Trigger entry point — called every 15 minutes by time-based trigger.
 * Skips during overnight hours to save quota.
 * @returns {Object} Processing result or skip info
 */
function batchProcessSchedule() {
  if (isOvernightHours()) {
    var now = new Date();
    var timeStr = Utilities.formatDate(now, CONFIG.timezone, 'hh:mm a');
    console.log('Skipping batch — overnight hours (' + timeStr + ' Pacific)');
    return { skipped: true, reason: 'overnight_hours', time: timeStr };
  }
  return batchProcess(false);
}

/**
 * Check if current time is in the overnight skip window.
 * @returns {boolean} True if we should skip processing
 */
function isOvernightHours() {
  var now = new Date();
  var hour = parseInt(Utilities.formatDate(now, CONFIG.timezone, 'HH'));
  return hour >= CONFIG.overnight.skipStart || hour < CONFIG.overnight.skipEnd;
}

/**
 * Main batch processing pipeline.
 * Reads all sheets, parses sections, builds BOTH caches (Approach A + B).
 *
 * Pipeline:
 *   1. Set concurrency guard
 *   2. Check roster sheet → set/clear warning
 *   3. Read roster from "Data v3"
 *   4. Find available sheets
 *   5. For each sheet: read → parse → cache sheet (B) → extract per-person (A)
 *   6. Batch-write per-person caches with putAll()
 *   7. Store metadata
 *   8. Clear concurrency guard
 *
 * @param {boolean} benchmarkMode - If true, returns detailed timing/size data
 * @returns {Object} Processing results with timing
 */
function batchProcess(benchmarkMode) {
  var timing = {};
  var startTime = Date.now();
  var cache = CacheService.getScriptCache();
  var errors = [];

  // Step 1: Concurrency guard (5-min TTL as safety against crashes)
  cache.put('batch_processing', 'true', 300);

  try {
    console.log('=== Starting Batch Processing ===');

    // Step 2 & 3: Roster check + read
    var t0 = Date.now();
    var spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    var rosterSheet = spreadsheet.getSheetByName(CONFIG.rosterSheetName);

    if (!rosterSheet) {
      cache.put('roster_warning', JSON.stringify({
        missing: CONFIG.rosterSheetName,
        detectedAt: new Date().toISOString()
      }), CONFIG.cacheDuration);
      console.warn('Roster sheet "' + CONFIG.rosterSheetName + '" not found!');
    } else {
      cache.remove('roster_warning');
    }

    var roster = rosterSheet ? readRoster(rosterSheet) : { people: [], categories: {} };
    timing.rosterRead = (Date.now() - t0) / 1000;
    console.log('Roster: ' + roster.people.length + ' people in ' + timing.rosterRead.toFixed(2) + 's');

    // Cache roster categories for Approach B's full-data response
    cache.put('roster_cache', JSON.stringify(roster.categories), CONFIG.cacheDuration);

    // Step 4: Find available sheets
    var t1 = Date.now();
    var availableSheets = findAvailableSheets(spreadsheet);
    timing.sheetDiscovery = (Date.now() - t1) / 1000;
    console.log('Found ' + availableSheets.length + ' sheets in ' + timing.sheetDiscovery.toFixed(2) + 's');

    if (availableSheets.length === 0) {
      throw new Error('No sheets found for the next ' + CONFIG.daysToProcess + ' days');
    }

    // Step 5: Process each sheet
    var t2 = Date.now();
    var allPersonEvents = {};
    var sheetDates = [];
    var totalEvents = 0;

    availableSheets.forEach(function(sheetInfo) {
      var sheetStart = Date.now();
      try {
        console.log('Processing: ' + sheetInfo.name + ' (' + sheetInfo.isoDate + ')');

        // 5a: Read sheet data (single API call)
        var sheetData = fetchSheetData(spreadsheet, sheetInfo.name, sheetInfo.isoDate);

        // 5b: Parse all sections from in-memory array (no API calls)
        var parsed = parseSections(sheetData.data, sheetData.structure);

        // 5c: Cache full sheet data (Approach B) with size protection
        var sheetCacheEntry = {
          name: sheetInfo.name,
          isoDate: sheetInfo.isoDate,
          data: parsed
        };
        cacheSheetWithSizeCheck(cache, sheetInfo.isoDate, sheetCacheEntry);
        sheetDates.push(sheetInfo.isoDate);

        // 5d: Extract per-person events
        roster.people.forEach(function(person) {
          var events = extractPersonEvents(person.name, parsed, sheetInfo.isoDate);
          if (events.length > 0) {
            if (!allPersonEvents[person.name]) {
              allPersonEvents[person.name] = {
                person: person.name,
                class: person.category,
                type: person.type,
                events: [],
                days: [],
                personnelNotes: null
              };
            }
            // Append events (concat without creating new array)
            allPersonEvents[person.name].events.push.apply(
              allPersonEvents[person.name].events, events
            );
            if (allPersonEvents[person.name].days.indexOf(sheetInfo.isoDate) === -1) {
              allPersonEvents[person.name].days.push(sheetInfo.isoDate);
            }
            totalEvents += events.length;
          }
        });

        // 5e: Discover non-roster people appearing in schedule sections
        var discoveredNames = discoverNonRosterPeople(parsed, allPersonEvents, roster.people);
        discoveredNames.forEach(function(name) {
          var events = extractPersonEvents(name, parsed, sheetInfo.isoDate);
          if (events.length > 0) {
            if (!allPersonEvents[name]) {
              allPersonEvents[name] = {
                person: name,
                class: 'External',
                type: 'external',
                events: [],
                days: [],
                personnelNotes: null
              };
            }
            allPersonEvents[name].events.push.apply(allPersonEvents[name].events, events);
            if (allPersonEvents[name].days.indexOf(sheetInfo.isoDate) === -1) {
              allPersonEvents[name].days.push(sheetInfo.isoDate);
            }
            totalEvents += events.length;
          }
        });

        // Extract personnel notes for each person (later sheets overwrite earlier — notes don't vary by day)
        if (CONFIG.features.personnelNotes && parsed.personnelNotes) {
          roster.people.forEach(function(person) {
            var note = extractPersonNote(person.name, parsed.personnelNotes);
            if (note && allPersonEvents[person.name]) {
              allPersonEvents[person.name].personnelNotes = note;
            }
          });
        }

        var sheetDuration = (Date.now() - sheetStart) / 1000;
        console.log('  Completed in ' + sheetDuration.toFixed(2) + 's');

      } catch (error) {
        console.error('  ERROR on ' + sheetInfo.name + ': ' + error.toString());
        errors.push(sheetInfo.name + ': ' + error.toString());
      }
    });

    timing.sheetProcessing = (Date.now() - t2) / 1000;

    // Step 6: Batch-write per-person caches (Approach A) using putAll()
    var t3 = Date.now();
    var updateTimestamp = new Date().toISOString();
    var cachedPeopleNames = [];

    var cacheEntries = {};
    Object.keys(allPersonEvents).forEach(function(name) {
      var personData = allPersonEvents[name];
      personData.lastUpdated = updateTimestamp;
      personData.version = '6.0';
      personData.days.sort();
      cacheEntries['schedule_' + name] = JSON.stringify(personData);
      cachedPeopleNames.push(name);
    });

    // putAll() accepts max 100 entries per call
    var entryKeys = Object.keys(cacheEntries);
    for (var i = 0; i < entryKeys.length; i += 100) {
      var batch = {};
      entryKeys.slice(i, i + 100).forEach(function(key) {
        batch[key] = cacheEntries[key];
      });
      cache.putAll(batch, CONFIG.cacheDuration);
    }

    // Store lookup lists
    cache.put('people_list', JSON.stringify(cachedPeopleNames), CONFIG.cacheDuration);
    cache.put('sheet_list', JSON.stringify(sheetDates), CONFIG.cacheDuration);

    timing.cacheWrite = (Date.now() - t3) / 1000;

    // Step 7: Store metadata
    timing.total = (Date.now() - startTime) / 1000;

    var metadata = {
      lastRun: new Date().toISOString(),
      duration: timing.total,
      sheetsProcessed: availableSheets.length,
      peopleProcessed: roster.people.length,
      peopleWithEvents: cachedPeopleNames.length,
      eventsFound: totalEvents,
      errors: errors.length
    };
    cache.put('batch_metadata', JSON.stringify(metadata), CONFIG.cacheDuration);

    console.log('=== Batch Complete ===');
    console.log('Duration: ' + timing.total.toFixed(2) + 's | Sheets: ' + availableSheets.length +
                ' | People: ' + cachedPeopleNames.length + ' | Events: ' + totalEvents);

    // Build result
    var result = {
      sheetsProcessed: availableSheets.length,
      peopleProcessed: cachedPeopleNames.length,
      eventsFound: totalEvents,
      errors: errors,
      timing: timing
    };

    // Benchmark mode: add detailed cache size metrics
    if (benchmarkMode) {
      var approachATotalSize = 0;
      cachedPeopleNames.forEach(function(name) {
        approachATotalSize += (cacheEntries['schedule_' + name] || '').length;
      });

      var approachBTotalSize = 0;
      sheetDates.forEach(function(date) {
        var sheetCache = cache.get('sheet_' + date);
        if (sheetCache) approachBTotalSize += sheetCache.length;
      });

      result.approachA = {
        description: 'Server-side per-person cache',
        processingTime: timing.total.toFixed(1) + 's',
        cacheWriteTime: timing.cacheWrite.toFixed(1) + 's',
        totalCacheEntries: cachedPeopleNames.length,
        avgCacheEntrySize: cachedPeopleNames.length > 0
          ? Math.round(approachATotalSize / cachedPeopleNames.length / 1024) + 'KB' : '0KB',
        totalCacheSize: Math.round(approachATotalSize / 1024) + 'KB'
      };

      result.approachB = {
        description: 'Full-data per-sheet cache',
        processingTime: timing.sheetProcessing.toFixed(1) + 's',
        cacheWriteTime: 'included in processing',
        totalCacheEntries: sheetDates.length,
        avgCacheEntrySize: sheetDates.length > 0
          ? Math.round(approachBTotalSize / sheetDates.length / 1024) + 'KB' : '0KB',
        totalCacheSize: Math.round(approachBTotalSize / 1024) + 'KB'
      };

      result.shared = {
        sheetReadTime: timing.sheetProcessing.toFixed(1) + 's',
        rosterReadTime: timing.rosterRead.toFixed(1) + 's',
        parsingTime: 'included in sheetReadTime',
        rosterCount: roster.people.length,
        sheetsProcessed: availableSheets.length,
        totalEvents: totalEvents
      };
    }

    return result;

  } finally {
    // Step 8: Always clear concurrency guard
    cache.remove('batch_processing');
  }
}


// ===== DATA FETCHING =====

/**
 * Read the roster from the dedicated roster sheet ("Data v3").
 * Returns both a flat people list and categorized names.
 * @param {Sheet} rosterSheet - The roster sheet object
 * @returns {Object} { people: [{name, category, type}], categories: {category: [names]} }
 */
function readRoster(rosterSheet) {
  var allValues = rosterSheet.getDataRange().getDisplayValues();
  var headerNames = {};
  CONFIG.rosterStructure.forEach(function(c) { headerNames[c.header] = true; });

  var people = [];
  var categories = {};
  var seenNames = {};

  CONFIG.rosterStructure.forEach(function(colConfig) {
    var names = [];

    allValues.slice(1).forEach(function(row) {
      var name = row[colConfig.col] ? row[colConfig.col].trim() : '';

      // Skip empty, dots, headers, and duplicates
      if (!name || name.length < 2 || name === '.' || headerNames[name]) return;
      if (seenNames[name]) return;
      seenNames[name] = true;

      var isStaff = colConfig.category.toLowerCase().indexOf('staff') >= 0 ||
                    colConfig.category.toLowerCase().indexOf('attached') >= 0;

      names.push(name);
      people.push({
        name: name,
        category: colConfig.category,
        type: isStaff ? 'staff' : 'student'
      });
    });

    names.sort();
    categories[colConfig.category] = names;
  });

  return { people: people, categories: categories };
}

/**
 * Find available schedule sheets covering the current + next week window.
 * When CONFIG.includePastDays is true, scans back to Sunday of the current week
 * so workload counting has full-week data. Then scans forward through next week.
 * Searches using the standard "Mon 16 Mar" naming format.
 * @param {Spreadsheet} spreadsheet - The spreadsheet object
 * @returns {Array<{name: string, isoDate: string}>} Available sheet info, sorted by date
 */
function findAvailableSheets(spreadsheet) {
  var foundSheets = [];
  var today = getCurrentDate();
  var dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Calculate start date: Sunday of current week if includePastDays, else today
  var startDate = new Date(today);
  if (CONFIG.includePastDays) {
    var dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    startDate.setDate(startDate.getDate() - dayOfWeek); // back to Sunday
  }

  // Scan from start date through daysToProcess + extra for weekends/gaps
  // With past days: covers Sun of current week through ~end of next week
  var maxScan = CONFIG.daysToProcess + 14;

  for (var i = 0; i < maxScan; i++) {
    var targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + i);

    var day = targetDate.getDate();
    var dayShort = dayNamesShort[targetDate.getDay()];
    var month = monthNames[targetDate.getMonth()];

    var sheetName = dayShort + ' ' + day + ' ' + month;
    var sheet = spreadsheet.getSheetByName(sheetName);

    if (sheet) {
      var y = targetDate.getFullYear();
      var m = String(targetDate.getMonth() + 1).padStart(2, '0');
      var d = String(targetDate.getDate()).padStart(2, '0');

      foundSheets.push({
        name: sheet.getName(),
        isoDate: y + '-' + m + '-' + d
      });
    }
  }

  return foundSheets;
}

/**
 * Fetch a single sheet's data using optimized explicit range.
 * Reads only the needed area (~8,580 cells with notes, ~3,960 without)
 * instead of getDataRange() which reads ~422,910 cells.
 * @param {Spreadsheet} spreadsheet - The spreadsheet
 * @param {string} sheetName - Tab name
 * @param {string} isoDate - Date for structure selection
 * @returns {Object} { data: 2D array, structure: config object }
 */
function fetchSheetData(spreadsheet, sheetName, isoDate) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

  var structure = getActiveSheetStructure(isoDate);

  // Calculate bounding box from all section definitions
  var maxRow = 0;
  var maxCol = 0;

  var sectionKeys = Object.keys(structure.sections);
  for (var i = 0; i < sectionKeys.length; i++) {
    var s = structure.sections[sectionKeys[i]];
    // Skip academics section if feature is off
    if (sectionKeys[i] === 'academics' && !CONFIG.features.academics) continue;
    if (s.endRow > maxRow) maxRow = s.endRow;
    if (s.endCol > maxCol) maxCol = s.endCol;
  }

  // Include personnel notes range if enabled
  if (CONFIG.features.personnelNotes && structure.personnelNoteStructure) {
    structure.personnelNoteStructure.ranges.forEach(function(r) {
      if (r.endRow > maxRow) maxRow = r.endRow;
      if (r.endCol > maxCol) maxCol = r.endCol;
    });
  }

  // Single API call — reads the entire needed area at once
  var allData = sheet.getRange(1, 1, maxRow, maxCol).getDisplayValues();

  return { data: allData, structure: structure };
}


// ===== SECTION PARSING =====

/**
 * Parse all sections from a sheet's raw data array.
 * Extracts each section range from the in-memory array (no API calls).
 * @param {Array<Array<string>>} allData - Full sheet data (2D array from getRange)
 * @param {Object} structure - Active sheet structure from CONFIG
 * @returns {Object} { supervision, flying, ground, na, [academics], [personnelNotes] }
 */
function parseSections(allData, structure) {
  var result = {};

  var sectionKeys = Object.keys(structure.sections);
  for (var i = 0; i < sectionKeys.length; i++) {
    var sectionName = sectionKeys[i];

    // Skip academics if feature flag is off
    if (sectionName === 'academics' && !CONFIG.features.academics) continue;

    result[sectionName] = extractRange(allData, structure.sections[sectionName]);
  }

  // Extract personnel notes if enabled and available
  if (CONFIG.features.personnelNotes && structure.personnelNoteStructure) {
    result.personnelNotes = structure.personnelNoteStructure.ranges.map(function(rangeDef) {
      return extractRange(allData, rangeDef);
    });
  }

  return result;
}

/**
 * Extract a rectangular range from a 2D array.
 * Pure in-memory operation — no Sheets API calls.
 * @param {Array<Array<string>>} allData - Full sheet data
 * @param {Object} rangeDef - { startRow, endRow, startCol, endCol }
 * @returns {Array<Array<string>>} Extracted sub-array
 */
function extractRange(allData, rangeDef) {
  var result = [];
  for (var row = rangeDef.startRow; row < rangeDef.endRow; row++) {
    var rowData = [];
    for (var col = rangeDef.startCol; col < rangeDef.endCol; col++) {
      rowData.push(allData[row] && allData[row][col] ? allData[row][col] : '');
    }
    result.push(rowData);
  }
  return result;
}


// ===== PERSON EXTRACTION =====

/**
 * Extract all events for a specific person from parsed section data.
 * Searches each section's rows for the person's name (case-insensitive).
 * @param {string} name - Person name to search for
 * @param {Object} parsed - Parsed sections from parseSections()
 * @param {string} isoDate - Date string for this sheet
 * @returns {Array} Array of event objects matching the person
 */
function extractPersonEvents(name, parsed, isoDate) {
  var events = [];
  var nameLower = name.toLowerCase();

  if (parsed.supervision) {
    events.push.apply(events, parseSupervisionForPerson(nameLower, parsed.supervision, isoDate));
  }
  if (parsed.flying) {
    events.push.apply(events, parseFlyingForPerson(nameLower, parsed.flying, isoDate));
  }
  if (parsed.ground) {
    events.push.apply(events, parseGroundForPerson(nameLower, parsed.ground, isoDate));
  }
  if (parsed.na) {
    events.push.apply(events, parseNAForPerson(nameLower, parsed.na, isoDate));
  }
  // Academics: included in data (for bulk view) but filtered by frontend for individual view
  if (CONFIG.features.academics && parsed.academics) {
    events.push.apply(events, parseAcademicsForPerson(nameLower, parsed.academics, isoDate));
  }

  return events;
}

/**
 * Discover people who appear in schedule sections but aren't on the roster.
 * Scans crew/people columns in flying, ground, and NA sections for names
 * not already tracked. No extra API calls — uses already-parsed data.
 * @param {Object} parsed - Parsed sections from parseSections()
 * @param {Object} allPersonEvents - Already-tracked people (by name key)
 * @param {Array} rosterPeople - Roster people array [{name, category, type}]
 * @returns {Array<string>} Newly discovered names
 */
function discoverNonRosterPeople(parsed, allPersonEvents, rosterPeople) {
  var knownNames = {};
  rosterPeople.forEach(function(p) { knownNames[p.name.toLowerCase()] = true; });
  // Also skip names already discovered from previous sheets
  Object.keys(allPersonEvents).forEach(function(n) { knownNames[n.toLowerCase()] = true; });

  var discovered = {};

  // Scan flying crew columns (skip last 3: Notes, Effective, CX)
  if (parsed.flying) {
    parsed.flying.forEach(function(row) {
      row.slice(6, -3).forEach(function(cell) {
        var name = cell ? cell.trim() : '';
        if (name && name.length >= 2 && !knownNames[name.toLowerCase()]) {
          discovered[name] = true;
        }
      });
    });
  }

  // Scan ground people columns (skip last 3: Notes, Effective, CX)
  if (parsed.ground) {
    parsed.ground.forEach(function(row) {
      row.slice(3, -3).forEach(function(cell) {
        var name = cell ? cell.trim() : '';
        if (name && name.length >= 2 && !knownNames[name.toLowerCase()]) {
          discovered[name] = true;
        }
      });
    });
  }

  // Scan NA people columns (no trailing cols to skip)
  if (parsed.na) {
    parsed.na.forEach(function(row) {
      row.slice(3).forEach(function(cell) {
        var name = cell ? cell.trim() : '';
        if (name && name.length >= 2 && !knownNames[name.toLowerCase()]) {
          discovered[name] = true;
        }
      });
    });
  }

  // Scan supervision POC columns
  if (parsed.supervision) {
    parsed.supervision.forEach(function(row) {
      for (var col = 1; col < row.length - 2; col += 3) {
        var name = row[col] ? row[col].trim() : '';
        if (name && name.length >= 2 && !knownNames[name.toLowerCase()]) {
          discovered[name] = true;
        }
      }
    });
  }

  var names = Object.keys(discovered);
  if (names.length > 0) {
    console.log('  Discovered ' + names.length + ' non-roster people');
  }
  return names;
}

/**
 * Parse supervision section for a person.
 * Supervision rows: [DutyType, POC1, Start1, End1, POC2, Start2, End2, ...]
 * AUTH duties have no time range.
 * @param {string} nameLower - Lowercase person name
 * @param {Array<Array<string>>} data - Supervision section data
 * @param {string} date - ISO date string
 * @returns {Array} Matching event objects
 */
function parseSupervisionForPerson(nameLower, data, date) {
  var matches = [];

  data.forEach(function(row) {
    var dutyType = row[0];
    if (!dutyType) return;

    // Groups of 3 columns: POC, Start, End
    for (var col = 1; col < row.length - 2; col += 3) {
      var poc = row[col];
      var start = row[col + 1];
      var end = row[col + 2];

      if (poc && poc.toLowerCase().indexOf(nameLower) >= 0) {
        var isAuth = dutyType.toUpperCase().indexOf('AUTH') >= 0;

        matches.push({
          date: date,
          time: isAuth ? '' : start,
          type: 'Supervision',
          description: isAuth
            ? dutyType + ' | ' + poc
            : dutyType + ' | ' + poc + ' | ' + start + '-' + end,
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
 * Parse flying events for a person.
 * Row: [Model, BriefStart, ETD, ETA, DebriefEnd, Event, Crew×8, Notes, Effective, CX/Non-E]
 * @param {string} nameLower - Lowercase person name
 * @param {Array<Array<string>>} data - Flying section data
 * @param {string} date - ISO date string
 * @returns {Array} Matching event objects
 */
function parseFlyingForPerson(nameLower, data, date) {
  var matches = [];

  data.forEach(function(row) {
    // Quick check: does this row contain the name at all?
    if (row.join('|').toLowerCase().indexOf(nameLower) < 0) return;

    var model = row[0];
    var briefStart = row[1];
    var etd = row[2];
    var eta = row[3];
    var debriefEnd = row[4];
    var event = row[5];

    // Layout: [Model, Brief, ETD, ETA, Debrief, Event, Crew×8, Notes, Effective, CX/Non-E]
    var crewColumns = row.slice(6, -3);
    var crew = crewColumns.filter(function(c) { return c && c !== ''; });

    var notes = row[row.length - 3] || '';
    var effective = parseBoolean(row[row.length - 2]);
    var cancelled = parseBoolean(row[row.length - 1]);

    matches.push({
      date: date,
      time: briefStart,
      type: 'Flying Events',
      description: [model, event].concat(crew).filter(function(x) { return x; }).join(' | '),
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
        notes: notes,
        status: { effective: effective, cancelled: cancelled }
      }
    });
  });

  return matches;
}

/**
 * Parse ground events for a person.
 * Row: [Event, Start, End, People×10, Notes, Effective, CX/Non-E]
 * @param {string} nameLower - Lowercase person name
 * @param {Array<Array<string>>} data - Ground section data
 * @param {string} date - ISO date string
 * @returns {Array} Matching event objects
 */
function parseGroundForPerson(nameLower, data, date) {
  var matches = [];

  data.forEach(function(row) {
    if (row.join('|').toLowerCase().indexOf(nameLower) < 0) return;

    var event = row[0];
    var start = row[1];
    var end = row[2];

    // Layout: [Event, Start, End, People×10, Notes, Effective, CX/Non-E]
    var people = row.slice(3, -3).filter(function(c) { return c && c !== ''; });
    var notes = row[row.length - 3] || '';
    var effective = parseBoolean(row[row.length - 2]);
    var cancelled = parseBoolean(row[row.length - 1]);

    matches.push({
      date: date,
      time: start,
      type: 'Ground Events',
      description: [event].concat(people).filter(function(x) { return x; }).join(' | '),
      rangeSource: 'Ground Events',
      enhanced: {
        section: 'Ground Events',
        event: event,
        start: start,
        end: end,
        people: people,
        notes: notes,
        status: { effective: effective, cancelled: cancelled }
      }
    });
  });

  return matches;
}

/**
 * Parse NA (not available) section for a person.
 * Row: [Reason, Start, End, Person1..Person10]
 * No notes column, no status columns — just people slots.
 * @param {string} nameLower - Lowercase person name
 * @param {Array<Array<string>>} data - NA section data
 * @param {string} date - ISO date string
 * @returns {Array} Matching event objects
 */
function parseNAForPerson(nameLower, data, date) {
  var matches = [];

  data.forEach(function(row) {
    if (row.join('|').toLowerCase().indexOf(nameLower) < 0) return;

    var reason = row[0];
    var start = row[1];
    var end = row[2];
    var people = row.slice(3).filter(function(c) { return c && c !== ''; });

    matches.push({
      date: date,
      time: start,
      type: 'NA',
      description: [reason].concat(people).filter(function(x) { return x; }).join(' | '),
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
 * Parse academics section for a person.
 * Academics have large time ranges. Included in data for bulk/scheduler view,
 * but filtered out of individual view by the frontend.
 * @param {string} nameLower - Lowercase person name
 * @param {Array<Array<string>>} data - Academics section data
 * @param {string} date - ISO date string
 * @returns {Array} Matching event objects
 */
function parseAcademicsForPerson(nameLower, data, date) {
  var matches = [];

  data.forEach(function(row) {
    if (row.join('|').toLowerCase().indexOf(nameLower) < 0) return;

    var event = row[0];
    var start = row[1];
    var end = row[2];
    var details = row.slice(3).filter(function(c) { return c && c !== ''; });

    matches.push({
      date: date,
      time: start,
      type: 'Academics',
      description: [event].concat(details).filter(function(x) { return x; }).join(' | '),
      rangeSource: 'Academics',
      enhanced: {
        section: 'Academics',
        event: event,
        start: start,
        end: end,
        details: details
      }
    });
  });

  return matches;
}

/**
 * Extract personnel note for a specific person from notes data.
 * Searches all note ranges for a matching name.
 * @param {string} name - Person name (original case)
 * @param {Array<Array<Array<string>>>} notesData - Array of note range data arrays
 * @returns {string|null} Note text or null
 */
function extractPersonNote(name, notesData) {
  var nameLower = name.toLowerCase();

  for (var rangeIdx = 0; rangeIdx < notesData.length; rangeIdx++) {
    var rangeData = notesData[rangeIdx];
    for (var row = 0; row < rangeData.length; row++) {
      var nameCell = rangeData[row][0] ? rangeData[row][0].trim().toLowerCase() : '';
      if (nameCell === nameLower) {
        // noteCol is always 3 (4th column in the 4-column range block)
        var note = rangeData[row][3] ? rangeData[row][3].trim() : '';
        return note || null;
      }
    }
  }

  return null;
}


// ===== CACHE MANAGEMENT =====

/**
 * Cache a sheet's data with size protection.
 * GAS CacheService limit: 100KB (100,000 characters) per key.
 * If too large, strips personnelNotes and retries. If still too large, skips.
 * @param {Cache} cache - CacheService cache
 * @param {string} isoDate - Sheet date for the cache key
 * @param {Object} entry - Data object to cache
 */
function cacheSheetWithSizeCheck(cache, isoDate, entry) {
  var key = 'sheet_' + isoDate;
  var json = JSON.stringify(entry);

  // Check size against GAS 100KB limit (with 5KB safety margin)
  if (json.length > 95000) {
    console.warn('Sheet cache for ' + isoDate + ' is ' + json.length + ' chars — stripping personnelNotes');
    if (entry.data && entry.data.personnelNotes) {
      delete entry.data.personnelNotes;
      json = JSON.stringify(entry);
    }
  }

  if (json.length > 95000) {
    console.error('Sheet cache for ' + isoDate + ' still too large (' + json.length + ' chars) — skipping');
    return;
  }

  cache.put(key, json, CONFIG.cacheDuration);
}

/**
 * Get the roster warning from cache, if any.
 * @param {Cache} cache - CacheService cache
 * @returns {Object|null} Warning object { missing, detectedAt } or null
 */
function getRosterWarning(cache) {
  var warningJson = cache.get('roster_warning');
  return warningJson ? JSON.parse(warningJson) : null;
}


// ===== UTILITIES =====

/**
 * Create a JSON response for the web app.
 * @param {Object} data - Response data to serialize
 * @returns {TextOutput} GAS TextOutput with JSON MIME type
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Parse a boolean from a checkbox cell value.
 * Handles TRUE, checkmarks, and X characters.
 * @param {*} value - Cell value
 * @returns {boolean}
 */
function parseBoolean(value) {
  if (!value) return false;
  var valStr = String(value).toUpperCase().trim();
  return valStr === 'TRUE' || valStr === '\u2713' || valStr === 'X' || valStr === '\u2714';
}

/**
 * Get current date in configured timezone.
 * Returns noon to avoid timezone edge cases.
 * @returns {Date} Today's date at 12:00
 */
function getCurrentDate() {
  var now = new Date();
  var tzString = Utilities.formatDate(now, CONFIG.timezone, 'yyyy-MM-dd');
  var parts = tzString.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
}


// ===== ONE-TIME SETUP (run manually from editor) =====

/**
 * Set up time-based triggers for batch processing.
 * Run this ONCE from the GAS editor:
 *   1. Select setupTriggers from the function dropdown
 *   2. Click Run
 *   3. Authorize when prompted
 *
 * Creates a single 15-minute trigger for batchProcessSchedule().
 * The function handles overnight skipping internally.
 */
function setupTriggers() {
  // Remove existing triggers first to avoid duplicates
  removeTriggers();

  ScriptApp.newTrigger('batchProcessSchedule')
    .timeBased()
    .everyMinutes(15)
    .create();

  console.log('Trigger created: batchProcessSchedule every 15 minutes');
  console.log('Overnight skip: ' + CONFIG.overnight.skipStart + ':00 - ' +
              CONFIG.overnight.skipEnd + ':00 Pacific');
}

/**
 * Remove all triggers for batchProcessSchedule.
 * Safe to run multiple times.
 */
function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'batchProcessSchedule') {
      ScriptApp.deleteTrigger(trigger);
      console.log('Removed trigger: ' + trigger.getUniqueId());
    }
  });
}
