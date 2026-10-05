# `server/services/teamforce/payroll/attendanceLoader.ts`

> Database loader for attendance aggregation.

**Kind:** backend service · **Lines:** 145

<!-- docgen:auto -->

## Purpose
Database loader for attendance aggregation. The pure aggregator in
`attendance.ts` deliberately takes pre-fetched data so it stays testable
— this module is the impure adapter that converts DB rows into the
aggregator's input shape.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LoadedAttendanceData` | interface |  | 15 |
| `loadAttendanceForRun` | function | `async loadAttendanceForRun(userId: string, orgId: string, payrollMonth: number, payrollYear: number, cutoffDay: number): Promise<LoadedAttendanceData>` — Loads everything the aggregator needs for one (employee, payroll month). | 33 |
| `persistDeferredLop` | function | `async persistDeferredLop(userId: string, orgId: string, newDeferredLopDays: number): Promise<void>` — Resets the carry-over slot on the profile after a payroll run consumes it, and writes the new deferred amount (0 for normal months, > 0 in grace months). | 132 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `TeamforceWeeklyOffPattern` (server/models/teamforce/teamforceWeeklyOffPattern.model.ts) — reads: `findOne`
  - `TeamforceLeaveRequest` (server/models/teamforce/teamforceLeaveRequest.model.ts) — reads: `find`
  - `TimeTracking` (server/models/timeTracking.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/timeTracking.model.ts` — `TimeTracking`
  - `server/models/teamforce/teamforceLeaveRequest.model.ts` — `TeamforceLeaveRequest`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/models/teamforce/teamforceWeeklyOffPattern.model.ts` — `TeamforceWeeklyOffPattern`
  - `server/services/teamforce/payroll/attendance.ts` — `getAttendanceWindow`, `ApprovedLeaveRow`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/payrollRuns.ts`
