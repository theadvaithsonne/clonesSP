# `server/routes/nowpaymentsWebhook.ts`

> Express router with 1 endpoint, mounted at `/webhooks/nowpayments`.

**Kind:** Express router · **Lines:** 223 · **Mounted at:** `/webhooks/nowpayments` (browser: `/backend/webhooks/nowpayments`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/webhooks/nowpayments` | — | inline | 26 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 222 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `Product` (server/models/product.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/services/nowpayments.ts` — `verifyIpnSignature`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/invoice.ts` — `fulfillInvoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/product.model.ts` — `Product`
  - `server/bat246/services/bat246Entry.service.ts` — `createBoardFromPurchase`, `addAtBatFromPurchase`, `addFromUpperBaseInvite`, `addToDugoutFromPurchase`, `addFromGenericInvite`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/webhooks/nowpayments`.
