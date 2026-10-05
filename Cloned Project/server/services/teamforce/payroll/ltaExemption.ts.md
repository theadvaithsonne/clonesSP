# `server/services/teamforce/payroll/ltaExemption.ts`

> LTA exemption — Section 10(5).

**Kind:** backend service · **Lines:** 34

<!-- docgen:auto -->

## Purpose
LTA exemption — Section 10(5). Old Regime only.
Per spec §4.2:
  exempt_per_journey = MIN(actual_fare_claimed, LTA_component_annual / 2)

Block check (2022–25 current block, 2 journeys allowed) is the caller's
concern — this function trusts the caller to pass the in-block claim amount.
The function caps a single journey claim at half the annual LTA component.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LTAExemptionInput` | interface | LTA exemption — Section 10(5). | 11 |
| `LTAExemptionResult` | interface |  | 16 |
| `computeLTAExemption` | function | `computeLTAExemption(input: LTAExemptionInput): LTAExemptionResult` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
