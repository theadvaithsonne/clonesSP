# `server/services/teamforce/payroll/surcharge.ts`

> Surcharge — applies on top of income-tax.

**Kind:** backend service · **Lines:** 89

<!-- docgen:auto -->

## Purpose
Surcharge — applies on top of income-tax. Spec §10.

Slabs (both regimes by income):
  ≤ ₹50L            : 0%
  ₹50L - ₹1Cr       : 10%
  ₹1Cr - ₹2Cr       : 15%
  ₹2Cr - ₹5Cr       : 25%
  > ₹5Cr            : Old → 37%, New → 25%

Marginal relief applies at every slab boundary so that the additional
tax due to crossing into a higher surcharge bracket cannot exceed the
incremental income beyond the threshold.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `computeSurcharge` | function | `computeSurcharge(taxAfterRebate: number, netTaxableIncome: number, regime: Regime, taxAtPrevThresholdComputer: (incomeAtThreshold: number) => …): SurchargeResult` | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `Regime`, `SurchargeResult`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
