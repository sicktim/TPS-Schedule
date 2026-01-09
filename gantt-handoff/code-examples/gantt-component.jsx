/**
 * Gantt Chart Component - React implementation for TPS Class Schedule
 *
 * This is extracted and adapted from the working class-view.html implementation.
 * For use in a proper React/Next.js project with TypeScript.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// CONSTANTS
// =============================================================================

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const EVENT_COLORS = {
  flying: {
    bg: 'rgba(16, 185, 129, 0.8)',
    border: '#10b981',
    className: 'bg-emerald-500/80 border-emerald-500'
  },
  ground: {
    bg: 'rgba(245, 158, 11, 0.8)',
    border: '#f59e0b',
    className: 'bg-amber-500/80 border-amber-500'
  },
  na: {
    bg: 'rgba(239, 68, 68, 0.8)',
    border: '#ef4444',
    className: 'bg-red-500/80 border-red-500'
  },
  supervision: {
    bg: 'rgba(139, 92, 246, 0.8)',
    border: '#8b5cf6',
    className: 'bg-violet-500/80 border-violet-500'
  },
  other: {
    bg: 'rgba(59, 130, 246, 0.8)',
    border: '#3b82f6',
    className: 'bg-blue-500/80 border-blue-500'
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get Monday-Friday dates for a given week
 * @param {Date} referenceDate - Any date in the desired week
 * @returns {Array} Array of date objects with date, dateStr, and display properties
 */
function getWeekDates(referenceDate = new Date()) {
  const dayOfWeek = referenceDate.getDay();
  const monday = new Date(referenceDate);

  // Adjust to Monday (Sunday = 0, so go back 6 days; otherwise go back to previous Monday)
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(referenceDate.getDate() - daysFromMonday);

  const dates = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push({
      date: date,
      dateStr: formatDateLocal(date),
      display: `${DAY_NAMES[i]} ${date.getMonth() + 1}/${date.getDate()}`
    });
  }
  return dates;
}

/**
 * Determine event type color class
 */
function getEventTypeClass(event) {
  const type = (event.type || event.eventType || '').toLowerCase();
  if (type.includes('fly') || type.includes('flight')) return 'flying';
  if (type.includes('ground')) return 'ground';
  if (type.includes('na') || type.includes('unavail')) return 'na';
  if (type.includes('super') || type.includes('supe')) return 'supervision';
  return 'other';
}

/**
 * Format event for display in Gantt cell
 */
function formatEventDisplay(event) {
  const time = event.time || event.startTime || '';
  const title = event.title || event.event || event.description || '';
  const shortTime = time ? time.replace(':00', '').replace(' ', '') : '';
  return shortTime ? `${shortTime} ${title}` : title;
}

// =============================================================================
// MULTI-SELECT DROPDOWN COMPONENT
// =============================================================================

