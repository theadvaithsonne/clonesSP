# `server/models/contentSubmission.model.ts`

> Mongoose model for one social-media post an affiliate submits to a Content Rewards campaign, tracking review, view counts and earnings.

**Kind:** Mongoose model · **Lines:** 188

## Purpose
In Content Rewards a founder runs a `ContentCampaign` with a CPM rate; affiliates post content on their social accounts and submit the post URL. Each submission is reviewed (or auto-approved), its views are polled from the platform API, and it accrues earnings that the hourly payout sweeper pays out from the campaign's escrow wallet. This model is the per-post record that ties those steps together.

## How it works
- **Links:** `campaignId` (`ContentCampaign`), `userId` (the affiliate), `socialAccountId` (`SocialAccount`, optional), `orgId`.
- **Post:** `postUrl` (required) and `platform` (free string; the comment mentions tiktok/instagram/youtube/twitter, while campaigns only target instagram/youtube).
- **Review:** `status` - `pending` (default), `approved`, `rejected`, `flagged`; `reviewedBy`, `reviewedAt`, `rejectionReason` (max 1,000 chars). When the campaign has `autoApprove`, `server/routes/contentSubmission.ts` creates the submission directly as `approved`.
- **View tracking:** `viewsAtApproval` (baseline), `currentViews` (latest), `viewSnapshots[]` (`{views, timestamp}` history), `lastTrackedAt`. Views come only from platform APIs: `viewSource` is fixed to `"oauth_api"`, `platformPostId` holds the extracted media id used for API lookups, and `lastFetchedAt` supports a refresh rate limit (the sweeper skips submissions fetched within the last 50 minutes).
- **Payout basis:** `payoutBasis` is the founder's choice at approval: `net` (default; `viewsAtApproval` = current views, so only new views earn) or `total` (`viewsAtApproval` = 0, so all views earn). The sweeper always computes `netViews = currentViews - viewsAtApproval`, so the field is stored for audit only.
- **Earnings (cents):** `earnedAmount` is the running total computed from net views and the campaign CPM; `paidOutAmount` is how much has already been paid across one or more `ContentPayout` rows. Each sweeper tick pays the difference. `isPaidOut` means "fully settled" and only flips when the campaign closes; `paidOutAt` is the last payout time.
- `timestamps: true`.

**Indexes:**
- `campaign_submissions_idx` `{campaignId, status, createdAt:-1}` - founder's review list.
- `user_submissions_idx` `{userId, createdAt:-1}` - affiliate's own submissions.
- `tracking_queue_idx` `{status, lastTrackedAt}` - cron lookup of approved submissions needing a view refresh.
- `campaign_post_unique` - unique `{campaignId, postUrl}`, preventing the same post being submitted twice to one campaign.
- `org_submissions_idx` `{orgId, status, createdAt:-1}`.

## Exports
- `ContentSubmission` - Mongoose model (`"ContentSubmission"`, collection `contentsubmissions`).
- `SUBMISSION_STATUSES` / `SubmissionStatus` - `"pending" | "approved" | "rejected" | "flagged"`.
- `IViewSnapshot` - `{ views, timestamp }`.
- `IContentSubmission` - document interface.

## Interfaces
- **Database:** `ContentSubmission` (collection `contentsubmissions`); refs `ContentCampaign`, `User`, `SocialAccount`, `Organization`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/contentSubmission.ts` (mounted at `/content-submissions`, browser `/backend/content-submissions`), `server/routes/contentCampaign.ts` (`/content-campaigns`), `server/services/campaignWallet.ts` (increments `paidOutAmount` during payouts) and `server/services/contentPayoutSweeper.ts` (hourly view refresh and payout).

## Notes
- `postUrl` uniqueness is per campaign and exact-string; the same post with a different URL form (query string, short link) is not caught by the index.
- `viewSnapshots` grows unbounded per submission.
