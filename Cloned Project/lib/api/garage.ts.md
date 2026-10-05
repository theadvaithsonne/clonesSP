# `lib/api/garage.ts`

> A small fetch client for the "Garage API" origin (`NEXT_PUBLIC_GARAGE_API_URL`), used to look up the current user's affiliate id, profile and offices.

**Kind:** frontend library · **Lines:** 106

## Purpose
This client was ported from the NetworkChains (NC) apps. NC and Garage share a JWT secret and user database, so an NC token is accepted by Garage's endpoints. The file calls Garage's affiliate and `/auth/me` endpoints on an origin configured separately from `NEXT_PUBLIC_API_URL`. Those routes exist in this repo's backend: `server/routes/affiliate.ts` (mounted at `/affiliate`) and the auth router (mounted at `/auth`). Whether `NEXT_PUBLIC_GARAGE_API_URL` points at this app's `/backend` depends on how it is deployed.

## How it works
- `GARAGE_API_URL` is `NEXT_PUBLIC_GARAGE_API_URL`, falling back to `https://test.garage.app`. Paths are joined to it directly, with no `/backend` prefix added.
- `garageApi<T>(path, opts?, authenticated = false)`:
  - Sets JSON `Content-Type` unless the body is `FormData`.
  - When `authenticated` is true, sends the consumer token (`getToken()`), or, only when there is no consumer session, the garage-admin console token (`getAdminToken()`). This lets the funnel CTA picker in the admin console call `fetchMyAffiliateId`. The comment says the backend maps an admin token to the admin's own user record. On the affiliate route that is the `requireUserOrGarageAdminAsUser` middleware.
  - `cache: "no-store"`. A non-OK response throws an `Error` whose message is the raw response text.
- `fetchMyAffiliateId()`: `GET /affiliate/my-affiliate-id` (authenticated). Returns `affiliateId` or `null`. Never throws.
- `fetchMyGarageProfile()`: `GET /auth/me`. Returns `{ id, email, name, profilePicture? }` or `null`. The header prefers this avatar over NC's own profile.
- `fetchMyOffices()`: `GET /auth/me`. Maps `user.organizations` to `{ id, name }` (id from `id` or `_id`, name defaulting to `"Office"`) and drops entries without an id. Returns `[]` on error. Used for the Leaderboard's office filter.

## Exports
- `garageApi<T>(path: string, opts?: RequestInit, authenticated?: boolean): Promise<T>`
- `fetchMyAffiliateId(): Promise<string | null>`
- `GarageMeUser` (interface) - `{ id, email, name, profilePicture? }`.
- `fetchMyGarageProfile(): Promise<GarageMeUser | null>`
- `GarageOffice` (interface) - `{ id, name }`.
- `fetchMyOffices(): Promise<GarageOffice[]>`

## Interfaces
- **Backend endpoints called** (on `NEXT_PUBLIC_GARAGE_API_URL`):
  - `GET /affiliate/my-affiliate-id` - served in this repo by `server/routes/affiliate.ts` (`requireUserOrGarageAdminAsUser`). From the browser it is `/backend/affiliate/my-affiliate-id`.
  - `GET /auth/me` - the auth router (browser path `/backend/auth/me`).
- **Environment variables:** `NEXT_PUBLIC_GARAGE_API_URL` - the Garage API origin.
- **Browser storage / cookies:** reads `garage_tok` (`getToken`) and `garage_admin_token` (`getAdminToken`) from localStorage.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken`, `getAdminToken`.
- **Packages:** none.

## Used by
- `components/garage/link-picker.tsx`
- `components/office/ControlBar.tsx`

## Notes
- If `NEXT_PUBLIC_GARAGE_API_URL` isn't set, calls go to the hard-coded test host `https://test.garage.app`, not to this app.
- Unless the env var already includes `/backend`, these paths won't reach the merged server on the app host, because only `BACKEND_HOSTS` serve backend routes at the root.
