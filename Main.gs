/**
 * TPS Schedule - Main Router
 *
 * Routes HTTP requests to the appropriate processor version.
 * Handles caching via batch processor for instant responses.
 */

// Active version: "SIMPLIFIED" or "ENHANCED"
const ACTIVE_VERSION = "SIMPLIFIED";

/**
 * doGet(e) - Main HTTP endpoint
 *
 * URL Parameters:
 *   ?name=Sick           - Name to search for
 *   ?days=5              - Number of days to search
 *   ?version=simplified  - Override version (simplified/enhanced)
 *   ?forceRefresh=true   - Trigger batch cache refresh
 *   ?viewCache=true      - View all cached data summary
 *   ?viewCache=person    - View cache for specific person (use with ?name=)
 *   ?viewCache=bulk      - View ALL cached schedules (for class view)
 *
 * @param {Object} e - Google Apps Script event object
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;

    // Handle view cache request
    if (e.parameter.viewCache) {
      return handleViewCache(e.parameter.viewCache, e.parameter.name);
    }

    // Handle force refresh request
    if (e.parameter.forceRefresh === 'true' || e.parameter.refresh === 'true') {
      return handleForceRefresh();
    }

    // Try cache first (instant response)
    const cachedResponse = getCachedSchedule(searchName);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Cache miss - return error instead of processing (saves quota)
    console.error(`CACHE MISS: "${searchName}" not found in batch cache`);
    return createJsonResponse({
      error: true,
      errorType: 'CACHE_MISS',
      message: `"${searchName}" not found in cache. This person may not be in the roster (rows 120-168). Add them to the spreadsheet roster and run ?forceRefresh=true`,
      searchName: searchName,
      hint: 'Check the student/staff list in the spreadsheet (rows 120-168)'
    });

  } catch (error) {
    console.error("Router error:", error);
    return createJsonResponse({
      error: true,
      message: error.toString()
    });
  }
}

/**
 * Handle view cache request - returns cached data as JSON
 *
 * @param {string} mode - 'true' for summary, 'person' for specific person, 'bulk' for all data
 * @param {string} name - Person name (optional, used with mode='person')
 */
function handleViewCache(mode, name) {
  const cache = CacheService.getScriptCache();

  // View cache for specific person
  if (mode === 'person' && name) {
    const personCache = cache.get(`schedule_${name}`);
    return createJsonResponse({
      viewCache: true,
      mode: 'person',
      name: name,
      cached: personCache ? true : false,
      data: personCache ? JSON.parse(personCache) : null
    });
  }

  // Bulk mode - return ALL cached schedules with full data (for class view)
  if (mode === 'bulk') {
    return handleViewCacheBulk();
  }

  // View all cached data (summary only)
  const batchMetadata = cache.get('batch_metadata');
  const metadata = batchMetadata ? JSON.parse(batchMetadata) : null;

  // Get the cached people list from batch processor
  let cachedPeople = [];
  const peopleListJson = cache.get('batch_people_list');

  if (peopleListJson) {
    const peopleNames = JSON.parse(peopleListJson);

    peopleNames.forEach(personName => {
      const personCache = cache.get(`schedule_${personName}`);
      if (personCache) {
        const parsed = JSON.parse(personCache);
        // Handle both flat events array and nested events structure
        let eventCount = 0;
        if (parsed.events) {
          if (Array.isArray(parsed.events) && parsed.events.length > 0) {
            if (parsed.events[0].events) {
              // Nested: [{date, events: [...]}]
              eventCount = parsed.events.reduce((sum, day) => sum + day.events.length, 0);
            } else {
              // Flat: [{date, time, ...}]
              eventCount = parsed.events.length;
            }
          }
        }
        cachedPeople.push({
          name: personName,
          eventCount: eventCount,
          class: parsed.class || '',
          type: parsed.type || ''
        });
      }
    });
  }

  return createJsonResponse({
    viewCache: true,
    mode: 'all',
    metadata: metadata,
    cachedPeopleCount: cachedPeople.length,
    cachedPeople: cachedPeople,
    hint: 'Use ?viewCache=person&name=PersonName to view full cache for a specific person, or ?viewCache=bulk for all data'
  });
}

/**
 * Handle bulk cache request - returns ALL cached schedules with full event data
 * Used by class view to fetch everything in one request
 */
