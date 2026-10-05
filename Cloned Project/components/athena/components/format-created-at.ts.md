# `components/athena/components/format-created-at.ts`

> Small date helpers that format a task's `createdAt` value in the viewer's time zone, either as an absolute date-time or as relative time.

**Kind:** utility module (not a component) · **Lines:** 41

## Purpose
Taskroom cards and the card detail modal show when a task was created, both as an absolute timestamp (for example "Oct 4, 2026, 3:12 PM") and as "3 days ago". This module keeps that formatting in one place. It accepts the loose shapes the Taskroom API returns: an ISO string, epoch milliseconds, `null` or empty.

## How it works
- The user's time zone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`, falling back to `"UTC"`.
- `parseCreatedAt` returns `null` for `null`, `undefined`, `""` and unparseable values, using `date-fns` `isValid`. Each formatter returns `null` in those cases too, so callers can skip rendering.
- `formatCreatedAtDateTime` uses `Intl.DateTimeFormat` with the browser's locale, `dateStyle: "medium"`, `timeStyle: "short"`, and the user's time zone.
- `formatCreatedAtElapsed` uses `date-fns` `formatDistanceToNow` with `addSuffix: true`, which gives output like "about 2 hours ago".
- `getTimeZoneAbbreviation` finds the `timeZoneName` part (for example "IST" or "GMT+5:30") through `formatToParts`. If that throws, it returns the IANA zone name.

## Exports
- `getUserTimeZone(): string` returns the IANA time zone, or `"UTC"`.
- `getTimeZoneAbbreviation(date = new Date()): string` returns the short time-zone label for that date.
- `parseCreatedAt(value?: string | number | null): Date | null` returns a valid `Date` or `null`.
- `formatCreatedAtDateTime(value?): string | null` returns a localised medium date with a short time.
- `formatCreatedAtElapsed(value?): string | null` returns relative time with a suffix.

## Dependencies
- **Packages:** `date-fns` (`formatDistanceToNow`, `isValid`).

## Used by
- `components/athena/components/card-modal.tsx`
- `components/athena/components/kanban-card.tsx`
