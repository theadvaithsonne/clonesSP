# `app/(dashboard)/coverfi/products/page.tsx`

> Next.js page for the Coverfi product list (the default "Products" tab); it only renders `ProductsList`.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/products`

## Purpose
This is the landing route of the Coverfi catalogue. It shows the table of insurance products, each linking to its detail page at `/coverfi/products/<id>`.

## How it works
A server component with no logic: it returns `<ProductsList />`. That component loads products and insurance companies through `lib/coverfi/products-api.ts` (`/v1/coverfi/products`) and `lib/coverfi/insurance-api.ts`. When it creates a draft product it sends the user to `/coverfi/products/<draft id>`.

The surrounding layouts add the rest:
- `app/(dashboard)/coverfi/layout.tsx` - founder-only access (others are redirected to `/`), the `coverfi-skin` styling and `CoverfiPasswordGate`.
- `app/(dashboard)/coverfi/products/layout.tsx` - the "Products" header and the Products/Categories/Filters tabs.

## Exports
- `default ProductsPage()` - the page component.

## Interfaces
- **External services:** the Coverfi API (base URL from `NEXT_PUBLIC_COVERFI_API_URL`, used through `lib/coverfi/api.ts`). It is not part of this repo's Express backend.

## Dependencies
- **Internal:** `components/coverfi/products/ProductsList.tsx` - the product table and its actions.

## Used by
Nothing imports it. Next.js serves it at `/coverfi/products`. The "Products" tab in `ProductsTabs` links here.
