# `server/services/contentPayoutSweeper.ts`

> src/services/contentPayoutSweeper.ts Hourly sweeper that turns the Content Rewards earnings flywheel.

**Kind:** backend service · **Lines:** 329

<!-- docgen:auto -->

## Purpose
src/services/contentPayoutSweeper.ts
Hourly sweeper that turns the Content Rewards earnings flywheel.

For each approved-but-not-fully-settled submission in an active campaign:
  1. Refresh views from the platform API (respecting the existing 1h
     rate-limit guard).
  2. Recompute earnedAmount from the refreshed views and the campaign CPM.
  3. If (earnedAmount - paidOutAmount) >= campaign.minPayout, payout the
     delta atomically: debit CampaignWallet, credit ContentRewardsWallet,
     write ContentPayout + paired audit transactions.

The sweeper is the ONLY thing that moves money for content rewards now —
the manual /:id/payout founder endpoint has been removed.

Concurrency guard: an in-process flag prevents two ticks running at once
if a sweep takes longer than its interval.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SweepResult` | interface |  | 37 |
| `sweepContentPayouts` | function | `async sweepContentPayouts(): Promise<SweepResult>` — Run one sweep. Safe to call directly (e.g. | 126 |

## Interfaces

- **Database (Mongoose models used):**
  - `SocialAccount` (server/models/socialAccount.model.ts) — reads: `findOne`
  - `ContentSubmission` (server/models/contentSubmission.model.ts) — reads: `find`
  - `ContentCampaign` (server/models/contentCampaign.model.ts) — reads: `findById`
  - `CampaignWallet` (server/models/campaignWallet.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/contentSubmission.model.ts` — `ContentSubmission`
  - `server/models/contentCampaign.model.ts` — `ContentCampaign`
  - `server/models/socialAccount.model.ts` — `SocialAccount`
  - `server/models/campaignWallet.model.ts` — `CampaignWallet`
  - `server/services/viewTracking.ts` — `fetchViewsAuto`
  - `server/services/campaignWallet.ts` — `payoutFromCampaignToAffiliate`
  - `server/routes/contentSubmission.ts` — `recalcCampaignTotalViews`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/contentSubmission.ts`
