# `lib/coverfi/insurance-api.ts`

> CRUD client for the insurance companies (insurers) a Coverfi brokerage works with, served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 34

## Purpose
Products are underwritten by insurers. This module manages the brokerage's list of insurance companies, which the product wizard uses to pick `insurance_provider` and the corporate and company screens use to label products. Calls go through `coverfiApi`.

## How it works
Base path: `/v1/coverfi/insurance`.
- `listInsuranceCompanies()` - `GET /v1/coverfi/insurance`, returns `InsuranceCompany[]`.
- `getInsuranceCompany(id)` - `GET .../:id`.
- `createInsuranceCompany(body)` - `POST .../create`. The body is an `InsuranceCompany` without the server-owned fields (`_id`, `brokerageId`, `orgId`, timestamps); `is_active` is optional.
- `updateInsuranceCompany(id, patch)` - `PATCH .../update/:id`.
- `deleteInsuranceCompany(id)` - `DELETE .../delete/:id`. Returns the raw `ApiResult<null>`.

All the other functions unwrap `.data`.

## Exports
`listInsuranceCompanies`, `getInsuranceCompany`, `createInsuranceCompany`, `updateInsuranceCompany`, `deleteInsuranceCompany`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `InsuranceCompany`.

## Used by
`app/(dashboard)/coverfi/page.tsx`, `components/coverfi/companies/CompanyDetail.tsx`, `components/coverfi/corporate/CorporateProductsTab.tsx`, `CorporateStep4Products.tsx`, `components/coverfi/insurance/InsuranceCompaniesTable.tsx`, `InsuranceCompanyFormDialog.tsx`, `components/coverfi/products/ProductWizard.tsx` and `ProductsList.tsx`.

## Notes
- Update and delete use the action-in-path style (`/update/:id`, `/delete/:id`), unlike most other Coverfi modules, which `PATCH` or `DELETE` `/:id` directly.
