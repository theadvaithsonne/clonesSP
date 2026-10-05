# `server/routes/cashbackCodes.ts`

> REST routes for the cashback code system (v2: single-product binding).

**Kind:** Express router · **Lines:** 593 · **Mounted at:** `/cashback-codes` (browser: `/backend/cashback-codes`)

<!-- docgen:auto -->

## Purpose
REST routes for the cashback code system (v2: single-product binding).
Mounted at `/cashback-codes`. All endpoints require `requireAuth`. Mutating
endpoints additionally run `isEligibleCreator` (UP-activated affiliate with
≥1 direct, or the platform super-admin) so only entitled callers can mint
or modify codes.

The same routes are called from the Garage HQ FE AND the external Garage
e-commerce platform — both forward the user's Garage JWT (SSO assumption).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/cashback-codes` | `requireAuth` | inline | 102 |
| GET | `/` | `/backend/cashback-codes` | `requireAuth` | inline | 181 |
| GET | `/me/summary` | `/backend/cashback-codes/me/summary` | `requireAuth` | inline | 205 |
| GET | `/me/received` | `/backend/cashback-codes/me/received` | `requireAuth` | inline | 225 |
| GET | `/eligible-for-buyer` | `/backend/cashback-codes/eligible-for-buyer` | `requireAuth` | inline | 268 |
| GET | `/eligible-items` | `/backend/cashback-codes/eligible-items` | `requireAuth` | inline | 318 |
| GET | `/eligible-buyers` | `/backend/cashback-codes/eligible-buyers` | `requireAuth` | inline | 377 |
| GET | `/for-affiliate` | `/backend/cashback-codes/for-affiliate` | — | inline | 411 |
| GET | `/:id` | `/backend/cashback-codes/:id` | `requireAuth` | inline | 458 |
| PATCH | `/:id` | `/backend/cashback-codes/:id` | `requireAuth` | inline | 475 |
| POST | `/:id/deactivate` | `/backend/cashback-codes/:id/deactivate` | `requireAuth` | inline | 526 |
| POST | `/:id/activate` | `/backend/cashback-codes/:id/activate` | `requireAuth` | inline | 546 |
| GET | `/:id/distributions` | `/backend/cashback-codes/:id/distributions` | `requireAuth` | inline | 570 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CASHBACK_PRODUCT_TYPES` | export |  | 590 |
| `default (router)` | default |  | 592 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `CASHBACK_PRODUCT_TYPES` (server/models/cashbackCode.model.ts) — referenced

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/user.model.ts` — `User`
  - `server/models/cashbackCode.model.ts` — `CASHBACK_PRODUCT_TYPES`, `CashbackProductType`
  - `server/services/cashbackCode.ts` — `isEligibleCreator`, `createCashbackCode`, `updateCashbackCode`, `setCashbackCodeStatus`, `listCashbackCodesForCreator`, `getCashbackCodeDetail`, `listDistributionsForCode`, `listDistributionsReceivedByUser`, … +5
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`, `ZodError`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/cashback-codes`.
