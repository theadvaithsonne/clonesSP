# `lib/calendarUtils.ts`

> Date maths, layout and colour helpers for the in-app Google-Calendar-style calendar (day/week/month views), plus the `CalendarEvent` shape those views render.

**Kind:** frontend library · **Lines:** 321

## Purpose
The Calendar page (`components/dashboard/CalendarPage.tsx` and `components/dashboard/calendar/*`) shows bookings, deal follow-up activities and events on a time grid. This file keeps the non-visual logic in one place: building the days of a week or month, placing an event on a 30-minute slot grid, detecting overlaps, expanding repeating events, picking a colour scheme from the title, and formatting dates. Everything is pure and runs in the browser's local time zone.

## How it works
### Data model
- `ViewMode = 'day' | 'week' | 'month'`.
- `CalendarEvent` - one item on the calendar: `_id`, `title`, `startTime`/`endTime` (ISO strings), populated `bookerId` and `bookedWithId` users, optional `color`, `category`, `isRepeating`. It also carries optional **deal activity** fields (`isDealActivity`, `activityType`, `leadId`, `entityName`, `contactName`, `description`, `isCompleted`) and **event** fields (`isEvent`, `invitedUserIds`, `guestInvitations`, `status`, `isLive`, `publicJoinCode`), because the page merges bookings, deal activities and events into one list.

### Colours and categories
- `eventColors` maps a category to `{ bg, border, text }` RGBA colours: `telehealth`, `review`, `medical`, `virtual`, `evaluation`, `patient`, `surgical`, `icu`, `team`, `deal`, `default`.
- `categorizeEvent(title)` chooses the category by case-insensitive keywords, first match wins: telehealth/telemedicine, review, medication/medical, virtual, evaluation, patient, surgical/surgery, icu/critical care/intensive, team/board/interdisciplin, follow-up variants or "deal task" -> `deal`, else `default`. (Most categories are healthcare-themed leftovers; in practice "team" and "deal" are the ones Garage titles hit.)

### Building the grid
- `getStartOfWeek(date)` - the Sunday of that week (keeps the time of day).
- `getWeekDays(startDate)` - seven midnight `Date`s from the start date.
- `getMonthDays(date)` - every cell from the Sunday on/before the 1st to the Saturday on/after the last day, rounded up to whole weeks (35 or 42 cells, occasionally 28).
- `generateTimeSlots(startHour = 0, endHour = 24)` - `"HH:00"` and `"HH:30"` labels.

### Placing events
- `calculateEventPosition(event, dayStart, startHour = 0, slotHeight = 48)` returns `{ top, height, column }`: `top` in pixels from `startHour`, at `slotHeight` per 30 minutes; `height` at least one slot; `column` = whole days between the week start and the event's day.
- `eventsOverlap(a, b)` - strict interval overlap.
- `getEventsForDay(events, date)` - non-repeating events whose start falls within the day; repeating events appear on their original day and **every** later day (there is no recurrence rule or end date), with start/end rewritten to that day at the original clock times.
- `getCurrentTimePosition(startHour, slotHeight)` - pixel offset of "now"; `isTimeInView(startHour, endHour)` - whether the current hour is inside the visible range.

### Formatting (`en-US`)
`formatDate` ("Oct 4"), `formatFullDate` ("Sun, Oct 4"), `formatTime` (24-hour "14:30"), `getMonthYear` ("October 2026"), `isToday`, `isCurrentWeek`.

## Exports
- Types: `ViewMode`, `CalendarEvent`.
- `eventColors` - category -> colour scheme map.
- `categorizeEvent(title: string): string`
- `getWeekDays(startDate: Date): Date[]`
- `getStartOfWeek(date: Date): Date`
- `getMonthDays(date: Date): Date[]`
- `formatDate(date: Date): string`, `formatFullDate(date: Date): string`
- `calculateEventPosition(event, dayStart, startHour?, slotHeight?): { top; height; column }`
- `eventsOverlap(event1, event2): boolean`
- `getEventsForDay(events, date): CalendarEvent[]`
- `getCurrentTimePosition(startHour?, slotHeight?): number`
- `isTimeInView(startHour: number, endHour: number): boolean`
- `generateTimeSlots(startHour?, endHour?): string[]`
- `formatTime(date: Date): string`
- `getMonthYear(date: Date): string`
- `isToday(date: Date): boolean`
- `isCurrentWeek(date: Date): boolean`

## Dependencies
None.

## Used by
- `components/dashboard/CalendarPage.tsx`
- `components/dashboard/calendar/CalendarGrid.tsx`, `CalendarHeader.tsx`, `EditEventModal.tsx`, `EditMembersModal.tsx`, `EventCard.tsx`, `EventDetailsModal.tsx`, `FollowUpGroupCard.tsx`

## Notes
- `calculateEventPosition` uses clock minutes only, so an event that crosses midnight gets a negative duration and is clamped to one slot high.
- `isCurrentWeek` compares against a week start that still has the current time of day, so a date at midnight on today's Sunday can fall just before it; likewise the week end is Saturday at the current time, not 23:59.
- Do not confuse this `CalendarEvent` with the one in `lib/calendar.ts` (used for "add to calendar" links).
