# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/dateUtils.ts`

> Small timezone-aware date helpers (detect the browser timezone, format a date as dd/mm/yyyy, get the start of today in a timezone) for the Taskroom UI.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 45

## Purpose
A utility module written for the Taskroom Kanban components so that task dates could be shown and compared in the user's own timezone. The header comment (`// utils/dateUtils.ts`) suggests it was copied from a generic utils folder. Nothing in the project imports it.

## How it works
- `getUserTimezone()` returns `Intl.DateTimeFormat().resolvedOptions().timeZone` in the browser. During server rendering (`window` undefined) it falls back to `'America/New_York'`.
- `formatDateForUser(date, timeZone?)` formats with the `en-GB` locale and 2-digit day/month plus numeric year in the given timezone (default: the user's), e.g. `04/10/2026`. A falsy `date` returns the placeholder string `'dd-mm-yyyy'`. Note the placeholder uses dashes while the real output uses slashes.
- `getStartOfDayInTimeZone(timeZone?)` works out today's year, month and day **in the target timezone** with `formatToParts`, builds `YYYY-MM-DDT00:00:00` and parses it with `new Date(...)`. Because the string has no offset, it is parsed in the browser's local timezone. The result is midnight local time on the calendar date the target timezone is currently on, not the exact instant midnight occurred in that timezone. With the default (user's own) timezone the two are the same.

## Exports
- `getUserTimezone(): string` - IANA timezone name of the browser, or `'America/New_York'` on the server.
- `formatDateForUser(date: Date, timeZone?: string): string` - `dd/mm/yyyy` string in the timezone.
- `getStartOfDayInTimeZone(timeZone?: string): Date` - local-midnight `Date` for the timezone's current calendar day.

## Dependencies
- **Internal:** none.
- **Packages:** none (uses the built-in `Intl` API).

## Used by
Nothing imports this file, so it appears unused. Sibling components such as `create-task-dialog.tsx` do their own date handling with `date-fns` and plain `Date` arithmetic.

## Notes
- The hard-coded `America/New_York` server fallback matches the leftover `todayNY` naming in `create-task-dialog.tsx`, where New York time was apparently once used as the reference timezone.
