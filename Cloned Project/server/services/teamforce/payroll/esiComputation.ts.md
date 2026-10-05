# `server/services/teamforce/payroll/esiComputation.ts`

> Employees' State Insurance (ESI) — Section 192 statutory.

**Kind:** backend service · **Lines:** 151

<!-- docgen:auto -->

## Purpose
Employees' State Insurance (ESI) — Section 192 statutory.
Spec §13.4:
  - Threshold: gross ≤ ₹21,000 → covered.
  - Two periods: April–September (P1) and October–March (P2).
  - Once covered at the start of a period, ESI continues for the WHOLE
    period regardless of mid-period salary increase.
  - Inverse: not covered at start → no ESI even if salary dips below ₹21k.
  - Rates: 0.75% employee, 3.25% employer (on full gross).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ESI_THRESHOLD` | const | `= 21000` | 14 |
| `ESI_EMPLOYEE_RATE` | const | `= 0.0075` | 15 |
| `ESI_EMPLOYER_RATE` | const | `= 0.0325` | 16 |
| `getESIPeriod` | function | `getESIPeriod(calendarMonth: number): ESIPeriod` | 18 |
| `ESIInput` | interface |  | 22 |
| `ESIResult` | interface |  | 30 |
| `computeESI` | function | `computeESI(input: ESIInput): ESIResult` | 36 |
| `isESIEligibleAtPeriodStart` | function | `isESIEligibleAtPeriodStart(periodStartMonthlyGross: number): boolean` — Convenience: decide initial ESI coverage for a fresh contribution period. | 48 |
| `PriorMonthEsi` | interface |  | 64 |
| `DetermineEsiCoverageInput` | interface |  | 72 |
| `DetermineEsiCoverageResult` | interface |  | 88 |
| `determineEsiCoverage` | function | `determineEsiCoverage(input: DetermineEsiCoverageInput): DetermineEsiCoverageResult` | 106 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/types.ts` — `ESIPeriod`, `(types only)`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
