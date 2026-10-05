# `server/services/contentRewardsWallet.ts`

> src/services/contentRewardsWallet.ts Read-only accessors for the founder/affiliate Content Rewards dashboard in the Garage Payment Vault.

**Kind:** backend service · **Lines:** 423

<!-- docgen:auto -->

## Purpose
src/services/contentRewardsWallet.ts
Read-only accessors for the founder/affiliate Content Rewards dashboard
in the Garage Payment Vault.

HISTORY: Originally backed by `ContentRewardsWallet` + `ContentRewardsWalletTransaction`.
After Option B (shared-DB direct write — see services/campaignWallet.ts),
payouts no longer touch those collections. Earnings now land in the shared
`wallets` collection (NC's Wallet model, exposed on Garage as NcWallet) and
are audited in `CampaignWalletTransaction` rows with `relatedUserId = the affiliate`.

These functions read from the new sources but keep the legacy response
shape so the existing /wallet/content-rewards/* routes + WalletPageNew
frontend don't need to change.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getOrCreateContentRewardsWallet` | function | `async getOrCreateContentRewardsWallet(_userId: string, _session?: any): Promise<{ userId: string; balance: number; curren…` — Legacy lazy-create helper. | 31 |
| `getContentRewardsWalletBalance` | function | `async getContentRewardsWalletBalance(userId: string): Promise<{ balance: number; totalEarnings: number;…` — Read-only balance for the Payment Vault dashboard. | 51 |
| `getContentRewardsBalanceForOrg` | function | `async getContentRewardsBalanceForOrg(userId: string, orgId: string): Promise<{ orgId: string; balance: number; totalEa…` — Per-org balance for one (user, org). | 88 |
| `listContentRewardsBalancesForUser` | function | `async listContentRewardsBalancesForUser(userId: string): Promise< Array<{ orgId: string; orgName: string; …` — Per-org breakdown for one user — one row per org with any content rewards activity. | 118 |
| `getContentRewardsWalletTransactions` | function | `async getContentRewardsWalletTransactions(userId: string, options: { limit?: number; offset?: number; type?: string; …): Promise<{ transactions: any[]; total: number }>` — Paginated content-rewards transactions for the user. | 166 |
| `transferEarningsToUserWallet` | function | `async transferEarningsToUserWallet(params: { userId: string; orgId: string; // doubles as the …): Promise<{ ncWallet: any; destinationWallet: any; …` | 241 |

## Interfaces

- **Database (Mongoose models used):**
  - `OrgRewardsWallet` (server/models/orgRewardsWallet.model.ts) — reads: `aggregate`, `findOne`, `find`; **writes:** `updateOne`
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `NcWallet` (server/models/ncWallet.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/ncWallet.model.ts` — `NcWallet`
  - `server/models/orgRewardsWallet.model.ts` — `OrgRewardsWallet`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
- **Packages:**
  - `mongoose` — `ClientSession`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/wallet.ts`
