# `lib/coverfi/brokerage-api.ts`

> Typed client functions for the brokerage's own profile, branding, public landing page, branch locations and stakeholder assignments in the external Coverfi backend.

**Kind:** frontend library · **Lines:** 86

## Purpose
In Coverfi a "brokerage" is the insurance broker business tied to the current Garage organisation. This module wraps the `/v1/coverfi/brokerage/*` endpoints that the brokerage settings screens use: profile form, branding form, landing-page builder, locations table and stakeholders table. Every call goes through `coverfiApi`, so it carries the Garage bearer token and goes to `NEXT_PUBLIC_COVERFI_API_URL`.

## How it works
Each function sends one request and, except where noted, unwraps the `ApiResult.data` field. The `brokerageId`/`orgId` scope is not sent by the client; the Coverfi backend presumably derives it from the token.

| Function | Request (Coverfi backend) | Returns |
|---|---|---|
| `getBrokerage()` | `GET /v1/coverfi/brokerage/profile` | `Brokerage \| null` |
| `patchBrokerageProfile(patch)` | `PATCH .../profile` | `Brokerage` |
| `patchBrokerageBranding(patch)` | `PATCH .../branding` | `Brokerage` |
| `saveLandingPage(patch)` | `PATCH .../landing-page` | `Brokerage` |
| `publishLandingPage()` | `POST .../landing-page/publish` (body `{}`) | `Brokerage` |
| `listLocations()` | `GET .../location` | `BrokerageLocation[]` |
| `createLocation(body)` | `POST .../location` | `BrokerageLocation` |
| `updateLocation(id, patch)` | `PATCH .../location/:id` | `BrokerageLocation` |
| `deleteLocation(id)` | `DELETE .../location/:id` | raw `ApiResult<null>` |
| `listStakeholders()` | `GET .../stakeholders` | `Stakeholder[]` |
| `updateStakeholderAssignment(userId, { role_id?, branch_id? })` | `PATCH .../stakeholders/:userId/assignment` | raw `ApiResult<unknown>` |

`createLocation` takes a `BrokerageLocation` without `_id`, `brokerageId`, `orgId`, `createdAt` or `updatedAt`. In `updateStakeholderAssignment`, sending `null` for a field clears that assignment.

## Exports
`getBrokerage`, `patchBrokerageProfile`, `patchBrokerageBranding`, `saveLandingPage`, `publishLandingPage`, `listLocations`, `createLocation`, `updateLocation`, `deleteLocation`, `listStakeholders`, `updateStakeholderAssignment`. All are described in the table above.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL` (not part of this repo).

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `Brokerage`, `BrokerageLocation`, `Stakeholder`.

## Used by
`components/coverfi/brokerage/BrandingForm.tsx`, `LandingPageBuilder.tsx`, `LocationFormDialog.tsx`, `LocationsTable.tsx`, `ProfileForm.tsx` and `StakeholdersTable.tsx`.

## Notes
- Stakeholders are read-only here. They are Garage org members with `role: "stakeholder"`, managed through Garage's invite flow; Coverfi only attaches a Coverfi role label and a branch to them.
- Brokerage "locations" (`/brokerage/location`) are a different resource from "office locations" (`/locations`, see `office-locations-api.ts`).
