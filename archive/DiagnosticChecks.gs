/**
 * Diagnostic Checks for TPS Schedule Batch Processing
 *
 * Run these functions to diagnose issues with triggers, cache, and dates
 */

/**
 * Check if triggers are running and when they last executed
 */
function checkTriggerExecutionStatus() {
  console.log('=== TRIGGER EXECUTION STATUS ===\n');

  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Total triggers: ${triggers.length}\n`);

  const batchTriggers = triggers.filter(t =>
    t.getHandlerFunction() === 'batchProcessRecent' ||
    t.getHandlerFunction() === 'batchProcessUpcoming'
  );

  console.log('Batch Processing Triggers:');
  batchTriggers.forEach(trigger => {
    console.log(`  • ${trigger.getHandlerFunction()}`);
    console.log(`    Event: ${trigger.getEventType()}`);
    console.log(`    Source: ${trigger.getTriggerSource()}`);

    // Check if it's a time-based trigger
    if (trigger.getEventType() === ScriptApp.EventType.CLOCK) {
      console.log(`    Type: Time-based`);
    }
  });

  console.log('\n=== RECENT EXECUTIONS ===');
  console.log('Note: Check Apps Script Executions tab for detailed logs');
  console.log('Go to: Extensions → Apps Script → Left sidebar → Executions (clock icon)');

  console.log('\n=== CACHE STATUS ===');
  const cache = CacheService.getScriptCache();
  const metadata = cache.get('batch_metadata');

  if (metadata) {
    const meta = JSON.parse(metadata);
    console.log('Last batch run:');
    console.log(`  • Timestamp: ${meta.lastRun}`);
    console.log(`  • Tier: ${meta.tier}`);
    console.log(`  • Duration: ${meta.duration} minutes`);
    console.log(`  • Sheets processed: ${meta.sheetsProcessed}`);
    console.log(`  • People processed: ${meta.peopleProcessed}`);

    const lastRun = new Date(meta.lastRun);
    const now = new Date();
    const minutesAgo = Math.floor((now - lastRun) / (1000 * 60));
    console.log(`  • Time since last run: ${minutesAgo} minutes ago`);

    if (minutesAgo > 60) {
      console.log(`  ⚠️  WARNING: Cache is ${minutesAgo} minutes old!`);
      console.log(`     Expected: Recent tier should run every 15 min`);
      console.log(`     Expected: Upcoming tier should run every 30 min`);
    }
  } else {
    console.log('❌ No batch metadata found in cache!');
    console.log('   Triggers may not be running or batch process hasn\'t run yet.');
  }

  console.log('\n=== PEOPLE IN CACHE ===');
  const peopleList = cache.get('batch_people_list');
  if (peopleList) {
    const people = JSON.parse(peopleList);
    console.log(`Total people cached: ${people.length}`);
    console.log(`Sample: ${people.slice(0, 5).join(', ')}...`);
  } else {
    console.log('❌ No people list found in cache!');
  }
}

/**
 * Check date formatting in cache
 */
function checkCacheDateFormats() {
  console.log('=== CACHE DATE FORMAT CHECK ===\n');

  const cache = CacheService.getScriptCache();

  // Check a sample person
  const testPerson = 'Sick';  // Change to a person you know exists
  const cacheKey = `schedule_${testPerson}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    const data = JSON.parse(cached);
    console.log(`Person: ${data.person}`);
    console.log(`Days array: ${JSON.stringify(data.days)}`);
    console.log(`Last updated: ${data.lastUpdated}`);

    if (data.events && data.events.length > 0) {
      console.log(`\nFirst event:`);
      const firstEvent = data.events[0];
      console.log(`  • Date: "${firstEvent.date}" (format: ${typeof firstEvent.date})`);
      console.log(`  • Day: "${firstEvent.day || firstEvent.dayName}"`);
      console.log(`  • Time: "${firstEvent.time}"`);
      console.log(`  • Event: "${firstEvent.event}"`);

      // Check if date is ISO format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(firstEvent.date)) {
        console.log(`  ✅ Date is in ISO format (YYYY-MM-DD)`);
      } else {
        console.log(`  ⚠️  Date is NOT in ISO format!`);
        console.log(`     Expected: YYYY-MM-DD (e.g., 2025-01-05)`);
        console.log(`     Got: ${firstEvent.date}`);
      }
    }

    console.log(`\nFull cached data:`);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`❌ No cached data found for "${testPerson}"`);
    console.log('Try a different person or run batch process first.');
  }
}

