# `server/models/auctionWalletTransaction.model.ts`

> Mongoose model `AuctionWalletTransaction`: append-only audit log with one row per balance change on an `AuctionWallet`.

**Kind:** Mongoose model · **Lines:** 139

## Purpose
Records every top-up, bid lock, refund, settlement and manual adjustment on a bidder's auction wallet. Each row captures the full wallet state transition, and an idempotency key makes every money path safe to re-run.

## How it works
- **Both balances on every row:** `balanceBefore/After` track the spendable balance and `lockedBefore/After` track the escrow mirror. A bid lock moves money between the two, so recording only one would be misleading.
- **Idempotency keys** (unique sparse index on `idempotencyKey`, same pattern as `aivatarWalletTransaction`):
  - top-up -> `topup:<invoiceId>` (verify-payment and a gateway webhook can both run `fulfillInvoice` for one payment)
  - bid lock -> `lock:<bidId>`
  - bid refund -> `refund:<bidId>`
  - bid settle -> `settle:<bidId>`
- `type` - `topup`, `bid_lock`, `bid_refund`, `bid_settle`, `adjustment` (indexed).
- `direction` - `in` | `out`.
- `amount` - float USD, `min: 0` (deliberately no `min: 0.01`: a raise whose delta rounds to 0 after conversion still deserves an audit row); `currency` default `USD`.
- `productId` refs **`StoreProduct`** (storefront auctions are garage-store-backend products); the comment warns that getting this ref wrong makes `.populate()` silently resolve against the wrong collection. `bidId` is a plain ObjectId.
- `description` (required, max 500), `note` (max 1000), `relatedTransactionId` (paired platform-side `WalletTransaction`), `metadata` (Mixed).
- `status` - `completed` (default), `pending`, `failed`, `reversed`; indexed.
- Indexes: `auctionWalletId`, `userId` single-field; `{ auctionWalletId, createdAt -1 }`, `{ userId, createdAt -1 }`, `{ productId, type }`, unique sparse `{ idempotencyKey }`.
- Explicit collection `auctionwallettransactions`.

## Exports
- `AuctionWalletTransaction` - Mongoose model.
- `interface IAuctionWalletTransaction` - document shape.
- `AUCTION_WALLET_TX_TYPES`, `type AuctionWalletTxType`.
- `AUCTION_WALLET_TX_DIRECTIONS` (`["in", "out"]`), `type AuctionWalletTxDirection`.

## Interfaces
- **Database:** `AuctionWalletTransaction` (collection `auctionwallettransactions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/auctionWallet.ts` - writes ledger rows for top-ups / settlement.
- `server/routes/wallet.ts` - mounted at `/wallet` (browser `/backend/wallet`), lists auction-wallet history.
- `server/scripts/diagnoseAuctionSettlement.ts` - manual diagnostic (production `MONGODB_URI`).

## Notes
- **Co-owned collection** with garage-store-backend (see `auctionWallet.model.ts`); keep schemas in sync.
- A unique sparse index treats an explicit `null` as a value in MongoDB, so the default `idempotencyKey: null` could collide between rows that carry no key; in practice writers should always set a key or leave the field absent.