function handleViewCacheBulk() {
  const cache = CacheService.getScriptCache();
  const batchMetadata = cache.get('batch_metadata');
  const metadata = batchMetadata ? JSON.parse(batchMetadata) : null;
  const peopleListJson = cache.get('batch_people_list');

  if (!peopleListJson) {
    return createJsonResponse({
      viewCache: true,
      mode: 'bulk',
      error: true,
      message: 'No cached data available'
    });
  }

  const peopleNames = JSON.parse(peopleListJson);
  const schedules = [];
  const categories = new Set();

  peopleNames.forEach(personName => {
    const personCache = cache.get(`schedule_${personName}`);
    if (personCache) {
      const parsed = JSON.parse(personCache);
      const category = parsed.class || parsed.type || 'Unknown';
      categories.add(category);

      schedules.push({
        name: personName,
        category: category,
        events: parsed.events || []
      });
    }
  });

  // Sort schedules alphabetically by name
  schedules.sort((a, b) => a.name.localeCompare(b.name));

  // Convert categories to sorted array, filtering out "Future" categories unless renamed
  const categoryList = Array.from(categories)
    .filter(cat => !cat.startsWith('Future Category'))
    .sort();

  return createJsonResponse({
    viewCache: true,
    mode: 'bulk',
    metadata: metadata,
    categories: categoryList,
    peopleCount: schedules.length,
    schedules: schedules
  });
}

/**
 * Handle force refresh request - triggers batch processing
 * NOTE: This bypasses overnight hours check - always processes when manually triggered
 */
function handleForceRefresh() {
  console.log('Force refresh requested - bypassing overnight check, triggering batch process');

  try {
    // Call batchProcessAll directly to bypass overnight hours check
    const result = batchProcessAll(7);

    return createJsonResponse({
      forceRefresh: true,
      status: 'success',
      message: 'Cache refreshed',
      duration: result ? result.totalDuration : null,
      peopleProcessed: result ? result.peopleProcessed : null,
      eventsFound: result ? result.eventsFound : null
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
 * Get cached schedule for a person
 */
function getCachedSchedule(searchName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `schedule_${searchName}`;
  const cached = cache.get(cacheKey);

  // Check if batch processing is in progress
  const isRefreshing = cache.get('batch_processing') === 'true';

  if (!cached) {
    // If refreshing, return special response instead of null
    if (isRefreshing) {
      return createJsonResponse({
        isRefreshing: true,
        message: 'Cache is being refreshed, please wait...'
      });
    }
    return null;
  }

  console.log(`Cache hit for ${searchName}`);

  // Add batch metadata to response
  let response = JSON.parse(cached);
  const batchMetadata = cache.get('batch_metadata');

  if (batchMetadata) {
    const metadata = JSON.parse(batchMetadata);
    response.cacheUpdated = metadata.lastRun;
    response.batchDuration = metadata.duration;
    response.totalEvents = metadata.eventsFound;
  }

  // Include refreshing status
  response.isRefreshing = isRefreshing;

  return createJsonResponse(response);
}

/**
 * Route to appropriate processor version
 */
function routeToProcessor(e) {
  let selectedVersion = ACTIVE_VERSION;

  // Allow URL parameter override
  if (e.parameter.version) {
    const v = e.parameter.version.toLowerCase();
    if (v === "simplified" || v === "4.0") {
      selectedVersion = "SIMPLIFIED";
    } else if (v === "enhanced" || v === "5.0") {
      selectedVersion = "ENHANCED";
    }
  }

  console.log(`Routing to ${selectedVersion} version`);

  let result;
  if (selectedVersion === "ENHANCED") {
    result = doGet_Enhanced(e);
  } else {
    result = doGet_Simplified(e);
  }

  // Cache the result for next time
  cacheResult(e.parameter.name || SEARCH_CONFIG.searchTerm, result);

  return result;
}

/**
 * Cache a successful result
 */
function cacheResult(searchName, result) {
  try {
    const resultText = result.getContent();
    const resultJson = JSON.parse(resultText);

    if (!resultJson.error && resultJson.events) {
      const cache = CacheService.getScriptCache();
      cache.put(`schedule_${searchName}`, resultText, SEARCH_CONFIG.cacheTTL);
      console.log(`Cached result for ${searchName}`);
    }
  } catch (e) {
    console.warn('Could not cache result:', e);
  }
}

/**
 * Create JSON response
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
