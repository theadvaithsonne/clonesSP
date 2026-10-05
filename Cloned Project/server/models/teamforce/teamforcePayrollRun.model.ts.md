# `server/models/teamforce/teamforcePayrollRun.model.ts`

> Mongoose model `TeamforcePayrollRun` (collection `teamforcepayrollruns`) with 18 top-level fields.

**Kind:** Mongoose model · **Lines:** 84

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforcePayrollRun`

- **Collection:** `teamforcepayrollruns` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Types.ObjectId` | required, index, ref "Organization" |
| `fyMonth` | `Number` | required |
| `fyYear` | `Number` | required |
| `calendarMonth` | `Number` | required |
| `calendarYear` | `Number` | required |
| `runType` | `String` | default "FULL", enum PAYROLL_RUN_TYPES |
| `scope` | `ScopeSchema` | default null |
| `includedUserIds` | `[Types.ObjectId]` | ref "User" |
| `status` | `String` | index, default "DRAFT", enum PAYROLL_RUN_STATUSES |
| `windowStart` | `Date` | required |
| `windowEnd` | `Date` | required |
| `cutoffDayUsed` | `Number` | required |
| `totals` | `TotalsSchema` | default () => ({}) |
| `createdBy` | `Types.ObjectId` | ref "User" |
| `approvedBy` | `Types.ObjectId` | ref "User" |
| `approvedAt` | `Date` | default null |
| `paidAt` | `Date` | default null |
| `notes` | `String` | default "" |

### Indexes

- `{ orgId: 1, fyYear: 1, fyMonth: 1 }, { unique: true }` (L78)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PAYROLL_RUN_STATUSES` | const | `= ["DRAFT", "APPROVED", "PAID"] as const` | 3 |
| `PAYROLL_RUN_TYPES` | const | `= ["FULL", "PARTIAL"] as const` | 4 |
| `TeamforcePayrollRun` | model | `model( "TeamforcePayrollRun", TeamforcePayrollRunSchema )` | 80 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/teamforce/payrollRuns.ts`
