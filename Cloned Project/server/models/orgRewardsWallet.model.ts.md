# `server/models/orgRewardsWallet.model.ts`

> Mongoose model for Garage's per-(user, organization) Content Rewards wallet, with an embedded transaction ledger in USD cents.

**Kind:** Mongoose model · **Lines:** 97

## Purpose
Content Rewards (money a user earns from campaign payouts and similar) used to be held in the global `NcWallet`, a schema shared with the NetworkChains backend in the same MongoDB cluster (`wallets` collection). Garage needed the balance to be per organization, but adding `orgId` to `NcWallet`'s unique key would have broken NetworkChains. So Garage moved to its own collection; after the cutover Garage no longer reads or writes `wallets` for this purpose, while NetworkChains keeps using it.

## How it works
- **Unit:** every amount is USD **cents**, matching `NcWallet`, so the migration was 1:1.
- **Transaction sources (`ORG_REWARDS_TX_SOURCES`):** `campaign_payout`, `store_to_cr_send`, `self_transfer_to_store`, `withdrawal`, `admin_adjust`, `migration_seed`.
- **Embedded transaction** (`_id: false`): `type` (`credit` / `debit`), `amount` (cents, always positive, min 0), `balanceAfter` (cents), `source` (enum above), `description` (required), optional `relatedId` (payout, source transaction or withdrawal id for joins), `createdAt` (default now).
- **Wallet document:** `userId` (ref `User`) and `orgId` (ref `Organization`), both required and indexed; `balance`, `totalEarnings` (lifetime credits, denormalised for the dashboard) and `totalWithdrawn` (lifetime withdrawals), all cents, default 0, min 0; `transactions[]`; `timestamps: true`.
- **Indexes:** unique `{ userId: 1, orgId: 1 }` (exactly one wallet per user per org); `{ orgId: 1, balance: -1 }` for admin pages that list balances within an org.
- `min: 0` on `balance` means a debit that would overdraw fails validation on document saves (atomic `$inc` updates bypass validators unless run with `runValidators`, so services must guard balances themselves).

## Exports
- `ORG_REWARDS_TX_SOURCES` - readonly tuple of allowed transaction sources.
- `OrgRewardsTxSource` - union type of those sources.
- `IOrgRewardsWalletTransaction` - ledger entry interface.
- `IOrgRewardsWallet` - wallet document interface.
- `OrgRewardsWallet` - the Mongoose model.

## Interfaces
- **Database:** `OrgRewardsWallet` (collection `orgrewardswallets`). Related legacy collection: `wallets` (`NcWallet`, shared with NetworkChains).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/contentRewardsWallet.ts` - aggregates balances across a user's org wallets and reads a single org wallet.
- `server/services/campaignWallet.ts`, `server/services/wallet.ts`, `server/services/withdrawal.ts` - credits, store transfers and withdrawals.
- `server/controllers/garageAdmin.controller.ts` - admin views/adjustments.
- `server/scripts/migrate-content-rewards-to-org-rewards.ts` - one-off migration that seeded these wallets from `NcWallet` (source `migration_seed`); hand-run against `MONGODB_URI`, which is the production database.

## Notes
- The ledger is embedded, so a very active wallet's document grows without bound (MongoDB's 16 MB document limit applies).
- The model is registered without a `mongoose.models` guard.
