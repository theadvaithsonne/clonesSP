# `server/routes/garageAdminNetworkChainSubs.ts`

> Express router with 2 endpoints, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 801 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/networkchain-subs` | `/backend/garage-admin/networkchain-subs` | `requireGarageAdminAuth` | inline | 33 |
| POST | `(dynamic)` | `/backend/garage-admin/(dynamic)` | `"/networkchain-subs/:userId/assign-agent"`, `"/users/:userId/assign-agent"`, `requireGarageAdminAuth`, `requireAdminAction(["one_time_affiliates", "n…` | inline | 686 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 800 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`; **writes:** `updateOne`
  - `NcSubscription` (server/models/ncSubscription.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `find`, `findById`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireAdminAction`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/ncSubscription.model.ts` — `NcSubscription`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/services/autoDebitInstrument.ts` — `autoDebitInstrument`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
