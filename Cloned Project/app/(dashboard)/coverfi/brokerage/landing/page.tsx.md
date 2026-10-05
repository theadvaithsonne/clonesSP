# `app/(dashboard)/coverfi/brokerage/landing/page.tsx`

> Thin route file that renders the builder for the brokerage's public landing page.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/brokerage/landing`

## Purpose
This is the "Landing Page" tab of the Coverfi brokerage settings. The file only binds the URL to `LandingPageBuilder`, which edits the content of the brokerage's public-facing page through the external Coverfi API.

## How it works
`BrokerageLandingPage()` returns `<LandingPageBuilder />`. The page has no logic of its own. The header and tabs come from `coverfi/brokerage/layout.tsx`. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default BrokerageLandingPage()` - renders the landing-page builder.

## Dependencies
- **Internal:** `components/coverfi/brokerage/LandingPageBuilder.tsx` - the landing-page editor.

## Used by
No file imports it. It is reached at `/coverfi/brokerage/landing` through the "Landing Page" tab in `components/coverfi/brokerage/BrokerageTabs.tsx`.
