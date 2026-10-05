# `app/(dashboard)/coverfi/brokerage/locations/page.tsx`

> Thin route file that renders the brokerage Locations table.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/brokerage/locations`

## Purpose
This is the "Locations" tab of the Coverfi brokerage settings. The file only binds the URL to `LocationsTable`, which lists the brokerage's branches and edits them through `LocationFormDialog` against the external Coverfi API.

## How it works
`BrokerageLocationsPage()` returns `<LocationsTable />`. The page has no logic of its own. The header and tabs come from `coverfi/brokerage/layout.tsx`. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default BrokerageLocationsPage()` - renders the locations table.

## Dependencies
- **Internal:** `components/coverfi/brokerage/LocationsTable.tsx` - the brokerage location list and CRUD.

## Used by
No file imports it. It is reached at `/coverfi/brokerage/locations` through the "Locations" tab in `components/coverfi/brokerage/BrokerageTabs.tsx`.

## Notes
This page is separate from `/coverfi/office-locations` (`OfficeLocationsTable`), which is a different screen backed by `lib/coverfi/office-locations-api.ts`.
