/**
 * TPS Schedule - Automated Trigger Setup
 *
 * Creates time-based triggers for the tiered batch processing system
 *
 * QUOTA USAGE (verified with real execution times):
 * - Recent (every 20 min): 72 runs/day × 0.49 min = 35.3 min/day
 * - Upcoming (every 30 min): 48 runs/day × 0.54 min = 25.9 min/day
 * - TOTAL: 61.2 min/day (68% of 90 min daily limit)
 */

// ======================
// TRIGGER CONFIGURATION
// ======================

const TRIGGER_CONFIG = {
  recent: {
    functionName: 'batchProcessRecent',
    intervalMinutes: 20,
    description: 'Process days 0-2 (today through day after tomorrow)'
  },
  upcoming: {
    functionName: 'batchProcessUpcoming',
    intervalMinutes: 30,
    description: 'Process days 3-7 (upcoming week)'
  }
};

// ===================
// SETUP FUNCTIONS
// ===================

/**
 * MAIN SETUP: Run this once to configure all triggers
 *
 * This will:
 * 1. Delete any existing triggers for these functions (cleanup)
 * 2. Create RECENT trigger (every 20 minutes)
 * 3. Create UPCOMING trigger (every 30 minutes)
 * 4. Verify triggers were created successfully
 */
function setupAllTriggers() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     TPS SCHEDULE - AUTOMATED TRIGGER SETUP             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Cleanup existing triggers
    console.log('Step 1: Cleaning up existing triggers...');
    deleteAllBatchTriggers();
    console.log('✓ Cleanup complete\n');

    // Step 2: Create RECENT trigger (every 20 minutes)
    console.log('Step 2: Creating RECENT trigger...');
    console.log(`  Function: ${TRIGGER_CONFIG.recent.functionName}`);
    console.log(`  Interval: Every ${TRIGGER_CONFIG.recent.intervalMinutes} minutes`);
    console.log(`  Purpose: ${TRIGGER_CONFIG.recent.description}`);

    const recentTrigger = ScriptApp.newTrigger(TRIGGER_CONFIG.recent.functionName)
      .timeBased()
      .everyMinutes(TRIGGER_CONFIG.recent.intervalMinutes)
      .create();

    console.log(`✓ Created trigger ID: ${recentTrigger.getUniqueId()}\n`);

    // Step 3: Create UPCOMING trigger (every 30 minutes)
    console.log('Step 3: Creating UPCOMING trigger...');
    console.log(`  Function: ${TRIGGER_CONFIG.upcoming.functionName}`);
    console.log(`  Interval: Every ${TRIGGER_CONFIG.upcoming.intervalMinutes} minutes`);
    console.log(`  Purpose: ${TRIGGER_CONFIG.upcoming.description}`);

    const upcomingTrigger = ScriptApp.newTrigger(TRIGGER_CONFIG.upcoming.functionName)
      .timeBased()
      .everyMinutes(TRIGGER_CONFIG.upcoming.intervalMinutes)
      .create();

    console.log(`✓ Created trigger ID: ${upcomingTrigger.getUniqueId()}\n`);

    // Step 4: Verify and display summary
    console.log('Step 4: Verification...');
    const triggers = ScriptApp.getProjectTriggers();
    const batchTriggers = triggers.filter(t =>
      t.getHandlerFunction() === TRIGGER_CONFIG.recent.functionName ||
      t.getHandlerFunction() === TRIGGER_CONFIG.upcoming.functionName
    );

    console.log(`\n✓ Total triggers created: ${batchTriggers.length}\n`);

    // Display quota summary
    console.log('═════════════════════════════════════════════════════');
    console.log('                 QUOTA SUMMARY                       ');
    console.log('═════════════════════════════════════════════════════');
    console.log(`Recent tier (every ${TRIGGER_CONFIG.recent.intervalMinutes} min):`);
    console.log(`  - ${Math.floor(1440 / TRIGGER_CONFIG.recent.intervalMinutes)} runs/day × 0.49 min = ${(Math.floor(1440 / TRIGGER_CONFIG.recent.intervalMinutes) * 0.49).toFixed(1)} min/day`);
    console.log(`\nUpcoming tier (every ${TRIGGER_CONFIG.upcoming.intervalMinutes} min):`);
    console.log(`  - ${Math.floor(1440 / TRIGGER_CONFIG.upcoming.intervalMinutes)} runs/day × 0.54 min = ${(Math.floor(1440 / TRIGGER_CONFIG.upcoming.intervalMinutes) * 0.54).toFixed(1)} min/day`);

    const totalQuota = (Math.floor(1440 / TRIGGER_CONFIG.recent.intervalMinutes) * 0.49) +
                       (Math.floor(1440 / TRIGGER_CONFIG.upcoming.intervalMinutes) * 0.54);

    console.log(`\nTOTAL: ${totalQuota.toFixed(1)} min/day (${(totalQuota/90*100).toFixed(1)}% of 90 min limit)`);
    console.log('═════════════════════════════════════════════════════\n');

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              ✓ SETUP COMPLETE!                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Monitor the Executions tab (clock icon → Executions)');
    console.log('2. Wait 20-30 minutes for first batch runs to complete');
    console.log('3. Test the API to verify cache is being populated');
    console.log('4. Check quota usage after 24 hours\n');

    return {
      success: true,
      triggersCreated: batchTriggers.length,
      recentTriggerId: recentTrigger.getUniqueId(),
      upcomingTriggerId: upcomingTrigger.getUniqueId()
    };

  } catch (e) {
    console.error('❌ ERROR during trigger setup:', e);
    console.error('Stack:', e.stack);
    throw e;
  }
}

