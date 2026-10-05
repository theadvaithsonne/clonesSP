# `lib/zonedTime.ts`

> IANA-timezone arithmetic built on `Intl` alone — no date library.

**Kind:** frontend library · **Lines:** 114

<!-- docgen:auto -->

## Purpose
IANA-timezone arithmetic built on `Intl` alone — no date library.

Workshops store their schedule as a calendar date plus a wall-clock
"HH:MM" string interpreted in the host's timezone. Turning that back into
a real instant needs the UTC offset *at that moment*, which shifts across
DST boundaries, so a fixed offset is never correct.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `timeZoneOffsetMs` | function | `timeZoneOffsetMs(date: Date, timeZone: string): number` — UTC offset of `timeZone` at the instant `date`, in milliseconds. | 14 |
| `ymdInTimeZone` | function | `ymdInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number }` — Calendar Y/M/D of `date` as observed in `timeZone`. | 45 |
| `zonedTimeToUtc` | function | `zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date` — Instant at which the wall clock in `timeZone` reads `year-month-day hour:minute`. | 74 |
| `parseWallClock` | function | `parseWallClock(value?: string \| null): { hour: number; minute: number } \| null` — Parses "HH:MM" / "H:MM" / "HH:MM:SS" into `{hour, minute}`; null when unparseable. | 89 |
| `parseCalendarDate` | function | `parseCalendarDate(value?: string \| null): { year: number; month: number; day: number } \| nu…` — Parses "YYYY-MM-DD" into its calendar parts; null when unparseable. | 102 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/webinar/WebinarPreJoin.tsx`
- `lib/admin-api/daily-reports.ts`
