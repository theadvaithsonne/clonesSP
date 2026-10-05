# `app/(dashboard)/coverfi/corporate/new/page.tsx`

> Thin route file that renders step 1 of creating a Coverfi corporate (basic info form).

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/corporate/new`

## Purpose
Creating a corporate is split into two routes. This page shows only the first step, `CorporateStep1Form`. When that form creates the record, it navigates to `/coverfi/corporate/<created._id>`, where `CorporateWizard` continues with steps 2-4 (address, employees, products).

## How it works
`NewCorporatePage()` returns `<CorporateStep1Form />`. The static `new` segment takes precedence over the sibling `corporate/[id]` route. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default NewCorporatePage()` - renders the first-step form.

## Dependencies
- **Internal:** `components/coverfi/corporate/CorporateStep1Form.tsx` - creates the corporate through the external Coverfi API.

## Used by
No file imports it. It is reached at `/coverfi/corporate/new`, typically from `CorporateList`.
