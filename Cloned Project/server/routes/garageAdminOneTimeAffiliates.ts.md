# `server/routes/garageAdminOneTimeAffiliates.ts`

> Express router with 2 endpoints, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 1301 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/one-time-affiliates` | `/backend/garage-admin/one-time-affiliates` | `requireGarageAdminAuth` | inline | 42 |
| POST | `/users/:userId/nvc-chat` | `/backend/garage-admin/users/:userId/nvc-chat` | `requireGarageAdminAuth` | inline | 1242 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1300 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `aggregate`, `findById`; **writes:** `updateOne`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `aggregate`, `find`
  - `ReserveLicense` (server/models/reserveLicense.model.ts) — reads: `aggregate`, `find`
  - `IgniteCallModel` (server/models/igniteCall.model.ts) — reads: `find`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/reserveLicense.model.ts` — `ReserveLicense`
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/models/igniteCall.model.ts` — `IgniteCallModel`
  - `server/services/igniteCall.service.ts` — `newestLiveCall`, `enrichStatuses`, `applyManualCompletion`
  - `server/lib/ncMeetClient.ts` — `ncScheduleStatuses`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
