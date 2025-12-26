# TPS Squadron Schedule

A mobile-friendly web application for viewing military/aviation squadron schedules with role-based event visibility.

## Features

### Core Functionality
- 📅 **Personal Schedule Viewing**: Search and view your schedule by name
- 🔄 **Auto-Refresh**: Automatically updates every 15 minutes
- 📱 **Mobile-Optimized**: PWA-ready with home screen support
- 🎨 **Modern UI**: Dark theme with glassmorphic design
- ⚡ **Real-Time Search**: Debounced search with instant results

### Event Types
- ✈️ **Flying Events**: Aircraft operations with crew, ETD/ETA, debrief times
- 🏃 **Ground Events**: Training and administrative events
- 🚫 **N/A Events**: Non-availability periods (leave, medical, etc.)
- 👁️ **Supervision**: Duty assignments
- 📌 **Other**: Miscellaneous events

### Advanced Features
- 👥 **Role-Based Visibility**: Events can be shown to specific user roles
  - **ALL Events**: Visible to everyone
  - **STAFF ONLY Events**: Only visible to staff personnel
  - **Personal Events**: Only visible to named individuals
- 🎭 **User Roles**: Support for different personnel categories
  - Regular Personnel
  - Staff IP
  - Staff IFTE/ICSO
  - STC Staff
  - Attached/Support
- ⚙️ **Configurable Settings**:
  - Search name
  - Days ahead (1-7 days)
  - User role/category
  - Show/hide group events
  - Test mode for date simulation
- 📊 **Event Status**: Visual indicators for cancelled and partially effective events
- 🔍 **Event Filtering**: Smart filtering based on user role and preferences

## Tech Stack

- **Frontend**: React 18 (via CDN)
- **Styling**: TailwindCSS + Custom CSS
- **Build**: Babel Standalone (no build process required)
- **Storage**: LocalStorage for configuration
- **Backend**: Google Apps Script
- **Deployment**: Static HTML file

## Quick Start

### Deployment

1. **Host the file**: Upload `index.html` to any web server
2. **Access**: Open in a browser
3. **Add to home screen** (mobile): For quick access

### Configuration

1. Click the **Settings** icon (⚙️)
2. Configure:
   - **Search Name**: Your name as it appears in the schedule
   - **Days Ahead**: How many days to look ahead (1-7)
   - **Your Role/Category**: Your personnel category
   - **Show group events**: Enable/disable ALL events
3. Click **Save Settings**

## Usage

### Viewing Your Schedule

1. Enter your name in the search field
2. Results update automatically as you type
3. View events organized by day
4. Events are color-coded by type

### Understanding Event Badges

- **Green badge**: Flying Event
- **Orange badge**: Ground Event
- **Red badge**: N/A (Non-Availability)
- **Purple badge**: Supervision
- **Blue badge**: Other
- **Cyan "ALL" badge**: Event visible to everyone
- **Purple "STAFF ONLY" badge**: Event only visible to staff
- **Red "CANCELLED" badge**: Event is cancelled
- **Orange "PARTIAL" badge**: Event is partially effective

### Role-Based Visibility

The app supports three types of event visibility:

1. **Personal Events**: Only shown to named individuals
2. **ALL Events**: Shown to everyone (when enabled in settings)
3. **STAFF ONLY Events**: Only shown to staff roles

See [ROLE_BASED_EVENTS.md](./ROLE_BASED_EVENTS.md) for detailed documentation.

## Google Sheets Integration

### Backend Setup

The app fetches data from a Google Apps Script web app that reads from Google Sheets.

**API Endpoint**: Configured in settings (default provided)

**Parameters**:
- `name`: Search query (required)
- `days`: Number of days ahead (1-7)
- `version`: Set to "enhanced" for detailed event data
- `testDate`: Optional date for testing (YYYY-MM-DD)

### Sheet Structure

The backend expects sheets with the following sections:
- **Flying Events**: Aircraft operations
- **Ground Events**: Training and meetings
- **Supervision**: Duty assignments
- **NA**: Non-availability

### Setting Up Special Events

