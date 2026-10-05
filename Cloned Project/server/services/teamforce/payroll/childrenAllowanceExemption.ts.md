# `server/services/teamforce/payroll/childrenAllowanceExemption.ts`

> Children Education & Hostel Allowance exemption — Section 10(14).

**Kind:** backend service · **Lines:** 42

<!-- docgen:auto -->

## Purpose
Children Education & Hostel Allowance exemption — Section 10(14).
Old Regime only.

Spec §4.3:
  education_allowance_exempt = MIN(actual_paid, 100 × num_eligible × 12)
  hostel_allowance_exempt    = MIN(actual_paid, 300 × num_eligible × 12)
  num_eligible               = MIN(num_children, 2)

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChildrenAllowanceInput` | interface | Children Education & Hostel Allowance exemption — Section 10(14). | 11 |
| `ChildrenAllowanceResult` | interface |  | 17 |
| `computeChildrenAllowanceExemption` | function | `computeChildrenAllowanceExemption(input: ChildrenAllowanceInput): ChildrenAllowanceResult` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
