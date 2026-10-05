# `server/routes/internalCrypto.ts`

> Internal endpoints called by garage-crypto-backend.

**Kind:** Express router · **Lines:** 71 · **Mounted at:** `/internal` (browser: `/backend/internal`)

<!-- docgen:auto -->

## Purpose
Internal endpoints called by garage-crypto-backend. Every handler
runs behind requireInternalService (X-Internal-Token header + no
Authorization).

The only endpoint today is the fulfill-paid webhook: crypto backend
marks an invoice paid when a deposit lands, then posts here so
main's fulfillInvoice runs (commission distribution, seller USD
credit, per-itemType fulfillment). Duplicate delivery is safe — the
Idempotency-Key is recorded on the invoice and a second call with
the same key returns 409 without re-running fulfilment.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/invoices/:invoiceId/fulfill-paid` | `/backend/internal/invoices/:invoiceId/fulfill-paid` | — | inline | 20 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireInternalService` (L18)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 70 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/middleware/internalService.ts` — `requireInternalService`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/invoice.ts` — `fulfillInvoice`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/internal`.
