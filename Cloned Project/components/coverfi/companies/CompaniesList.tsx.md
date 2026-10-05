# `components/coverfi/companies/CompaniesList.tsx`

> Client component that lists a Coverfi brokerage's customer companies in a table, with links to each company and a delete action.

**Kind:** React component · **Lines:** 157

## Purpose
Coverfi is the insurance-brokerage module of the app. A "customer company" is a business the brokerage sells insurance products to. This component is the index screen for those companies: it loads them from the external Coverfi API, shows one row per company, and links to the creation wizard and the per-company detail page.

## How it works
- State: `rows` (`Company[]`) and `loading`. `refresh()` calls `listCompanies()` and shows a `sonner` error toast on failure; it runs once on mount.
- Header: `PageHeader` with eyebrow "Coverfi · Customers", title "Customer Companies" and a "New company" button linking to `/coverfi/companies/new`.
- Table columns:
  - **Logo**: `company_logo` as an `<img>`, or a `Building2` placeholder icon.
  - **Name**: `display_name`, falling back to `legal_name`, then "Unnamed". Links to `/coverfi/companies/<_id>`.
  - **Industry**, or an em dash when empty.
  - **POC**: point-of-contact first/last name with the email below it. An em dash appears when neither first name nor email is set.
  - **Enrollments**: count of `enrolled_products`.
  - **Delete**: a trash button.
- The table shows a "Loading…" row while fetching and "No customer companies yet." when the list is empty.
- `onDelete(c)` asks for a native `confirm()` naming the legal name, calls `deleteCompany(c._id)`, shows a success toast and reloads the list.

## Exports
- `default CompaniesList()`: the company list screen. Takes no props.

## Interfaces
- **External services:** the Coverfi API at `NEXT_PUBLIC_COVERFI_API_URL` (default `http://localhost:4100`). It is not part of this repo's Express server. Calls are made through `coverfiApi`, which adds the bearer token from `getToken()`:
  - `GET /v1/coverfi/company/all`: list the companies.
  - `DELETE /v1/coverfi/company/delete/:id`: remove a company.

## Dependencies
- **Internal:** `components/coverfi/PageHeader.tsx` (page header), `components/ui/button.tsx` and `components/ui/table.tsx` (shadcn UI), `lib/coverfi/companies-api.ts` (`listCompanies`, `deleteCompany`), `lib/coverfi/types.ts` (`Company`).
- **Packages:** `react` (state and effect), `next` (`Link`), `lucide-react` (icons), `sonner` (toasts).

## Used by
- `app/(dashboard)/coverfi/companies/page.tsx`, which serves the URL `/coverfi/companies`.

## Notes
- `ImageIcon` is imported but never used.
- Delete has no optimistic update. The whole list reloads after each delete.
