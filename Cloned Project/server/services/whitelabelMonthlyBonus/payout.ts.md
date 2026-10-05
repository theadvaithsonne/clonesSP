# `server/services/whitelabelMonthlyBonus/payout.ts`

> Payout step for the monthly whitelabel volume bonus.

**Kind:** backend service · **Lines:** 175

<!-- docgen:auto -->

## Purpose
Payout step for the monthly whitelabel volume bonus.

Mirrors rankBonus/payout.ts:
  • ONE mongoose transaction per recipient — one bad row doesn't
    roll back the other N-1.
  • Idempotency is two-layered: cheap findOne on the dedupeKey
    (short-circuits an ordinary re-run) + the partial unique index
    on WalletTransaction.metadata.dedupeKey as a race backstop
    (E11000 → treat as SUCCESS).
  • Amounts are DOLLARS (float). `unit: "whole"` in metadata so the
    commission-earned push notifier formats "$1,500.00" not "$15.00".

Runs in-process; the caller (run.ts) has already acquired the
cronLease and switched the run.status to "paying".

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PayoutSummary` | interface |  | 24 |
| `payRunPayouts` | function | `async payRunPayouts(runId: Types.ObjectId, periodKey: string): Promise<PayoutSummary>` | 34 |

## Interfaces

- **Database (Mongoose models used):**
  - `WhitelabelBonusPayout` (server/models/whitelabelBonusPayout.model.ts) — reads: `find`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/whitelabelBonusPayout.model.ts` — `WhitelabelBonusPayout`, `whitelabelMonthlyBonusDedupeKey`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/whitelabelMonthlyBonus/run.ts`
