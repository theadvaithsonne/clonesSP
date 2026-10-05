# `server/models/auctionEscrow.model.ts`

> Mongoose model `AuctionEscrow`: one row per (bidder, storefront auction) recording how much of the bidder's money is held in escrow, enabling delta locking.

**Kind:** Mongoose model · **Lines:** 95

## Purpose
Storefront auctions are paid from a prepaid `AuctionWallet`. When a bidder raises a bid from $100 to $110, only the $10 difference should move into escrow. This row keeps the running escrowed total per bidder per auction so that delta can be computed, and records whether the escrow was refunded (outbid) or settled (won).

## How it works
Operations described in the header (all performed by **garage-store-backend**, not this repo):
- `lockForBid()` - `delta = requiredUsd - lockedUsd`, then `lockedUsd += delta`.
- `releaseEscrow()` - refund `lockedUsd`, `status = "refunded"`.
- `markEscrowSettled()` - the winner's escrow converts to a sale, `status = "settled"`.

`exchangeRate` (bid currency to USD) is pinned at first lock and reused at settlement, so currency drift between bid and close cannot unbalance the ledger - the exact escrowed USD is settled.

Fields: `userId` (ref `User`), `productId` (ref **`StoreProduct`**, collection `storeproducts` - not this backend's `Product`), `orgId` (ref `Organization`) - all required and indexed; `lockedUsd`, `bidAmount` (latest bid in auction currency) - default 0, `min: 0`; `bidCurrency` (uppercase, default `USD`); `exchangeRate` (default 1); `status` (`held` default, `refunded`, `settled`; indexed); `lastBidId`, `refundedAt`, `settledAt`; timestamps.

Indexes:
- Unique `{ userId, productId }` - exactly one escrow row per bidder per auction; delta calculation depends on it.
- `{ productId, status }` - resolution sweeps all held escrows on an auction to refund losers.

Explicit collection `auctionescrows`.

## Exports
- `AuctionEscrow` - Mongoose model.
- `interface IAuctionEscrow` - document shape.
- `AUCTION_ESCROW_STATUSES` - `["held", "refunded", "settled"]`.
- `type AuctionEscrowStatus`.

## Interfaces
- **Database:** `AuctionEscrow` (collection `auctionescrows`) - read-only from this repo.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/auctionWallet.ts` - reads escrow during settlement.
- `server/scripts/diagnoseAuctionSettlement.ts` - manual diagnostic script (connects to `MONGODB_URI`, the production database).

## Notes
- **Co-owned collection.** garage-store-backend (a separate service, not in this repo) is the only writer; a mirror schema lives at `garage-store-backend/src/models/shared/auctionEscrow.model.ts`. Keep the two in sync when changing fields.
