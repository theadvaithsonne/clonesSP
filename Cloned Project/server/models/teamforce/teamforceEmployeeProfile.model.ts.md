# `server/models/teamforce/teamforceEmployeeProfile.model.ts`

> Mongoose model for an employee's Teamforce HR profile in one organisation. It holds personal details, org placement, reporting line, salary inputs, tax settings, attendance policy, exit data, documents and bank details.

**Kind:** Mongoose model · **Lines:** 153

## Purpose
A Garage `User` can belong to several organisations. Within each one, Teamforce keeps exactly one HR profile per user, keyed by `{ userId, orgId }`. It is the central record of the HR module:
- the employees list, add/edit forms, Bulk Upload and Invite via Email all write it;
- leave routing, break-policy matching and the Betty team views read it;
- the payroll engine reads it to work out each employee's pay, attendance and tax.

## How it works
Embedded sub-schemas (no `_id`):
- `EducationSchema`: `degreeName`, `yearOfPassing`, `certificateUrl`.
- `WorkExperienceSchema`: `companyName`, `yearsOfExperience`, `designation`, `referenceName`, `referenceContact`.
- `CustomAmountSchema`: `name` (required) and `amount`. Used for `customAllowances` and `customDeductions`.

Field groups:
- **Identity and role:** `userId` (ref `User`) and `orgId` (ref `Organization`), both required. `teamforceRole` (`admin`/`member`, default `member`) is a role inside Teamforce only and does not change the user's Garage org role. `_helpers.ts` treats a founder (JWT role) or a profile with `teamforceRole === "admin"` as having full access. `hasRecruitmentAccess` also accepts `managesTeam === true`.
- **Personal:** `mobileNumber`, `pan` (uppercased), `dateOfBirth` (sets the age used for age-tiered Old Regime slabs and senior-citizen limits; when missing, payroll assumes age 35), `permanentAddress`, `currentAddress`, `sameAsPermanent`.
- **Joining and organisation:** `dateOfJoining` (drives joining-month proration and the grace window), `placeOfJoining`, `branchId` (ref `TeamforceBranch`), `departmentId` (ref `TeamforceDepartment`), `designation`, `employmentType` (`full-time`, `part-time`, `contract`, `intern`, `freelance`), `state` (chooses the Professional Tax slab, falling back to the payroll config's `defaultState`), `cityType` (`METRO`/`NON_METRO`, for the HRA exemption).
- **Hierarchy:** `reportingManagerId` and `secondaryReviewerId` (ref `User`), `managesTeam`.
- **Salary:**
  - `salaryStructureId` (ref `TeamforceSalaryStructure`) and `monthlyCtc` are what the current payroll engine uses. A run skips an employee who lacks either (`no_salary_structure`, `no_monthly_ctc`).
  - `basicSalary`, `hra`, `transportAllowance`, `providentFund`, `professionalTax`, `variablePay`, `customAllowances` and `customDeductions` are older flat fields. `routes/teamforce/taxDeclaration.ts` still falls back to them in its regime preview for profiles without a structure.
  - `pfOption` (`CEILING`/`ACTUAL`, default `CEILING`) and `esiApplicable` feed the PF and ESI calculators.
- **TDS:** `tdsRegime` (`new`/`old`), `estimatedAnnualTds`, `autoCalculateTds`. Payroll takes the regime from `TeamforceEmployeeTaxDeclaration.regime` for the financial year, not from `tdsRegime`.
- **Attendance policy:**
  - `shiftId` (ref `TeamforceShift`) and `weeklyOffPatternId` (ref `TeamforceWeeklyOffPattern`, read by `attendanceLoader.ts`).
  - `deferredLopDays` (min 0) holds loss-of-pay days carried over from the joining month's grace window. The next run consumes it, and `persistDeferredLop` writes the new value when a run is approved.
- **Exit:** `exitedAt` (default null) and `exitReason`. When `exitedAt` falls in a payroll month, that run is treated as the Full & Final run, and TDS covers the whole remaining liability instead of being spread over the remaining months.
- **Documents:** `offerLetterUrl`, `idProofUrl`, `educationCertificatesUrl`, `experienceLettersUrl` (S3 URLs).
- **Bank:** `bankAccountHolderName`, `bankAccountType` (`savings`/`current`), `bankAccountNumber`, `bankIfscCode`.

Indexes: **unique** `{ userId, orgId }` and `{ orgId }`. `timestamps: true`.

## Exports
- `TeamforceEmployeeProfile` - the Mongoose model `"TeamforceEmployeeProfile"` (collection `teamforceemployeeprofiles`).

## Interfaces
- **Database:** `TeamforceEmployeeProfile` (collection `teamforceemployeeprofiles`).
  - Written by `routes/teamforce/employees.ts` (create, edit, role change, delete profile) and by `persistDeferredLop` in `services/teamforce/payroll/attendanceLoader.ts`.
  - Read by most other Teamforce routes and by `routes/betty.ts`.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
- `server/routes/betty.ts`
- `server/routes/teamforce/_helpers.ts` (access checks)
- `server/routes/teamforce/breakSettings.ts`, `employees.ts`, `leaveRequests.ts`, `payrollRuns.ts`, `taxDeclaration.ts`
- `server/services/teamforce/payroll/attendanceLoader.ts`

The main HTTP surface is `GET|POST /backend/teamforce/employees`, `GET|PATCH /backend/teamforce/employees/:userId`, `PATCH /backend/teamforce/employees/:userId/role` and `DELETE /backend/teamforce/employees/:userId/profile`.

## Notes
- Field-level privacy is enforced in the router layer, not in the model:
  - `SENSITIVE_FIELDS` in `_helpers.ts` (salary, TDS, PF/ESI, hierarchy, shift and off pattern, offer letter, exit) are removed from responses for viewers without full access.
  - `MANAGER_ONLY_FIELDS` cannot be self-edited.
- Bank account number, IFSC and PAN are stored in plain text, and the bank fields are not in `SENSITIVE_FIELDS`.
- Payroll transactions store a copy of the salary inputs, so later profile edits do not change past payslips.