/**
 * Check current sheet availability
 */
function checkAvailableSheets() {
  console.log('=== AVAILABLE SHEETS CHECK ===\n');

  const ss = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);
  const allSheets = ss.getSheets();

  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  console.log(`Today is: ${dayNames[today.getDay()]}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`);
  console.log(`ISO format: ${today.toISOString().split('T')[0]}\n`);

  console.log('All sheet names:');
  const dateSheets = [];
  allSheets.forEach(sheet => {
    const name = sheet.getName();
    console.log(`  • ${name}`);

    // Check if it looks like a date sheet
    const datePattern = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i;
    if (datePattern.test(name)) {
      dateSheets.push(name);
    }
  });

  console.log(`\nDate sheets found: ${dateSheets.length}`);
  dateSheets.forEach(name => console.log(`  • ${name}`));

  // Check next 14 days for available sheets
  console.log('\n=== SHEET AVAILABILITY (Next 14 Days) ===');
  for (let i = 0; i < 14; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);

    const dayName = dayNames[targetDate.getDay()];
    const dayNameShort = dayNamesShort[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const day = targetDate.getDate();

    const sheetName1 = `${dayNameShort} ${day} ${monthName}`;
    const sheetName2 = `${dayName}, ${day} ${monthName}`;

    const sheet = ss.getSheetByName(sheetName1) || ss.getSheetByName(sheetName2);

    const isoDate = targetDate.toISOString().split('T')[0];
    const status = sheet ? '✅' : '❌';
    const foundName = sheet ? sheet.getName() : '(not found)';

    console.log(`  ${status} Day +${i}: ${isoDate} (${dayNameShort}) → ${foundName}`);
  }
}

/**
 * Test batch processing for today
 */
function testBatchProcessToday() {
  console.log('=== TEST BATCH PROCESS FOR TODAY ===\n');

  try {
    console.log('Running batchProcessRecent() (days 0-2)...\n');
    const result = batchProcessRecent();

    console.log('Results:');
    console.log(`  • Tier: ${result.tier}`);
    console.log(`  • Day range: ${result.dayRange}`);
    console.log(`  • Duration: ${result.totalDuration} minutes`);
    console.log(`  • Sheets processed: ${result.sheetsProcessed}`);
    console.log(`  • People processed: ${result.peopleProcessed}`);
    console.log(`  • Events found: ${result.eventsFound}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach(err => console.log(`  • ${err}`));
    }

    if (result.sheetMetrics && result.sheetMetrics.length > 0) {
      console.log(`\nSheet metrics:`);
      result.sheetMetrics.forEach(m => {
        console.log(`  • ${m.sheet}: ${m.duration.toFixed(2)}s, ${m.eventsFound} events`);
      });
    }

    console.log('\n✅ Batch process completed successfully!');
    console.log('Check cache with checkCacheDateFormats() to verify data.');

  } catch (error) {
    console.error('❌ Error running batch process:');
    console.error(error.toString());
    console.error(error.stack);
  }
}

/**
 * Run all diagnostic checks
 */
function runAllDiagnostics() {
  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║' + ' '.repeat(15) + 'TPS SCHEDULE DIAGNOSTICS' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(60) + '╝');
  console.log('');

  checkTriggerExecutionStatus();
  console.log('\n' + '─'.repeat(60) + '\n');

  checkAvailableSheets();
  console.log('\n' + '─'.repeat(60) + '\n');

  checkCacheDateFormats();
  console.log('\n' + '─'.repeat(60) + '\n');

  console.log('✅ All diagnostic checks complete!');
  console.log('\nNext steps:');
  console.log('  1. If triggers aren\'t running: Check Executions tab for errors');
  console.log('  2. If cache is stale: Run testBatchProcessToday() to refresh');
  console.log('  3. If date format is wrong: Check batch processor date logic');
}
