# `app/(dashboard)/coverfi/brokerage/branding/page.tsx`

> Thin route file that renders the brokerage Branding form.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/brokerage/branding`

## Purpose
This is the "Branding" tab of the Coverfi brokerage settings. The file only binds the URL to `BrandingForm`. The component holds all logic and saves through the external Coverfi API (brokerage endpoints under `/v1/coverfi/brokerage`).

## How it works
`BrokerageBrandingPage()` returns `<BrandingForm />`. The page has no props, state or fetching of its own. The header and tabs come from `coverfi/brokerage/layout.tsx`. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default BrokerageBrandingPage()` - renders the branding form.

## Dependencies
- **Internal:** `components/coverfi/brokerage/BrandingForm.tsx` - the branding editor.

## Used by
No file imports it. It is reached at `/coverfi/brokerage/branding` through the "Branding" tab in `components/coverfi/brokerage/BrokerageTabs.tsx`.
