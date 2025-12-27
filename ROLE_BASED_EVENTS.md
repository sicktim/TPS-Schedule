# Role-Based Event Visibility

## Overview

The Squadron Schedule app now supports role-based event visibility, allowing events to be shown to specific groups of users based on their role/category. Additionally, the app supports filtering by event categories such as Student Academics.

## Event Visibility Types

### 1. **Personal Events** (Default)
- Events that list specific individuals by name
- Only visible to the named persons when they search for their name
- Example: "F-16 Academics" with persons "Payne, Borek"

### 2. **ALL Events**
- Events marked with "ALL" in the persons field
- Visible to everyone who has "Show group events (ALL)" enabled
- Indicated by a cyan **ALL** badge
- Example: "Ops Call/DF" with person "ALL"

### 3. **STAFF ONLY Events**
- Events marked with "STAFF ONLY" in the persons field
- Only visible to users with staff roles:
  - Staff IP
  - Staff IFTE/ICSO
  - STC Staff
  - Attached/Support
- Indicated by a purple **STAFF ONLY** badge
- Example: "TPS CC Call" with person "STAFF ONLY"

### 4. **Student Academics Events**
- Events with "ACADEM" in the event name (e.g., "F-16 ACADEMICS", "ACADEMICS")
- Can be toggled on/off via "Show student academics" setting
- Indicated by an indigo **ACADEMICS** badge
- Works independently of other visibility types (can be ALL + ACADEMICS, or personal + ACADEMICS)

## User Roles

The app supports the following user roles:

1. **Regular Personnel** (default)
   - Sees only personal events and ALL events (if enabled)
   - Does not see STAFF ONLY events

2. **Staff IP**
   - Sees personal events, ALL events (if enabled), and STAFF ONLY events

3. **Staff IFTE/ICSO**
   - Sees personal events, ALL events (if enabled), and STAFF ONLY events

4. **STC Staff**
   - Sees personal events, ALL events (if enabled), and STAFF ONLY events

5. **Attached/Support**
   - Sees personal events, ALL events (if enabled), and STAFF ONLY events

## Configuration

Users can configure their role and visibility preferences in the Settings panel:

### Your Role/Category
- Dropdown menu to select your role
- Determines which STAFF ONLY events you see
- Persisted in localStorage

### Show Group Events (ALL)
- Checkbox to enable/disable ALL events
- When enabled, events marked with "ALL" are displayed
- When disabled, only personal and role-specific events are shown
- Persisted in localStorage

### Show Student Academics
- Checkbox to enable/disable academics events
- When enabled, all events with "ACADEM" in the name are displayed
- When disabled, academics events are filtered out regardless of other settings
- Persisted in localStorage
- Works as a filter on top of other visibility rules

### Quick Settings Access
- Click the settings gear icon (⚙️) to open settings
- Click your name in the status bar to open settings

## Implementation Details

### Data Structure

Events in the enhanced format should include a `people` array that can contain:
- Specific names: `["Payne", "Borek"]`
- ALL indicator: `["ALL"]`
- STAFF ONLY indicator: `["STAFF ONLY"]` or `["STAFF ON"]`

### Backend Data Format

```json
{
  "enhanced": {
    "section": "Ground Events",
    "event": "Ops Call/DF",
    "start": "11:30",
    "end": "12:30",
    "people": ["ALL"]
  }
}
```

### Visibility Detection Logic

The app automatically detects event visibility type by checking the `people` array and event name:

1. Check if event name contains "ACADEM" → Mark as academics
2. If `people` contains "ALL" → ALL event
3. If `people` contains "STAFF ONLY" or "STAFF ON" → STAFF ONLY event
4. Otherwise → Personal event

### Filtering Process

1. **Fetch**: App fetches events from backend based on search name
2. **Parse**: Each event is parsed to determine visibility type and academics status
3. **Filter**: Events are filtered based on (in order):
   - Show student academics setting (if disabled, filter out all academics events)
   - User's role setting (for STAFF ONLY events)
   - Show group events setting (for ALL events)
   - Event visibility type
4. **Display**: Remaining events are displayed with appropriate badges

## Visual Indicators

Events display badges to indicate their visibility type and category:

- **Indigo "ACADEMICS" badge**: Event is an academics event
- **Cyan "ALL" badge**: Event is visible to everyone
- **Purple "STAFF ONLY" badge**: Event is only visible to staff roles
- No special badge: Personal event

Events can have multiple badges (e.g., ACADEMICS + ALL for a group academics event).

## Status Bar

The status bar displays:
- Current search name (clickable to open settings)
- Current user role in purple text
- Warning if group events are hidden (yellow text)
- Warning if academics are hidden (yellow text)
- Last update time

