# `server/utils/geocoding.ts`

> Module exporting `getCoordinatesFromAddress`, `countryToIso2`, `resolvePostalCode`.

**Kind:** backend utility · **Lines:** 384

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getCoordinatesFromAddress` | function | `async getCoordinatesFromAddress(addressComponents: { streetAddress?: string; city: string; …): Promise<{ latitude: number; longitude: number } \|…` | 1 |
| `countryToIso2` | function | `countryToIso2(country?: string \| null): string \| undefined` | 156 |
| `resolvePostalCode` | function | `async resolvePostalCode(postalCode: string, country?: string): Promise<{ city: string; state: string; country: s…` | 192 |

## Interfaces

- **External HTTP calls:**
  - `GET https://api.zippopotam.us/${candidate.toLowerCase()}/${encodeURIComponent(lookup)}` (L298)
  - `GET https://api.postalpincode.in/pincode/${code}` (L341)
- **Environment variables (`process.env`):** `GOOGLE_MAPS_API_KEY`
- **External hosts mentioned in the code:** `maps.googleapis.com`, `api.zippopotam.us`, `api.postalpincode.in`, `nominatim.openstreetmap.org`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/controllers/coworkingSpace.controller.ts`
- `server/routes/org.ts`
- `server/routes/profile.ts`
- `server/routes/public.ts`
