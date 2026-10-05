# `server/services/teamforce/payroll/structureResolver.ts`

> Salary structure resolver — converts a TeamforceSalaryStructure (with percentage / flat components) into actual rupee amounts for ONE month, given the employee's monthly CTC anchor.

**Kind:** backend service · **Lines:** 248

<!-- docgen:auto -->

## Purpose
Salary structure resolver — converts a TeamforceSalaryStructure (with
percentage / flat components) into actual rupee amounts for ONE month,
given the employee's monthly CTC anchor.

Resolution order (handles forward dependencies between calc types):
  1. flat              → uses `value` directly
  2. percentCTC        → `value` % of monthlyCtc
  3. compute basic + DA from results so far
  4. percentBasic      → `value` % of basic
  5. percentBasicPlusDA → `value` % of (basic + DA)
  6. compute gross from earnings so far
  7. percentGross      → `value` % of gross  (typically only for ESI)

Pure function, no DB.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CalcType` | type | Salary structure resolver — converts a TeamforceSalaryStructure (with percentage / flat components) into actual rupee amounts for ONE month, given the employee's monthly CTC anchor. | 18 |
| `ComponentCode` | type |  | 25 |
| `TaxabilityType` | type |  | 27 |
| `RawComponent` | interface |  | 36 |
| `RawStructure` | interface |  | 44 |
| `ResolvedComponent` | interface |  | 49 |
| `ResolvedStructure` | interface |  | 53 |
| `ResolveInput` | interface |  | 117 |
| `resolveStructure` | function | `resolveStructure(input: ResolveInput): ResolvedStructure` | 122 |
| `prorateResolved` | function | `prorateResolved(resolved: ResolvedStructure, attendanceFactor: number): ResolvedStructure` — Apply attendance proration to every monthly amount. | 210 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
