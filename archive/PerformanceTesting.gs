/**
 * Performance Testing Suite
 * Measures actual execution times for quota calculations
 */

// =======================
// COMPONENT TIMING TESTS
// =======================

/**
 * Test 1: Measure sheet processing time
 * How long does it take to read and process ONE sheet for all people?
 */
function test1_SheetProcessingTime() {
  console.log('=== TEST 1: Sheet Processing Time ===\n');

  const testDate = new Date('2026-01-05'); // Jan 5, 2026
  const sheets = getRelevantSheets(0, 1, testDate); // Just get 1 sheet

  if (sheets.length === 0) {
    console.error('No sheets found! Check test date.');
    return;
  }

  const people = getAllPeople();
  console.log(`Testing with ${people.length} people on sheet: ${sheets[0].sheetName}`);

  const start = new Date();
  const results = processSheet(sheets[0], people);
  const duration = (new Date() - start) / 1000;

  const totalEvents = Object.values(results).reduce((sum, p) => sum + p.events.length, 0);

  console.log('\n--- RESULTS ---');
  console.log(`Sheet: ${sheets[0].sheetName}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Events found: ${totalEvents}`);
  console.log(`People processed: ${Object.keys(results).length}`);
  console.log(`Avg time per person: ${(duration / people.length * 1000).toFixed(1)}ms`);

  return {
    sheetName: sheets[0].sheetName,
    duration: duration,
    people: people.length,
    events: totalEvents
  };
}

/**
 * Test 2: Measure people extraction time
 * How long to get the list of all people from sheets?
 */
function test2_PeopleExtractionTime() {
  console.log('=== TEST 2: People Extraction Time ===\n');

  const start = new Date();
  const people = getAllPeople();
  const duration = (new Date() - start) / 1000;

  console.log('\n--- RESULTS ---');
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`People found: ${people.length}`);

  return {
    duration: duration,
    peopleCount: people.length
  };
}

/**
 * Test 3: Measure cache writing time ONLY
 * How long does it take to cache 292 people with their data?
 */
function test3_CacheWritingTime() {
  console.log('=== TEST 3: Cache Writing Time ===\n');

  const cache = CacheService.getScriptCache();
  const testData = [];

  // Create realistic test data (similar size to actual schedule data)
  for (let i = 0; i < 292; i++) {
    testData.push({
      person: `TestPerson${i}`,
      class: 'Test Class',
      type: 'test',
      events: Array(5).fill(null).map((_, j) => ({
        day: 'Monday',
        date: '5 Jan',
        section: 'Flying Events',
        time: '1400-1600',
        event: `Test Event ${j}`,
        crew: '1x1',
        status: 'effective'
      })),
      days: ['2026-01-05', '2026-01-06'],
      lastUpdated: new Date().toISOString(),
      version: '5.0-test'
    });
  }

  console.log(`Prepared ${testData.length} test records`);
  console.log(`Sample size: ${Utilities.newBlob(JSON.stringify(testData[0])).getBytes().length} bytes\n`);

  // Measure cache writing
  const start = new Date();
  let successCount = 0;
  let totalBytes = 0;

  testData.forEach((data, i) => {
    try {
      const json = JSON.stringify(data);
      const bytes = Utilities.newBlob(json).getBytes().length;
      cache.put(`test_schedule_${i}`, json, 300); // 5 min TTL for test
      successCount++;
      totalBytes += bytes;
    } catch (e) {
      console.error(`Error caching test record ${i}: ${e}`);
    }
  });

  const duration = (new Date() - start) / 1000;

  console.log('\n--- RESULTS ---');
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Records cached: ${successCount}/${testData.length}`);
  console.log(`Total size: ${(totalBytes / 1024).toFixed(2)} KB`);
  console.log(`Avg time per record: ${(duration / successCount * 1000).toFixed(1)}ms`);
  console.log(`Avg size per record: ${(totalBytes / successCount / 1024).toFixed(2)} KB`);

  // Cleanup
  console.log('\nCleaning up test cache entries...');
  for (let i = 0; i < testData.length; i++) {
    cache.remove(`test_schedule_${i}`);
  }

  return {
    duration: duration,
    recordsCached: successCount,
    totalSizeKB: totalBytes / 1024,
    avgTimePerRecordMs: duration / successCount * 1000,
    avgSizePerRecordKB: totalBytes / successCount / 1024
  };
}

/**
 * Test 4: Measure FULL tier execution (days 0-2)
 * End-to-end timing for RECENT tier
 */
function test4_RecentTierFullExecution() {
  console.log('=== TEST 4: RECENT Tier Full Execution (Days 0-2) ===\n');

  const testDate = new Date('2026-01-05');
  const originalGetRelevantSheets = this.getRelevantSheets;

  this.getRelevantSheets = function(startDay, endDay) {
    return originalGetRelevantSheets(startDay, endDay, testDate);
  };

  try {
    const start = new Date();
    const metrics = batchProcessRecent();
    const duration = (new Date() - start) / 1000;

    console.log('\n--- DETAILED BREAKDOWN ---');
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Sheets: ${metrics.sheetsProcessed}`);
    console.log(`People: ${metrics.peopleProcessed}`);
    console.log(`Events: ${metrics.eventsFound}`);
    console.log(`Cache Size: ${(metrics.cacheSize / 1024).toFixed(2)} KB`);
    console.log(`Errors: ${metrics.errors.length}`);

    // Calculate component times
    const sheetProcessingTime = metrics.sheetMetrics.reduce((sum, m) => sum + m.duration, 0);
    const cachingTime = duration - sheetProcessingTime;

    console.log('\n--- TIME BREAKDOWN ---');
    console.log(`Sheet Processing: ${sheetProcessingTime.toFixed(2)}s (${(sheetProcessingTime/duration*100).toFixed(1)}%)`);
    console.log(`Caching: ${cachingTime.toFixed(2)}s (${(cachingTime/duration*100).toFixed(1)}%)`);
    console.log(`Per sheet: ${(sheetProcessingTime/metrics.sheetsProcessed).toFixed(2)}s avg`);
    console.log(`Per person cache: ${(cachingTime/metrics.peopleProcessed*1000).toFixed(1)}ms avg`);

    return {
      totalDuration: duration,
      sheetProcessingTime: sheetProcessingTime,
      cachingTime: cachingTime,
      sheets: metrics.sheetsProcessed,
      people: metrics.peopleProcessed,
      events: metrics.eventsFound
    };

  } finally {
    this.getRelevantSheets = originalGetRelevantSheets;
  }
}

