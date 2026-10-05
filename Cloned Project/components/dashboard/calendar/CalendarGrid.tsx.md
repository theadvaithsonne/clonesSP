# `components/dashboard/calendar/CalendarGrid.tsx`

> React component `CalendarGrid`.

**Kind:** React component · **Lines:** 564 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `React` (react), `FollowUpGroupCard` (components/dashboard/calendar/FollowUpGroupCard.tsx), `EventCard` (components/dashboard/calendar/EventCard.tsx)

### Props

- **`CalendarGrid`**: `events: CalendarEvent[]`, `currentDate: Date`, `viewMode: ViewMode`, `startHour?: number`, `endHour?: number`, `onEventClick: (event: CalendarEvent) => void`, `meId: string`

**Hooks used:** `useState`×2, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CalendarGrid` | component | `CalendarGrid({ events, currentDate, viewMode, startHour = 6, endHour = 2…)` | 128 |

## Interfaces

- **Timers / queues:** `setInterval` at L147

## Dependencies

- **Internal:**
  - `components/dashboard/calendar/EventCard.tsx` — `EventCard`
  - `lib/calendarUtils.ts` — `getWeekDays`, `getMonthDays`, `calculateEventPosition`, `getCurrentTimePosition`, `isTimeInView`, `generateTimeSlots`, `getEventsForDay`, `isToday`, … +1
  - `lib/calendarUtils.ts` — `CalendarEvent`, `ViewMode`, `(types only)`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/calendar/FollowUpGroupCard.tsx` — `FollowUpGroupCard`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`

## Used by

- `components/dashboard/CalendarPage.tsx`
