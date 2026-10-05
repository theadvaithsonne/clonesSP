# `server/routes/garageAdminDailyReports.ts`

> Express router with 1 endpoint, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 559 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/daily-reports` | `/backend/garage-admin/daily-reports` | `requireGarageAdminAuth`, `requireAdminPage("daily_reports", "view")` | inline | 236 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DailyReportKind` | type |  | 48 |
| `default (router)` | default |  | 558 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireAdminPage`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/officePlan.model.ts` — `OFFICE_PLAN_IDS`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
