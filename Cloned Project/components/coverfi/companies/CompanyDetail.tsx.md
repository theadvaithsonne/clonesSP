# `components/coverfi/companies/CompanyDetail.tsx`

> Client component for one Coverfi customer company, with three tabs: Info (an edit form), Products (enroll and unenroll) and Employees (roster CRUD).

**Kind:** React component · **Lines:** 681

## Purpose
After the creation wizard (`CompanyWizard.tsx`) makes a customer company, this screen is where a brokerage user views and maintains it. It edits the company profile and address, manages which insurance products the company is enrolled in, and manages the company's employees. All data comes from the external Coverfi API through `lib/coverfi/companies-api.ts`, `products-api.ts` and `insurance-api.ts`.

## How it works

### Shell: `CompanyDetail` (L56-L170)
- Props: `companyId`, which comes from the dynamic route segment.
- `refresh()` loads three things in parallel:
  - `getCompany(companyId)`
  - `listProducts()`, which falls back to `[]` on error
  - `listInsuranceCompanies()`, which falls back to `[]` on error

  Only a failed company fetch shows an error toast.
- When `company` is null it shows "Loading…" or "Couldn't load this company…" instead of the page.
- Header: back link to `/coverfi/companies`, then the logo (or a `Building2` placeholder), display or legal name, industry, number of enrolled products and `employee_count`.
- Tab bar: local `tab` state with the values `"info" | "products" | "employees"`. The active tab gets a brand-coloured underline.
- `refresh` is passed down as the callback for Info and Products. Calling it sets `loading` back to true, so the tab content unmounts and then remounts with fresh props. The selected tab stays the same.

### Info tab: `InfoTab` (L174-L395)
- Copies the company into a flat form state. POC fields are flattened to `poc_*`, and `pincode` is held as a string.
- `ImageUpload` handles the company logo. It uploads through Coverfi's upload helper and returns a URL.
- The form has three sections:
  - Basic: legal name, display name, industry.
  - Point of contact: first and last name, email, and a phone number reduced to digits only.
  - Address: street number, street name, city, a country `Select`, a state `Select`, and a pincode reduced to digits and capped at 6.
- The country and state lists come from `country-state-city`. The ISO codes are stored, not the names. Changing the country clears the state, and the state picker stays disabled until a country is chosen.
- `onSave()` sends all fields to `updateCompany(company._id, …)`. It rebuilds the nested `poc` object and converts `pincode` to a number, or `undefined` when empty. Then it shows a toast and calls `onSaved()`.

### Products tab: `ProductsTab` (L399-L543)
- `enrolledIds` is the set of `company.enrolled_products[].productId`.
- `eligible` is the products that are `is_active` and not already enrolled. The "Enroll product" button appears only when `eligible` is non-empty.
- The picker is a `Select` over the eligible products. `onEnroll()` calls `enrollProduct(company._id, selected)`, without notes.
- The table lists each enrolled product with:
  - its name, looked up by id, or "Unknown product" when the id is not in the product list
  - its insurer name, from `insurance_provider` mapped through the insurer list
  - its enrolment date (`enrolled_at`)
  - an X button that runs `onUnenroll()`, which asks for confirmation and then calls `unenrollProduct(company._id, productId)`

### Employees tab: `EmployeesTab` (L547-L665)
- Keeps its own `rows` state, loaded with `listCompanyEmployees(companyId)`.
- Table columns are name, email, designation and department, plus edit and delete buttons.
- Add and edit both open `CompanyEmployeeFormDialog`. `editing` holds the employee being edited, or `null` to add one. The dialog's `onSaved` reloads this tab's list only.
- Delete asks for confirmation, then calls `deleteCompanyEmployee(e._id)`.

### Helper
- `Field` (L667-L680) renders a label above its input.

## Exports
- `default CompanyDetail({ companyId }: { companyId: string })`: the company detail page body. `InfoTab`, `ProductsTab`, `EmployeesTab` and `Field` are module-private.

## Interfaces
- **External services:** the Coverfi API at `NEXT_PUBLIC_COVERFI_API_URL` (default `http://localhost:4100`), called with a bearer token through `coverfiApi`:
  - `GET /v1/coverfi/company/:id`: load the company.
  - `PATCH /v1/coverfi/company/:id`: save the Info tab.
  - `POST /v1/coverfi/company/:companyId/enroll-product` (body `{ productId, notes }`): enroll a product.
  - `DELETE /v1/coverfi/company/:companyId/enroll-product/:productId`: unenroll a product.
  - `GET /v1/coverfi/company/:companyId/employees`: list employees.
  - `DELETE /v1/coverfi/company-employees/:id`: delete an employee.
  - `GET /v1/coverfi/products`: product catalogue.
  - `GET /v1/coverfi/insurance`: insurer names.
  - Creating and updating employees goes through `CompanyEmployeeFormDialog`.

## Dependencies
- **Internal:**
  - `lib/coverfi/companies-api.ts`: company and employee calls.
  - `lib/coverfi/products-api.ts`: `listProducts`.
  - `lib/coverfi/insurance-api.ts`: `listInsuranceCompanies`.
  - `lib/coverfi/types.ts`: the `Company`, `CompanyEmployee`, `InsuranceCompany` and `Product` types.
  - `components/coverfi/brokerage/ImageUpload.tsx`: logo upload.
  - `components/coverfi/companies/CompanyEmployeeFormDialog.tsx`: the employee form.
  - `components/ui/*`: button, input, label, badge, select and table.
  - `lib/utils.ts`: `cn`.
- **Packages:** `react`, `next` (`Link`), `lucide-react` (icons), `country-state-city` (country and state lists), `sonner` (toasts).

## Used by
- `app/(dashboard)/coverfi/companies/[id]/page.tsx`, which serves the URL `/coverfi/companies/:id`.

## Notes
- Adding or deleting employees does not refresh the parent, so the `employee_count` shown in the header stays stale until the page reloads or the Info or Products tab triggers `refresh()`.
- `state` and `country` are stored as ISO codes (for example `IN`, `MH`), not display names. Other screens that read these fields need to map them back.
- If `listProducts` fails, it silently returns `[]`. Every enrolled product then shows as "Unknown product" and the Enroll button is hidden.
- `Badge` is imported but never used.
