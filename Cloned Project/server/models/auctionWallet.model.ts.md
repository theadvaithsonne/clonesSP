# `server/models/auctionWallet.model.ts`

> Mongoose model `AuctionWallet`: a buyer's global prepaid USD wallet used to bid on storefront auctions.

**Kind:** Mongoose model · **Lines:** 79

## Purpose
Bidders fund this wallet before bidding; it replaced the old Razorpay card authorise-and-capture bid path entirely. Unlike `StoreWallet` (keyed per user + org), this wallet is **global per user**: one balance is used across many sellers' stores.

## How it works
Money model (from the header):
| Event | Effect | Who |
|---|---|---|
| top-up (invoice paid) | `balance += amount` | this backend, in `fulfillInvoice` |
| bid lock | `balance -= d`, `lockedBalance += d`; the same `d` is credited to the platform `StoreWallet` (escrow account) | garage-store-backend |
| outbid refund | `lockedBalance -= L`, `balance += L` | garage-store-backend |
| win settle | `lockedBalance -= L` (money already left `balance` at lock time) | garage-store-backend |

So `balance` is spendable money, and `lockedBalance` is only a **display mirror** of what is held in escrow for this user - the locked funds are no longer in this document.

Balances are float USD main units (e.g. `12.34`), matching `StoreWallet`, `AffiliateWallet` and `CampaignWallet`; every write should be rounded via `round2`.

Fields: `userId` (ref `User`, required, unique), `balance`, `lockedBalance` (default 0, `min: 0`), `currency` (default `USD`), `isActive` (default true), `lastTransactionAt`, and lifetime aggregates `totalToppedUp`, `totalLocked`, `totalRefunded`, `totalSpent` (cheap dashboard reads without scanning the ledger). Timestamps on; explicit collection `auctionwallets`.

## Exports
- `AuctionWallet` - Mongoose model.
- `interface IAuctionWallet` - document shape.

## Interfaces
- **Database:** `AuctionWallet` (collection `auctionwallets`) - written here (top-ups) and by garage-store-backend (lock/refund/settle).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/auctionWallet.ts` - top-ups and settlement helpers.
- `server/scripts/diagnoseAuctionSettlement.ts` - manual diagnostic (production `MONGODB_URI`).

## Notes
- **Co-owned collection.** garage-store-backend writes it through `src/models/shared/auctionWallet.model.ts`; keep both schemas in sync.
- Every balance change should also produce an `AuctionWalletTransaction` row.
