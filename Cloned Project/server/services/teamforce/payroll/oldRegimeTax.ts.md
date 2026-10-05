# `server/services/teamforce/payroll/oldRegimeTax.ts`

> Old Regime tax — Section 192 / FY 2024-25.

**Kind:** backend service · **Lines:** 99

<!-- docgen:auto -->

## Purpose
Old Regime tax — Section 192 / FY 2024-25.
Spec §8.

Age-tiered slabs:
  < 60:  Nil up to ₹2.5L; 5% to ₹5L; 20% to ₹10L; 30% above
  60-79: Nil up to ₹3L;   5% to ₹5L; 20% to ₹10L; 30% above
  80+:   Nil up to ₹5L;                20% to ₹10L; 30% above

Sec 87A rebate (Old Regime):
  IF net_taxable_income <= 5,00,000:
      rebate = MIN(tax_before_rebate, 12500)
      tax_after_rebate = tax_before_rebate - rebate

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `STD_DEDUCTION_OLD` | const | `= 50000` | 18 |
| `REBATE_OLD_THRESHOLD` | const | `= 500000` | 19 |
| `REBATE_OLD_CAP` | const | `= 12500` | 20 |
| `computeOldRegimeTaxBeforeRebate` | function | `computeOldRegimeTaxBeforeRebate(netTaxableIncome: number, age: number): number` | 51 |
| `applyRebate87AOld` | function | `applyRebate87AOld(taxBeforeRebate: number, netTaxableIncome: number): RebateApplication` | 71 |
| `computeOldRegimeTax` | function | `computeOldRegimeTax(netTaxableIncome: number, age: number): { taxBeforeRebate: number; rebate: RebateApplicat…` | 91 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `RebateApplication`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
