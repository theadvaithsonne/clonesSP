# `app/(dashboard)/coverfi/companies/new/page.tsx`

> Thin route file that renders the wizard for creating a new Coverfi customer company.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/companies/new`

## Purpose
This route starts the "add a customer company" flow, which captures the POC, address and enrolled products. The file only binds the URL to `CompanyWizard`. When the wizard finishes, it navigates to `/coverfi/companies/<companyId>`.

## How it works
`NewCompanyPage()` returns `<CompanyWizard />`. Because `new` is a static segment, it takes precedence over the sibling dynamic `companies/[id]` route. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default NewCompanyPage()` - renders the company-creation wizard.

## Dependencies
- **Internal:** `components/coverfi/companies/CompanyWizard.tsx` - the multi-step creation form that calls the external Coverfi API.

## Used by
No file imports it. It is reached at `/coverfi/companies/new`, for example from the "Add a customer company" card on `/coverfi`.
