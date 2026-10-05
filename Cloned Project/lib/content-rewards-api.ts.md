# `lib/content-rewards-api.ts`

> Typed client for the Content Rewards programme: founders run paid "clipping"/UGC campaigns, affiliates connect social accounts, submit posts, earn per-thousand-view payouts, and move earnings between wallets.

**Kind:** frontend library · **Lines:** 607

## Purpose
Content Rewards spans several backend routers (campaigns, social accounts, social OAuth, submissions, wallet, link preview). This file gathers every call the dashboard needs into one module with shared TypeScript types, so the founder page, the affiliate page and the wallet page all talk to the backend the same way. Every function is a thin wrapper around `api()` from `lib/api.ts`, authenticated with the session token from `getToken()`; `api()` throws an `Error` with the server's `error`/`message` on non-2xx responses.

## How it works

### Types (L7-L178)
- `Campaign` - a campaign: type `clipping | ugc`, status `draft | active | paused | completed`, budget / spent / remaining, `ratePerThousand`, currency `USD | INR`, min/max payout, allowed `platforms`, `requirements` (duration bounds, hashtags, mentions, guidelines), `assets`, `resourceLinks`, `autoApprove`, submission/view/participant counters, optional escrow fields `campaignWalletId` and `lockedAmount`, and optional `userSubmissions`.
- `CampaignWalletInfo` / `CampaignWalletTransactionItem` - the per-campaign escrow wallet (balance, locked, paid out, refunded, status `active | closed | missing`) and its audit ledger (credit/debit/refund, before/after balances, related user/submission/payout). Amounts are float USD per the inline comments.
- `ContentRewardsBalance`, `ContentRewardsOrgBalance`, `ContentRewardsTransactionItem` - an earner's Content Rewards balance (total, or one row per org) and ledger.
- `StoreWalletBalance` - founder's Store wallet balance.
- `SocialAccount` - a linked social profile with bio-code verification state (`isVerified`, `verificationCode`) and `oauthConnected`.
- `Submission` - an affiliate's post on a campaign: status `pending | approved | rejected | flagged`, review fields, view counters (`viewsAtApproval`, `currentViews`, `netViews`), earnings and payout state, `viewSource: "oauth_api"`, `viewSnapshots`, and optional `metadata` (title/thumbnail/author fetched at submission time so the founder review card can show a preview).
- `EarningsSummary` - totals plus `byCampaign` and `byPlatform` breakdowns.
- `CampaignStats` - campaign plus status counts, `topPerformers` and `platformBreakdown`.
- `ContentRewardsTransferResult` (L508) - the result of a self-transfer.

### Campaigns (L180-L246)
`fetchCampaigns(status?)` lists the founder's campaigns; `fetchActiveCampaigns(orgId?)` lists active campaigns an affiliate can join (the backend falls back to the token's org when `orgId` is omitted). `createCampaign`, `updateCampaign`, `deleteCampaign` and `fetchCampaignStats` are founder actions; `joinCampaign` / `leaveCampaign` are affiliate actions.

