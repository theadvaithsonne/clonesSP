# `server/services/rankBonus/payout.ts`

> src/services/rankBonus/payout.ts

**Kind:** backend service · **Lines:** 239

<!-- docgen:auto -->

## Purpose
src/services/rankBonus/payout.ts

Pays the qualifications produced by qualify.ts.

ONE TRANSACTION PER RECIPIENT, never one for the whole run. With hundreds of
payees a single spanning transaction means one bad row rolls back everyone;
per-recipient means a failure pays the other N-1 and reports `failed: 1`.
This mirrors services/contentPayoutSweeper.ts.

Idempotency is two-layered, because a rank bonus has no natural "already paid"
delta the way a content payout does (earned − paidOut). A blind re-run WOULD
pay $40 twice. So:
  1. a cheap findOne on metadata.dedupeKey, to short-circuit without work
  2. the partial unique index on WalletTransaction.metadata.dedupeKey as the
     real backstop against a race — E11000 is treated as SUCCESS, not failure
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PayoutSummary` | interface |  | 28 |
| `payRunQualifications` | function | `async payRunQualifications(runId: Types.ObjectId, periodKey: string): Promise<PayoutSummary>` — Credit every pending qualification for a run. | 45 |
| `applyRanksToUsers` | function | `async applyRanksToUsers(runId: Types.ObjectId, periodKey: string): Promise<{ set: number; cleared: number }>` — Stamp each qualifier's rank onto their User doc, and clear it for everyone who held a rank last period but did not qualify this one. | 196 |

## Interfaces

- **Database (Mongoose models used):**
  - `RankQualification` (server/models/rankQualification.model.ts) — reads: `find`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — **writes:** `bulkWrite`, `updateMany`

## Dependencies

- **Internal:**
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/rankQualification.model.ts` — `RankQualification`, `rankBonusDedupeKey`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/rankBonus/run.ts`
