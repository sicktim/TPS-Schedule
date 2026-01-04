// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    TPS-SCHEDULE MAIN ROUTER                                ║
// ║                                                                            ║
// ║  Purpose: Routes requests to different implementation versions             ║
// ║           Allows easy switching between SIMPLIFIED and OPTIMIZED           ║
// ║                                                                            ║
// ║  Last Modified: December 24, 2025                                          ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ┌────────────────────────────────────────────────────────────────────────────┐
// │                        VERSION CONFIGURATION                               │
// │                                                                            │
// │  Change ACTIVE_VERSION to switch between implementations:                  │
// │                                                                            │
// │  "SIMPLIFIED" (v4.0):                                                      │
// │    - No caching, always fresh data                                         │
// │    - Simple text parsing                                                   │
// │    - Best for: Personalized background refresh (15-min intervals)          │
// │    - Performance: ~30s per request                                         │
// │                                                                            │
// │  "OPTIMIZED" (v3.1):                                                       │
// │    - Caching enabled (10-min TTL)                                          │
// │    - Simple text parsing                                                   │
// │    - Best for: Shared dashboards, repeated queries                         │
// │    - Performance: ~30s first request, <1s cached requests                  │
// │                                                                            │
// │  "ENHANCED" (v5.0):                                                        │
// │    - No caching, always fresh data                                         │
// │    - Advanced parsing with structured metadata                             │
// │    - Parses: Supervision, Flying Events, Ground Events, NAs                │
// │    - Returns: Enhanced objects + legacy format (backwards compatible)      │
// │    - Extracts: Times, crew, status (effective/cancelled), event details    │
// │    - Best for: Rich UI, mobile apps needing detailed event data            │
// │    - Performance: ~30s per request                                         │
// │                                                                            │
// └────────────────────────────────────────────────────────────────────────────┘

const ACTIVE_VERSION = "SIMPLIFIED";  // Options: "SIMPLIFIED", "OPTIMIZED", "ENHANCED"

// Set to true to allow URL parameter to override ACTIVE_VERSION
const ALLOW_VERSION_OVERRIDE = true;


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                          MAIN WEB APP ENDPOINT                             ║
// ║                                                                            ║
// ║  This is the entry point for all HTTP requests to your deployed web app.   ║
// ║  It routes requests to the appropriate implementation based on config.     ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * doGet(e) - Main router for HTTP GET requests
 *
 * Routes incoming requests to the appropriate implementation version.
 * Can be controlled via ACTIVE_VERSION constant or URL parameter.
 *
 * @param {Object} e - Event object from Google Apps Script
 * @param {Object} e.parameter - URL query parameters
 *
 * URL EXAMPLES:
 *   Basic request (uses ACTIVE_VERSION):
 *     ?name=Sick&days=4
 *
 *   Force cache refresh (triggers batch processing):
 *     ?forceRefresh=true
 *     ?refresh=true
 *
 *   Override version via URL parameter (if ALLOW_VERSION_OVERRIDE = true):
 *     ?name=Sick&days=4&version=optimized
 *     ?name=Sick&days=4&version=simplified
 *     ?name=Sick&days=4&version=enhanced
 *     ?name=Sick&days=4&version=4.0
 *     ?name=Sick&days=4&version=3.1
 *     ?name=Sick&days=4&version=5.0
 *
 *   Test mode:
 *     ?name=Sick&days=4&testDate=2025-12-15
 *
 * @returns {TextOutput} JSON response from the selected implementation
 */
