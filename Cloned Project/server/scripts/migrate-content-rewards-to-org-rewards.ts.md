# `server/scripts/migrate-content-rewards-to-org-rewards.ts`

> Migration: NcWallet (global per-user Content Rewards) → OrgRewardsWallet (per-(user,org)).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 361

<!-- docgen:auto -->

## Purpose
Migration: NcWallet (global per-user Content Rewards) → OrgRewardsWallet (per-(user,org)).

For each user with content-rewards activity, reconstruct per-org balances
by walking historical ledgers, then seed OrgRewardsWallet rows. NcWallet
is left untouched (NetworkChains still uses it for its own purposes;
Garage just stops reading it).

Reconstruction (cents, signed sum per org):
  +  CampaignWalletTransaction (relatedUserId = user, type = "debit",
     status = "completed")  →  attributed to that row's orgId.
  +  WalletTransaction (userId = user, walletType = "content_rewards",
     type = "credit")  →  attributed to the row's orgId when present;
     otherwise to the SENDER's orgId in metadata; otherwise FIFO across
     the per-org earnings buckets accumulated so far.
  −  WalletTransaction (userId = user, walletType = "content_rewards",
     type ∈ {"transfer","debit","withdrawal"})  →  same orgId attribution, […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `CampaignWalletTransaction` (server/models/campaignWalletTransaction.model.ts) — reads: `find`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
  - `OrgRewardsWallet` (server/models/orgRewardsWallet.model.ts) — reads: `exists`; **writes:** `findOneAndUpdate`
  - `NcWallet` (server/models/ncWallet.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/ncWallet.model.ts` — `NcWallet`
  - `server/models/orgRewardsWallet.model.ts` — `OrgRewardsWallet`
  - `server/models/campaignWalletTransaction.model.ts` — `CampaignWalletTransaction`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-content-rewards-to-org-rewards.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `OrgRewardsWallet` (findOneAndUpdate).
- Command-line flags referenced: `--apply`, `--verbose`.
