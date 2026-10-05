# `server/services/founderSubMonthlyBonus/payout.ts`

> Payout step for the monthly founder Pro-sub volume bonus.

**Kind:** backend service · **Lines:** 176

<!-- docgen:auto -->

## Purpose
Payout step for the monthly founder Pro-sub volume bonus.

Mirrors whitelabelMonthlyBonus/payout.ts:
  • ONE mongoose transaction per recipient — one bad row doesn't
    roll back the other N-1.
  • Idempotency two-layered: cheap findOne on dedupeKey + partial
    unique index on WalletTransaction.metadata.dedupeKey (E11000 =
    already paid).
  • Amounts in DOLLARS (float).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PayoutSummary` | interface |  | 19 |
| `payRunPayouts` | function | `async payRunPayouts(runId: Types.ObjectId, periodKey: string): Promise<PayoutSummary>` | 29 |

## Interfaces

- **Database (Mongoose models used):**
  - `FounderSubBonusPayout` (server/models/founderSubBonusPayout.model.ts) — reads: `find`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/founderSubBonusPayout.model.ts` — `FounderSubBonusPayout`, `founderSubMonthlyBonusDedupeKey`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/founderSubMonthlyBonus/run.ts`
