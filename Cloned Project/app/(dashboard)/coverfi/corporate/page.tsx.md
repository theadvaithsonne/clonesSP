# `app/(dashboard)/coverfi/corporate/page.tsx`

> Thin route file that renders the list of Coverfi corporate records.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/corporate`

## Purpose
"Corporate" is a separate Coverfi entity from "companies", with its own API module (`lib/coverfi/corporate-api.ts`, base path `/v1/coverfi/corporate`). It has a four-step setup (info, address, employees, products). This route lists corporates by binding the URL to `CorporateList`.

## How it works
`CorporatePage()` returns `<CorporateList />`. The page has no logic of its own. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default CorporatePage()` - renders the corporate list.

## Dependencies
- **Internal:** `components/coverfi/corporate/CorporateList.tsx` - the corporate list.

## Used by
No file imports it. It is reached at `/coverfi/corporate`, through Coverfi navigation.