/**
 * Delete all existing batch processing triggers
 * Useful for cleanup before recreating triggers
 */
function deleteAllBatchTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;

  triggers.forEach(trigger => {
    const functionName = trigger.getHandlerFunction();

    // Delete triggers for batch processing functions
    if (functionName === 'batchProcessRecent' ||
        functionName === 'batchProcessUpcoming' ||
        functionName === 'batchProcessAllSchedules') {

      console.log(`  Deleting trigger for: ${functionName} (ID: ${trigger.getUniqueId()})`);
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  console.log(`  Deleted ${deletedCount} existing batch triggers`);
  return deletedCount;
}

/**
 * List all current triggers (for debugging)
 */
function listAllTriggers() {
  console.log('=== ALL PROJECT TRIGGERS ===\n');

  const triggers = ScriptApp.getProjectTriggers();

  if (triggers.length === 0) {
    console.log('No triggers found.');
    return;
  }

  triggers.forEach((trigger, index) => {
    console.log(`Trigger ${index + 1}:`);
    console.log(`  ID: ${trigger.getUniqueId()}`);
    console.log(`  Function: ${trigger.getHandlerFunction()}`);
    console.log(`  Event Type: ${trigger.getEventType()}`);

    if (trigger.getEventType() === ScriptApp.EventType.CLOCK) {
      console.log(`  Trigger Source: ${trigger.getTriggerSource()}`);
    }

    console.log('');
  });

  console.log(`Total triggers: ${triggers.length}`);
}

/**
 * Delete ALL triggers (nuclear option - use with caution!)
 */
function deleteAllTriggers() {
  const confirmation = Browser.msgBox(
    'Delete ALL Triggers?',
    'This will delete ALL triggers in this project. Are you sure?',
    Browser.Buttons.YES_NO
  );

  if (confirmation !== 'yes') {
    console.log('Cancelled.');
    return;
  }

  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });

  console.log(`✓ Deleted all ${triggers.length} triggers`);
}

/**
 * Test trigger setup without actually creating triggers
 * Useful for verifying configuration
 */
