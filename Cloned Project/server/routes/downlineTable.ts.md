# `server/routes/downlineTable.ts`

> src/routes/downlineTable.ts GET /affiliate/downline-table — server-driven data source for the Bigin-style 1Network → Downline table.

**Kind:** Express router · **Lines:** 1044 · **Mounted at:** `/affiliate` (browser: `/backend/affiliate`)

<!-- docgen:auto -->

## Purpose
src/routes/downlineTable.ts
GET /affiliate/downline-table — server-driven data source for the Bigin-style
1Network → Downline table. Pagination + sort + filter run entirely in Mongo
against the denormalized fields on User (ancestors / depth / legNumber /
directsCount / downlineCount / typeFlags), so there is NO per-request
$graphLookup. See the backend contract (docs 2026-07-27).

View = a root user's full recursive subtree (root defaults to the caller;
pivot via ?rootUserId). Level & leg are derived relative to that root from the
stored ancestor path. Footer totals are for the WHOLE view (unfiltered).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/downline-table` | `/backend/affiliate/downline-table` | `requireAuth` | inline | 190 |
| GET | `/downline-table/facets` | `/backend/affiliate/downline-table/facets` | `requireAuth` | inline | 850 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `excludeBeneathClause` | function | `excludeBeneathClause(raw: unknown): Record<string, unknown> \| null` — `?excludeUserId=` — hide everyone BENEATH each named person, keeping the person themselves listed. | 127 |
| `default (router)` | default |  | 1043 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`, `aggregate`, `distinct`, `countDocuments`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/services/comboWindow.ts` — `comboWindowFor`, `comboWindowStatus`, `COMBO_WINDOW_HOURS`, `ComboWindowStatus`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`
- `server/routes/__tests__/downlineTable.exclude.test.ts`

Entry: mounted in `server/app.ts` at `/affiliate`.
