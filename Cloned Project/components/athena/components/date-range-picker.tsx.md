# `components/athena/components/date-range-picker.tsx`

> A minimal popover date-range picker that reports the chosen range as millisecond timestamps.

**Kind:** React component · **Lines:** 58

## Purpose
This is a small helper for picking a from/to date range, for example as a filter, in the Taskroom / Athena module. It wraps any trigger element in a Radix popover that holds the shadcn `Calendar` in range mode, styled for the module's dark theme.

## How it works
- The initial state comes from `selectedRange`. When `selectedRange.start` is set, the state becomes `{ from: new Date(start), to: end ? new Date(end) : undefined }`. This is read only once, on mount, and later prop changes are not re-synced.
- `handleSelect` stores the react-day-picker `DateRange` locally and calls:
  - `onSelect({ start: from.getTime(), end: to?.getTime() ?? null })` when a `from` date exists;
  - `onSelect({ start: null, end: null })` when the selection is cleared.
- The calendar opens on the month of the current `from` date (`defaultMonth`) and uses `initialFocus`.

## Exports
- `CalendarDateRangePicker({ onSelect, selectedRange?, children })`
  - `onSelect(range: { start: number | null; end: number | null })` returns the range as epoch milliseconds.
  - `children` is the popover trigger, rendered with `asChild`.

## Dependencies
- **Internal:** `components/ui/calendar.tsx`, `components/ui/popover.tsx`. `lib/utils.ts` (`cn`) is imported but unused.
- **Packages:** `react-day-picker` (the `DateRange` type), `react`.

## Used by
No file imports it, so it appears unused. The Taskroom date UI uses `custom-date-picker.tsx` instead.
