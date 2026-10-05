# `components/dashboard/inlineApps/teamforce/api.ts`

> Module exporting `listEmployees`, `getEmployee`, `upsertEmployee`, `updateEmployeeProfile` and 81 more.

**Kind:** React component · **Lines:** 821

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `listEmployees` | function | `async listEmployees()` | 46 |
| `getEmployee` | function | `async getEmployee(userId: string)` | 50 |
| `upsertEmployee` | function | `async upsertEmployee(payload: Record<string, unknown>)` | 54 |
| `updateEmployeeProfile` | function | `async updateEmployeeProfile(userId: string, patch: Record<string, unknown>)` | 61 |
| `setTeamforceRole` | function | `async setTeamforceRole(userId: string, teamforceRole: "admin" \| "member")` | 71 |
| `deleteEmployeeProfile` | function | `async deleteEmployeeProfile(userId: string)` | 81 |
| `listBranches` | function | `async listBranches()` | 88 |
| `createBranch` | function | `async createBranch(data: Partial<Branch>)` | 92 |
| `updateBranch` | function | `async updateBranch(id: string, data: Partial<Branch>)` | 99 |
| `deleteBranch` | function | `async deleteBranch(id: string)` | 106 |
| `listDepartments` | function | `async listDepartments()` | 113 |
| `createDepartment` | function | `async createDepartment(data: Partial<Department>)` | 117 |
| `updateDepartment` | function | `async updateDepartment(id: string, data: Partial<Department>)` | 124 |
| `deleteDepartment` | function | `async deleteDepartment(id: string)` | 134 |
| `listShifts` | function | `async listShifts()` | 141 |
| `createShift` | function | `async createShift(data: Partial<Shift>)` | 145 |
| `updateShift` | function | `async updateShift(id: string, data: Partial<Shift>)` | 152 |
| `deleteShift` | function | `async deleteShift(id: string)` | 159 |
| `listWeeklyOffPatterns` | function | `async listWeeklyOffPatterns()` | 166 |
| `createWeeklyOffPattern` | function | `async createWeeklyOffPattern(data: Partial<WeeklyOffPattern>)` | 172 |
| `updateWeeklyOffPattern` | function | `async updateWeeklyOffPattern(id: string, data: Partial<WeeklyOffPattern>)` | 181 |
| `deleteWeeklyOffPattern` | function | `async deleteWeeklyOffPattern(id: string)` | 191 |
| `listBreakPolicies` | function | `async listBreakPolicies()` | 198 |
| `createBreakPolicy` | function | `async createBreakPolicy(data: Partial<BreakPolicy>)` | 204 |
| `updateBreakPolicy` | function | `async updateBreakPolicy(id: string, data: Partial<BreakPolicy>)` | 211 |
| `deleteBreakPolicy` | function | `async deleteBreakPolicy(id: string)` | 221 |
| `getBreakStatus` | function | `async getBreakStatus()` | 227 |
| `listLeavePolicies` | function | `async listLeavePolicies()` | 232 |
| `createLeavePolicy` | function | `async createLeavePolicy(data: Partial<LeavePolicy>)` | 238 |
| `updateLeavePolicy` | function | `async updateLeavePolicy(id: string, data: Partial<LeavePolicy>)` | 245 |
| `deleteLeavePolicy` | function | `async deleteLeavePolicy(id: string)` | 255 |
| `LeaveType` | type |  | 262 |
| `LeaveStatus` | type |  | 268 |
| `LeaveRequest` | interface |  | 270 |
| `LeaveRequestInput` | interface |  | 291 |
| `createLeaveRequest` | function | `async createLeaveRequest(data: LeaveRequestInput)` | 300 |
| `listMyLeaveRequests` | function | `async listMyLeaveRequests()` | 307 |
| `listOrgLeaveRequests` | function | `async listOrgLeaveRequests(status?: LeaveStatus)` | 313 |
| `approveLeaveRequest` | function | `async approveLeaveRequest(id: string, note?: string)` | 321 |
| `rejectLeaveRequest` | function | `async rejectLeaveRequest(id: string, note?: string)` | 328 |
| `cancelLeaveRequest` | function | `async cancelLeaveRequest(id: string)` | 335 |
| `listTeamLeaveRequests` | function | `async listTeamLeaveRequests(status?: LeaveStatus)` | 343 |
| `listSalaryStructures` | function | `async listSalaryStructures()` | 352 |
| `createSalaryStructure` | function | `async createSalaryStructure(data: Partial<Omit<SalaryStructure, "_id" \| "orgId" \| "isAc…)` | 358 |
| `updateSalaryStructure` | function | `async updateSalaryStructure(id: string, data: Partial<Omit<SalaryStructure, "_id" \| "orgId" \| "isAc…)` | 367 |
| `deleteSalaryStructure` | function | `async deleteSalaryStructure(id: string)` | 377 |
| `getSalaryStructureDefaults` | function | `async getSalaryStructureDefaults()` | 384 |
| `getPayrollConfig` | function | `async getPayrollConfig()` | 391 |
| `updatePayrollConfig` | function | `async updatePayrollConfig(data: Partial<Pick<PayrollConfig, "attendanceCutoffDay" \| "…)` | 395 |
| `unlockPayrollConfig` | function | `async unlockPayrollConfig()` | 404 |
| `listPTSlabs` | function | `async listPTSlabs(state?: string)` | 412 |
| `createPTSlab` | function | `async createPTSlab(data: Omit<PTSlab, "_id" \| "isActive" \| "effectiveDate"> & …)` | 419 |
| `updatePTSlab` | function | `async updatePTSlab(id: string, data: Partial<Omit<PTSlab, "_id" \| "isActive">>)` | 430 |
| `deletePTSlab` | function | `async deletePTSlab(id: string)` | 440 |
| `seedPTSlabs` | function | `async seedPTSlabs()` | 446 |
| `getTaxDeclaration` | function | `async getTaxDeclaration(fy: string, userId?: string)` | 454 |
| `upsertTaxDeclaration` | function | `async upsertTaxDeclaration(data: Partial<Omit<EmployeeTaxDeclaration, "_id" \| "userId"…, userId?: string)` | 464 |
| `lockTaxDeclaration` | function | `async lockTaxDeclaration(fy: string, userId?: string)` | 477 |
| `unlockTaxDeclaration` | function | `async unlockTaxDeclaration(fy: string, userId?: string)` — Founder-only master unlock. | 489 |
| `getRegimePreview` | function | `async getRegimePreview(fy: string, userId?: string)` | 498 |
| `getOrgTaxSummary` | function | `async getOrgTaxSummary(fy: string)` | 508 |
| `listPayrollRuns` | function | `async listPayrollRuns(fyYear?: number)` | 517 |
| `listMyPayrollSlips` | function | `async listMyPayrollSlips(fyYear?: number)` | 524 |
| `getMyForm16` | function | `async getMyForm16(fyYear: number)` | 531 |
| `getPayrollRun` | function | `async getPayrollRun(id: string)` | 537 |
| `createPayrollRun` | function | `async createPayrollRun(params: { fyMonth: number; fyYear: number; runType?: "FULL"…)` | 543 |
| `getMonthSummary` | function | `async getMonthSummary(fyYear: number, fyMonth: number)` | 555 |
| `approvePayrollRun` | function | `async approvePayrollRun(id: string)` | 561 |
| `markPaidPayrollRun` | function | `async markPaidPayrollRun(id: string)` | 568 |
| `deletePayrollRun` | function | `async deletePayrollRun(id: string)` | 575 |
| `overridePayrollTransaction` | function | `async overridePayrollTransaction(runId: string, txId: string, patch: Partial<{ monthlyTDS: number; professionalTax: numbe…)` | 581 |
| `emailPayrollSlip` | function | `async emailPayrollSlip(runId: string, txId: string)` | 600 |
| `emailAllPayrollSlips` | function | `async emailAllPayrollSlips(runId: string)` | 607 |
| `listRecruitmentRequests` | function | `async listRecruitmentRequests(params?: { page?: number; pageSize?: number; status?: Recru…)` | 617 |
| `getRecruitmentRequest` | function | `async getRecruitmentRequest(id: string)` | 640 |
| `createRecruitmentRequest` | function | `async createRecruitmentRequest(payload: RecruitmentRequestPayload)` | 646 |
| `updateRecruitmentRequest` | function | `async updateRecruitmentRequest(id: string, payload: Partial<RecruitmentRequestPayload> & { status?: Re…)` | 655 |
| `deleteRecruitmentRequest` | function | `async deleteRecruitmentRequest(id: string)` | 665 |
| `getRecruitmentAccess` | function | `async getRecruitmentAccess()` | 672 |
| `FormBuilderResponse` | type |  | 679 |

