# `components/athena/components/TimesheetWeekPicker.tsx`

> A clickable "Mon d – Mon d" week label that opens a portal-rendered month calendar where the user picks a whole Sunday-to-Saturday week, reported back as a week offset from the current week.

**Kind:** React component · **Lines:** 339

## Purpose
The Athena timesheet screens (personal timesheet, approvals, all timesheets) all show one week at a time and track it as a numeric `weekOffset` (0 = this week, -1 = last week, ...). This component is the shared header control for those screens: it shows the current week range and lets the user jump to any week via a compact dark calendar popover, without each screen re-implementing date maths.

## How it works
- **Date helpers (L24-L71):** `localDayMs` normalises a date to local midnight; `startOfSunday` rewinds to the Sunday of its week; `buildMonthWeeks(year, month)` builds a fixed 6-row x 7-day grid starting on the Sunday on or before the 1st of the month; `fmtWeekLabel` renders `"Jan 5 – Jan 11"` from the 7-element `dates` array (or `"Select week"` when empty). Weeks always start on Sunday (`DAY_HEADERS` is `Su..Sa`).
- **`weekOffsetForSunday` (exported):** difference in whole weeks between a given Sunday and the Sunday of today, using `Math.round` so DST shifts do not produce off-by-one offsets.
- **State:** `open`, `viewDate` (the month currently shown, reset to the selected week's month each time the panel opens), `hoverSundayMs` (which row is hovered) and `pos` (fixed-position coordinates).
- **Positioning and dismissal (L100-L127):** while open, the panel is placed 8px below the trigger button using `getBoundingClientRect`, recomputed on window resize and on any scroll (capture phase). A capture-phase `mousedown` listener on `document` closes the panel when the click lands outside both the trigger and the panel.
- **Panel (L151-L287):** rendered via `createPortal` into `document.body` with `position: fixed` and `zIndex: 100000` so it escapes overflow/stacking contexts of the timesheet tables. Header shows `Month Year`, a "Today" button (sets offset 0) and previous/next month arrows. Each week is one `<button>` row; the selected week (matched by comparing its Sunday to `dates[0]`) is filled with the brand accent, a hovered row gets a softer accent, and days outside the viewed month are dimmed.
- **Selecting:** clicking a row calls `onWeekOffsetChange(weekOffsetForSunday(week[0]))` and closes the panel. The parent recomputes `dates` from the new offset.
- Styling is inline (dark `#161616` panel) with accent colours from `timesheetTheme` (`TS_ACCENT`, `TS_ACCENT_SOFT_BG_HOVER`, `TS_ON_ACCENT`, which resolve to the `--brand` CSS variables).

## Exports
- `TimesheetWeekPicker({ dates, onWeekOffsetChange, fontSize = 20, fontWeight = 700 })` - the trigger button plus popover. `dates` is the currently displayed week (7 `Date`s, Sunday first); `onWeekOffsetChange` is a React state setter (`Dispatch<SetStateAction<number>>`) for the parent's week offset; `fontSize`/`fontWeight` style the label.
- `weekOffsetForSunday(sunday: Date): number` - number of weeks between `sunday` and the current week's Sunday.

## Dependencies
- **Internal:** `components/athena/components/timesheetTheme.ts` - shared accent colour tokens for timesheet surfaces.
- **Packages:** `react` (state, effects, memo, refs), `react-dom` (`createPortal`).

## Used by
- `components/athena/components/AllTimesheets.tsx`
- `components/athena/components/TimesheetApprovals.tsx`
- `components/athena/components/timesheet.tsx`

## Notes
- `viewDate` is initialised from `dates[0]`; passing an empty `dates` array would produce an invalid date. Callers always pass a full week.
- The panel is only built when `typeof document !== "undefined"`, so it is SSR-safe even though the file is a client component.
