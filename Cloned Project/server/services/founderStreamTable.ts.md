# `server/services/founderStreamTable.ts`

> Founder Live Streams table — the dense, one-row-per-stream dataset behind the founder console's Bigin-style grid (Founder → Live).

**Kind:** backend service · **Lines:** 1714

<!-- docgen:auto -->

## Purpose
Founder Live Streams table — the dense, one-row-per-stream dataset behind
the founder console's Bigin-style grid (Founder → Live).

The card list this replaced only ever needed enrolments + a headline revenue
figure, so `getOrgWorkshops` enriches for that. This view asks fifteen
questions per row — attendance, Garage TV reach, enrolment revenue AND its
transaction count, affiliate payouts on both the enrolment and the
live-selling side, what was sold on screen and to how many people — so it
gets its own reader rather than growing the list endpoint every other
surface already depends on.

TWO VIEWS, ONE ROW SHAPE
  One Time   → one row per non-recurring stream.
  Recurring  → the founder first picks a series (see
               `getFounderRecurringSeries`), then the table shows one row
               per SESSION of that series. Same fifteen columns, same row […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderStreamView` | type |  | 69 |
| `FounderStreamStatus` | type | The four series-level statuses the console renders. | 79 |
| `FounderStreamRow` | interface |  | 85 |
| `FounderStreamTotals` | interface | The footer strip. | 159 |
| `FounderRecurringSeries` | interface | One entry in the "Recurring Live Streams" drill-down panel. | 174 |
| `FounderSeriesHeader` | interface | Everything the recurring view prints ABOVE the table. | 196 |
| `FounderStreamTableResult` | interface |  | 219 |
| `FounderStreamTableOptions` | interface |  | 237 |
| `getFounderStreamTable` | function | `async getFounderStreamTable(orgId: string, options: FounderStreamTableOptions = {}): Promise<FounderStreamTableResult>` | 894 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `find`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`, `countDocuments`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/models/user.model.ts` — `User`
  - `server/utils/exchangeRate.ts` — `getUsdToInrRate`
  - `server/utils/recurrence.ts` — `calculateSessions`, `getNextSession`
  - `server/utils/workshopStatus.ts` — `isSessionDeleted`, `sessionDayKey`
  - `server/utils/sessionOverlay.ts` — `resolveEffectiveSession`
  - `server/services/workshop.ts` — `getWorkshopStartDateTimeUTC`, `getWorkshopEndDateTimeUTC`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/workshop.ts`

## Notes

- Large file (1714 lines) — read it by section; line numbers above point into it.
