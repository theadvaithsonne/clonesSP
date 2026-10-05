# `server/services/teamforce/payroll/section192Tds.ts`

> Section 192 — Monthly TDS computation pipeline.

**Kind:** backend service · **Lines:** 317

<!-- docgen:auto -->

## Purpose
Section 192 — Monthly TDS computation pipeline.
Spec §11. Wires together every other module in this folder:

  YTD actuals + projected gross
    → exemptions (HRA, LTA, Children) — Old Regime only
    → standard deduction (regime-specific)
    → Chapter VI-A (Old Regime + 80CCD(2) for both)
    → Professional Tax (annualised)
    → net taxable income
    → income tax (regime-specific) + 87A rebate
    → marginal relief (New Regime ₹7L boundary)
    → surcharge (with marginal relief at 50L/1Cr/2Cr/5Cr)
    → cess (4%)
    → annual_tax_liability − ytd_tds_deducted, divided over remaining months

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Section192Input` | interface |  | 41 |
| `Section192Result` | interface |  | 102 |
| `computeSection192TDS` | function | `computeSection192TDS(input: Section192Input): Section192Result` | 144 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `CityType`, `PTSlab`, `Regime`, `(types only)`
  - `server/services/teamforce/payroll/hraExemption.ts` — `computeHRAExemption`
  - `server/services/teamforce/payroll/ltaExemption.ts` — `computeLTAExemption`
  - `server/services/teamforce/payroll/childrenAllowanceExemption.ts` — `computeChildrenAllowanceExemption`
  - `server/services/teamforce/payroll/ptComputation.ts` — `computeProfessionalTax`
  - `server/services/teamforce/payroll/oldRegimeTax.ts` — `computeOldRegimeTax`, `STD_DEDUCTION_OLD`, `computeOldRegimeTaxBeforeRebate`, `applyRebate87AOld`
  - `server/services/teamforce/payroll/newRegimeTax.ts` — `computeNewRegimeTax`, `STD_DEDUCTION_NEW`, `computeNewRegimeTaxBeforeRebate`, `applyRebate87ANew`, `applyMarginalReliefNew`
  - `server/services/teamforce/payroll/surcharge.ts` — `computeSurcharge`
  - `server/services/teamforce/payroll/cess.ts` — `computeCess`
  - `server/services/teamforce/payroll/chapterVIA.ts` — `computeChapterVIA`, `ChapterVIAInput`
  - `server/services/teamforce/payroll/fyHelpers.ts` — `getRemainingMonthsInFY`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
