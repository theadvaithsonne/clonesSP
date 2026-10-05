# `server/routes/counterBills.ts`

> Express router with 13 endpoints, mounted at `/api/counter-bills`.

**Kind:** Express router · **Lines:** 491 · **Mounted at:** `/api/counter-bills` (browser: `/backend/api/counter-bills`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/attach` | `/backend/api/counter-bills/attach` | `requireAuth` | inline | 158 |
| GET | `/mine` | `/backend/api/counter-bills/mine` | `requireAuth` | inline | 173 |
| GET | `/:id/for-me` | `/backend/api/counter-bills/:id/for-me` | `requireAuth` | inline | 199 |
| POST | `/:id/correction` | `/backend/api/counter-bills/:id/correction` | `requireAuth` | inline | 218 |
| GET | `/` | `/backend/api/counter-bills` | `requireAuth`, `requireStoreMember` | inline | 258 |
| POST | `/preview` | `/backend/api/counter-bills/preview` | `requireAuth`, `requireStoreMember` | inline | 362 |
| POST | `/` | `/backend/api/counter-bills` | `requireAuth`, `requireStoreMember` | inline | 392 |
| GET | `/:id` | `/backend/api/counter-bills/:id` | `requireAuth`, `requireStoreMember` | inline | 403 |
| PATCH | `/:id` | `/backend/api/counter-bills/:id` | `requireAuth`, `requireStoreMember` | inline | 414 |
| POST | `/:id/send` | `/backend/api/counter-bills/:id/send` | `requireAuth`, `requireStoreMember` | inline | 430 |
| POST | `/:id/cancel` | `/backend/api/counter-bills/:id/cancel` | `requireAuth`, `requireStoreMember` | inline | 444 |
| POST | `/:id/split` | `/backend/api/counter-bills/:id/split` | `requireAuth`, `requireStoreMember` | inline | 455 |
| POST | `/:id/correction/dismiss` | `/backend/api/counter-bills/:id/correction/dismiss` | `requireAuth`, `requireStoreMember` | inline | 471 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 490 |

## Interfaces

- **Database (Mongoose models used):**
  - `Store` (server/models/store.model.ts) — reads: `findOne`, `find`
  - `CounterBill` (server/models/counterBill.model.ts) — reads: `find`, `findOne`, `findById`, `aggregate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/counterBill.model.ts` — `CounterBill`, `ICounterBill`
  - `server/models/store.model.ts` — `Store`
  - `server/services/ecommerceInvoice.ts` — `EcommerceError`
  - `server/services/counterBill.ts` — `CounterBillError`, `SellerContext`, `attachCustomer`, `cancelBill`, `createDraft`, `customerView`, `loadOwnBill`, `priceBill`, … +6
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/counter-bills`.
