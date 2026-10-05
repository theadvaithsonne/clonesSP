# `app/(dashboard)/coverfi/companies/[id]/page.tsx`

> Dynamic route that unwraps the company id from the URL and renders the Coverfi customer-company detail view.

**Kind:** Next.js page · **Lines:** 14 · **Route:** `/coverfi/companies/[id]`

## Purpose
This is the detail screen for one Coverfi customer company. The file only extracts `id` and passes it to `CompanyDetail`. That component loads the company (`getCompany(id)` → `GET /v1/coverfi/company/:id` on the external Coverfi API) and manages its employees, for example through `CompanyEmployeeFormDialog`.

## How it works
- A client component.
- `params` is a `Promise<{ id: string }>` (Next.js 15). The page unwraps it with React's `use(params)` and renders `<CompanyDetail companyId={id} />`.
- `/coverfi/companies/new` is a static sibling route, so it does not reach this page.

## Exports
- `default CompanyDetailPage({ params })` - `params: Promise<{ id: string }>`.

## Dependencies
- **Internal:** `components/coverfi/companies/CompanyDetail.tsx` - the company detail UI.
- **Packages:** `react` (`use`).

## Used by
No file imports it. It is reached at `/coverfi/companies/<id>`, from `CompaniesList` rows and from the redirect at the end of `CompanyWizard`.
