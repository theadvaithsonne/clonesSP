# `app/(dashboard)/coverfi/companies/page.tsx`

> Thin route file that renders the list of Coverfi customer companies.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/companies`

## Purpose
Customer companies are the businesses a brokerage insures. This route lists them by binding the URL to `CompaniesList`, which loads the data from the external Coverfi API (`listCompanies()` → `GET /v1/coverfi/company/all`).

## How it works
`CompaniesPage()` returns `<CompaniesList />`. The page has no logic of its own. Access control (founder check and password gate) comes from `app/(dashboard)/coverfi/layout.tsx`.

## Exports
- `default CompaniesPage()` - renders the companies list.

## Dependencies
- **Internal:** `components/coverfi/companies/CompaniesList.tsx` - the company list.

## Used by
No file imports it. It is reached at `/coverfi/companies`, for example from the "Customer companies" tile on `/coverfi`.
