# `server/services/teamforce/payroll/fyHelpers.ts`

> Indian Financial Year helpers.

**Kind:** backend service · **Lines:** 45

<!-- docgen:auto -->

## Purpose
Indian Financial Year helpers. FY runs April 1 → March 31.
Calendar month 4 (April) is FY month 1; calendar month 3 (March) is FY month 12.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getFYString` | function | `getFYString(calendarMonth: number, calendarYear: number): string` — Returns "2024-25" for April 2024 → March 2025. | 7 |
| `getFYMonth` | function | `getFYMonth(calendarMonth: number): number` — April → 1, May → 2, …, March → 12. | 14 |
| `getRemainingMonthsInFY` | function | `getRemainingMonthsInFY(calendarMonth: number): number` | 18 |
| `calendarDaysInMonth` | function | `calendarDaysInMonth(month: number, year: number): number` — Calendar days in a given month of a given year (handles leap Feb). | 23 |
| `isFebruary` | function | `isFebruary(calendarMonth: number): boolean` — True iff the current pay-month is February. | 28 |
| `ageOnDate` | function | `ageOnDate(dateOfBirth: Date \| null \| undefined, asOf: Date = new Date()): number` — Whole-year age as of a given reference date (defaults to today). | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/attendance.ts`
- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
