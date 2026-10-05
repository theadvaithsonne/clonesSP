# `lib/coverfi/companies-api.ts`

> Client functions for Coverfi client companies (a three-step creation wizard, product enrolment) and their employees, served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 100

## Purpose
A "company" is a client business the brokerage insures. This module backs the companies list, the company detail page, the company wizard and the employee form dialog. It is a lighter-weight model than "corporates" (`corporate-api.ts`): company employees are plain records, not Garage users. All calls go through `coverfiApi`.

## How it works
Base paths are `/v1/coverfi/company` and `/v1/coverfi/company-employees`. Every function unwraps `ApiResult.data` except the deletes.

**Companies**
- `listCompanies()` - `GET /v1/coverfi/company/all`.
- `getCompany(id)` - `GET /v1/coverfi/company/:id`.
- The creation wizard, where each step advances `Company.step_completed`:
  - `createCompanyStep1({ legal_name, display_name?, industry?, poc? })` - `POST .../create/step1`. Creates the record and returns it, including its `_id`.
  - `createCompanyStep2(id, Partial<Company>)` - `POST .../create/step2/:id`. Saves the address and logo fields.
  - `createCompanyStep3(id, { enrolled_products? })` - `POST .../create/step3/:id`. Saves the initial product enrolments (`productId`, `notes`).
- `updateCompany(id, patch)` - `PATCH .../:id`.
- `deleteCompany(id)` - `DELETE .../delete/:id`.
- `enrollProduct(companyId, productId, notes?)` - `POST .../:companyId/enroll-product`.
- `unenrollProduct(companyId, productId)` - `DELETE .../:companyId/enroll-product/:productId`.

**Employees**
- `listCompanyEmployees(companyId)` - `GET /v1/coverfi/company/:companyId/employees`.
- `createCompanyEmployee(companyId, body)` - `POST` to the same path.
- `updateCompanyEmployee(id, patch)` - `PATCH /v1/coverfi/company-employees/:id`.
- `deleteCompanyEmployee(id)` - `DELETE /v1/coverfi/company-employees/:id`.

## Exports
`listCompanies`, `getCompany`, `createCompanyStep1`, `createCompanyStep2`, `createCompanyStep3`, `updateCompany`, `deleteCompany`, `enrollProduct`, `unenrollProduct`, `listCompanyEmployees`, `createCompanyEmployee`, `updateCompanyEmployee`, `deleteCompanyEmployee`. It also re-exports `type CompanyEnrolledProduct` from `types.ts`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `Company`, `CompanyEmployee`, `CompanyEnrolledProduct`.

## Used by
`app/(dashboard)/coverfi/page.tsx` (`listCompanies`), `components/coverfi/companies/CompaniesList.tsx`, `CompanyDetail.tsx`, `CompanyEmployeeFormDialog.tsx` and `CompanyWizard.tsx`.

## Notes
- Employee create and list calls are nested under the company. Update and delete go to the flat `company-employees` path by employee id.
