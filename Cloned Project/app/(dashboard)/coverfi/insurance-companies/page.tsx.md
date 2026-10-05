# `app/(dashboard)/coverfi/insurance-companies/page.tsx`

> Thin route file that renders the table of insurance providers (insurers) known to Coverfi.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/insurance-companies`

## Purpose
A brokerage sells products from insurance carriers. This route lists those carriers by binding the URL to `InsuranceCompaniesTable`, which uses the external Coverfi API (`lib/coverfi/insurance-api.ts`, base path `/v1/coverfi/insurance`).

## How it works
`InsuranceCompaniesPage()` returns `<InsuranceCompaniesTable />`. The page has no logic of its own. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default InsuranceCompaniesPage()` - renders the insurers table.

## Dependencies
- **Internal:** `components/coverfi/insurance/InsuranceCompaniesTable.tsx` - the insurer list and CRUD.

## Used by
No file imports it. It is reached at `/coverfi/insurance-companies`, for example from the "Insurance providers" tile on `/coverfi`.
