# `app/(dashboard)/coverfi/products/filters/page.tsx`

> Next.js page for the "Filters" tab of the Coverfi product catalogue; it only renders `FilterTypesPanel`.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/products/filters`

## Purpose
Coverfi is the insurance-catalogue module of the dashboard. Its Products area has three tabs (Products, Categories, Filters). This file is the route entry for the Filters tab, where founders manage filter types (for example "Coverage type") and the filter items under them that describe products.

## How it works
A server component with no logic: it returns `<FilterTypesPanel />`. All data loading, dialogs and create/edit/delete actions live in that component, which talks to the Coverfi API through `lib/coverfi/products-api.ts` (paths under `/v1/coverfi/filter`).

The page renders inside two layouts:
- `app/(dashboard)/coverfi/layout.tsx` - founder-only check (`useAmIFounder`, non-founders are sent to `/`), the `coverfi-skin` body class, and `CoverfiPasswordGate`.
- `app/(dashboard)/coverfi/products/layout.tsx` - the "Products" page header and the `ProductsTabs` strip, which highlights "Filters" for this path.

## Exports
- `default ProductFiltersPage()` - the page component.

## Interfaces
- **External services:** the Coverfi API (base URL from `NEXT_PUBLIC_COVERFI_API_URL`, used by `FilterTypesPanel` through `lib/coverfi/api.ts`). It is not part of this repo's Express backend.

## Dependencies
- **Internal:** `components/coverfi/products/FilterTypesPanel.tsx` - the whole UI for this tab.

## Used by
Nothing imports it. Next.js serves it at `/coverfi/products/filters` (the `(dashboard)` group does not appear in the URL). It is reached from the "Filters" tab in `ProductsTabs`.
