# `server/routes/hifiInvoice.ts`

> HiFi investment — invoice + wallet-payment bridge.

**Kind:** Express router · **Lines:** 814 · **Mounted at:** `/hifi` (browser: `/backend/hifi`)

<!-- docgen:auto -->

## Purpose
HiFi investment — invoice + wallet-payment bridge.

The garage-seller-hifi Next app owns products, application flow,
KYC, subscriptions, payouts (see hifi_* collections in
roam-admin-prod). This router exists ONLY so the hifi seller FE can
route the "Pay" step through our invoice + multi-currency store
wallet system:

  POST /hifi/applications/:applicationId/invoice
      Called by the seller FE at the pay step. Mints an invoice in
      our system for the application's amount + currency, and
      returns { invoiceId, invoiceNumber, redirectUrl, amount, currency }.
      Investor then hits /invoice/:invoiceId, picks the matching
      sibling wallet, pays. Our fulfillInvoice hook writes back to
      hifi_investment_applications and creates the subscription.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/applications/:applicationId/invoice` | `/backend/hifi/applications/:applicationId/invoice` | `requireAuth` | inline | 98 |
| GET | `/applications/:applicationId/invoice` | `/backend/hifi/applications/:applicationId/invoice` | `requireAuth` | inline | 317 |
| POST | `/payouts/distribute` | `/backend/hifi/payouts/distribute` | `requireAuth` | inline | 386 |
| GET | `/organizations/:orgId/transactions` | `/backend/hifi/organizations/:orgId/transactions` | `requireAuth` | inline | 693 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 813 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`, `exists`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`, `find`, `countDocuments`; **writes:** `create`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
- **Raw collections:** `hifi_investment_applications`, `hifi_products`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/services/wallet.ts` — `debitStoreWallet`
  - `server/config/hifiInvoice.ts` — `normalizeHifiCurrency`, `HIFI_PAYABLE_CURRENCIES`
  - `server/config/cryptoWallets.ts` — `getChainConfig`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/hifi`.
