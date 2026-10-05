# `server/models/contentPayout.model.ts`

> Mongoose model for Content Rewards payout records: one audit row each time money moves from a campaign's escrow wallet to an affiliate for a submission.

**Kind:** Mongoose model · **Lines:** 83

## Purpose
When an affiliate's content submission earns money (views x campaign CPM), the payout service debits the campaign's `CampaignWallet` and credits the affiliate. `ContentPayout` is the audit trail of those events, so a founder or admin can see who was paid, for which campaign/submission, how much, and for how many views.

## How it works
- References: `userId` (the affiliate, `User`), `campaignId` (`ContentCampaign`), `submissionId` (`ContentSubmission`), `orgId` (`Organization`); all required and indexed.
- `amount` - payout amount in **cents**; `viewsRewarded` - views covered by this payout.
- `status` - `pending` (default), `processing`, `completed`, `failed`; `processedAt` - when it completed.
- `transactionRef` - intended to hold the related wallet transaction id (string, default `""`).
- `timestamps: true`.
- Indexes: `user_payouts_idx` `{userId, createdAt:-1}` and `campaign_payouts_idx` `{campaignId, createdAt:-1}` for per-user and per-campaign history.

In practice the only writer is `payoutFromCampaignToAffiliate` in `server/services/campaignWallet.ts`, which creates the row inside the same Mongo transaction as the wallet debit/credit with `status: "completed"` and `processedAt: now`. Each row represents the **delta** paid on that tick (earned minus already paid out), not a cumulative figure. The paired `CampaignWalletTransaction` (and the legacy `ContentRewardsWalletTransaction`) can point back at it through `relatedPayoutId`.

## Exports
- `ContentPayout` - Mongoose model (`"ContentPayout"`, collection `contentpayouts`).
- `PAYOUT_STATUSES` / `PayoutStatus` - `"pending" | "processing" | "completed" | "failed"`.
- `IContentPayout` - document interface.

## Interfaces
- **Database:** `ContentPayout` (collection `contentpayouts`) - written by the campaign wallet service.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/campaignWallet.ts` (payout path, driven by `server/services/contentPayoutSweeper.ts` and the payout endpoint in `server/routes/contentSubmission.ts`).

## Notes
- The current payout code does not set `transactionRef`, so it stays an empty string; link rows via `relatedPayoutId` on the transaction side instead.
- Rows are only ever created as `completed`; the other statuses are unused today.