function MultiSelect({ options, selected, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? 'All Selected'
      : `${selected.length} selected`;

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="min-w-[200px] flex justify-between items-center bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
      >
        <span>{displayText}</span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-72 overflow-y-auto z-50">
          <div className="flex gap-2 p-2 border-b border-gray-700">
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-700"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 bg-gray-600 rounded hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
          {options.map(option => (
            <label
              key={option}
              className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-700/50"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
                className="rounded mr-2"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EVENT BLOCK COMPONENT
// =============================================================================

function EventBlock({ event }) {
  const typeKey = getEventTypeClass(event);
  const colors = EVENT_COLORS[typeKey];
  const display = formatEventDisplay(event);

  return (
    <div
      className={`rounded px-1 py-0.5 my-0.5 text-xs leading-tight border-l-2 truncate hover:whitespace-normal hover:z-10 hover:relative ${colors.className}`}
      title={`${event.time || ''} - ${event.title || event.event || ''}\n${event.location || ''}`}
    >
      {display}
    </div>
  );
}

// =============================================================================
// LEGEND COMPONENT
// =============================================================================

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm p-4 bg-gray-800/50 rounded-lg">
      {Object.entries(EVENT_COLORS).map(([key, colors]) => (
        <div key={key} className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${colors.className}`} />
          <span className="capitalize">{key === 'na' ? 'N/A' : key}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN GANTT CHART COMPONENT
// =============================================================================

export default function GanttChart({
  schedules = [],       // Array of { name, category, events: [] }
  categories = [],      // Array of category strings
  onRefresh,            // Callback to refresh data
  loading = false,
  metadata = null       // Cache metadata for display
}) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);  // 0 = current week, -1 = last week, 1 = next week
  const [weekDates, setWeekDates] = useState([]);

  // Initialize with first category when categories load
  useEffect(() => {
    if (categories.length > 0 && selectedCategories.length === 0) {
      setSelectedCategories([categories[0]]);
    }
  }, [categories]);

  // Update week dates when offset changes
  useEffect(() => {
    const reference = new Date();
    reference.setDate(reference.getDate() + (weekOffset * 7));
    setWeekDates(getWeekDates(reference));
  }, [weekOffset]);

  // Filter and sort people based on selected categories
  const filteredPeople = schedules
    .filter(person => selectedCategories.includes(person.category))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get events for a person on a specific date
  const getEventsForDate = (person, dateStr) => {
    if (!person.events) return [];

    let events = [];

    if (Array.isArray(person.events)) {
      if (person.events.length > 0 && person.events[0].events) {
        // Grouped by day: [{date, dayName, events: [...]}]
        const dayData = person.events.find(d => d.date === dateStr);
        events = dayData ? dayData.events : [];
      } else {
        // Flat array: [{date, time, ...}]
        events = person.events.filter(e => e.date === dateStr);
      }
    }

    // Sort by time
    return events.sort((a, b) => {
      const timeA = a.time || a.startTime || '';
      const timeB = b.time || b.startTime || '';
      return timeA.localeCompare(timeB);
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-800/50 rounded-lg">
        <div>
          <h1 className="text-xl font-semibold">TPS Class Schedule</h1>
          <p className="text-gray-400 text-sm">Weekly Gantt View</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              ← Prev
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Next →
            </button>
          </div>

          {/* Category Filter */}
          <MultiSelect
            options={categories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="Select categories..."
          />

          {/* Actions */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg print:hidden"
          >
            Print
          </button>
        </div>
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="text-xs text-gray-500 px-4">
          Cache updated: {new Date(metadata.lastRun).toLocaleString()}
          {schedules && ` | ${schedules.length} people loaded`}
        </div>
      )}

      {/* Selected Categories Pills */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4">
          {selectedCategories.map(cat => (
            <span key={cat} className="text-xs bg-blue-600/30 px-2 py-1 rounded">
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center bg-gray-800/50 rounded-lg">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading schedules...</p>
        </div>
      )}

      {/* No Selection State */}
      {!loading && selectedCategories.length === 0 && (
        <div className="p-8 text-center bg-gray-800/50 rounded-lg">
          <p className="text-gray-400">Select one or more categories to view schedules</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && selectedCategories.length > 0 && filteredPeople.length === 0 && (
        <div className="p-8 text-center bg-gray-800/50 rounded-lg">
          <p className="text-gray-400">No people found for selected categories</p>
        </div>
      )}

      {/* Gantt Grid */}
      {!loading && filteredPeople.length > 0 && (
        <div className="overflow-x-auto bg-gray-800/50 rounded-lg">
          <div
            className="grid gap-px bg-gray-700/50"
            style={{
              gridTemplateColumns: '140px repeat(5, 1fr)',
              minWidth: '900px'
            }}
          >
            {/* Header Row */}
            <div className="bg-gray-900 font-semibold text-center p-3">Name</div>
            {weekDates.map((day, i) => (
              <div key={i} className="bg-gray-900 font-semibold text-center p-3">
                {day.display}
              </div>
            ))}

            {/* Data Rows */}
            {filteredPeople.map(person => (
              <React.Fragment key={person.name}>
                <div className="bg-gray-900/50 font-medium flex items-center px-2 py-1 text-sm">
                  {person.name}
                </div>
                {weekDates.map((day, colIdx) => {
                  const events = getEventsForDate(person, day.dateStr);
                  return (
                    <div
                      key={colIdx}
                      className="bg-gray-900/30 min-h-[50px] p-1"
                    >
                      {events.map((event, eventIdx) => (
                        <EventBlock key={eventIdx} event={event} />
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && filteredPeople.length > 0 && (
        <div className="print:hidden">
          <Legend />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*
import GanttChart from './GanttChart';

function App() {
  const [data, setData] = useState({ schedules: [], categories: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/schedule');
      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <GanttChart
      schedules={data.schedules}
      categories={data.categories}
      onRefresh={fetchData}
      loading={loading}
      metadata={data.metadata}
    />
  );
}
*/
