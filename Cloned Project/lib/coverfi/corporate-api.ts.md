# `lib/coverfi/corporate-api.ts`

> Client functions for Coverfi corporates (a four-step onboarding wizard), their employees, employees' dependents and corporate-to-product policy mappings, served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 152

## Purpose
"Corporates" are the fuller client model: types.ts labels them "Phase 8 + 9". Each corporate has a named admin, a list of points of contact, employees who are linked to Garage user accounts (`CorporateEmployee.userId`), dependents per employee, and policy mappings that say which product covers which employees. This module is the data layer for the `components/coverfi/corporate/*` wizard, the detail tabs and the dialogs. All calls go through `coverfiApi`.

## How it works
Every function unwraps `ApiResult.data` except the hard deletes (`deleteCorporate`, `deleteDependent`, `deleteMapping`), which return the raw `ApiResult<null>`.

**Corporates** (base `/v1/coverfi/corporate`)
- `listCorporates()` - `GET .../all`.
- `getCorporate(id)` - `GET .../:id`. The detail view also includes `employee_count`, `dependent_count` and `active_policy_count`.
- The wizard:
  - `createCorporateStep1({ legal_name, admin_email, display_name?, industry?, admin_first_name?, admin_last_name?, admin_phone?, admin_phone_code?, poc? })` - `POST .../create/step1`. Creates the corporate and its admin.
  - `createCorporateStep2(id, Partial<Corporate>)` - `POST .../create/step2/:id`. Saves the address.
  - `createCorporateStep3(id)` - `POST .../create/step3/:id` with body `{}`. Marks the employees step complete; employees themselves are added with the employee calls below.
  - `createCorporateStep4(id)` - `POST .../create/step4/:id` with body `{}`. Marks the products step complete; mappings are added separately.
- `updateCorporate(id, patch)` - `PATCH .../:id`.
- `deleteCorporate(id)` - `DELETE .../delete/:id`.

**Employees**
- `listCorporateEmployees(corporateId)` and `createCorporateEmployee(corporateId, body)` - `GET` and `POST /v1/coverfi/corporate/:corporateId/employees`.
- `updateCorporateEmployee(id, patch)` - `PATCH /v1/coverfi/corporate-employees/:id`.
- `suspendCorporateEmployee(id)` - `DELETE /v1/coverfi/corporate-employees/:id`. The function name says this suspends the employee (status `suspended`) rather than removing the record, and it returns the updated `CorporateEmployee`.

**Dependents**
- `listDependentsForEmployee(employeeId)` and `createDependent(employeeId, body)` - `GET` and `POST /v1/coverfi/corporate-employees/:employeeId/dependents`.
- `updateDependent(id, patch)` and `deleteDependent(id)` - `PATCH` and `DELETE /v1/coverfi/corporate-dependents/:id`.

**Product mappings**
- `listMappingsForCorporate(corporateId)` and `createMapping(corporateId, body)` - `GET` and `POST /v1/coverfi/corporate/:corporateId/product-mappings`.
- `updateMapping(id, patch)` and `deleteMapping(id)` - `PATCH` and `DELETE /v1/coverfi/corporate-product-mappings/:id`.

## Exports
`listCorporates`, `getCorporate`, `createCorporateStep1`, `createCorporateStep2`, `createCorporateStep3`, `createCorporateStep4`, `updateCorporate`, `deleteCorporate`, `listCorporateEmployees`, `createCorporateEmployee`, `updateCorporateEmployee`, `suspendCorporateEmployee`, `listDependentsForEmployee`, `createDependent`, `updateDependent`, `deleteDependent`, `listMappingsForCorporate`, `createMapping`, `updateMapping`, `deleteMapping`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`. That backend provisions Garage users for corporate admins and employees: Garage's `user.model.ts` has a Coverfi flag for such users, which `server/routes/auth.ts` clears on their first normal Garage login.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `Corporate`, `CorporateEmployee`, `CorporateDependent`, `CorporateProductMapping`.

## Used by
`components/coverfi/corporate/CorporateEmployeesTab.tsx`, `CorporateInfoTab.tsx`, `CorporateList.tsx`, `CorporateProductsTab.tsx`, `CorporateStep1Form.tsx`, `CorporateStep2Address.tsx`, `CorporateStep3Employees.tsx`, `CorporateStep4Products.tsx`, `CorporateWizard.tsx`, `DependentFormDialog.tsx`, `EmployeeFormDialog.tsx` and `MappingFormDialog.tsx`.

## Notes
- Nested paths (under `/corporate/:id/...` or `/corporate-employees/:id/...`) are used for list and create. Flat paths by item id are used for update and delete. Keep to this pattern if you add calls.
