# `server/services/teamforce/payroll/newRegimeTax.ts`

> New Regime tax — Section 115BAC / FY 2024-25 (default).

**Kind:** backend service · **Lines:** 113

<!-- docgen:auto -->

## Purpose
New Regime tax — Section 115BAC / FY 2024-25 (default).
Spec §9.

Slabs (no age differentiation):
  ≤ ₹3L            : Nil
  ₹3L–₹7L          : 5%
  ₹7L–₹10L         : 10%
  ₹10L–₹12L        : 15%
  ₹12L–₹15L        : 20%
  > ₹15L           : 30%

Sec 87A rebate (New Regime):
  IF net_taxable_income <= 7,00,000:
      rebate = MIN(tax_before_rebate, 25000)  // effective tax = 0 up to ₹7L

Marginal relief (just above ₹7L): […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `STD_DEDUCTION_NEW` | const | `= 75000` | 24 |
| `REBATE_NEW_THRESHOLD` | const | `= 700000` | 25 |
| `REBATE_NEW_CAP` | const | `= 25000` | 26 |
| `computeNewRegimeTaxBeforeRebate` | function | `computeNewRegimeTaxBeforeRebate(netTaxableIncome: number): number` | 37 |
| `applyRebate87ANew` | function | `applyRebate87ANew(taxBeforeRebate: number, netTaxableIncome: number): RebateApplication` | 55 |
| `MarginalReliefResult` | interface |  | 75 |
| `applyMarginalReliefNew` | function | `applyMarginalReliefNew(taxAfterRebate: number, netTaxableIncome: number): MarginalReliefResult` | 81 |
| `computeNewRegimeTax` | function | `computeNewRegimeTax(netTaxableIncome: number): { taxBeforeRebate: number; rebate: RebateApplicat…` | 100 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `RebateApplication`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
