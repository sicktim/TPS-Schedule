// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         TPS SCHEDULE - MAIN ENTRY                          ║
// ║                                                                            ║
// ║  Purpose: Main entry point for web app HTTP requests                       ║
// ║  Version: 4.0                                                              ║
// ║  Last Modified: January 4, 2026                                            ║
// ║                                                                            ║
// ║  Architecture:                                                             ║
// ║  - Main.gs: HTTP entry point (this file)                                   ║
// ║  - TriggerSetup.gs: Core processing logic                                  ║
// ║  - Config.gs: Configuration and date-based ranges                          ║
// ║                                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ┌────────────────────────────────────────────────────────────────────────────┐
// │                            TABLE OF CONTENTS                               │
// ├────────────────────────────────────────────────────────────────────────────┤
// │                                                                            │
// │  [1] WEB APP ENTRY POINT .......................... Lines 25-35           │
// │      - doGet(): Routes all requests to TriggerSetup.gs                     │
// │                                                                            │
// └────────────────────────────────────────────────────────────────────────────┘


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      [1] WEB APP ENTRY POINT                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * doGet() - Main HTTP request handler
 *
 * Entry point for all web app requests. Routes to TriggerSetup.gs.
 *
 * URL Parameters:
 *   name - Person's name to search for
 *   days - Number of days ahead to search (default: 3)
 *   testDate - Optional test date in YYYY-MM-DD format
 *
 * Example: ?name=Sick&days=4
 */
function doGet(e) {
  return doGet_Simplified(e);
}
