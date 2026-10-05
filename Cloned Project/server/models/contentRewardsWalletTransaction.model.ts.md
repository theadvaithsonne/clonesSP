# `server/models/contentRewardsWalletTransaction.model.ts`

> Legacy Mongoose model for the audit log of `ContentRewardsWallet` balance changes; defined but no longer imported anywhere.

**Kind:** Mongoose model · **Lines:** 116

## Purpose
This was the ledger for the per-user Content Rewards wallet: one row per credit, debit or withdrawal, paired with the matching `CampaignWalletTransaction` on the campaign escrow side. After the payout path was moved to write directly into the shared `wallets` collection (`NcWallet`) and audit in `CampaignWalletTransaction` (see the history comment in `server/services/contentRewardsWallet.ts`), this collection stopped being written.

## How it works
- Links: `contentRewardsWalletId` (required, ref `ContentRewardsWallet`), `userId` (required, ref `User`), optional `campaignId` (`ContentCampaign`), `submissionId` (`ContentSubmission`), `orgId` (`Organization`).
- `type` - `credit`, `debit` or `withdrawal` (`CONTENT_REWARDS_TX_TYPES`).
- `amount` - float USD, minimum 0.01; `currency` default `"USD"`; `balanceBefore` / `balanceAfter` snapshots (required).
- `description` - required, trimmed, max 500 chars.
- `relatedPayoutId` - ref `ContentPayout`; `relatedTransactionId` - the paired `CampaignWalletTransaction` id (no `ref` declared).
- `metadata` - free-form `Mixed`.
- `status` - `completed` (default), `pending`, `failed`, `reversed`.
- `timestamps: true`.
- Indexes: single-field on the link fields, `type` and `status`; compound `{contentRewardsWalletId, createdAt:-1}`, `{userId, createdAt:-1}`, `{campaignId, createdAt:-1}`.

## Exports
- `ContentRewardsWalletTransaction` - Mongoose model (`"ContentRewardsWalletTransaction"`, collection `contentrewardswallettransactions`).
- `CONTENT_REWARDS_TX_TYPES` / `ContentRewardsTxType` - `"credit" | "debit" | "withdrawal"`.
- `IContentRewardsWalletTransaction` - document interface.

## Interfaces
- **Database:** `ContentRewardsWalletTransaction` (collection `contentrewardswallettransactions`) - no current readers or writers.

## Dependencies
- **Packages:** `mongoose`.

## Used by
Appears unused: nothing imports it. Content Rewards transaction history (`/wallet/content-rewards/*` in `server/routes/wallet.ts`) is now served from `CampaignWalletTransaction` via `server/services/contentRewardsWallet.ts`.

## Notes
- Historical rows may still exist in the database from before the rewrite; they are not shown in the current UI.
