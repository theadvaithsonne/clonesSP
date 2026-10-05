# `server/services/bondCommission.ts`

> Commission for HiFi bonds.

**Kind:** backend service · **Lines:** 320

<!-- docgen:auto -->

## Purpose
Commission for HiFi bonds.

The bond engine never decides WHO gets paid — spec §6: "The bond
engine does not know how commission is split. It computes a pool
amount and calls the comp-plan service." This module is that call.

---------------------------------------------------------------
Why the pool is converted to USD first
---------------------------------------------------------------
A bond may be denominated in INR/USD/ETH/BTC/USDT (decision D4), but
commission distribution across this platform is USD-only and rather
firmly so:

  • `distributeCommissions` calls `convertToUsd`, which supports ONLY
    USD and INR and throws on anything else.
  • `distributeUnilevelPlusCommission` accepts a `currency` argument, […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PoolQuote` | interface |  | 36 |
| `quoteBondCommissionUsd` | function | `async quoteBondCommissionUsd(poolAtomic: string, currency: BondCurrency): Promise<PoolQuote>` — Convert a commission pool to USD. | 45 |
| `DistributeBondCommissionInput` | interface |  | 58 |
| `DeferredUpPayout` | interface |  | 76 |
| `DistributeBondCommissionResult` | interface |  | 84 |
| `distributeBondCommission` | function | `async distributeBondCommission(input: DistributeBondCommissionInput): Promise<DistributeBondCommissionResult>` — Split a bond commission pool through the founder's chosen comp plan. | 112 |
| `runDeferredUpPayout` | function | `async runDeferredUpPayout(d: DeferredUpPayout): Promise<{ recipients: number; unspentUsd: number …` — Run a deferred Unilevel Plus payout. | 299 |

## Interfaces

- **Database (Mongoose models used):**
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findById`
  - `BondLedgerEntry` (server/models/bondLedgerEntry.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/config/bondMoney.ts` — `BondCurrency`, `fromAtomic`
  - `server/models/bondLedgerEntry.model.ts` — `BondLedgerEntry`
  - `server/models/combPlan.model.ts` — `CombPlan`
- **Packages:**
  - `mongoose`

## Used by

- `server/services/bondInvoiceFulfillment.ts`
- `server/services/bondPayoutEngine.ts`
