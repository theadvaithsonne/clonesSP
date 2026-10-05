# `components/coverfi/companies/CompanyEmployeeFormDialog.tsx`

> Modal dialog for adding or editing an employee of a Coverfi customer company.

**Kind:** React component · **Lines:** 193

## Purpose
Each Coverfi customer company keeps its own employee roster, the people its insurance products cover. This dialog is the single form for that roster. It runs in "add" mode when `existing` is null and in "edit" mode when an employee is passed in. It is opened from the Employees tab of `CompanyDetail`.

## How it works
- The local `data` state holds `employee_id`, `first_name`, `last_name`, `email`, `phone_number`, `phoneCode` (default `"+91"`), `designation` and `department`. These start from the `empty` constant.
- A `useEffect` on `[existing, open]` resets the form every time the dialog opens. With `existing` set it fills the fields from that employee, and missing optional fields become `""` or `"+91"`. Otherwise it clears the form.
- The phone number input strips non-digits as the user types. The phone code is free text.
- `onSave()`:
  - First and last name are required, and a toast error appears if either is empty.
  - Edit mode calls `updateCompanyEmployee(existing._id, data)`. Add mode calls `createCompanyEmployee(companyId, data)`.
  - On success it shows a toast, then calls `onSaved()` (the parent reloads its list) and `onClose()`. On failure it shows the error message in a toast.
- Closing the dialog via its overlay or Esc key calls `onClose`. The footer has Cancel and Add/Update buttons, and the save button is disabled while a save is running.
- `Field` is a local helper that renders a label with its input.

## Exports
- `default CompanyEmployeeFormDialog({ open, onClose, onSaved, companyId, existing? })`. `companyId` is the parent company for creates. `existing` is the employee being edited, or `null`/`undefined` to add a new one.

## Interfaces
- **External services:** the Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`), called through `coverfiApi`:
  - `POST /v1/coverfi/company/:companyId/employees`: create an employee.
  - `PATCH /v1/coverfi/company-employees/:id`: update an employee.

## Dependencies
- **Internal:** `components/ui/dialog.tsx`, `input.tsx`, `label.tsx` and `button.tsx` (shadcn UI); `lib/coverfi/companies-api.ts` (`createCompanyEmployee`, `updateCompanyEmployee`); `lib/coverfi/types.ts` (`CompanyEmployee`).
- **Packages:** `react`, `sonner`.

## Used by
- `components/coverfi/companies/CompanyDetail.tsx` (its `EmployeesTab`).

## Notes
- The whole form object is sent on save, so blank optional fields go to the API as empty strings, not omitted.
- Fields such as `date_of_birth`, `date_of_joining` and `dependents` exist on the `CompanyEmployee` type but cannot be edited here.
- No email format check is done beyond `type="email"` on the input.