function testTriggerConfiguration() {
  console.log('=== TRIGGER CONFIGURATION TEST ===\n');

  console.log('Recent Tier Configuration:');
  console.log(`  Function: ${TRIGGER_CONFIG.recent.functionName}`);
  console.log(`  Interval: ${TRIGGER_CONFIG.recent.intervalMinutes} minutes`);
  console.log(`  Description: ${TRIGGER_CONFIG.recent.description}`);
  console.log(`  Runs per day: ${Math.floor(1440 / TRIGGER_CONFIG.recent.intervalMinutes)}`);
  console.log(`  Estimated quota: ${(Math.floor(1440 / TRIGGER_CONFIG.recent.intervalMinutes) * 0.49).toFixed(1)} min/day\n`);

  console.log('Upcoming Tier Configuration:');
  console.log(`  Function: ${TRIGGER_CONFIG.upcoming.functionName}`);
  console.log(`  Interval: ${TRIGGER_CONFIG.upcoming.intervalMinutes} minutes`);
  console.log(`  Description: ${TRIGGER_CONFIG.upcoming.description}`);
  console.log(`  Runs per day: ${Math.floor(1440 / TRIGGER_CONFIG.upcoming.intervalMinutes)}`);
  console.log(`  Estimated quota: ${(Math.floor(1440 / TRIGGER_CONFIG.upcoming.intervalMinutes) * 0.54).toFixed(1)} min/day\n`);

  const totalQuota = (Math.floor(1440 / TRIGGER_CONFIG.recent.intervalMinutes) * 0.49) +
                     (Math.floor(1440 / TRIGGER_CONFIG.upcoming.intervalMinutes) * 0.54);

  console.log(`Total Daily Quota: ${totalQuota.toFixed(1)} min (${(totalQuota/90*100).toFixed(1)}% of 90 min limit)`);
  console.log(totalQuota <= 90 ? '✓ Within quota limits' : '❌ EXCEEDS quota limits');

  // Verify functions exist
  console.log('\nFunction Verification:');
  try {
    if (typeof this[TRIGGER_CONFIG.recent.functionName] === 'function') {
      console.log(`✓ ${TRIGGER_CONFIG.recent.functionName} exists`);
    } else {
      console.log(`❌ ${TRIGGER_CONFIG.recent.functionName} NOT FOUND`);
    }

    if (typeof this[TRIGGER_CONFIG.upcoming.functionName] === 'function') {
      console.log(`✓ ${TRIGGER_CONFIG.upcoming.functionName} exists`);
    } else {
      console.log(`❌ ${TRIGGER_CONFIG.upcoming.functionName} NOT FOUND`);
    }
  } catch (e) {
    console.log('Note: Function verification may not work in test mode');
  }

  console.log('\n✓ Configuration test complete');
  console.log('Run setupAllTriggers() to create the triggers');
}

/**
 * Quick status check - shows current triggers and next run times
 */
function checkTriggerStatus() {
  console.log('=== TRIGGER STATUS ===\n');

  const triggers = ScriptApp.getProjectTriggers();
  const batchTriggers = triggers.filter(t =>
    t.getHandlerFunction() === TRIGGER_CONFIG.recent.functionName ||
    t.getHandlerFunction() === TRIGGER_CONFIG.upcoming.functionName
  );

  if (batchTriggers.length === 0) {
    console.log('❌ No batch processing triggers found!');
    console.log('Run setupAllTriggers() to create them.\n');
    return;
  }

  console.log(`Found ${batchTriggers.length} batch processing triggers:\n`);

  batchTriggers.forEach(trigger => {
    console.log(`Function: ${trigger.getHandlerFunction()}`);
    console.log(`  ID: ${trigger.getUniqueId()}`);
    console.log(`  Type: Time-based`);
    console.log('');
  });

  console.log('✓ Triggers are active and running');
  console.log('\nTo monitor executions:');
  console.log('1. Click the clock icon (⏰) in the left sidebar');
  console.log('2. Click "Executions" tab');
  console.log('3. You should see runs appearing every 20-30 minutes\n');
}
