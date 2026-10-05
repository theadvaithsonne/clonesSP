# `server/models/ncWallet.model.ts`

> Mongoose mirror of NetworkChains' `wallets` collection, letting Garage credit and debit NC wallets directly inside its own Mongo transactions.

**Kind:** Mongoose model · **Lines:** 65

## Purpose
NetworkChains (NC) keeps a per-user cents-denominated wallet in the `wallets` collection. Garage and NC share the same MongoDB cluster, so Garage binds its own model (`NcWallet`) to that collection. It can then, for example, credit an affiliate's NC wallet atomically in the same transaction that debits a Garage `CampaignWallet`, with "no HTTP rail, no outbox". The header names NC's `src/models/wallet.model.ts` (in the network-chains backend) as the source of truth; fields and indexes must be kept in sync with it.

## How it works
- `NcWalletTransactionSchema` (no `_id`): `type` (`credit` | `debit`), `amount` (cents, always positive, min 0), `balanceAfter` (cents), `description` (required), `createdAt`.
- `NcWalletSchema` (bound with `collection: "wallets"`, timestamps on):
  - `userId` - ref `User`, required, **unique**, indexed. The `ref` exists only so `.populate("userId", ...)` works in Garage admin endpoints. Without it, rows come back with a bare ObjectId and lose the user's email and name. Refs are not written to Mongo, so this does not conflict with NC's schema.
  - `balance` (cents, default 0, min 0), `debt` (cents, default 0, min 0).
  - `transactions[]` - embedded ledger.
- The model name `"NcWallet"` is Garage-local and never exposed to NC.

## Exports
- `NcWallet` - the Mongoose model.
- `INcWallet`, `INcWalletTransaction` - interfaces.

## Interfaces
- **Database:** collection `wallets` (owned by NetworkChains) - **read and write**.
- **External services:** NetworkChains backend (shared Mongo cluster).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/campaignWallet.ts` - finds or creates the user's NC wallet inside a session, settles `debt`, then credits `balance`.
- `server/services/contentRewardsWallet.ts` - debits the NC wallet when moving content rewards.
- `server/services/wallet.ts`, `server/services/withdrawal.ts` - mirror credits and withdrawals onto the legacy NcWallet so NC stays in sync while balances move to Garage's per-org `OrgRewardsWallet`.
- `server/controllers/garageAdmin.controller.ts` - admin views (populates `userId`).
- `server/scripts/migrate-content-rewards-to-org-rewards.ts` - one-off migration (production database) that streams every NC wallet to compare balances.

## Notes
- Amounts are **cents** here, while many Garage wallets use dollars. Convert carefully.
- `balance` and `debt` have `min: 0` validators, but those only run on document saves (and on updates only when validators are enabled). Atomic `$inc` updates can still push a value negative unless the query guards it.
- Writes affect NC users' real money. Keep any schema change in lockstep with NC.
