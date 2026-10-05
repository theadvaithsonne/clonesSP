# `app/(dashboard)/coverfi/products/categories/page.tsx`

> Thin route file that renders the table of Coverfi product categories.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/products/categories`

## Purpose
Coverfi products are grouped into categories, which the product wizard uses. This route manages those categories by binding the URL to `CategoriesTable`. The table reads and writes through the external Coverfi API (`lib/coverfi/products-api.ts`, base path `/v1/coverfi/categories`).

## How it works
`ProductCategoriesPage()` returns `<CategoriesTable />`. The static `categories` segment takes precedence over the sibling dynamic `products/[id]` route. It renders inside `coverfi/products/layout.tsx` and `coverfi/layout.tsx` (access control).

## Exports
- `default ProductCategoriesPage()` - renders the categories table.

## Dependencies
- **Internal:** `components/coverfi/products/CategoriesTable.tsx` - the category list and CRUD.

## Used by
No file imports it. It is reached at `/coverfi/products/categories`, through the Coverfi products navigation.
