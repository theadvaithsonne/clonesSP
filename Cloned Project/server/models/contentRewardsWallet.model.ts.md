# `server/models/contentRewardsWallet.model.ts`

> Legacy Mongoose model for a per-user wallet holding Content Rewards earnings, kept separate from the affiliate commission wallet; no code imports it any more.

**Kind:** Mongoose model · **Lines:** 46

## Purpose
Originally, payouts from a campaign's `CampaignWallet` were credited into this per-user wallet so Content Rewards earnings stayed segregated from `AffiliateWallet` (unilevel commissions) and could get their own withdrawal flow. The payout path has since been rewritten ("Option B" in `server/services/contentRewardsWallet.ts`): earnings are now written straight into the shared `wallets` collection (`NcWallet`) and audited in `CampaignWalletTransaction`. This model remains defined but is not used.

## How it works
- `userId` - required, unique (one wallet per user), ref `User`.
- `balance` - float USD, default 0, min 0 (note: the campaign side uses cents; this wallet uses dollars).
- `currency` - default `"USD"`.
- `totalEarnings` - lifetime credited sum; `totalWithdrawn` - reserved for a future withdrawal flow.
- `isActive` - default true; `lastTransactionAt` - last balance change.
- `timestamps: true`.

## Exports
- `ContentRewardsWallet` - Mongoose model (`"ContentRewardsWallet"`, collection `contentrewardswallets`).
- `IContentRewardsWallet` - document interface.

## Interfaces
- **Database:** `ContentRewardsWallet` (collection `contentrewardswallets`) - no current readers or writers in code.

## Dependencies
- **Packages:** `mongoose`.

## Used by
Appears unused: nothing imports it. `server/services/contentRewardsWallet.ts` keeps the legacy function names (`getOrCreateContentRewardsWallet`, `getContentRewardsWalletBalance`, ...) for `/wallet/content-rewards/*` routes and `components/dashboard/WalletPageNew.tsx`, but reads from `NcWallet`/`CampaignWalletTransaction` instead of this collection.

## Notes
- Existing documents in this collection (from before the rewrite) may hold historical balances that the current dashboard no longer shows.
- Safe-to-delete candidate once it is confirmed that no historical data needs to be read.
