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
 *
 * @param {Object} e - Google Apps Script event object
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;

    // Handle force refresh request
    if (e.parameter.forceRefresh === 'true' || e.parameter.refresh === 'true') {
      return handleForceRefresh();
    }

    // Try cache first (instant response)
    const cachedResponse = getCachedSchedule(searchName);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Cache miss - process in real-time
    console.log(`Cache miss for ${searchName} - processing in real-time`);
    return routeToProcessor(e);

  } catch (error) {
    console.error("Router error:", error);
    return createJsonResponse({
      error: true,
      message: error.toString()
    });
  }
}

/**
 * Handle force refresh request - triggers batch processing
 */
function handleForceRefresh() {
  console.log('Force refresh requested - triggering batch process');

  try {
    const result = batchProcessSchedule();

    if (result && result.skipped) {
      return createJsonResponse({
        forceRefresh: true,
        status: 'skipped',
        reason: result.reason,
        message: 'Batch process skipped (overnight hours)'
      });
    }

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

  if (!cached) return null;

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