_…and 11 more._

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/teamforce/salary-structures/defaults` (L385)
  - `POST /backend/teamforce/pt-slabs` (L424)
  - `PATCH /backend/teamforce/pt-slabs/${id}` (L434)
  - `DELETE /backend/teamforce/pt-slabs/${id}` (L441)
  - `POST /backend/teamforce/pt-slabs/seed` (L447)
  - `POST /backend/upload` (L813)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${withOrg("/teamforce/tax-declaration")}${orgQS}fy=${encodeURIComponent(fy)}${userQS}` (L459)
  - `GET ${withOrg("/teamforce/tax-declaration/regime-preview")}${orgQS}fy=${encodeURIComponent(fy)}${userQS}` (L503)
  - `GET ${base}${sep}fy=${encodeURIComponent(fy)}` (L511)
  - `GET ${withOrg("/teamforce/payroll-runs")}${qs}` (L519)
  - `GET ${withOrg("/teamforce/payroll-runs/me/transactions")}${qs}` (L526)
  - `GET ${withOrg("/teamforce/payroll-runs/me/form16")}&fyYear=${fyYear}` (L532)
  - `GET ${withOrg("/teamforce/payroll-runs/month-summary")}&fyYear=${fyYear}&fyMonth=${fyMonth}` (L556)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getOrgId`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `EmployeeListItem`, `EmployeeProfile`, `Branch`, `Department`, `Shift`, `WeeklyOffPattern`, `LeavePolicy`, `BreakPolicy`, … +22
- **Packages:** none

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/backOfficeAppSideBar.tsx`
- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
- `components/dashboard/inlineApps/teamforce/sections/AddEmployeeSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/AttendanceSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/BranchesSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/DepartmentsSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/EmployeeDetailsSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx`
- `components/dashboard/inlineApps/teamforce/sections/EmployeesSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/MySalarySlipsSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/RecruitmentSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx`
- `components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/TaxDeclarationSection.tsx`
