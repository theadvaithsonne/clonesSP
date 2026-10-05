# `components/garage-admin/catchup/timezones.ts`

> Timezone + duration helpers, copied verbatim from the NetworkChains web app (components/meet/schedule-fields.tsx) so the Garage admin catch-up scheduler behaves identically.

**Kind:** React component · **Lines:** 169

<!-- docgen:auto -->

## Purpose
Timezone + duration helpers, copied verbatim from the NetworkChains web app
(components/meet/schedule-fields.tsx) so the Garage admin catch-up scheduler
behaves identically. Only the pure helpers are taken — the NC field
components pull in NC-only dependencies.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `durationMinutesBetween` | function | `durationMinutesBetween(start: string, end: string): number` | 21 |
| `canonicalTz` | function | `canonicalTz(tz: string): string` | 27 |
| `TzEntry` | interface |  | 89 |
| `TIMEZONES` | const | `= (() => { const seen = new Set(COMMON_TZ.map((t) => t.tz)); const out: TzEntry[] = [...COMMON_TZ];…` | 95 |
| `zonedWallClockToUtc` | function | `zonedWallClockToUtc(ymd: string, hm: string, timeZone: string): Date` — Convert a wall-clock date + time IN `timeZone` to the correct UTC instant. | 162 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx`
