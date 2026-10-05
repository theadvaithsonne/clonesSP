# `server/services/teamforce/payroll/hraExemption.ts`

> HRA exemption — Section 10(13A).

**Kind:** backend service · **Lines:** 78

<!-- docgen:auto -->

## Purpose
HRA exemption — Section 10(13A). Old Regime only.
Per spec §4.1: take MIN of three conditions.

  c1 = actual HRA received (annual)
  c2 = actual rent paid (annual) − 10% × basic (annual)
  c3 = 50% × basic (annual) for METRO,  40% × basic (annual) otherwise

Guards:
  - exempt = 0 if employee owns a house in the same city
  - exempt = 0 if no rent declaration submitted
  - exempt = 0 if monthly rent > 8333 (annual > 1L) AND landlord PAN not provided
  - exempt = 0 if c2 is negative (rent < 10% of basic)

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HRAExemptionInput` | interface |  | 18 |
| `HRAExemptionResult` | interface |  | 28 |
| `computeHRAExemption` | function | `computeHRAExemption(input: HRAExemptionInput): HRAExemptionResult` | 44 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `CityType`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
