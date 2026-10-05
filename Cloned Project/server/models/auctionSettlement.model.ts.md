# `server/models/auctionSettlement.model.ts`

> Mongoose model `AuctionSettlement`: hand-off queue in which garage-store-backend drops one row per won storefront auction for this backend's settlement cron to fulfil.

**Kind:** Mongoose model · **Lines:** 148

## Purpose
Seller payout, commissions, territory/franchise splits and cashback all run through `fulfillInvoice`, which lives in this backend and cannot be called from garage-store-backend. So when the store backend resolves an auction it performs the money movement it owns (refund losers' escrow, convert the winner's escrow to spent) and inserts **one** `pending` row here. This backend's settlement cron then runs the normal e-commerce fulfilment pipeline against it.

## How it works
### Ownership
- store-backend -> `INSERT status: "pending"` (only writer of new rows).
- this backend's cron -> `UPDATE status: "settled" | "failed"` (only consumer).

### Idempotency
`bidId` is required and **unique**: it anchors the whole settlement, and the same id namespaces the downstream unique-sparse keys (`Invoice.razorpayPaymentId`, `ProductOrder.paymentId`, `CommissionDistribution {paymentId, itemType, itemId}`), so a re-run is a no-op at every layer.

### Fields
- Sale: `productId` (ref `StoreProduct`, not `Product`), `orgId` (ref `Organization`), `bidId`.
- Winner: `winnerUserId` (ref `User`, required), `winnerEmail`, `winnerName`.
- Money: `amountUsd` - exactly what was escrowed, settle this rather than re-converting; `bidAmount`, `bidCurrency` (uppercase, default `USD`), `exchangeRate`.
- Outcome: `status` (`pending` default, `settled`, `failed`, `skipped`), `invoiceId` (ref `Invoice`), `productOrderId` (ref `ProductOrder`), `commissionDistributionId` (ref `CommissionDistribution`), `sellerCreditedUsd`.
- Proof of payment: `settled` is only written once a `CommissionDistribution` for the sale reaches `"completed"`. `fulfillInvoice` returning is **not** enough, because it swallows per-line commission errors and still reports success.
- Retry control: `attempts`, `lastError`, `nextAttemptAt` (exponential backoff - a row is skipped until this time so a broken row doesn't burn its budget in minutes), `needsAddress` (settled without a shipping address; seller must follow up), `settledAt`.

### Indexes
`productId`, `orgId`, `winnerUserId`, `status` single-field; unique `bidId`; and `{ status, createdAt }` - the cron's hot query. Explicit collection `auctionsettlements`.

## Exports
- `AuctionSettlement` - Mongoose model.
- `interface IAuctionSettlement` - document shape.
- `AUCTION_SETTLEMENT_STATUSES` - `["pending", "settled", "failed", "skipped"]`.
- `type AuctionSettlementStatus`.
- `AUCTION_SETTLEMENT_MAX_ATTEMPTS = 5` - stop retrying after five failures (the older Razorpay capture path retried every 60 s with no cap).

## Interfaces
- **Database:** `AuctionSettlement` (collection `auctionsettlements`) - read/updated here, inserted by garage-store-backend.
- **Background work:** consumed by `startAuctionSettlementCron()` in `server/services/auctionSettlement.ts`, started from `server/index.ts` and run every 60 s.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/auctionSettlement.ts` - the settlement cron.
- `server/routes/garageAdminAuctionSettlements.ts` - admin view, mounted at `/garage-admin/auction-settlements` (browser `/backend/garage-admin/auction-settlements`).
- `server/services/founderStreamTable.ts` - reads settlements for founder reporting.
- `server/scripts/diagnoseAuctionSettlement.ts` - manual diagnostic (production `MONGODB_URI`).

## Notes
- **Co-owned collection.** Mirror schema at `garage-store-backend/src/models/shared/auctionSettlement.model.ts` (external repo); keep them in sync.
