# `server/services/teamforce/payroll/types.ts`

> Shared types for the Teamforce payroll tax engine.

**Kind:** backend service · **Lines:** 38

<!-- docgen:auto -->

## Purpose
Shared types for the Teamforce payroll tax engine.
All amounts are in INR. All "annual" figures are full-FY, not prorated.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Regime` | type | Shared types for the Teamforce payroll tax engine. | 6 |
| `CityType` | type |  | 7 |
| `PFOption` | type |  | 8 |
| `PTSlab` | interface | PT slab as stored in the DB. | 12 |
| `ESIPeriod` | type | ESI contribution period covers Apr–Sep or Oct–Mar. | 22 |
| `RebateApplication` | interface | Sec 87A rebate handles for clarity in audit logs / breakdown. | 25 |
| `SurchargeResult` | interface | Surcharge with optional marginal-relief adjustment. | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/esiComputation.ts`
- `server/services/teamforce/payroll/hraExemption.ts`
- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/newRegimeTax.ts`
- `server/services/teamforce/payroll/oldRegimeTax.ts`
- `server/services/teamforce/payroll/pfComputation.ts`
- `server/services/teamforce/payroll/ptComputation.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
- `server/services/teamforce/payroll/surcharge.ts`
