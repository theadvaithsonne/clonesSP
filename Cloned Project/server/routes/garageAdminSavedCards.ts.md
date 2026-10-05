# `server/routes/garageAdminSavedCards.ts`

> Admin surface for a user's saved cards (Stripe only — Razorpay tokens are read-only elsewhere and out of scope here).

**Kind:** Express router · **Lines:** 2090 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
Admin surface for a user's saved cards (Stripe only — Razorpay
tokens are read-only elsewhere and out of scope here).

Powers the "Saved Cards" tab on
/garage-admin/one-time-affiliates/[userId]. Five actions:
  1. GET  /users/:userId/saved-cards
       List the user's Stripe methods with mandate metadata.
  2. PATCH /users/:userId/saved-cards/:pmId/default
       Flip default flag locally (no Stripe API call needed).
  3. DELETE /users/:userId/saved-cards/:pmId
       Detach from Stripe + $pull from User.paymentProfile.
  4. POST /users/:userId/saved-cards/:pmId/charge
       One-time charge for a specific product. Routes through the
       normal Invoice → chargeSavedPaymentMethod → webhook →
       fulfillInvoice pipeline so the buyer actually GETS the
       product. Applies the shared MIT/CIT gating from […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (14)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/users/:userId/saved-cards` | `/backend/garage-admin/users/:userId/saved-cards` | — | inline | 88 |
| PATCH | `/users/:userId/saved-cards/:pmId/default` | `/backend/garage-admin/users/:userId/saved-cards/:pmId/default` | — | inline | 147 |
| DELETE | `/users/:userId/saved-cards/:pmId` | `/backend/garage-admin/users/:userId/saved-cards/:pmId` | — | inline | 181 |
| POST | `/users/:userId/saved-cards/create-add-link` | `/backend/garage-admin/users/:userId/saved-cards/create-add-link` | — | inline | 230 |
| GET | `/orgs/:orgId/products` | `/backend/garage-admin/orgs/:orgId/products` | — | inline | 309 |
| GET | `/orgs/:orgId/subscribable-items` | `/backend/garage-admin/orgs/:orgId/subscribable-items` | — | inline | 348 |
| POST | `/users/:userId/saved-cards/:pmId/charge` | `/backend/garage-admin/users/:userId/saved-cards/:pmId/charge` | — | inline | 420 |
| POST | `/users/:userId/saved-cards/:pmId/start-subscription` | `/backend/garage-admin/users/:userId/saved-cards/:pmId/start-subscription` | — | inline | 655 |
| GET | `/users/:userId/billable-platform-items` | `/backend/garage-admin/users/:userId/billable-platform-items` | — | inline | 998 |
| POST | `/users/:userId/saved-cards/:pmId/bill-platform-item` | `/backend/garage-admin/users/:userId/saved-cards/:pmId/bill-platform-item` | — | inline | 1139 |
| POST | `/users/:userId/saved-cards/:pmId/charge-adhoc` | `/backend/garage-admin/users/:userId/saved-cards/:pmId/charge-adhoc` | — | inline | 1502 |
| GET | `/users/:userId/saved-cards/:pmId/refundable-charges` | `/backend/garage-admin/users/:userId/saved-cards/:pmId/refundable-charges` | — | inline | 1730 |
| POST | `/users/:userId/saved-cards/refund` | `/backend/garage-admin/users/:userId/saved-cards/refund` | — | inline | 1782 |
| POST | `/users/:userId/upi-mandates/:tokenId/charge-adhoc` | `/backend/garage-admin/users/:userId/upi-mandates/:tokenId/charge-adhoc` | — | inline | 1874 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth, requireGarageSuperAdmin` (L56)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2089 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`; **writes:** `updateOne`
  - `Product` (server/models/product.model.ts) — reads: `find`, `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `find`, `findOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `updateOne`
- **Raw collections:** `networkchain_subscriptions`
- **Environment variables (`process.env`):** `FRONTEND_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/user.model.ts` — `User`
  - `server/models/product.model.ts` — `Product`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/stripe.ts` — `chargeSavedPaymentMethod`, `detachPaymentMethod`, `refundStripeCharge`, `createSetupIntent`, `getOrCreateStripeCustomer`
  - `server/services/paymentGating.ts` — `resolveSavedCardChargeMode`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/services/jwt.ts` — `signJwt`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.

## Notes

- Large file (2090 lines) — read it by section; line numbers above point into it.
