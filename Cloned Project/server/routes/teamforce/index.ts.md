# `server/routes/teamforce/index.ts`

> Express router with 0 endpoints, mounted at `/teamforce`.

**Kind:** Express router · **Lines:** 37 · **Mounted at:** `/teamforce` (browser: `/backend/teamforce`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (0)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| USE | `/branches` | `/backend/teamforce/branches` | — | `branchesRouter` | 20 |
| USE | `/departments` | `/backend/teamforce/departments` | — | `departmentsRouter` | 21 |
| USE | `/shifts` | `/backend/teamforce/shifts` | — | `shiftsRouter` | 22 |
| USE | `/weekly-off-patterns` | `/backend/teamforce/weekly-off-patterns` | — | `weeklyOffPatternsRouter` | 23 |
| USE | `/employees` | `/backend/teamforce/employees` | — | `employeesRouter` | 24 |
| USE | `/leave-requests` | `/backend/teamforce/leave-requests` | — | `leaveRequestsRouter` | 25 |
| USE | `/leave-policies` | `/backend/teamforce/leave-policies` | — | `leavePoliciesRouter` | 26 |
| USE | `/break-settings` | `/backend/teamforce/break-settings` | — | `breakSettingsRouter` | 27 |
| USE | `/salary-structures` | `/backend/teamforce/salary-structures` | — | `salaryStructuresRouter` | 28 |
| USE | `/payroll-config` | `/backend/teamforce/payroll-config` | — | `payrollConfigRouter` | 29 |
| USE | `/pt-slabs` | `/backend/teamforce/pt-slabs` | — | `ptSlabsRouter` | 30 |
| USE | `/tax-declaration` | `/backend/teamforce/tax-declaration` | — | `taxDeclarationRouter` | 31 |
| USE | `/payroll-runs` | `/backend/teamforce/payroll-runs` | — | `payrollRunsRouter` | 32 |
| USE | `/recruitment-requests` | `/backend/teamforce/recruitment-requests` | — | `recruitmentRequestsRouter` | 33 |
| USE | `/candidates` | `/backend/teamforce/candidates` | — | `candidatesRouter` | 34 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 36 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/routes/teamforce/branches.ts` — `branchesRouter (default)`
  - `server/routes/teamforce/departments.ts` — `departmentsRouter (default)`
  - `server/routes/teamforce/shifts.ts` — `shiftsRouter (default)`
  - `server/routes/teamforce/weeklyOffPatterns.ts` — `weeklyOffPatternsRouter (default)`
  - `server/routes/teamforce/employees.ts` — `employeesRouter (default)`
  - `server/routes/teamforce/leaveRequests.ts` — `leaveRequestsRouter (default)`
  - `server/routes/teamforce/leavePolicies.ts` — `leavePoliciesRouter (default)`
  - `server/routes/teamforce/breakSettings.ts` — `breakSettingsRouter (default)`
  - `server/routes/teamforce/salaryStructures.ts` — `salaryStructuresRouter (default)`
  - `server/routes/teamforce/payrollConfig.ts` — `payrollConfigRouter (default)`
  - `server/routes/teamforce/ptSlabs.ts` — `ptSlabsRouter (default)`
  - `server/routes/teamforce/taxDeclaration.ts` — `taxDeclarationRouter (default)`
  - `server/routes/teamforce/payrollRuns.ts` — `payrollRunsRouter (default)`
  - `server/routes/teamforce/recruitmentRequests.ts` — `recruitmentRequestsRouter (default)`
  - `server/routes/teamforce/candidates.ts` — `candidatesRouter (default)`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/teamforce`.
