# `lib/recurrence.ts`

> Client-side mirror of the server's recurrence walk (see `roam-backend/src/utils/recurrence.ts`).

**Kind:** frontend library · **Lines:** 174

<!-- docgen:auto -->

## Purpose
Client-side mirror of the server's recurrence walk (see
`roam-backend/src/utils/recurrence.ts`).

It exists so a founder can SEE the sessions a rule will produce while they
are still editing the rule — before any workshop document exists to ask the
backend about. The server stays the authority: nothing computed here is
persisted, and every session that is edited is written back through
`updateWorkshopSession` keyed by the same canonical day.

EVERYTHING HERE IS UTC. A session's identity is the UTC midnight of the day
the rule produced — that's the key registrations, orders and room routing
use — so the walk is done on `YYYY-MM-DD` strings and UTC accessors. Using
local dates would shift half the world's sessions by a day.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ClientRecurrencePattern` | interface | Client-side mirror of the server's recurrence walk (see `roam-backend/src/utils/recurrence.ts`). | 17 |
| `weeklyDays` | function | `weeklyDays(pattern: ClientRecurrencePattern): number[]` — Every weekday a weekly rule runs on. | 33 |
| `monthlyDays` | function | `monthlyDays(pattern: ClientRecurrencePattern): number[]` — Every date-of-month a monthly rule runs on. | 40 |
| `ymdToUtcDate` | function | `ymdToUtcDate(ymd: string): Date` — "2026-09-17" → Date at 2026-09-17T00:00:00.000Z. | 46 |
| `utcDateToYmd` | function | `utcDateToYmd(date: Date): string` — Date → "YYYY-MM-DD", read in UTC. | 52 |
| `matchesPattern` | function | `matchesPattern(date: Date, pattern: ClientRecurrencePattern): boolean` — Does this day satisfy the rule? | 58 |
| `computeSessionDays` | function | `computeSessionDays(opts: { pattern: ClientRecurrencePattern; /** yyyy-mm-dd, i…): string[]` — Every session day a rule produces, as `YYYY-MM-DD`, inclusive of both bounds. | 91 |
| `describePattern` | function | `describePattern(pattern: ClientRecurrencePattern): string` — "Every day", "Every Monday and Wednesday", "Monthly on the 1st and 15th" — a one-line summary of the rule, for headers and preview captions. | 150 |
| `RECURRENCE_DAY_LABELS` | export | `(local DAY_LABELS)` | 173 |
| `ordinalDay` | export | `(local ordinal)` | 173 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/liveStreams/SessionScheduleEditor.tsx`
