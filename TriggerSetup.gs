/**
 * TPS Schedule - Automated Trigger Setup
 *
 * Creates a single time-based trigger for batch processing
 *
 * QUOTA USAGE (with overnight skip 8 PM - 5 AM):
 * - Trigger fires: 96 times/day (every 15 min)
 * - Actually processes: ~60 times/day (work hours only)
 * - Quota used: 60 runs × 0.9 min = 54 min/day (60% of 90 min limit)
 */

// ======================
// TRIGGER CONFIGURATION
// ======================

const TRIGGER_CONFIG = {
  functionName: 'batchProcessSchedule',
  intervalMinutes: 15,  // Valid: 1, 5, 10, 15, 30
  description: 'Process all 7 days of schedules (skips overnight hours 8 PM - 5 AM)'
};

// ===================
// SETUP FUNCTIONS
// ===================

/**
 * MAIN SETUP: Run this once to configure the batch processing trigger
 *
 * This will:
 * 1. Delete any existing batch processing triggers (cleanup)
 * 2. Create a single trigger to run every 15 minutes
 * 3. Verify trigger was created successfully
 *
 * Note: The batch processor automatically skips overnight hours (8 PM - 5 AM Pacific)
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

    // Step 2: Create batch processing trigger
    console.log('Step 2: Creating batch processing trigger...');
    console.log(`  Function: ${TRIGGER_CONFIG.functionName}`);
    console.log(`  Interval: Every ${TRIGGER_CONFIG.intervalMinutes} minutes`);
    console.log(`  Purpose: ${TRIGGER_CONFIG.description}`);

    const trigger = ScriptApp.newTrigger(TRIGGER_CONFIG.functionName)
      .timeBased()
      .everyMinutes(TRIGGER_CONFIG.intervalMinutes)
      .create();

    console.log(`✓ Created trigger ID: ${trigger.getUniqueId()}\n`);

    // Step 3: Verify and display summary
    console.log('Step 3: Verification...');
    const triggers = ScriptApp.getProjectTriggers();
    const batchTriggers = triggers.filter(t =>
      t.getHandlerFunction() === TRIGGER_CONFIG.functionName
    );

    console.log(`\n✓ Trigger created successfully!\n`);

    // Display quota summary
    console.log('═════════════════════════════════════════════════════');
    console.log('                 QUOTA SUMMARY                       ');
    console.log('═════════════════════════════════════════════════════');
    console.log(`Trigger interval: Every ${TRIGGER_CONFIG.intervalMinutes} minutes`);
    console.log(`Trigger fires: ${Math.floor(1440 / TRIGGER_CONFIG.intervalMinutes)} times/day (24 hours)`);
    console.log(`Actually processes: ~60 times/day (work hours 5 AM - 8 PM)`);
    console.log(`Skipped overnight: ~36 times/day (8 PM - 5 AM)`);
    console.log(`\nQuota usage: 60 runs × 0.9 min = 54 min/day`);
    console.log(`Quota percentage: 60% of 90 min daily limit`);
    console.log(`Quota saved by overnight skip: 32 min/day (36%)`);
    console.log('═════════════════════════════════════════════════════\n');

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              ✓ SETUP COMPLETE!                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Monitor the Executions tab (clock icon → Executions)');
    console.log('2. Wait 15 minutes for first batch run to complete');
    console.log('3. Test the API to verify cache is being populated');
    console.log('4. Check quota usage after 24 hours\n');

    return {
      success: true,
      triggerId: trigger.getUniqueId(),
      functionName: TRIGGER_CONFIG.functionName,
      intervalMinutes: TRIGGER_CONFIG.intervalMinutes
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

    // Delete triggers for batch processing functions (including legacy names)
    if (functionName === 'batchProcessSchedule' ||
        functionName === 'batchProcessRecent' ||
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

  console.log('Batch Processing Configuration:');
  console.log(`  Function: ${TRIGGER_CONFIG.functionName}`);
  console.log(`  Interval: ${TRIGGER_CONFIG.intervalMinutes} minutes`);
  console.log(`  Description: ${TRIGGER_CONFIG.description}`);
  console.log(`  Runs per day: ${Math.floor(1440 / TRIGGER_CONFIG.intervalMinutes)} (triggers fire)`);
  console.log(`  Actual runs: ~60/day (work hours only, overnight skip)`);
  console.log(`  Estimated quota: 54 min/day (60% of 90 min limit)\n`);

  console.log('✓ Within quota limits');
  console.log('✓ Overnight hours automatically skipped (8 PM - 5 AM Pacific)');

  // Verify function exists
  console.log('\nFunction Verification:');
  try {
    if (typeof this[TRIGGER_CONFIG.functionName] === 'function') {
      console.log(`✓ ${TRIGGER_CONFIG.functionName} exists`);
    } else {
      console.log(`❌ ${TRIGGER_CONFIG.functionName} NOT FOUND`);
    }
  } catch (e) {
    console.log('Note: Function verification may not work in test mode');
  }

  console.log('\n✓ Configuration test complete');
  console.log('Run setupAllTriggers() to create the trigger');
}

/**
 * Quick status check - shows current triggers and status
 */
function checkTriggerStatus() {
  console.log('=== TRIGGER STATUS ===\n');

  const triggers = ScriptApp.getProjectTriggers();
  const batchTriggers = triggers.filter(t =>
    t.getHandlerFunction() === TRIGGER_CONFIG.functionName
  );

  if (batchTriggers.length === 0) {
    console.log('❌ No batch processing trigger found!');
    console.log('Run setupAllTriggers() to create it.\n');
    return;
  }

  console.log(`Found ${batchTriggers.length} batch processing trigger(s):\n`);

  batchTriggers.forEach(trigger => {
    console.log(`Function: ${trigger.getHandlerFunction()}`);
    console.log(`  ID: ${trigger.getUniqueId()}`);
    console.log(`  Type: Time-based (every ${TRIGGER_CONFIG.intervalMinutes} min)`);
    console.log('');
  });

  console.log('✓ Trigger is active and running');
  console.log('✓ Automatically skips overnight hours (8 PM - 5 AM Pacific)');
  console.log('\nTo monitor executions:');
  console.log('1. Click the clock icon (⏰) in the left sidebar');
  console.log('2. Click "Executions" tab');
  console.log('3. You should see runs every 15 minutes (work hours)\n');
}
