# `lib/hooks/useGlobeData.ts`

> A hook that loads the public datasets behind the Discover globe (HQ organisations, founders and stakeholders) and derives per-country groupings and ticker messages for each tab.

**Kind:** React hook · **Lines:** 189

## Purpose
The Discover section has an interactive 3D globe (`components/discover/globe/GlobeView.tsx`) with three tabs: **hqs**, **founders** and **stakeholders**. Each tab plots entities that have coordinates and runs a scrolling ticker of names and locations. This hook fetches the three lists from public (unauthenticated) backend endpoints and converts them into the shapes the globe and ticker render.

## How it works
- **Fetch (`fetchData`).** On mount it requests all three endpoints in parallel with `Promise.all`. Each list is stored only if its response has `success: true`. Any thrown error sets `error` (message, or "Failed to fetch data") and logs to the console; `loading` is cleared either way. Because `Promise.all` is used, one failing request means none of the three lists is updated.
- **`getCountryGroups(tab)`.** Picks the list for the tab, keeps only items where `isValidCoordinate(latitude, longitude)` passes (both defined, numeric and in range), groups them by `country` (missing country becomes `"Unknown"`) with a `countryCode` from `getCountryCode()` (`"XX"` when unmapped), and returns the groups sorted alphabetically by country name.
- **`getTickerMessages(tab)`.** Builds one `TickerMessage` per entity, coordinates or not:
  - HQs: `"<org name> - <city, state, country>"` with the org icon;
  - founders and stakeholders: `"<name> - <first org name> - <location>"` with the profile picture; `companyName` falls back to the person's name.
  The location comes from `getEntityLocation()` (`"Unknown Location"` when empty).
- Both derivations are memoised with `useCallback` on the three lists.

## Exports
- `useGlobeData(): UseGlobeDataReturn` - returns `{ hqOrganizations, founders, stakeholders, loading, error, refetch, getCountryGroups(tab), getTickerMessages(tab) }`. The return interface itself is not exported.

## Interfaces
- **Backend endpoints called** (all in `server/routes/public.ts`, mounted at `/public`, no auth):
  - `GET /backend/public/hq-organizations` - HQ organisations with location data.
  - `GET /backend/public/all-founders` - founders with location and organisations.
  - `GET /backend/public/all-stakeholders` - stakeholders with location and organisations.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (sends the session token if one exists, but these routes do not need it); `components/discover/globe/types.ts` - entity and response types, `TabType`, `getCountryCode`, `isValidCoordinate`, `getEntityLocation`.
- **Packages:** `react` - state, effects, callbacks.

## Used by
- `components/discover/globe/GlobeView.tsx`

## Notes
- These endpoints are public and return people's names, profile pictures and city-level locations. Review what the backend exposes there before adding fields.
