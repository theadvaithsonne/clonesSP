# `components/coverfi/products/ProductsTabs.tsx`

> Tab bar for the Coverfi Products section that links Products, Categories and Filters and highlights the active tab.

**Kind:** React component · **Lines:** 48

## Purpose
The Coverfi Products area has three sibling pages. This component draws the tab strip under the Products page header so users can move between them. It is mounted once in the products layout, so it shows on every page under `/coverfi/products`.

## How it works
- A static `tabs` array holds the three entries: `/coverfi/products` (Products), `/coverfi/products/categories` (Categories) and `/coverfi/products/filters` (Filters).
- `usePathname()` gives the current path (or `""`), which decides which tab is active:
  - **Products** is active on `/coverfi/products` itself and on any deeper product page, such as the wizard at `/coverfi/products/[id]`, **unless** the path starts with `/categories` or `/filters`. Without that exclusion, the Products tab would light up on its sibling tabs too.
  - The other tabs are active on an exact match or any sub-path (`${href}/`).
- Each tab is a `next/link` `Link`. The active one gets a white label and a `border-brand` underline; the others are muted. Classes are merged with `cn`.

## Exports
- `default ProductsTabs()`: the tab navigation. It takes no props.

## Dependencies
- **Internal:** `lib/utils.ts` (`cn` class merger).
- **Packages:** `next` (`next/link`, `usePathname` from `next/navigation`).

## Used by
- `app/(dashboard)/coverfi/products/layout.tsx`, which renders it below the "Products" `PageHeader` for every route under `/coverfi/products`.
