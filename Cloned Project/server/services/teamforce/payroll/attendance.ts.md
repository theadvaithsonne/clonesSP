# `server/services/teamforce/payroll/attendance.ts`

> Attendance aggregation — feeds the payroll engine.

**Kind:** backend service · **Lines:** 328

<!-- docgen:auto -->

## Purpose
Attendance aggregation — feeds the payroll engine. Spec §3.1–§3.3.

Exports:
  - getAttendanceWindow(payMonth, payYear, cutoffDay): { start, end }
  - aggregateForEmployee(input): full per-employee breakdown for the run

Both functions are PURE — no DB calls. The Phase 5 PayrollRun pipeline
fetches the raw attendance data and passes it in.

LOP rule (Phase 4): a "loss of pay" day is any calendar day in the
attendance window where the employee:
  - is NOT on an Approved leave request, AND
  - has NO TimeTracking clock-in for that calendar day, AND
  - is NOT on a scheduled weekly-off
Half-day approved leaves count as 0.5 paid leave + 0.5 LOP-eligible (so the
other half day still counts as present iff there's a clock-in). […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ApprovedLeaveRow` | interface |  | 28 |
| `AttendanceWindow` | interface |  | 34 |
| `getAttendanceWindow` | function | `getAttendanceWindow(payMonth: number, payYear: number, cutoffDay: number): AttendanceWindow` — Returns the attendance window for a given pay month + cutoff day. | 42 |
| `AttendanceAggregateInput` | interface |  | 71 |
| `AttendanceAggregateResult` | interface |  | 87 |
| `aggregateForEmployee` | function | `aggregateForEmployee(input: AttendanceAggregateInput): AttendanceAggregateResult` | 168 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/fyHelpers.ts` — `calendarDaysInMonth`
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/attendanceLoader.ts`
- `server/services/teamforce/payroll/index.ts`
