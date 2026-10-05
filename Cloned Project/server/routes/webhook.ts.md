# `server/routes/webhook.ts`

> Express router with 3 endpoints, mounted at `/webhooks`.

**Kind:** Express router · **Lines:** 935 · **Mounted at:** `/webhooks` (browser: `/backend/webhooks`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/razorpay` | `/backend/webhooks/razorpay` | — | inline | 99 |
| GET | `/health` | `/backend/webhooks/health` | — | inline | 912 |
| GET | `/razorpay/test` | `/backend/webhooks/razorpay/test` | — | inline | 924 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 934 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/services/razorpay.ts` — `verifyWebhookSignature`
  - `server/services/downlineTree.ts` — `refreshTypeFlags`
  - `server/services/subscription.ts` — `handleSubscriptionAuthenticated`, `handleSubscriptionActivated`, `handleSubscriptionCharged`, `handleSubscriptionPending`, `handleSubscriptionHalted`, `handleSubscriptionCancelled`, `handleSubscriptionCompleted`, `handleSubscriptionPaused`, … +1
  - `server/services/officeSubscription.ts` — `handleOfficeSubscriptionAuthenticated`, `handleOfficeSubscriptionActivated`, `handleOfficeSubscriptionCharged`, `handleOfficeSubscriptionPending`, `handleOfficeSubscriptionHalted`, `handleOfficeSubscriptionCancelled`
  - `server/services/officeAddonSubscription.ts` — `handleOfficeAddonSubscriptionAuthenticated`, `handleOfficeAddonSubscriptionActivated`, `handleOfficeAddonSubscriptionCharged`, `handleOfficeAddonSubscriptionPending`, `handleOfficeAddonSubscriptionHalted`, `handleOfficeAddonSubscriptionCancelled`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/invoice.ts` — `createRecurringInvoice`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/services/unilevelPlusCommission.ts` — `getUserPurchase`, `getActiveUnilevelPlusPlan`, `distributeUnilevelPlusCommission`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/webhooks`.
