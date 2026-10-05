# `server/routes/garageAdminAuctionSettlements.ts`

> Admin surface for auction win settlements.

**Kind:** Express router · **Lines:** 232 · **Mounted at:** `/garage-admin/auction-settlements` (browser: `/backend/garage-admin/auction-settlements`)

<!-- docgen:auto -->

## Purpose
Admin surface for auction win settlements.

Every failure in the settlement pipeline used to be console-only, and a
`failed` row was unrecoverable: the cron selects `status: "pending"` and
nothing reset it, so the buyer's money stayed in the platform escrow wallet
with no way back. These endpoints make stuck wins visible and fixable.

Same gate as /garage-admin/wallets — super-admin only, because requeue and
repair both move real money.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/auction-settlements` | — | inline | 36 |
| GET | `/:id` | `/backend/garage-admin/auction-settlements/:id` | — | inline | 118 |
| POST | `/:id/requeue` | `/backend/garage-admin/auction-settlements/:id/requeue` | — | inline | 157 |
| POST | `/:id/repair-commission` | `/backend/garage-admin/auction-settlements/:id/repair-commission` | — | inline | 202 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth, requireGarageSuperAdmin` (L28)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 231 |

## Interfaces

- **Database (Mongoose models used):**
  - `AuctionSettlement` (server/models/auctionSettlement.model.ts) — reads: `find`, `countDocuments`, `findById`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/auctionSettlement.model.ts` — `AuctionSettlement`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/user.model.ts` — `User`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/services/auctionSettlement.ts` — `settleAuctionWin`, `repairSellerCommission`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/auction-settlements`.
