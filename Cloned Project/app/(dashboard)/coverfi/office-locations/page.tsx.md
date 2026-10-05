# `app/(dashboard)/coverfi/office-locations/page.tsx`

> Thin route file that renders the Coverfi Office Locations table.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/office-locations`

## Purpose
This route manages office locations through `OfficeLocationsTable`, backed by the external Coverfi API (`lib/coverfi/office-locations-api.ts`, base path `/v1/coverfi/locations`).

## How it works
`OfficeLocationsPage()` returns `<OfficeLocationsTable />`. The page has no logic of its own. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default OfficeLocationsPage()` - renders the office-locations table.

## Dependencies
- **Internal:** `components/coverfi/office-locations/OfficeLocationsTable.tsx` - the location list and CRUD.

## Used by
No file imports it. It is reached at `/coverfi/office-locations`, through Coverfi navigation.

## Notes
This page is distinct from the brokerage "Locations" tab (`/coverfi/brokerage/locations`, `components/coverfi/brokerage/LocationsTable.tsx`). The two screens use different components.
