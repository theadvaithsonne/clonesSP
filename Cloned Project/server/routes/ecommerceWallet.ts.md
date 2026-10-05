# `server/routes/ecommerceWallet.ts`

> src/routes/ecommerceWallet.ts

**Kind:** Express router · **Lines:** 317 · **Mounted at:** `/ecommerce` (browser: `/backend/ecommerce`)

<!-- docgen:auto -->

## Purpose
src/routes/ecommerceWallet.ts

Buyer-side wallet reads for the external Garage e-commerce storefront,
authenticated via the buyer's Garage Bearer JWT (SSO). The storefront
forwards the buyer's existing JWT — no new key, no userId in the path.

Endpoints (mounted under /ecommerce):
  GET /ecommerce/wallet?orgId=<X>     — snapshot for one storefront
  GET /ecommerce/wallets/me           — all storefronts the buyer has activity in

Both return a unified `EcommerceWalletSnapshot` shape: balance,
withdrawable, recent StoreWallet transactions, and the cashback the
buyer has received at THAT storefront.

Design note: a buyer holds one StoreWallet per (userId, orgId). Cashback
also lands per-(buyer, sellerOrgId) — see CASHBACK_CODES_API.md. So […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/wallet` | `/backend/ecommerce/wallet` | `requireAuth` | inline | 164 |
| GET | `/wallets/me` | `/backend/ecommerce/wallets/me` | `requireAuth` | inline | 241 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 316 |

## Interfaces

- **Database (Mongoose models used):**
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`, `find`
  - `CashbackDistribution` (server/models/cashbackDistribution.model.ts) — reads: `aggregate`, `find`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/cashbackDistribution.model.ts` — `CashbackDistribution`
  - `server/services/wallet.ts` — `getStoreWalletBalance`, `getStoreWalletTransactions`
  - `server/services/withdrawal.ts` — `getWithdrawableBalanceCents`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`, `ZodError`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/ecommerce`.
