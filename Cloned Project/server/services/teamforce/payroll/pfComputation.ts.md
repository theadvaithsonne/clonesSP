# `server/services/teamforce/payroll/pfComputation.ts`

> Provident Fund — Section 192 statutory.

**Kind:** backend service · **Lines:** 65

<!-- docgen:auto -->

## Purpose
Provident Fund — Section 192 statutory.
Spec §13.5:

  pf_basis = basic + DA

  IF pf_basis <= 15000:
      employee_pf  = 12% × pf_basis
      employer_epf = 3.67% × pf_basis  (goes to EPF)
      employer_eps = 8.33% × pf_basis  (goes to EPS — pension; capped at ₹15k basis)
  ELSE:
      IF employee.pf_option = CEILING:
          employee_pf = 12% × 15000 = 1800
      ELSE (ACTUAL):
          employee_pf = 12% × pf_basis
      employer_epf = 3.67% × 15000
      employer_eps = 8.33% × 15000  (= ₹1,250) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PF_BASIS_CEILING` | const | `= 15000` | 23 |
| `PFInput` | interface |  | 25 |
| `PFResult` | interface |  | 31 |
| `computePF` | function | `computePF(input: PFInput): PFResult` | 39 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `PFOption`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