/**
 * Test 5: Measure FULL tier execution (days 3-7)
 * End-to-end timing for UPCOMING tier
 */
function test5_UpcomingTierFullExecution() {
  console.log('=== TEST 5: UPCOMING Tier Full Execution (Days 3-7) ===\n');

  const testDate = new Date('2026-01-05');
  const originalGetRelevantSheets = this.getRelevantSheets;

  this.getRelevantSheets = function(startDay, endDay) {
    return originalGetRelevantSheets(startDay, endDay, testDate);
  };

  try {
    const start = new Date();
    const metrics = batchProcessUpcoming();
    const duration = (new Date() - start) / 1000;

    console.log('\n--- DETAILED BREAKDOWN ---');
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Sheets: ${metrics.sheetsProcessed}`);
    console.log(`People: ${metrics.peopleProcessed}`);
    console.log(`Events: ${metrics.eventsFound}`);
    console.log(`Cache Size: ${(metrics.cacheSize / 1024).toFixed(2)} KB`);
    console.log(`Errors: ${metrics.errors.length}`);

    // Calculate component times
    const sheetProcessingTime = metrics.sheetMetrics.reduce((sum, m) => sum + m.duration, 0);
    const cachingTime = duration - sheetProcessingTime;

    console.log('\n--- TIME BREAKDOWN ---');
    console.log(`Sheet Processing: ${sheetProcessingTime.toFixed(2)}s (${(sheetProcessingTime/duration*100).toFixed(1)}%)`);
    console.log(`Caching: ${cachingTime.toFixed(2)}s (${(cachingTime/duration*100).toFixed(1)}%)`);
    console.log(`Per sheet: ${(sheetProcessingTime/metrics.sheetsProcessed).toFixed(2)}s avg`);
    console.log(`Per person cache: ${(cachingTime/metrics.peopleProcessed*1000).toFixed(1)}ms avg`);

    return {
      totalDuration: duration,
      sheetProcessingTime: sheetProcessingTime,
      cachingTime: cachingTime,
      sheets: metrics.sheetsProcessed,
      people: metrics.peopleProcessed,
      events: metrics.eventsFound
    };

  } finally {
    this.getRelevantSheets = originalGetRelevantSheets;
  }
}

// ========================
// COMPREHENSIVE TEST SUITE
// ========================

/**
 * Run ALL performance tests and generate quota calculations
 * This gives you REAL numbers for setting up triggers
 */
function runAllPerformanceTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   TPS SCHEDULE - COMPREHENSIVE PERFORMANCE TESTING     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const results = {};

  try {
    // Test 1: Sheet processing
    console.log('\n' + '='.repeat(60));
    results.test1 = test1_SheetProcessingTime();
    Utilities.sleep(2000); // 2 sec pause between tests

    // Test 2: People extraction
    console.log('\n' + '='.repeat(60));
    results.test2 = test2_PeopleExtractionTime();
    Utilities.sleep(2000);

    // Test 3: Cache writing
    console.log('\n' + '='.repeat(60));
    results.test3 = test3_CacheWritingTime();
    Utilities.sleep(2000);

    // Test 4: Recent tier
    console.log('\n' + '='.repeat(60));
    results.test4 = test4_RecentTierFullExecution();
    Utilities.sleep(2000);

    // Test 5: Upcoming tier
    console.log('\n' + '='.repeat(60));
    results.test5 = test5_UpcomingTierFullExecution();

    // Generate quota calculations
    console.log('\n' + '='.repeat(60));
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              QUOTA CALCULATIONS (REAL DATA)            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const recentDuration = results.test4.totalDuration / 60; // minutes
    const upcomingDuration = results.test5.totalDuration / 60; // minutes

    console.log('--- RECENT TIER (Days 0-2) ---');
    console.log(`Duration: ${recentDuration.toFixed(2)} minutes`);
    console.log(`If run every 30 min: ${(48 * recentDuration).toFixed(1)} min/day`);
    console.log(`If run every 45 min: ${(32 * recentDuration).toFixed(1)} min/day`);
    console.log(`If run every 60 min: ${(24 * recentDuration).toFixed(1)} min/day`);

    console.log('\n--- UPCOMING TIER (Days 3-7) ---');
    console.log(`Duration: ${upcomingDuration.toFixed(2)} minutes`);
    console.log(`If run every 1 hour: ${(24 * upcomingDuration).toFixed(1)} min/day`);
    console.log(`If run every 2 hours: ${(12 * upcomingDuration).toFixed(1)} min/day`);
    console.log(`If run every 3 hours: ${(8 * upcomingDuration).toFixed(1)} min/day`);

    console.log('\n--- RECOMMENDED COMBINATIONS ---');

    const combo1 = 48 * recentDuration + 8 * upcomingDuration;
    console.log(`Option 1: Recent every 30 min + Upcoming every 3 hr = ${combo1.toFixed(1)} min/day ${combo1 <= 90 ? '✅' : '❌'}`);

    const combo2 = 32 * recentDuration + 8 * upcomingDuration;
    console.log(`Option 2: Recent every 45 min + Upcoming every 3 hr = ${combo2.toFixed(1)} min/day ${combo2 <= 90 ? '✅' : '❌'}`);

    const combo3 = 24 * recentDuration + 8 * upcomingDuration;
    console.log(`Option 3: Recent every 60 min + Upcoming every 3 hr = ${combo3.toFixed(1)} min/day ${combo3 <= 90 ? '✅' : '❌'}`);

    const combo4 = 32 * recentDuration + 12 * upcomingDuration;
    console.log(`Option 4: Recent every 45 min + Upcoming every 2 hr = ${combo4.toFixed(1)} min/day ${combo4 <= 90 ? '✅' : '❌'}`);

    console.log('\n--- DAILY QUOTA LIMIT: 90 minutes ---\n');

    return results;

  } catch (e) {
    console.error('\n❌ ERROR during testing:', e);
    console.error('Stack:', e.stack);
    throw e;
  }
}

/**
 * Quick test - just run the two tiers and show quota usage
 */
function quickQuotaTest() {
  console.log('=== QUICK QUOTA TEST ===\n');

  const testDate = new Date('2026-01-05');
  const originalGetRelevantSheets = this.getRelevantSheets;

  this.getRelevantSheets = function(startDay, endDay) {
    return originalGetRelevantSheets(startDay, endDay, testDate);
  };

  try {
    console.log('Testing RECENT tier (days 0-2)...');
    const start1 = new Date();
    batchProcessRecent();
    const recentTime = (new Date() - start1) / 60000; // minutes

    console.log('\nTesting UPCOMING tier (days 3-7)...');
    const start2 = new Date();
    batchProcessUpcoming();
    const upcomingTime = (new Date() - start2) / 60000; // minutes

    console.log('\n' + '='.repeat(60));
    console.log('QUOTA CALCULATIONS:');
    console.log('='.repeat(60));
    console.log(`\nRecent tier: ${recentTime.toFixed(2)} min per run`);
    console.log(`Upcoming tier: ${upcomingTime.toFixed(2)} min per run`);

    console.log('\nWith recommended setup:');
    console.log(`  - Recent every 45 min: 32 runs × ${recentTime.toFixed(2)} = ${(32 * recentTime).toFixed(1)} min/day`);
    console.log(`  - Upcoming every 3 hr: 8 runs × ${upcomingTime.toFixed(2)} = ${(8 * upcomingTime).toFixed(1)} min/day`);
    console.log(`  TOTAL: ${(32 * recentTime + 8 * upcomingTime).toFixed(1)} min/day`);
    console.log(`  QUOTA: ${((32 * recentTime + 8 * upcomingTime) / 90 * 100).toFixed(1)}% of 90 min limit`);

  } finally {
    this.getRelevantSheets = originalGetRelevantSheets;
  }
}