## Google Sheets Integration

### Setting Up ALL Events

In your Google Sheet's Ground Events section:
1. Create the event row with start/end times and event name
2. In the persons column, enter: `ALL`

### Setting Up STAFF ONLY Events

In your Google Sheet's Ground Events section:
1. Create the event row with start/end times and event name
2. In the persons column, enter: `STAFF ONLY`

### Example Sheet Structure

| Events | Start | End | Person 1 | Person 2 |
|--------|-------|-----|----------|----------|
| Ops Call/DF | 11:30 | 12:30 | ALL | |
| TPS CC Call | 10:00 | 11:00 | STAFF ONLY | |
| F-16 Academics | 12:00 | 15:00 | Payne | Borek |

## Testing

To test the role-based visibility:

1. Open Settings
2. Change "Your Role/Category" to different values
3. Toggle "Show group events (ALL)"
4. Observe which events appear/disappear based on your role

### Test Scenarios

**Scenario 1: Regular Personnel with Group Events Enabled, Academics Enabled**
- Should see: Personal events + ALL events + Academics events
- Should NOT see: STAFF ONLY events

**Scenario 2: Regular Personnel with Group Events Disabled, Academics Enabled**
- Should see: Personal events + Academics events
- Should NOT see: ALL events or STAFF ONLY events

**Scenario 3: Staff IP with Group Events Enabled, Academics Enabled**
- Should see: Personal events + ALL events + STAFF ONLY events + Academics events

**Scenario 4: Staff IP with Group Events Disabled, Academics Disabled**
- Should see: Personal events + STAFF ONLY events
- Should NOT see: ALL events or Academics events

**Scenario 5: Any Role with Academics Disabled**
- Should NOT see: Any events with "ACADEM" in the name
- Should see: All other events based on role and group events settings

## Code Architecture

### Key Functions

- `getEventVisibility(event)`: Determines visibility type and allowed roles
- `shouldShowEvent(event, userRole, searchName, showGroupEvents)`: Filters events based on user settings
- `EventCard`: Displays events with appropriate visibility badges

### Configuration Storage

All settings are stored in localStorage under the key `scheduleWidgetConfig`:

```json
{
  "searchName": "Sick",
  "daysAhead": 4,
  "userRole": "Regular Personnel",
  "showGroupEvents": true,
  ...
}
```

## Future Enhancements

Potential improvements to the role-based visibility system:

1. **Custom Role Groups**: Allow defining custom role groups beyond the predefined staff categories
2. **Event-Specific Roles**: Support events visible to specific role combinations (e.g., "IP and IFTE only")
3. **Role Hierarchy**: Implement role hierarchy where higher roles see lower role events
4. **Backend Role Validation**: Verify user roles on the backend for security
5. **Multi-Select Roles**: Allow users to select multiple roles if they serve multiple functions
6. **Role-Based Notifications**: Send notifications only to relevant role groups

## Performance Notes

### Cache Size Increase

With the new filtering system, the backend may return more events than before (ALL events, STAFF ONLY events, and personal events). This is expected behavior to enable client-side filtering.

**Cache size considerations:**
- Backend cache: The backend (Google Apps Script) may cache more data as it returns all event types
- Frontend storage: Only user settings are stored in localStorage (very small)
- Frontend memory: Events are held in React state only while the app is open
- Network: Larger payloads on initial fetch, but same refresh frequency

**Optimization recommendations:**
- The frontend is optimized with client-side filtering (no additional API calls)
- Consider backend optimizations if cache size becomes a concern
- Event data is not persisted client-side (fresh fetch on reload)

## Troubleshooting

### Events not appearing
1. Check your role setting in Settings
2. Verify "Show group events (ALL)" is enabled if you expect to see ALL events
3. Verify "Show student academics" is enabled if you expect to see academics events
4. Ensure your search name matches the name in the schedule
5. Check if the event is marked as STAFF ONLY and you have a staff role

### Wrong events showing
1. Verify your role is set correctly
2. Check the event's person field in the source data
3. Ensure the backend is sending the enhanced format with the `people` array
4. Check if academics filter is affecting visibility

### Too many events showing
1. Disable "Show group events (ALL)" to hide ALL events
2. Disable "Show student academics" to hide academics events
3. Verify you're searching for the correct name

## Migration Notes

This feature is backward compatible:
- Events without enhanced data default to "personal" visibility
- Users without a configured role default to "Regular Personnel"
- The showGroupEvents setting defaults to `true` to maintain current behavior
- The showAcademics setting defaults to `true` to maintain current behavior