### Social accounts and OAuth (L248-L318)
`fetchSocialAccounts`, `connectSocialAccount(platform, profileUrl)` (returns the account plus `instructions`), `verifySocialAccount(id)` (bio-code check; may return a fresh `verificationCode` or an `error`), `removeSocialAccount(id)`. `getOAuthUrl(platform)` returns the provider `authUrl` to redirect to (the provider then returns to the backend's public `GET /backend/social-oauth/:platform/callback`, which this file does not call); `disconnectOAuth` and `refreshOAuthToken` manage the stored token.

### Submissions (L320-L401)
- `submitContent(campaignId, postUrl)` - affiliate submits a post.
- `fetchMySubmissions({ status?, campaignId? })`, `fetchMyEarnings(campaignId?)` - affiliate views.
- `fetchCampaignSubmissions(campaignId, status?)` - founder review queue.
- `fetchLivePreviewViews(submissionId)` - founder-only live view count for a pending submission (stored count is still 0 before approval); per the doc comment it is not rate-limited and hits the platform API directly.
- `reviewSubmission(id, action, { reason?, payoutBasis? })` - approve or reject. `payoutBasis` is only sent when approving: `"net"` (the default) pays only views accrued after approval, `"total"` pays every view including the pre-approval backlog. `reason` is sent whenever it is defined.

### Wallets (L405-L537)
- `fetchStoreWalletBalance(orgId)` - founder's Store wallet for the active org; used to gate campaign creation.
- `fetchCampaignWallet(campaignId, { limit?, offset? })` - founder-only escrow snapshot plus paginated ledger.
- `fetchContentRewardsBalance(orgId?)` - with `orgId`, the balance in that org's `OrgRewardsWallet` (matches the org switcher); without, a legacy cross-org sum.
- `fetchContentRewardsBalancesPerOrg()` - same endpoint with `breakdown=1`, one row per org.
- `fetchContentRewardsTransactions({ limit?, offset?, type?, orgId? })` - ledger, per org when `orgId` is given, otherwise a legacy cross-org rollup.
- `transferContentRewards({ destination, amountCents, orgId?, note? })` - earner moves money from one org's Content Rewards bucket into their own Store or Affiliate wallet. `orgId` is the source bucket; the backend falls back to the session org if omitted. The amount is sent in cents.

### View refresh and link tools (L539-L606)
`refreshSubmissionViews(id)` re-fetches one submission's views (response may say `cached: true`); `refreshCampaignViews(campaignId)` refreshes all submissions of a campaign (founder). `fetchLinkPreview(url)` returns oEmbed-style metadata for a pasted URL; `verifyYouTubeOwnership(videoUrl)` checks whether a YouTube video's channel matches the user's connected channel.

## Exports
Functions: `fetchCampaigns`, `fetchActiveCampaigns`, `createCampaign`, `updateCampaign`, `deleteCampaign`, `fetchCampaignStats`, `joinCampaign`, `leaveCampaign`, `fetchSocialAccounts`, `connectSocialAccount`, `verifySocialAccount`, `removeSocialAccount`, `getOAuthUrl`, `disconnectOAuth`, `refreshOAuthToken`, `submitContent`, `fetchMySubmissions`, `fetchMyEarnings`, `fetchCampaignSubmissions`, `fetchLivePreviewViews`, `reviewSubmission`, `fetchStoreWalletBalance`, `fetchCampaignWallet`, `fetchContentRewardsBalance`, `fetchContentRewardsBalancesPerOrg`, `fetchContentRewardsTransactions`, `transferContentRewards`, `refreshSubmissionViews`, `refreshCampaignViews`, `fetchLinkPreview`, `verifyYouTubeOwnership` (all async, all return the parsed JSON described above).

Types: `Campaign`, `CampaignWalletInfo`, `CampaignWalletTransactionItem`, `ContentRewardsBalance`, `ContentRewardsOrgBalance`, `ContentRewardsTransactionItem`, `StoreWalletBalance`, `SocialAccount`, `Submission`, `EarningsSummary`, `CampaignStats`, `ContentRewardsTransferResult`.

## Interfaces
- **Backend endpoints called** (all require a logged-in user; "founder" means the route also applies `requireFounder`):
  - `GET /backend/content-campaigns?status=` (founder), `GET /backend/content-campaigns/active?orgId=`, `POST /backend/content-campaigns` (founder), `PATCH /backend/content-campaigns/:id` (founder), `DELETE /backend/content-campaigns/:id` (founder), `GET /backend/content-campaigns/:id/stats` (founder), `POST /backend/content-campaigns/:id/join`, `POST /backend/content-campaigns/:id/leave`, `GET /backend/content-campaigns/:id/wallet?limit&offset` (founder)
  - `GET /backend/social-accounts`, `POST /backend/social-accounts/connect`, `POST /backend/social-accounts/:id/verify`, `DELETE /backend/social-accounts/:id`
  - `GET /backend/social-oauth/:platform/authorize`, `POST /backend/social-oauth/:platform/disconnect`, `POST /backend/social-oauth/:platform/refresh`
  - `POST /backend/content-submissions`, `GET /backend/content-submissions?status&campaignId`, `GET /backend/content-submissions/earnings?campaignId`, `GET /backend/content-submissions/campaign/:campaignId?status` (founder), `GET /backend/content-submissions/:id/live-views` (founder), `PATCH /backend/content-submissions/:id/review` (founder), `POST /backend/content-submissions/:id/refresh-views`, `POST /backend/content-submissions/campaign/:campaignId/refresh-views` (founder)
  - `GET /backend/wallet/store/balance?orgId=`, `GET /backend/wallet/content-rewards/balance?orgId=` or `?breakdown=1`, `GET /backend/wallet/content-rewards/transactions?limit&offset&type&orgId`, `POST /backend/wallet/content-rewards/transfer`
  - `GET /backend/link-preview?url=` (user or garage-admin token), `GET /backend/link-preview/youtube-channel-check?videoUrl=`
- **Browser storage / cookies:** session token read from localStorage via `getToken()`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (base URL, JSON headers, error extraction); `lib/auth.ts` - `getToken()`.

## Used by
`components/dashboard/ContentRewardsAffiliatePage.tsx`, `components/dashboard/ContentRewardsPage.tsx`, `components/dashboard/WalletPageNew.tsx`.

## Notes
- Server routers: `server/routes/contentCampaign.ts`, `socialAccount.ts`, `socialOAuth.ts`, `contentSubmission.ts`, `wallet.ts`, `linkPreview.ts`, mounted in `server/app.ts` at `/content-campaigns`, `/social-accounts`, `/social-oauth`, `/content-submissions`, `/wallet` and `/link-preview`.
- Some query strings are interpolated without encoding (`status`, `orgId` in `fetchActiveCampaigns`, `campaignId`); the wallet and link-preview helpers do encode. Values are expected to be IDs or enum words.
- Backend routes not wrapped here include `GET /content-campaigns/:id`, `POST /content-campaigns/:id/wallet/transfer`, and the disabled `POST /social-accounts/:id/manual-verify` (always 403).
- Money flows touch real wallet balances (`transferContentRewards`, campaign creation and approval with payouts); treat these calls as financial operations.
