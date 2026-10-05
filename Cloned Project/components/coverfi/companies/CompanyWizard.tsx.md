# `components/coverfi/companies/CompanyWizard.tsx`

> Three-step client wizard that creates a Coverfi customer company: basic info, then address and logo, then product enrolment.

**Kind:** React component · **Lines:** 510

## Purpose
Creating a customer company in the Coverfi brokerage module goes through a staged API (`create/step1`, `step2/:id`, `step3/:id`). This component is the UI for that flow. Step 1 creates the record and returns its id. Steps 2 and 3 fill in the rest of the same record. At the end the user is sent to the company's detail page.

## How it works

### Orchestrator: `CompanyWizard` (L35-L179)
- State:
  - `step` (1-3)
  - `companyId`, set after step 1
  - `info`: legal, display and industry names plus POC first name, last name, email and phone
  - `addr`: logo URL, street number, street name, city, state, country and pincode
  - `products`: the active products only
  - `selectedProductIds`
  - `saving`
- On mount it calls `listProducts()` and keeps only the `is_active` products. Errors are swallowed.
- `submitStep1()` requires `legal_name`. It calls `createCompanyStep1` with the empty strings turned into `undefined` (POC sent as a nested `poc` object), stores the returned `_id` and moves to step 2.
- `submitStep2()` sends the address and logo to `createCompanyStep2(companyId, …)` and moves to step 3. Empty fields become `undefined`, and `pincode` is converted to a number.
- `submitStep3()` sends `{ enrolled_products: [{ productId }] }` for the selected products to `createCompanyStep3`, shows a "Company created" toast and calls `router.push('/coverfi/companies/<id>')`.
- `toggleProduct(id)` adds a product id to `selectedProductIds`, or removes it if already there.
- Every API error shows its message in a `sonner` toast.

### `Stepper` (L181-L221)
- Draws the three `STEPS` labels: "Basic info", "Address" and "Products".
- Completed steps show a check mark. The active step is highlighted. Chevrons separate the steps.

### Step views
- `BasicInfoStep` (L223-L311) collects legal name (marked required), display name, industry and the POC fields. The phone field keeps digits only.
- `AddressStep` (L313-L418):
  - `ImageUpload` handles the company logo.
  - Fields are street number, street name and city, plus a country `Select` and a state `Select` filled from `country-state-city` (ISO codes stored). Changing the country clears the state.
  - Pincode keeps digits only, at most 6.
  - Has Back and Continue buttons.
- `ProductsStep` (L420-L489) shows a checkbox card for each active product with its name and description. When no products exist it explains that the user can finish now and enroll later from the detail page. Has Back and Finish buttons.
- `Field` (L491-L509) renders a label (with an optional red asterisk) above its input.

## Exports
- `default CompanyWizard()`: the creation wizard. Takes no props. The sub-components are module-private.

## Interfaces
- **External services:** the Coverfi API at `NEXT_PUBLIC_COVERFI_API_URL` (default `http://localhost:4100`), called with a bearer token through `coverfiApi`:
  - `GET /v1/coverfi/products`: list the products to choose from.
  - `POST /v1/coverfi/company/create/step1`: create the company with its basic info.
  - `POST /v1/coverfi/company/create/step2/:id`: save the address and logo.
  - `POST /v1/coverfi/company/create/step3/:id`: save the product enrolments.

## Dependencies
- **Internal:**
  - `lib/coverfi/companies-api.ts`: the `createCompanyStep1`, `createCompanyStep2` and `createCompanyStep3` calls.
  - `lib/coverfi/products-api.ts`: `listProducts`.
  - `lib/coverfi/types.ts`: the `Company` and `Product` types.
  - `components/coverfi/brokerage/ImageUpload.tsx`: logo upload.
  - `components/ui/*`: button, input, label, select and badge.
  - `lib/utils.ts`: `cn`.
- **Packages:** `react`, `next/navigation` (`useRouter`), `lucide-react`, `country-state-city`, `sonner`.

## Used by
- `app/(dashboard)/coverfi/companies/new/page.tsx`, which serves the URL `/coverfi/companies/new`.

## Notes
- **Duplicate-create risk:** if the user goes Back from step 2 to step 1 and presses Continue again, `submitStep1()` calls `createCompanyStep1` again even though `companyId` is already set. This creates a second company record, and the first one is left behind.
- If the wizard is abandoned after step 1 or 2, a partially completed company stays in Coverfi. The `Company` type has a `step_completed` field for this case. That company still appears in `CompaniesList`.
- `Badge`, `X` and `Plus` are imported but never used. The `data`/`setData` props of the step views are typed as `any`.
