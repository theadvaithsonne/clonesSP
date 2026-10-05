# `server/models/campaignWalletTransaction.model.ts`

> Mongoose model for the audit log of a Content Rewards campaign escrow wallet: one row per balance change (lock, payout or refund).

**Kind:** Mongoose model · **Lines:** 112

## Purpose
Every movement in or out of a `CampaignWallet` is recorded here so the campaign's balance can be explained and reconciled. Each row can point at the paired transaction on the other side of the move: a `StoreWalletTransaction` when budget is locked or refunded, or a `ContentRewardsWalletTransaction` when an affiliate is paid.

## How it works
Fields (`ICampaignWalletTransaction`, with `timestamps`):
- **Scope:** `campaignWalletId` (`CampaignWallet`), `campaignId` (`ContentCampaign`), `orgId` (`Organization`), all required and indexed.
- **Movement:** `type` - `credit` (budget locked in), `debit` (payout to an affiliate) or `refund` (returned to the founder); `direction` - `in` or `out`.
- **Amounts:** `amount` (float USD, min 0.01), `currency` (default `USD`), `balanceBefore`, `balanceAfter`.
- `description` - required, max 500 characters.
- **Links (all default null):** `relatedUserId` (founder for credit/refund, affiliate for debit), `relatedSubmissionId` (`ContentSubmission`, for payout debits), `relatedPayoutId` (`ContentPayout`), `relatedTransactionId` (paired Store or ContentRewards wallet transaction, no `ref`).
- `metadata` - free-form `Mixed`.
- `status` - `completed` (default), `pending`, `failed`, `reversed`.

Indexes: `{ campaignWalletId, createdAt: -1 }`, `{ campaignId, createdAt: -1 }`, `{ orgId, type, createdAt: -1 }`, plus single-field indexes on the scope fields, `type` and `status`.

Collection: Mongoose default, `campaignwallettransactions`.

## Exports
- `CampaignWalletTransaction` - the model.
- `CAMPAIGN_WALLET_TX_TYPES` - `["credit", "debit", "refund"] as const`.
- `type CampaignWalletTxType`.
- `CAMPAIGN_WALLET_TX_DIRECTIONS` - `["in", "out"] as const`.
- `type CampaignWalletTxDirection`.
- `interface ICampaignWalletTransaction` - document type.

## Interfaces
- **Database:** `CampaignWalletTransaction` (collection `campaignwallettransactions`) - written by `server/services/campaignWallet.ts`; read by the admin back-office (`server/controllers/garageAdmin.controller.ts`) and by the one-off migration `server/scripts/migrate-content-rewards-to-org-rewards.ts`, which sums completed `debit` rows per affiliate and org to reconstruct per-org rewards balances.

## Dependencies
- **Packages:** `mongoose` - schema, model, types.

## Used by
`server/controllers/garageAdmin.controller.ts`, `server/scripts/migrate-content-rewards-to-org-rewards.ts`, `server/services/campaignWallet.ts`.

## Notes
- Amounts are floats in USD, so sums can carry small rounding drift; the migration script mentioned above tolerates about 2 cents of drift for this reason.
