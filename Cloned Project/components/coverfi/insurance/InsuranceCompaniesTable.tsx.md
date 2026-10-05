# `components/coverfi/insurance/InsuranceCompaniesTable.tsx`

> Client component that lists a brokerage's Coverfi insurance companies in a table and lets the user add, edit and delete them.

**Kind:** React component · **Lines:** 175

## Purpose
Coverfi is the insurance-brokerage module inside Garage. This component is the whole UI of the "Insurance Companies" catalog page: the insurance providers a brokerage works with. It loads the list from the external Coverfi API, renders it in a dark-themed shadcn table, and opens `InsuranceCompanyFormDialog` to create or edit an entry.

## How it works
- **State:** `rows` (the loaded `InsuranceCompany[]`), `loading`, `open` (dialog visibility) and `editing` (the row being edited, or `null` for "add").
- **Loading:** `refresh()` calls `listInsuranceCompanies()` on mount and after every save or delete. Failures show a `sonner` error toast with the server message, or "Failed to load insurance companies".
- **Header:** `PageHeader` with eyebrow "Coverfi · Catalog", an umbrella icon and an "Add" button that clears `editing` and opens the dialog.
- **Table columns:** logo thumbnail (an `<img>` when `logo` is set, otherwise an `ImageIcon` placeholder), name, country, product types, website, and edit/delete icon buttons. The table shows "Loading…" while fetching and "No insurance companies yet." when empty.
- **Product types:** shows the first four `product_type` values as `Badge`s, followed by a "+N" badge for the rest.
- **Country:** printed as stored. The form dialog saves the ISO code (for example `IN`), so this column shows codes, not country names.
- **Delete:** `onDelete` asks for confirmation with the browser's `confirm()`, then calls `deleteInsuranceCompany(row._id)`, shows a "Deleted" toast and refreshes.
- **Edit/Add:** sets `editing` and `open`. The dialog gets `onSaved={refresh}` so the list reloads after a successful save.

## Exports
- `default InsuranceCompaniesTable()` - the page body. Takes no props.

## Interfaces
- **External services:** the Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`), called through `lib/coverfi/insurance-api.ts`. It is not part of this repo's Express server.
  - `GET /v1/coverfi/insurance` - list companies
  - `DELETE /v1/coverfi/insurance/delete/:id` - delete a company
- **Browser storage / cookies:** the bearer token is read by `coverfiApi` via `getToken()` from `lib/auth`.

## Dependencies
- **Internal:**
  - `components/coverfi/PageHeader.tsx` - the shared Coverfi page header
  - `components/coverfi/insurance/InsuranceCompanyFormDialog.tsx` - the add/edit dialog
  - `components/ui/table.tsx`, `components/ui/button.tsx`, `components/ui/badge.tsx` - shadcn primitives
  - `lib/coverfi/insurance-api.ts` - `listInsuranceCompanies`, `deleteInsuranceCompany`
  - `lib/coverfi/types.ts` - the `InsuranceCompany` type
- **Packages:** `react` (state and effects), `lucide-react` (icons), `sonner` (toasts)

## Used by
- `app/(dashboard)/coverfi/insurance-companies/page.tsx`, which renders it as the whole page at the URL `/coverfi/insurance-companies`.

## Notes
- Deletion has no undo and uses the native `confirm()` dialog.
- The list is not paginated or filterable on the client. It shows whatever the Coverfi API returns.