**ALL Events** (visible to everyone):
- In the persons column, enter: `ALL`

**STAFF ONLY Events** (visible to staff only):
- In the persons column, enter: `STAFF ONLY`

See [ROLE_BASED_EVENTS.md](./ROLE_BASED_EVENTS.md) for detailed setup instructions.

## Configuration Options

### Default Configuration
```javascript
{
  searchName: 'Sick',
  daysAhead: 4,
  webAppUrl: 'https://script.google.com/...',
  version: 'enhanced',
  testMode: false,
  testDate: '2025-12-15',
  userRole: 'Regular Personnel',
  showGroupEvents: true
}
```

### LocalStorage

All settings are persisted in localStorage under the key `scheduleWidgetConfig`.

## Development

### File Structure
```
TPS-Schedule/
├── index.html              # Main application file
├── README.md              # This file
└── ROLE_BASED_EVENTS.md   # Role-based visibility documentation
```

### Key Components

**App Component** (`index.html:430`)
- Main application logic
- State management
- API integration
- Event filtering

**EventCard Component** (`index.html:308`)
- Individual event display
- Status indicators
- Visibility badges

**Configuration Management** (`index.html:113-134`)
- Load/save from localStorage
- Default settings
- Setting validation

**Event Filtering** (`index.html:245-261`)
- Role-based filtering
- Visibility detection
- Event processing

### Key Functions

- `getEventVisibility(event)`: Determines event visibility type
- `shouldShowEvent(event, userRole, searchName, showGroupEvents)`: Filters events
- `parseEvent(event)`: Parses event data and determines type
- `sortEventsByTime(eventsData)`: Sorts events chronologically
- `fetchSchedule(searchName)`: Fetches data from backend

## Features Roadmap

### Implemented ✅
- ✅ Personal schedule viewing
- ✅ Auto-refresh
- ✅ Role-based event visibility
- ✅ Mobile optimization
- ✅ Event status tracking
- ✅ Test mode

### Potential Enhancements 🚀
- [ ] Calendar export (iCal, Google Calendar)
- [ ] Browser notifications for upcoming events
- [ ] Offline support with service worker
- [ ] Multi-user view (compare schedules)
- [ ] Event statistics and analytics
- [ ] Dark/Light mode toggle
- [ ] Search history
- [ ] Event detail modal
- [ ] Share specific events
- [ ] Custom role groups
- [ ] Role hierarchy

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Safari (iOS + macOS)
- ✅ Firefox (latest)
- ✅ Mobile browsers

## Security Notes

- All data is fetched from a configured Google Apps Script endpoint
- Configuration is stored in browser localStorage only
- No server-side authentication (relies on backend implementation)
- Role selection is client-side (for display filtering only)

For production use with sensitive data, consider:
- Implementing backend role validation
- Adding authentication
- Using HTTPS
- Restricting API access

## Troubleshooting

### Events not loading
1. Check internet connection
2. Verify the API endpoint URL in settings
3. Check browser console for errors
4. Ensure the backend is accessible

### Wrong events showing
1. Verify search name matches schedule
2. Check role setting in Settings
3. Verify "Show group events" setting
4. Clear localStorage and reconfigure

### Mobile issues
1. Try adding to home screen
2. Check browser compatibility
3. Ensure JavaScript is enabled
4. Clear browser cache

## Contributing

This is a single-file application. To contribute:

1. Fork the repository
2. Make changes to `index.html`
3. Test in multiple browsers
4. Submit a pull request

## License

MIT License - See repository for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Changelog

### Version 2.0 (2025-12-26)
- ✨ Added role-based event visibility
- ✨ Added support for ALL events
- ✨ Added support for STAFF ONLY events
- ✨ Added user role selection
- ✨ Added show/hide group events toggle
- 📚 Added comprehensive documentation
- 🎨 Added visibility badges to events
- 🎨 Enhanced status bar with role display

### Version 1.0
- 🎉 Initial release
- ✨ Personal schedule viewing
- ✨ Auto-refresh functionality
- ✨ Mobile-optimized design
- ✨ Event categorization
- ✨ Test mode support
