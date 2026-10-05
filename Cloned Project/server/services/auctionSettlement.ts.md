# `server/services/auctionSettlement.ts`

> src/services/auctionSettlement.ts

**Kind:** backend service · **Lines:** 604

<!-- docgen:auto -->

## Purpose
src/services/auctionSettlement.ts

Turns a won auction into a real sale.

garage-store-backend owns bidding and escrow, but `fulfillInvoice` — seller
payout, platform fee, comb-plan commissions, territory + franchise splits,
cashback — lives here and can't be called from there. So the store backend
drops an AuctionSettlement row when an auction resolves with a winner, and
this cron picks it up.

Per row:
  1. release the escrow held in the platform store wallet
  2. mint a PAID invoice for exactly that amount
  3. run it through fulfillInvoice, which creates the ProductOrder,
     decrements inventory and distributes commissions — identical to a
     normal buy-now sale […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SettlementRunResult` | interface |  | 52 |
| `settleAuctionWin` | function | `async settleAuctionWin(settlementId: string \| Types.ObjectId): Promise<SettlementRunResult>` — Settle one queued auction win. | 194 |
| `repairSellerCommission` | function | `async repairSellerCommission(settlementId: string \| Types.ObjectId): Promise<{ ok: boolean; reason?: string; sellerCre…` — Repair the seller payout for a settlement whose invoice and order already exist but whose commission never completed. | 488 |
| `settleQueuedAuctionWins` | function | `async settleQueuedAuctionWins(): Promise<SettlementRunResult[]>` — Process a batch of queued wins. | 543 |
| `startAuctionSettlementCron` | function | `startAuctionSettlementCron(intervalMs = 60_000): NodeJS.Timeout` — Cron entrypoint — invoked from src/index.ts on boot. | 569 |

## Interfaces

- **Database (Mongoose models used):**
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `AuctionSettlement` (server/models/auctionSettlement.model.ts) — reads: `findById`, `find`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Store` (server/models/store.model.ts) — reads: `findOne`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `findOne`
- **Timers / queues:** `setTimeout` at L601; `setInterval` at L602

## Dependencies

- **Internal:**
  - `server/models/auctionSettlement.model.ts` — `AuctionSettlement`, `AUCTION_SETTLEMENT_MAX_ATTEMPTS`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/user.model.ts` — `User`
  - `server/models/store.model.ts` — `Store`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
  - `server/services/ecommerceInvoice.ts` — `resolveSellersForOrgs`
  - `server/utils/gstTax.ts` — `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`, `gstSkippedMetadata`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/garageAdminAuctionSettlements.ts`
