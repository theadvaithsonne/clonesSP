# `components/dashboard/inlineApps/teamforce/types.ts`

> Module exporting `Section`, `RecruitmentStatus`, `EmploymentType`, `ExperienceRange` and 54 more.

**Kind:** React component · **Lines:** 658

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Section` | type |  | 1 |
| `RecruitmentStatus` | type |  | 19 |
| `EmploymentType` | type |  | 26 |
| `ExperienceRange` | type |  | 27 |
| `CustomFieldType` | type |  | 29 |
| `CustomFieldDef` | interface |  | 31 |
| `CustomFieldValue` | interface |  | 38 |
| `RecruitmentRequest` | interface |  | 49 |
| `CandidateStage` | type |  | 76 |
| `Candidate` | interface |  | 85 |
| `CandidateApplyPayload` | interface |  | 112 |
| `RecruitmentRequestPayload` | interface |  | 123 |
| `EducationEntry` | interface |  | 142 |
| `WorkExperienceEntry` | interface |  | 148 |
| `CustomAmount` | interface |  | 156 |
| `EmployeeProfile` | interface |  | 161 |
| `EmployeeStatus` | type |  | 214 |
| `EmployeeListItem` | interface |  | 216 |
| `Branch` | interface |  | 232 |
| `Department` | interface |  | 245 |
| `Shift` | interface |  | 254 |
| `WeeklyOffPattern` | interface |  | 266 |
| `LeavePolicyType` | type |  | 275 |
| `LeavePolicyApplicableFor` | type |  | 276 |
| `BreakScopeType` | type |  | 281 |
| `BreakPayrollImpact` | interface |  | 283 |
| `BreakPolicy` | interface |  | 289 |
| `BreakStatus` | interface |  | 303 |
| `LeavePolicy` | interface |  | 318 |
| `ComponentCode` | type |  | 331 |
| `TaxabilityType` | type |  | 356 |
| `CalcType` | type |  | 365 |
| `TaxRegime` | type |  | 372 |
| `SalaryComponent` | interface |  | 374 |
| `SalaryStructure` | interface |  | 382 |
| `SalaryStructureDefaults` | interface |  | 394 |
| `PayrollConfig` | interface |  | 399 |
| `PTSlab` | interface |  | 409 |
| `Regime` | type |  | 420 |
| `HRADeclaration` | interface |  | 422 |
| `PreviousEmployer` | interface |  | 429 |
| `EmployeeTaxDeclaration` | interface |  | 438 |
| `RegimeBreakdown` | interface |  | 462 |
| `RegimePreview` | interface |  | 486 |
| `OrgTaxSummaryEntry` | interface |  | 497 |
| `PayrollRunStatus` | type |  | 508 |
| `PayrollRunTotals` | interface |  | 510 |
| `PayrollRunType` | type |  | 520 |
| `PartialPayrollScope` | interface |  | 522 |
| `PayrollRun` | interface |  | 529 |
| `MonthSummaryRemainingEmployee` | interface |  | 553 |
| `MonthSummaryResponse` | interface |  | 561 |
| `AttendanceBreakdown` | interface |  | 570 |
| `ResolvedComponentRow` | interface |  | 590 |
| `PayrollTransaction` | interface |  | 599 |
| `PayrollRunCreateResult` | interface |  | 634 |
| `Form16Totals` | interface |  | 640 |
| `Form16Response` | interface |  | 652 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/jobs/[id]/JobLandingClient.tsx`
- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
- `components/dashboard/inlineApps/teamforce/api.ts`
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
