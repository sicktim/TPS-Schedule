/**
 * TEST ACADEMICS AND GROUPED EVENTS
 *
 * Run this function to test if academics and grouped events are being generated
 * properly by the backend.
 */

/**
 * Test with a known student to see if academics are generated
 */
function testAcademicsFeature() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING ACADEMICS FEATURE');
  console.log('='.repeat(70));

  // Test with different student types
  const testCases = [
    { name: 'Vantiger', expectedType: 'Students (Alpha)' },
    { name: 'Payne', expectedType: 'Students (Bravo)' },
    { name: 'Coleman', expectedType: 'Staff IP' }
  ];

  testCases.forEach(testCase => {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Testing: ${testCase.name} (Expected: ${testCase.expectedType})`);
    console.log('─'.repeat(70));

    // Create mock request
    const mockEvent = {
      parameter: {
        name: testCase.name,
        days: '1',
        showAcademics: 'true',
        showGroupedEvents: 'false'
      }
    };

    try {
      const response = doGet_Enhanced(mockEvent);
      const data = JSON.parse(response.getContent());

      if (data.error) {
        console.log(`❌ ERROR: ${data.message}`);
        return;
      }

      console.log(`\n✅ Response received`);
      console.log(`Total events across all days: ${data.totalEvents}`);

      // Check each day
      data.events.forEach(day => {
        console.log(`\n📅 ${day.dayName} (${day.date}):`);
        console.log(`   Total events: ${day.events.length}`);

        // Separate academics from regular events
        const academics = day.events.filter(e => e.enhanced && e.enhanced.section === 'Academics');
        const regular = day.events.filter(e => !e.enhanced || e.enhanced.section !== 'Academics');

        console.log(`   Regular events: ${regular.length}`);
        console.log(`   Academic events: ${academics.length}`);

        if (academics.length > 0) {
          console.log('\n   📚 ACADEMIC EVENTS:');
          academics.forEach(evt => {
            console.log(`      ${evt.time} - ${evt.description}`);
            console.log(`         Section: ${evt.enhanced.section}`);
            console.log(`         Type: ${evt.enhanced.type}`);
          });
        } else {
          console.log('   ⚠️  NO ACADEMIC EVENTS FOUND');
        }

        if (regular.length > 0) {
          console.log('\n   📋 REGULAR EVENTS (first 3):');
          regular.slice(0, 3).forEach(evt => {
            console.log(`      ${evt.time} - ${evt.description.substring(0, 50)}`);
          });
        }
      });

    } catch (e) {
      console.log(`❌ EXCEPTION: ${e.toString()}`);
      console.log(e.stack);
    }
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Test grouped events feature
 */
function testGroupedEventsFeature() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING GROUPED EVENTS FEATURE');
  console.log('='.repeat(70));

  const testCases = [
    { name: 'Coleman', expectedType: 'Staff IP' },
    { name: 'Vantiger', expectedType: 'Students (Alpha)' }
  ];

  testCases.forEach(testCase => {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Testing: ${testCase.name} (Expected: ${testCase.expectedType})`);
    console.log('─'.repeat(70));

    const mockEvent = {
      parameter: {
        name: testCase.name,
        days: '1',
        showAcademics: 'false',
        showGroupedEvents: 'true'
      }
    };

    try {
      const response = doGet_Enhanced(mockEvent);
      const data = JSON.parse(response.getContent());

      if (data.error) {
        console.log(`❌ ERROR: ${data.message}`);
        return;
      }

      console.log(`\n✅ Response received`);
      console.log(`Total events across all days: ${data.totalEvents}`);

      data.events.forEach(day => {
        console.log(`\n📅 ${day.dayName} (${day.date}):`);
        console.log(`   Total events: ${day.events.length}`);

        // Find grouped events
        const grouped = day.events.filter(e =>
          e.description && (
            e.description.includes('ALL |') ||
            e.description.includes('STAFF ONLY |')
          )
        );
        const regular = day.events.filter(e =>
          !e.description || (
            !e.description.includes('ALL |') &&
            !e.description.includes('STAFF ONLY |')
          )
        );

        console.log(`   Regular events: ${regular.length}`);
        console.log(`   Grouped events: ${grouped.length}`);

        if (grouped.length > 0) {
          console.log('\n   👥 GROUPED EVENTS:');
          grouped.forEach(evt => {
            console.log(`      ${evt.time} - ${evt.description}`);
            if (evt.enhanced) {
              console.log(`         Section: ${evt.enhanced.section}`);
              console.log(`         Group Type: ${evt.enhanced.groupType}`);
            }
          });
        } else {
          console.log('   ⚠️  NO GROUPED EVENTS FOUND');
        }
      });

    } catch (e) {
      console.log(`❌ EXCEPTION: ${e.toString()}`);
      console.log(e.stack);
    }
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Test person type detection
 */
function testPersonTypeDetection() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING PERSON TYPE DETECTION');
  console.log('='.repeat(70));

  const spreadsheet = SpreadsheetApp.openById(SEARCH_CONFIG.spreadsheetId);

  // Get first available sheet
  const sheets = getSmartSheetRange(1);
  if (sheets.length === 0) {
    console.log('❌ No sheets found');
    return;
  }

  const sheet = sheets[0].sheet;
  console.log(`\nUsing sheet: ${sheets[0].sheetName}\n`);

  const testNames = ['Vantiger', 'Payne', 'Coleman', 'Sick', 'Harms, J *'];

  testNames.forEach(name => {
    console.log(`Testing: ${name}`);
    const personType = getPersonType(sheet, name);
    console.log(`   Result: ${personType || 'NOT FOUND'}`);
    console.log('');
  });

  console.log('='.repeat(70));
}

