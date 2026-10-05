# `server/routes/call.ts`

> Express router with 17 endpoints, mounted at `/calls`.

**Kind:** Express router · **Lines:** 812 · **Mounted at:** `/calls` (browser: `/backend/calls`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (17)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/calls` | `requireAuth` | inline | 32 |
| GET | `/manage` | `/backend/calls/manage` | `requireAuth` | inline | 114 |
| GET | `/` | `/backend/calls` | `requireAuth` | inline | 142 |
| GET | `/:callId` | `/backend/calls/:callId` | `requireAuth` | inline | 169 |
| PUT | `/:callId` | `/backend/calls/:callId` | `requireAuth` | inline | 206 |
| DELETE | `/:callId` | `/backend/calls/:callId` | `requireAuth` | inline | 271 |
| POST | `/:callId/questions` | `/backend/calls/:callId/questions` | `requireAuth` | inline | 310 |
| PUT | `/:callId/questions/:questionId` | `/backend/calls/:callId/questions/:questionId` | `requireAuth` | inline | 352 |
| DELETE | `/:callId/questions/:questionId` | `/backend/calls/:callId/questions/:questionId` | `requireAuth` | inline | 392 |
| PUT | `/:callId/questions/reorder` | `/backend/calls/:callId/questions/reorder` | `requireAuth` | inline | 429 |
| POST | `/:callId/create-order` | `/backend/calls/:callId/create-order` | `requireAuth` | inline | 472 |
| POST | `/:callId/verify-payment` | `/backend/calls/:callId/verify-payment` | `requireAuth` | inline | 569 |
| POST | `/:callId/purchase-free` | `/backend/calls/:callId/purchase-free` | `requireAuth` | inline | 650 |
| GET | `/purchases/me` | `/backend/calls/purchases/me` | `requireAuth` | inline | 706 |
| GET | `/:callId/purchases` | `/backend/calls/:callId/purchases` | `requireAuth` | inline | 726 |
| GET | `/purchases/:purchaseId` | `/backend/calls/purchases/:purchaseId` | `requireAuth` | inline | 754 |
| GET | `/:callId/stats` | `/backend/calls/:callId/stats` | `requireAuth` | inline | 786 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 811 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/services/call.ts` — `* as callService`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/callPurchase.model.ts` — `CallPurchase`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/bulkEmail.ts` — `notifyNewCallCreated`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/services/razorpay.ts` — `createOrder`, `verifyPaymentSignature`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/calls`.
