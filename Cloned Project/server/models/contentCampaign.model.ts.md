# `server/models/contentCampaign.model.ts`

> Mongoose model for a Content Rewards campaign: a founder funds a budget and pays creators (affiliates) a CPM rate for views on the clips/UGC they post.

**Kind:** Mongoose model · **Lines:** 228

## Purpose
"Content Rewards" lets an organisation's founder pay affiliates for content (short clips or user-generated videos) that promotes the business on Instagram or YouTube. This file defines the campaign document: the brief, the budget and rate, targeting, required hashtags/mentions, assets and resource links handed to creators, denormalised counters, and the link to the escrow `CampaignWallet` that actually holds the money. It also exports the enum constants (`SOCIAL_PLATFORMS` etc.) reused by other models and routes.

## How it works
- **Money is in cents.** `budget`, `budgetSpent`, `ratePerThousand` (payout per 1,000 views, minimum 1), `minPayout` and `maxPayout` (per submission, `0` = no limit) are integer cents to avoid floating-point drift. `lockedAmount` mirrors the `CampaignWallet` balance x 100 for fast UI reads (the wallet itself stores float USD).
- **Lifecycle:** `status` is one of `draft` (default), `active`, `paused`, `completed`. `completedAt` is set when the campaign auto-completes because its `CampaignWallet` drained to zero (see `payoutFromCampaignToAffiliate` in `server/services/campaignWallet.ts`). It is deliberately separate from `updatedAt`, which changes on every counter bump.
- **Type and currency:** `campaignType` is `clipping` or `ugc` (default `ugc`); `currency` is `USD` (default) or `INR`. The payout service currently only supports USD and throws for INR campaigns.
- **Targeting and brief:** `platforms` (array of `instagram` / `youtube`, default `["youtube"]`), `requirements` sub-document (`minDuration`/`maxDuration` in seconds, `hashtags`, `mentions`, free-text `guidelines` up to 5,000 chars), `assets[]` (`url`, `type` video/image/document, `description`) and `resourceLinks[]` (`url`, `label`, `type` drive/dropbox/notion/video/other).
- **Settings:** `autoApprove` - when true, submissions do not need manual founder review (enforced in the submission routes).
- **Counters (denormalised):** `totalSubmissions`, `approvedSubmissions`, `totalViews`, plus `participants` (User ids) and `totalParticipants`, all incremented by routes/services rather than computed.
- **Escrow link:** `campaignWalletId` references `CampaignWallet` (budget is locked from the founder's StoreWallet when the campaign is created).
- `timestamps: true` adds `createdAt`/`updatedAt`.

**Indexes:** single-field indexes on `orgId`, `founderId`, `status`; compound `org_campaigns_idx` `{orgId, status, createdAt:-1}` for the founder's list, and `active_campaigns_idx` `{status, createdAt:-1}` for affiliate discovery of active campaigns.

## Exports
- `ContentCampaign` - the Mongoose model (`"ContentCampaign"`, collection `contentcampaigns`).
- `CAMPAIGN_TYPES` / `CampaignType` - `"clipping" | "ugc"`.
- `CAMPAIGN_STATUSES` / `CampaignStatus` - `"draft" | "active" | "paused" | "completed"`.
- `CAMPAIGN_CURRENCIES` / `CampaignCurrency` - `"USD" | "INR"`.
- `SOCIAL_PLATFORMS` / `SocialPlatform` - `"instagram" | "youtube"`; also imported by `socialAccount.model.ts`.
- `ICampaignRequirements`, `ICampaignAsset`, `IResourceLink` - sub-document shapes.
- `IContentCampaign` - the document interface.

## Interfaces
- **Database:** `ContentCampaign` (collection `contentcampaigns`); refs `Organization`, `User` (founder, participants), `CampaignWallet`.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/models/socialAccount.model.ts`, `server/routes/contentCampaign.ts` (mounted at `/content-campaigns`, browser `/backend/content-campaigns`), `server/routes/contentSubmission.ts` (`/content-submissions`), `server/routes/socialAccount.ts` (`/social-accounts`), `server/services/campaignWallet.ts` (escrow and payouts), `server/services/contentPayoutSweeper.ts` (background payout sweeper).

## Notes
- Unit mismatch to keep in mind: campaign amounts are cents, `CampaignWallet` balances are float USD; `lockedAmount` is the bridge and must be kept in sync by whoever moves wallet money.
- `participants` is an unbounded array on the document; very large campaigns grow the document.