/**
 * Test the complete flow with both features enabled
 */
function testBothFeatures() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING BOTH FEATURES TOGETHER');
  console.log('='.repeat(70));

  const mockEvent = {
    parameter: {
      name: 'Vantiger',  // Should be Alpha student
      days: '1',
      showAcademics: 'true',
      showGroupedEvents: 'true'
    }
  };

  try {
    console.log('\n📤 REQUEST:');
    console.log(`   name: ${mockEvent.parameter.name}`);
    console.log(`   showAcademics: ${mockEvent.parameter.showAcademics}`);
    console.log(`   showGroupedEvents: ${mockEvent.parameter.showGroupedEvents}`);

    const response = doGet_Enhanced(mockEvent);
    const data = JSON.parse(response.getContent());

    if (data.error) {
      console.log(`\n❌ ERROR: ${data.message}`);
      if (data.stack) {
        console.log(data.stack);
      }
      return;
    }

    console.log(`\n📥 RESPONSE:`);
    console.log(`   Version: ${data.version}`);
    console.log(`   Total events: ${data.totalEvents}`);
    console.log(`   Days searched: ${data.daysSearched}`);

    // Analyze each day
    data.events.forEach(day => {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📅 ${day.dayName} (${day.date})`);
      console.log('─'.repeat(70));

      const academics = day.events.filter(e => e.enhanced && e.enhanced.section === 'Academics');
      const grouped = day.events.filter(e => e.enhanced && e.enhanced.groupType);
      const regular = day.events.filter(e =>
        (!e.enhanced || e.enhanced.section !== 'Academics') &&
        (!e.enhanced || !e.enhanced.groupType)
      );

      console.log(`\nEvent breakdown:`);
      console.log(`   Regular: ${regular.length}`);
      console.log(`   Academics: ${academics.length}`);
      console.log(`   Grouped: ${grouped.length}`);
      console.log(`   TOTAL: ${day.events.length}`);

      if (academics.length > 0) {
        console.log('\n📚 ACADEMICS:');
        academics.forEach(evt => {
          console.log(`   ${evt.time.padEnd(12)} ${evt.description}`);
        });
      }

      if (grouped.length > 0) {
        console.log('\n👥 GROUPED EVENTS:');
        grouped.forEach(evt => {
          console.log(`   ${evt.time.padEnd(12)} ${evt.description}`);
        });
      }

      console.log('\n📋 ALL EVENTS:');
      day.events.forEach((evt, idx) => {
        const section = evt.enhanced ? evt.enhanced.section : 'Unknown';
        console.log(`   ${(idx+1).toString().padStart(2)}. [${section.padEnd(15)}] ${evt.time.padEnd(12)} ${evt.description.substring(0, 40)}`);
      });
    });

    console.log('\n' + '='.repeat(70));
    console.log('📄 FULL JSON RESPONSE:');
    console.log('='.repeat(70));
    console.log(JSON.stringify(data, null, 2));

  } catch (e) {
    console.log(`\n❌ EXCEPTION: ${e.toString()}`);
    console.log(e.stack);
  }
}
