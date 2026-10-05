# `app/(dashboard)/coverfi/products/layout.tsx`

> Shared layout for every Coverfi Products route: a fixed "Products" header, the Products/Categories/Filters tab strip, and a scrolling content area.

**Kind:** Next.js layout · **Lines:** 24 · **Route:** `/coverfi/products`

## Purpose
The Coverfi catalogue has several routes under `/coverfi/products`: the product list, the per-product pages (`[id]`), `categories` and `filters`. This layout gives them all the same header and tab navigation, so each child page only renders its own panel.

## How it works
It renders a full-height flex column:
1. `PageHeader` with eyebrow "Coverfi · Catalog", title "Products", a one-line description ("Define products, the categories that group them, and the filters that describe them."), a `ShieldCheck` icon, and `noDivider` so the header's bottom border does not double up with the tab strip below.
2. `ProductsTabs` - links to `/coverfi/products`, `/coverfi/products/categories` and `/coverfi/products/filters`. The "Products" tab also stays active on deeper product pages such as `/coverfi/products/<id>`, but not on the two sibling tabs.
3. A `flex-1 overflow-auto` wrapper around `children`, so only the page body scrolls and the header and tabs stay put.

It has no state and no data fetching. It is a server component (no `"use client"`); `ProductsTabs` is a client component because it reads `usePathname()`.

This layout sits inside `app/(dashboard)/coverfi/layout.tsx`, which applies the founder-only check, the `coverfi-skin` styling and `CoverfiPasswordGate`.

## Exports
- `default ProductsLayout({ children }: { children: React.ReactNode })` - the layout component.

## Dependencies
- **Internal:** `components/coverfi/PageHeader.tsx` - the standard Coverfi page header; `components/coverfi/products/ProductsTabs.tsx` - the tab strip.
- **Packages:** `lucide-react` - the `ShieldCheck` icon.

## Used by
Nothing imports it. Next.js applies it to every route under `/coverfi/products`, including `page.tsx`, `[id]`, `categories` and `filters`.
