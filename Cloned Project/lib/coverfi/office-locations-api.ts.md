# `lib/coverfi/office-locations-api.ts`

> CRUD client for Coverfi office locations, served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 31

## Purpose
This module backs the office-locations table in the Coverfi dashboard. Office locations (`OfficeLocation`: name, full address, city, state, country, pincode, active flag) are a separate resource from the brokerage branch locations in `brokerage-api.ts`. Calls go through `coverfiApi`.

## How it works
Base path: `/v1/coverfi/locations`.
- `listOfficeLocations()` - `GET .../list`, returns `OfficeLocation[]`.
- `createOfficeLocation(body)` - `POST .../create`. The body excludes `_id`, `brokerageId`, `orgId`, the timestamps and `is_active`.
- `updateOfficeLocation(id, patch)` - `PATCH .../:id`.
- `deleteOfficeLocation(id)` - `DELETE .../:id`. Returns the raw `ApiResult<null>`.

## Exports
`listOfficeLocations`, `createOfficeLocation`, `updateOfficeLocation`, `deleteOfficeLocation`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `OfficeLocation`.

## Used by
`components/coverfi/office-locations/OfficeLocationsTable.tsx`.
