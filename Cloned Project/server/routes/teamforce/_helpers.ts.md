# `server/routes/teamforce/_helpers.ts`

> Module exporting `getAuthUser`, `getOrgIdStrict`, `isFounder`, `hasFullAccess` and 5 more.

**Kind:** Express router · **Lines:** 174

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getAuthUser` | function | `getAuthUser(req: Request): AuthUser` | 7 |
| `getOrgIdStrict` | function | `getOrgIdStrict(req: Request, res: Response): string \| null` | 11 |
| `isFounder` | function | `isFounder(req: Request): boolean` | 28 |
| `hasFullAccess` | function | `async hasFullAccess(req: Request): Promise<boolean>` | 32 |
| `requireTeamforceWriteAccess` | function | `async requireTeamforceWriteAccess(req: Request, res: Response): Promise<boolean>` | 51 |
| `hasRecruitmentAccess` | function | `async hasRecruitmentAccess(req: Request): Promise<boolean>` — Recruitment access: founder, Teamforce admin, or any employee whose profile has managesTeam=true (treated as "manager"). | 67 |
| `requireRecruitmentAccess` | function | `async requireRecruitmentAccess(req: Request, res: Response): Promise<boolean>` | 86 |
| `requireFounderOnly` | function | `requireFounderOnly(req: Request, res: Response): boolean` | 100 |
| `SENSITIVE_FIELDS` | const | `= [ // Salary & payroll "salaryStructureId", "monthlyCtc", "basicSalary", "hra", "transpo…` | 111 |
| `MANAGER_ONLY_FIELDS` | const | `= [ "teamforceRole", "reportingManagerId", "secondaryReviewerId", "branchId", "department…` — Fields an employee is NEVER allowed to set on themselves, even in self-edit (these are HR/manager-controlled, not self-service). | 144 |
| `stripSensitive` | function | `stripSensitive(profile: Record<string, any> \| null, fullAccess: boolean): Record<string, any> \| null` | 163 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
- **Packages:**
  - `express` — `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/branches.ts`
- `server/routes/teamforce/breakSettings.ts`
- `server/routes/teamforce/candidates.ts`
- `server/routes/teamforce/departments.ts`
- `server/routes/teamforce/employees.ts`
- `server/routes/teamforce/leavePolicies.ts`
- `server/routes/teamforce/leaveRequests.ts`
- `server/routes/teamforce/payrollConfig.ts`
- `server/routes/teamforce/payrollRuns.ts`
- `server/routes/teamforce/ptSlabs.ts`
- `server/routes/teamforce/recruitmentRequests.ts`
- `server/routes/teamforce/salaryStructures.ts`
- `server/routes/teamforce/shifts.ts`
- `server/routes/teamforce/taxDeclaration.ts`
- `server/routes/teamforce/weeklyOffPatterns.ts`
