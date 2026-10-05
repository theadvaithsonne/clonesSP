# `server/services/teamforce/payroll/ptComputation.ts`

> Professional Tax — state-level monthly deduction.

**Kind:** backend service · **Lines:** 58

<!-- docgen:auto -->

## Purpose
Professional Tax — state-level monthly deduction. Applies to BOTH regimes.
Spec §7.

- Slabs are matched against the current month's gross salary.
- When a slab carries `monthOverride`, it applies only in that calendar
  month (e.g. Maharashtra Feb = ₹300 for gross > ₹10,000).
- Annual PT cannot exceed ₹2,500 — once YTD reaches the cap, deduct ₹0.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ANNUAL_PT_CAP` | const | `= 2500` | 13 |
| `PTInput` | interface |  | 15 |
| `PTResult` | interface |  | 23 |
| `computeProfessionalTax` | function | `computeProfessionalTax(input: PTInput): PTResult` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `PTSlab`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