function doGet(e) {
  try {
    const searchName = e.parameter.name || SEARCH_CONFIG.searchTerm;

    // ═══════════════════════════════════════════════════════════════════════
    // FORCE REFRESH (Trigger Batch Processing)
    // ═══════════════════════════════════════════════════════════════════════
    // Hidden feature: ?forceRefresh=true triggers batch processing immediately
    // Useful for triple-tap refresh or manual cache updates
    // ═══════════════════════════════════════════════════════════════════════

    if (e.parameter.forceRefresh === 'true' || e.parameter.refresh === 'true') {
      console.log('🔄 FORCE REFRESH requested - triggering batch process');

      try {
        const result = batchProcessSchedule();

        // If skipped due to overnight hours or already running
        if (result && result.skipped) {
          return ContentService
            .createTextOutput(JSON.stringify({
              forceRefresh: true,
              status: 'skipped',
              reason: result.reason,
              time: result.time,
              message: 'Batch process skipped (overnight hours or already running)'
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        // Batch  process completed successfully
        return ContentService
          .createTextOutput(JSON.stringify({
            forceRefresh: true,
            status: 'success',
            message: 'Batch process completed - cache refreshed',
            duration: result ? result.totalDuration : null,
            peopleProcessed: result ? result.peopleProcessed : null,
            eventsFound: result ? result.eventsFound : null
          }))
          .setMimeType(ContentService.MimeType.JSON);

      } catch (error) {
        console.error('❌ Force refresh error:', error);
        return ContentService
          .createTextOutput(JSON.stringify({
            forceRefresh: true,
            status: 'error',
            message: error.toString(),
            hint: 'Check if batchProcessSchedule() function exists'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INSTANT CACHE RETRIEVAL (Batch Processing System)
    // ═══════════════════════════════════════════════════════════════════════
    // Try to get pre-processed data from cache first (FAST!)
    // Falls back to real-time processing if cache miss
    // ═══════════════════════════════════════════════════════════════════════

    const cache = CacheService.getScriptCache();
    const cacheKey = `schedule_${searchName}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log(`⚡ CACHE HIT for ${searchName} - instant return (<100ms)`);

      // Add batch metadata to response (when cache was last updated)
      const batchMetadata = cache.get('batch_metadata');
      let response = JSON.parse(cached);

      if (batchMetadata) {
        const metadata = JSON.parse(batchMetadata);
        response.cacheUpdated = metadata.lastRun; // Timestamp when batch processing completed
        response.batchDuration = metadata.duration;
        response.totalEvents = metadata.eventsFound;
      }

      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    console.log(`⏱ CACHE MISS for ${searchName} - processing in real-time (~30s)`);

    // ═══════════════════════════════════════════════════════════════════════
    // VERSION ROUTING (for cache misses or when batch processing disabled)
    // ═══════════════════════════════════════════════════════════════════════

    // Determine which version to use
    let selectedVersion = ACTIVE_VERSION;

    // Allow URL parameter to override if enabled
    if (ALLOW_VERSION_OVERRIDE && e.parameter.version) {
      const versionParam = e.parameter.version.toLowerCase();

      if (versionParam === "simplified" || versionParam === "4.0" || versionParam === "4") {
        selectedVersion = "SIMPLIFIED";
      } else if (versionParam === "optimized" || versionParam === "3.1" || versionParam === "3") {
        selectedVersion = "OPTIMIZED";
      } else if (versionParam === "enhanced" || versionParam === "5.0" || versionParam === "5") {
        selectedVersion = "ENHANCED";
      } else {
        // Invalid version parameter - return error
        return ContentService
          .createTextOutput(JSON.stringify({
            error: true,
            message: `Invalid version parameter: "${e.parameter.version}". Valid options: "simplified", "optimized", "enhanced", "4.0", "3.1", "5.0"`
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Log routing decision
    console.log(`🔀 ROUTER: Routing to ${selectedVersion} version`);
    if (e.parameter.version) {
      console.log(`   Override via URL parameter: version=${e.parameter.version}`);
    }

    // Route to the appropriate implementation
    let result;
    if (selectedVersion === "SIMPLIFIED") {
      result = doGet_Simplified(e);
    } else if (selectedVersion === "OPTIMIZED") {
      result = doGet_Optimized(e);
    } else if (selectedVersion === "ENHANCED") {
      result = doGet_Enhanced(e);
    } else {
      // Invalid ACTIVE_VERSION configuration
      return ContentService
        .createTextOutput(JSON.stringify({
          error: true,
          message: `Invalid ACTIVE_VERSION configuration: "${ACTIVE_VERSION}". Must be "SIMPLIFIED", "OPTIMIZED", or "ENHANCED"`,
          hint: "Check Main.gs and update ACTIVE_VERSION constant"
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Cache the result for next time (if it's a successful response)
    try {
      const resultText = result.getContent();
      const resultJson = JSON.parse(resultText);

      if (!resultJson.error && resultJson.events) {
        console.log(`💾 Caching result for ${searchName}`);
        cache.put(cacheKey, resultText, 21600); // 6 hours
      }
    } catch (e) {
      console.warn('Could not cache result:', e);
    }

    return result;

  } catch (error) {
    // Catch any routing errors
    console.error("❌ ROUTER ERROR:", error);
    return ContentService
      .createTextOutput(JSON.stringify({
        error: true,
        message: "Router error: " + error.toString(),
        stack: error.stack,
        hint: "Check that both doGet_Simplified() and doGet_Optimized() functions exist"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                                                                            ║
// ║                          TESTING FUNCTIONS                                 ║
// ║                                                                            ║
// ║  Run these from the Apps Script editor to test each version independently  ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * testRouter() - Test the router with default settings
 *
 * Tests whichever version is currently active (ACTIVE_VERSION).
 * Run this to verify the router is working correctly.
 */
function testRouter() {
  console.log("🧪 TESTING ROUTER");
  console.log("=".repeat(60));
  console.log(`Active version: ${ACTIVE_VERSION}`);
  console.log("");

  const mockEvent = {
    parameter: {
      name: "Sick",
      days: "4"
    }
  };

  console.log("Simulating request: ?name=Sick&days=4");
  const response = doGet(mockEvent);
  const content = response.getContent();
  const parsed = JSON.parse(content);

  if (parsed.error) {
    console.log("❌ ERROR:");
    console.log(`   ${parsed.message}`);
  } else {
    console.log("✅ SUCCESS:");
    console.log(`   Version: ${parsed.version}`);
    console.log(`   Simplified: ${parsed.simplified || false}`);
    console.log(`   Total events: ${parsed.totalEvents}`);
    console.log(`   Search name: ${parsed.searchName}`);
  }

  console.log("\n📋 FULL RESPONSE:");
  console.log(JSON.stringify(parsed, null, 2));
}


/**
 * testSimplified() - Test SIMPLIFIED version directly
 *
 * Bypasses the router and tests the simplified implementation directly.
 * Useful for debugging the simplified version.
 */
function testSimplified() {
  console.log("🧪 TESTING SIMPLIFIED VERSION (v4.0)");
  console.log("=".repeat(60));

  const mockEvent = {
    parameter: {
      name: "Sick",
      days: "4"
    }
  };

  console.log("Calling doGet_Simplified() directly...\n");

  try {
    const response = doGet_Simplified(mockEvent);
    const content = response.getContent();
    const parsed = JSON.parse(content);

    if (parsed.error) {
      console.log("❌ ERROR:");
      console.log(`   ${parsed.message}`);
      if (parsed.stack) {
        console.log(`   Stack: ${parsed.stack}`);
      }
    } else {
      console.log("✅ SUCCESS:");
      console.log(`   Version: ${parsed.version}`);
      console.log(`   Simplified: ${parsed.simplified}`);
      console.log(`   Total events: ${parsed.totalEvents}`);
      console.log(`   Days searched: ${parsed.daysSearched}`);

      console.log("\n📅 EVENTS FOUND:");
      parsed.events.forEach(day => {
        console.log(`   ${day.dayName} (${day.date}): ${day.events.length} events`);
      });
    }

    console.log("\n📋 FULL RESPONSE:");
    console.log(JSON.stringify(parsed, null, 2));

  } catch (error) {
    console.error("❌ FUNCTION NOT FOUND OR ERROR:");
    console.error(`   ${error.toString()}`);
    console.error("\n💡 HINT: Make sure Simplified.gs file exists with doGet_Simplified() function");
  }
}


/**
 * testOptimized() - Test OPTIMIZED version directly
 *
 * Bypasses the router and tests the optimized (cached) implementation directly.
 * Useful for debugging the optimized version.
 */
function testOptimized() {
  console.log("🧪 TESTING OPTIMIZED VERSION (v3.1)");
  console.log("=".repeat(60));

  const mockEvent = {
    parameter: {
      name: "Sick",
      days: "4"
    }
  };

  console.log("Calling doGet_Optimized() directly...\n");

  try {
    const response = doGet_Optimized(mockEvent);
    const content = response.getContent();
    const parsed = JSON.parse(content);

    if (parsed.error) {
      console.log("❌ ERROR:");
      console.log(`   ${parsed.message}`);
      if (parsed.stack) {
        console.log(`   Stack: ${parsed.stack}`);
      }
    } else {
      console.log("✅ SUCCESS:");
      console.log(`   Version: ${parsed.version}`);
      console.log(`   Optimized: ${parsed.optimized}`);
      console.log(`   Total events: ${parsed.totalEvents}`);
      console.log(`   Days searched: ${parsed.daysSearched}`);

      console.log("\n📅 EVENTS FOUND:");
      parsed.events.forEach(day => {
        console.log(`   ${day.dayName} (${day.date}): ${day.events.length} events`);
      });
    }

    console.log("\n📋 FULL RESPONSE:");
    console.log(JSON.stringify(parsed, null, 2));

  } catch (error) {
    console.error("❌ FUNCTION NOT FOUND OR ERROR:");
    console.error(`   ${error.toString()}`);
    console.error("\n💡 HINT: Make sure Optimized.gs file exists with doGet_Optimized() function");
  }
}


/**
 * testEnhanced() - Test ENHANCED version directly
 *
 * Bypasses the router and tests the enhanced implementation directly.
 * Useful for debugging the enhanced version with structured metadata.
 */
function testEnhanced() {
  console.log("🧪 TESTING ENHANCED VERSION (v5.0)");
  console.log("=".repeat(60));

  const mockEvent = {
    parameter: {
      name: "Harms, J *",
      days: "1",
      testDate: "2025-12-15"
    }
  };

  console.log("Calling doGet_Enhanced() with test date...\n");

  try {
    const response = doGet_Enhanced(mockEvent);
    const content = response.getContent();
    const parsed = JSON.parse(content);

    if (parsed.error) {
      console.log("❌ ERROR:");
      console.log(`   ${parsed.message}`);
      if (parsed.stack) {
        console.log(`   Stack: ${parsed.stack}`);
      }
    } else {
      console.log("✅ SUCCESS:");
      console.log(`   Version: ${parsed.version}`);
      console.log(`   Enhanced: ${parsed.enhanced}`);
      console.log(`   Total events: ${parsed.totalEvents}`);
      console.log(`   Days searched: ${parsed.daysSearched}`);

      console.log("\n📅 ENHANCED EVENTS:");
      parsed.events.forEach(day => {
        console.log(`\n   ${day.dayName} (${day.date}): ${day.events.length} events`);
        day.events.forEach((evt, idx) => {
          console.log(`   ${idx + 1}. Section: ${evt.enhanced.section}`);
          console.log(`      Legacy: ${evt.description.substring(0, 60)}`);
        });
      });
    }

    console.log("\n📋 FULL RESPONSE:");
    console.log(JSON.stringify(parsed, null, 2));

  } catch (error) {
    console.error("❌ FUNCTION NOT FOUND OR ERROR:");
    console.error(`   ${error.toString()}`);
    console.error("\n💡 HINT: Make sure Enhanced.gs file exists with doGet_Enhanced() function");
  }
}


/**
 * testAllVersions() - Compare all three versions side by side
 *
 * Runs all implementations and compares the results.
 * Useful for verifying all versions work and produce consistent results.
 */
function testAllVersions() {
  console.log("🧪 TESTING ALL VERSIONS - COMPARISON");
  console.log("=".repeat(60));

  const mockEvent = {
    parameter: {
      name: "Sick",
      days: "4"
    }
  };

  console.log("Testing with: ?name=Sick&days=4\n");

  // Test Simplified
  console.log("📦 SIMPLIFIED VERSION (v4.0):");
  console.log("-".repeat(60));
  try {
    const startSimplified = Date.now();
    const responseSimplified = doGet_Simplified(mockEvent);
    const durationSimplified = Date.now() - startSimplified;
    const parsedSimplified = JSON.parse(responseSimplified.getContent());

    if (parsedSimplified.error) {
      console.log(`❌ Error: ${parsedSimplified.message}`);
    } else {
      console.log(`✅ Version: ${parsedSimplified.version}`);
      console.log(`⏱️  Duration: ${durationSimplified}ms`);
      console.log(`📊 Events: ${parsedSimplified.totalEvents}`);
      console.log(`📅 Days: ${parsedSimplified.daysSearched}`);
    }
  } catch (error) {
    console.log(`❌ Function not found: ${error.toString()}`);
  }

  console.log("");

  // Test Optimized
  console.log("📦 OPTIMIZED VERSION (v3.1):");
  console.log("-".repeat(60));
  try {
    const startOptimized = Date.now();
    const responseOptimized = doGet_Optimized(mockEvent);
    const durationOptimized = Date.now() - startOptimized;
    const parsedOptimized = JSON.parse(responseOptimized.getContent());

    if (parsedOptimized.error) {
      console.log(`❌ Error: ${parsedOptimized.message}`);
    } else {
      console.log(`✅ Version: ${parsedOptimized.version}`);
      console.log(`⏱️  Duration: ${durationOptimized}ms`);
      console.log(`📊 Events: ${parsedOptimized.totalEvents}`);
      console.log(`📅 Days: ${parsedOptimized.daysSearched}`);
    }
  } catch (error) {
    console.log(`❌ Function not found: ${error.toString()}`);
  }

  console.log("");

  // Test Enhanced
  console.log("📦 ENHANCED VERSION (v5.0):");
  console.log("-".repeat(60));
  try {
    const startEnhanced = Date.now();
    const responseEnhanced = doGet_Enhanced(mockEvent);
    const durationEnhanced = Date.now() - startEnhanced;
    const parsedEnhanced = JSON.parse(responseEnhanced.getContent());

    if (parsedEnhanced.error) {
      console.log(`❌ Error: ${parsedEnhanced.message}`);
    } else {
      console.log(`✅ Version: ${parsedEnhanced.version}`);
      console.log(`⏱️  Duration: ${durationEnhanced}ms`);
      console.log(`📊 Events: ${parsedEnhanced.totalEvents}`);
      console.log(`📅 Days: ${parsedEnhanced.daysSearched}`);
    }
  } catch (error) {
    console.log(`❌ Function not found: ${error.toString()}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("💡 NOTE:");
  console.log("   All versions should return the same events");
  console.log("   Differences: performance, caching, and metadata detail (Enhanced)");
}


/**
 * testVersionSwitching() - Test switching via URL parameter
 *
 * Tests that the version parameter works correctly.
 * Only works if ALLOW_VERSION_OVERRIDE = true
 */
function testVersionSwitching() {
  console.log("🧪 TESTING VERSION SWITCHING VIA URL PARAMETER");
  console.log("=".repeat(60));
  console.log(`ALLOW_VERSION_OVERRIDE: ${ALLOW_VERSION_OVERRIDE}`);
  console.log(`ACTIVE_VERSION: ${ACTIVE_VERSION}\n`);

  if (!ALLOW_VERSION_OVERRIDE) {
    console.log("⚠️  WARNING: ALLOW_VERSION_OVERRIDE is false");
    console.log("   URL parameter will be ignored");
    console.log("   Set ALLOW_VERSION_OVERRIDE = true to enable\n");
  }

  const tests = [
    { version: undefined, desc: "No version param (uses ACTIVE_VERSION)" },
    { version: "simplified", desc: "version=simplified" },
    { version: "optimized", desc: "version=optimized" },
    { version: "enhanced", desc: "version=enhanced" },
    { version: "4.0", desc: "version=4.0 (alias for simplified)" },
    { version: "3.1", desc: "version=3.1 (alias for optimized)" },
    { version: "5.0", desc: "version=5.0 (alias for enhanced)" }
  ];

  tests.forEach(test => {
    console.log(`📋 Test: ${test.desc}`);
    console.log("-".repeat(60));

    const mockEvent = {
      parameter: {
        name: "Sick",
        days: "4"
      }
    };

    if (test.version) {
      mockEvent.parameter.version = test.version;
    }

    try {
      const response = doGet(mockEvent);
      const parsed = JSON.parse(response.getContent());

      if (parsed.error) {
        console.log(`❌ Error: ${parsed.message}`);
      } else {
        console.log(`✅ Routed to version: ${parsed.version}`);
        console.log(`   Simplified: ${parsed.simplified || false}`);
        console.log(`   Events found: ${parsed.totalEvents}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.toString()}`);
    }

    console.log("");
  });

  console.log("=".repeat(60));
  console.log("✅ Version switching test complete");
}


/**
 * showRouterInfo() - Display current router configuration
 *
 * Shows which version is active and how to switch.
 */
function showRouterInfo() {
  console.log("ℹ️  ROUTER CONFIGURATION");
  console.log("=".repeat(60));
  console.log(`Active Version: ${ACTIVE_VERSION}`);
  console.log(`Allow URL Override: ${ALLOW_VERSION_OVERRIDE}`);
  console.log("");

  console.log("📦 AVAILABLE VERSIONS:");
  console.log("   • SIMPLIFIED (v4.0) - No cache, simple text parsing");
  console.log("   • OPTIMIZED (v3.1) - With cache, simple text parsing");
  console.log("   • ENHANCED (v5.0) - No cache, advanced structured parsing");
  console.log("");

  console.log("🔧 TO SWITCH VERSIONS:");
  console.log("   1. Edit Main.gs");
  console.log(`   2. Change: const ACTIVE_VERSION = "${ACTIVE_VERSION}"`);
  console.log("   3. Deploy → Manage Deployments → Edit → Deploy");
  console.log("");

  if (ALLOW_VERSION_OVERRIDE) {
    console.log("🌐 URL PARAMETER OVERRIDE (ENABLED):");
    console.log("   Add to URL: &version=simplified | optimized | enhanced");
    console.log("   Example: ?name=Sick&days=4&version=enhanced");
  } else {
    console.log("🌐 URL PARAMETER OVERRIDE (DISABLED):");
    console.log("   Set ALLOW_VERSION_OVERRIDE = true to enable");
  }

  console.log("");
  console.log("🧪 QUICK TESTS:");
  console.log("   • testRouter() - Test current active version");
  console.log("   • testSimplified() - Test simplified version directly");
  console.log("   • testOptimized() - Test optimized version directly");
  console.log("   • testEnhanced() - Test enhanced version directly");
  console.log("   • testAllVersions() - Compare all three versions");
  console.log("   • testVersionSwitching() - Test URL parameter switching");
  console.log("=".repeat(60));
}
