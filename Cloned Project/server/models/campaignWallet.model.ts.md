# `server/models/campaignWallet.model.ts`

> Mongoose model for the per-campaign escrow wallet that holds the locked budget of a Content Rewards campaign.

**Kind:** Mongoose model · **Lines:** 71

## Purpose
In Content Rewards, a founder funds a campaign that pays affiliates for content submissions. To guarantee the money exists, the budget is moved out of the founder's `StoreWallet` into a dedicated `CampaignWallet` when the campaign is created. Approved payouts drain it into affiliates' `ContentRewardsWallet`s; archiving the campaign refunds what is left to the founder's `StoreWallet`. Each balance change is logged in `CampaignWalletTransaction`.

## How it works
Fields (`ICampaignWallet`, with `timestamps`):
- `campaignId` (`ContentCampaign`) - required and **unique**: exactly one wallet per campaign.
- `orgId` (`Organization`), `founderId` (`User`) - required, indexed.
- `balance` - float USD, default 0, `min: 0` (the comment notes it mirrors `StoreWallet`/`AffiliateWallet`, which are also floats).
- `currency` - default `USD`.
- Lifetime totals: `totalLocked` (credits in), `totalPaidOut` (debits to affiliates), `totalRefunded` (refunds to founder).
- `status` - `active` (default) or `closed`, indexed.
- `lastTransactionAt` - default null.

Collection: Mongoose default, `campaignwallets`.

## Exports
- `CampaignWallet` - the model.
- `CAMPAIGN_WALLET_STATUSES` - `["active", "closed"] as const`.
- `type CampaignWalletStatus` - union of those values.
- `interface ICampaignWallet` - document type.

## Interfaces
- **Database:** `CampaignWallet` (collection `campaignwallets`) - managed by `server/services/campaignWallet.ts` (lock, payout, refund) and read/debited by `server/services/contentPayoutSweeper.ts`.

## Dependencies
- **Packages:** `mongoose` - schema, model, types.

## Used by
`server/services/campaignWallet.ts`, `server/services/contentPayoutSweeper.ts`.

## Notes
- `min: 0` on `balance` is enforced by validators on `save()`, not on `$inc` updates; services must guard against overdraw themselves.
- `unique: true` together with `index: true` on `campaignId` is redundant (unique already creates the index).
