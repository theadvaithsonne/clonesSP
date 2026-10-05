# `server/services/campaignWallet.ts`

> src/services/campaignWallet.ts Service layer for the per-campaign escrow wallet.

**Kind:** backend service · **Lines:** 871

<!-- docgen:auto -->

## Purpose
src/services/campaignWallet.ts
Service layer for the per-campaign escrow wallet. Mirrors the patterns in
services/wallet.ts (single Mongo session, paired debit/credit transactions
linked via relatedTransactionId).

Three operations:
  1. lockBudgetForCampaign  — Store → Campaign  (on campaign creation)
  2. payoutFromCampaignToAffiliate — Campaign → NC Wallet  (per cron sweep tick)
  3. refundCampaignToFounder — Campaign → Store  (on campaign close)

Payout destination: the affiliate's NC `Wallet` (shared MongoDB collection
owned by network-chains-backend). Both backends sit on the same Mongo
cluster, so the campaign debit and the affiliate credit commit inside a
single Mongo transaction — no HTTP rail, no outbox, no reconciliation.

All amounts are passed in as CENTS (matching ContentCampaign / […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getCampaignWalletByCampaignId` | function | `async getCampaignWalletByCampaignId(campaignId: string): Promise<any>` | 39 |
| `getCampaignWalletTransactions` | function | `async getCampaignWalletTransactions(campaignId: string, options: { limit?: number; offset?: number } = {}): Promise<{ transactions: any[]; total: number }>` | 47 |
| `lockBudgetForCampaign` | function | `async lockBudgetForCampaign(params: { campaignId: string; founderId: string; orgId: str…): Promise<{ campaignWallet: any; storeTransaction: …` | 72 |
| `payoutFromCampaignToAffiliate` | function | `async payoutFromCampaignToAffiliate(params: { campaignId: string; submissionId: string; userId:…): Promise<{ campaignWallet: any; ncWallet: any; pay…` | 211 |
| `refundCampaignToFounder` | function | `async refundCampaignToFounder(params: { campaignId: string; description: string; session:…): Promise<{ campaignWallet: any; storeWallet: any; …` | 485 |
| `refundCampaignToFounderInOwnSession` | function | `async refundCampaignToFounderInOwnSession(campaignId: string, description: string)` | 630 |
| `transferCampaignToUserWallet` | function | `async transferCampaignToUserWallet(params: { campaignId: string; targetUserId: string; destina…): Promise<{ campaignWallet: any; destinationWallet:…` | 666 |

## Interfaces

- **Database (Mongoose models used):**
  - `CampaignWallet` (server/models/campaignWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `CampaignWalletTransaction` (server/models/campaignWalletTransaction.model.ts) — reads: `find`, `countDocuments`; **writes:** `create`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `ContentCampaign` (server/models/contentCampaign.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `NcWallet` (server/models/ncWallet.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `OrgRewardsWallet` (server/models/orgRewardsWallet.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `ContentPayout` (server/models/contentPayout.model.ts) — **writes:** `create`
  - `ContentSubmission` (server/models/contentSubmission.model.ts) — **writes:** `updateOne`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/campaignWallet.model.ts` — `CampaignWallet`
  - `server/models/campaignWalletTransaction.model.ts` — `CampaignWalletTransaction`
  - `server/models/contentPayout.model.ts` — `ContentPayout`
  - `server/models/contentSubmission.model.ts` — `ContentSubmission`
  - `server/models/contentCampaign.model.ts` — `ContentCampaign`
  - `server/models/ncWallet.model.ts` — `NcWallet`
  - `server/models/orgRewardsWallet.model.ts` — `OrgRewardsWallet`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
- **Packages:**
  - `mongoose` — `ClientSession`, `Types`

## Used by

- `server/routes/contentCampaign.ts`
- `server/services/contentPayoutSweeper.ts`
