# `server/routes/paymentMethods.ts`

> Express router with 7 endpoints, mounted at `/payment-methods`.

**Kind:** Express router · **Lines:** 477 · **Mounted at:** `/payment-methods` (browser: `/backend/payment-methods`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/payment-methods` | `requireAuth` | inline | 32 |
| POST | `/stripe/setup-intent` | `/backend/payment-methods/stripe/setup-intent` | `requireAuth` | inline | 85 |
| DELETE | `/stripe/:pmId` | `/backend/payment-methods/stripe/:pmId` | `requireAuth` | inline | 143 |
| PATCH | `/stripe/:pmId/default` | `/backend/payment-methods/stripe/:pmId/default` | `requireAuth` | inline | 229 |
| POST | `/razorpay/save-card-order` | `/backend/payment-methods/razorpay/save-card-order` | `requireAuth` | inline | 286 |
| DELETE | `/razorpay/:tokenId` | `/backend/payment-methods/razorpay/:tokenId` | `requireAuth` | inline | 332 |
| PATCH | `/razorpay/:tokenId/default` | `/backend/payment-methods/razorpay/:tokenId/default` | `requireAuth` | inline | 429 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 476 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `STRIPE_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/services/stripe.ts` — `createSetupIntent`, `detachPaymentMethod`, `getOrCreateStripeCustomer`, `stripeEnabled`
  - `server/services/razorpay.ts` — `createSaveCardOrder`, `deleteRazorpayToken`, `getOrCreateRazorpayCustomer`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/payment-methods`.
