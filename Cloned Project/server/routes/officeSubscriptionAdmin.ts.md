# `server/routes/officeSubscriptionAdmin.ts`

> Express router with 7 endpoints, mounted at `/office-subscription`.

**Kind:** Express router · **Lines:** 476 · **Mounted at:** `/office-subscription` (browser: `/backend/office-subscription`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/status` | `/backend/office-subscription/status` | `requireAuth` | inline | 29 |
| GET | `/plans` | `/backend/office-subscription/plans` | `requireAuth` | inline | 128 |
| GET | `/payments` | `/backend/office-subscription/payments` | `requireAuth` | inline | 158 |
| POST | `/cancel` | `/backend/office-subscription/cancel` | `requireAuth` | inline | 270 |
| POST | `/sync` | `/backend/office-subscription/sync` | `requireAuth` | inline | 317 |
| POST | `/init-plans` | `/backend/office-subscription/init-plans` | `requireAuth` | inline | 361 |
| POST | `/backfill-invoices` | `/backend/office-subscription/backfill-invoices` | `requireAuth` | inline | 393 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 475 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findById`
  - `OfficeSubscriptionPayment` (server/models/officeSubscriptionPayment.model.ts) — reads: `find`
  - `OfficeUpgradeHistory` (server/models/officeUpgradeHistory.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/officeSubscription.ts` — `getOfficePlans`, `getOfficeSubscription`, `getActiveOfficeSubscription`, `hasActiveOfficeSubscription`, `canInviteStakeholders`, `cancelOfficeSubscription`, `syncOfficeSubscriptionStatus`, `initializeOfficePlans`, … +3
  - `server/models/officePlan.model.ts` — `OfficePlan`, `IOfficePlan`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/officeSubscriptionPayment.model.ts` — `OfficeSubscriptionPayment`
  - `server/models/officeUpgradeHistory.model.ts` — `OfficeUpgradeHistory`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/office-subscription`.
