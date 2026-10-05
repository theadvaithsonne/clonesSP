# `server/routes/stripeWebhook.ts`

> Express router with 1 endpoint, mounted at `/webhooks/stripe`.

**Kind:** Express router · **Lines:** 379 · **Mounted at:** `/webhooks/stripe` (browser: `/backend/webhooks/stripe`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/webhooks/stripe` | — | inline | 18 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 378 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/services/stripe.ts` — `verifyWebhookSignature`, `getStripeClient`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/invoice.ts` — `fulfillInvoice`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/webhooks/stripe`.
