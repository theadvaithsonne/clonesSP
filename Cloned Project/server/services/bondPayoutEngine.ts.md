# `server/services/bondPayoutEngine.ts`

> The HiFi bond payout + redemption engine.

**Kind:** backend service · **Lines:** 565

<!-- docgen:auto -->

## Purpose
The HiFi bond payout + redemption engine.

---------------------------------------------------------------
Why this is written the way it is
---------------------------------------------------------------
This backend has NO cron library and NO leader election — every job
is a plain `setInterval` registered in src/index.ts. In a
multi-instance deploy the same tick runs concurrently on every
instance. Correctness therefore does NOT come from scheduling; it
comes from:

  1. Every payout event row existing BEFORE any money moves, created
     at purchase time with a unique `dedupeKey` (spec §8).
  2. A conditional claim (`findOneAndUpdate` on status "scheduled")
     so exactly one worker can take an event.
  3. Each event settling inside its own transaction, so one failure […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BOND_PAYOUT_MAX_ATTEMPTS` | const | `= 5` — Spec §8 wants "a defined number of attempts", not open-ended retry. | 40 |
| `TickResult` | interface |  | 52 |
| `redeemHolding` | function | `async redeemHolding(holdingId: string, opts: { auto: boolean }): Promise<{ ok: boolean; reason?: string; amountAto…` — Return principal and close the holding. | 388 |
| `runBondPayoutTick` | function | `async runBondPayoutTick(opts: { batchSize?: number } = {}): Promise<TickResult>` — One scheduler pass. Safe to run concurrently on several instances: each event is claimed with a conditional update before any money is touched. | 503 |

## Interfaces

- **Database (Mongoose models used):**
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `BondPayoutEvent` (server/models/bondPayoutEvent.model.ts) — reads: `findOne`, `countDocuments`, `find`; **writes:** `updateOne`, `findOneAndUpdate`
  - `BondInstrument` (server/models/bondInstrument.model.ts) — reads: `findById`
  - `BondHolding` (server/models/bondHolding.model.ts) — reads: `findById`, `find`; **writes:** `updateOne`, `findOneAndUpdate`
  - `BondLedgerEntry` (server/models/bondLedgerEntry.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/bondHolding.model.ts` — `BondHolding`
  - `server/models/bondPayoutEvent.model.ts` — `BondPayoutEvent`
  - `server/models/bondInstrument.model.ts` — `BondInstrument`
  - `server/models/bondLedgerEntry.model.ts` — `BondLedgerEntry`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/config/bondMoney.ts` — `BondCurrency`, `toWalletAmount`, `fromAtomic`
  - `server/services/hifiInvoiceFulfillment.ts` — `findOrgFounderId`
- **Packages:**
  - `mongoose`

## Used by

- `server/index.ts`
- `server/routes/bond.ts`
