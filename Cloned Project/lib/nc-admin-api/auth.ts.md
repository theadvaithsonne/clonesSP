# `lib/nc-admin-api/auth.ts`

> Client-side auth and transport layer for the ported NetworkChains admin pages: it exchanges the Garage admin token for a NetworkChains (NC) admin token without a second login, then makes authorised requests to the external NC contacts-backend, re-elevating once if a request returns 401.

**Kind:** frontend library · **Lines:** 196

## Purpose
The pages under `/garage-admin/networkchains/*` were ported from the separate NetworkChains web app. They talk to **contacts-backend** (`https://backend.networkchains.com` by default), an external service, not to this repo's Express `server/`. That backend needs its own NC admin token. Instead of the NC OTP login, this module silently exchanges the Garage admin session token at `POST /admin/auth/elevate-garage`. Every other `lib/nc-admin-api/*` client sends its requests through this file.

## How it works
**Base URL.** `NC_API_URL = process.env.NEXT_PUBLIC_NC_API_URL ?? "https://backend.networkchains.com"`. This is deliberately a separate variable. In this app `NEXT_PUBLIC_API_URL` points at the Garage backend (`/backend`), so using it here would send every NC call to the wrong server, where it would fail with a silent 404.

**Token storage.** The NC token is cached in `localStorage["nc_admin_token"]`. The Garage token is read from `localStorage["garage_admin_token"]`, which `app/garage-admin/login/page.tsx` and `app/garage-admin/accept-invite/page.tsx` write. All accessors return or do nothing when `window` is undefined, which makes them safe during SSR.

**Elevation (`elevate`, private).** If no Garage token is stored, the result is `unavailable`. Otherwise it calls `POST ${NC_API_URL}/admin/auth/elevate-garage` with the Garage token as a `Bearer` header. The response maps to an `NcElevationResult`:
- 401 or 403 → `{ ok: false, reason: "unauthorized" }`. The operator holds no NetworkChains page in the Garage permission editor, or is no longer an active admin. The UI shows a refusal panel. This is also what someone hits by typing a `/garage-admin/networkchains` URL by hand after the sidebar has hidden the section.
- Any other non-OK status, a body without a token, or a network error → `{ ok: false, reason: "unavailable" }`. The UI shows a retry state, not a refusal.
- On success the token is stored and `{ ok: true, token }` is returned.

**De-duplication.** `ensureNcAdminToken()` returns the cached token if there is one. Otherwise it shares a single in-flight `elevating` promise, so N hooks mounting together trigger one elevation request. The promise is cleared in `finally`.

**Request with retry (`request`, private).** It gets a token, failing with `NcAdminUnauthorizedError` or with `NcAdminApiError(..., 503)` for `unavailable`. `call()` sets the `Authorization` header and adds `Content-Type: application/json` when there is a body and no content type is set. On a 401, the cached token is cleared, elevation runs again and the request is retried once. A second 401 clears the token and throws `NcAdminUnauthorizedError`, so this never loops.

**Response unwrapping.**
- `ncAdminFetch<T>` expects contacts-backend's `{ ok, data, error?, detail? }` envelope. It throws `NcAdminApiError(error || "Request failed (status)", status, detail)` on a non-2xx status, `ok === false` or a missing `data`, and returns `data`.
- `ncAdminFetchRaw<T>` is for endpoints without the envelope. It throws only on a non-2xx status and otherwise returns the whole body.

**Narrowing helper.** `isElevationFailure` is an explicit type predicate. The repo's tsconfig is non-strict (`strictNullChecks` off), so a plain `if (!result.ok)` check would not narrow the union correctly.

## Exports
- `NC_API_URL: string` - base URL of the NC contacts-backend.
- `class NcAdminUnauthorizedError extends Error` - the session is not authorised or has expired (thrown after the retry fails or elevation is refused).
- `class NcAdminApiError extends Error { status: number; detail?: string }` - generic NC API error carrying the HTTP status and, optionally, the upstream `detail` message. Callers such as `admin-sentry.ts` and `admin-posthog.ts` match on `message` exactly.
- `getNcAdminToken(): string | null`, `setNcAdminToken(token): void`, `clearNcAdminToken(): void` - access to the `nc_admin_token` localStorage entry.
- `type NcElevationResult` - `{ ok: true; token } | { ok: false; reason: "unauthorized" | "unavailable" }`.
- `ensureNcAdminToken(): Promise<NcElevationResult>` - returns the cached token or elevates (de-duplicated).
- `ncAdminFetch<T>(path, init?): Promise<T>` - authorised request that unwraps the envelope.
- `ncAdminFetchRaw<T>(path, init?): Promise<T>` - authorised request that returns the raw body.

## Interfaces
- **Backend endpoints called:** `POST {NC_API_URL}/admin/auth/elevate-garage` - exchanges the Garage admin token for an NC admin token. All other paths are supplied by callers.
- **External services:** NetworkChains contacts-backend (`backend.networkchains.com`).
- **Environment variables:** `NEXT_PUBLIC_NC_API_URL` - NC backend base URL override.
- **Browser storage / cookies:** localStorage `nc_admin_token` (read/write/remove), `garage_admin_token` (read only).

## Dependencies
- **Internal:** none.
- **Packages:** none (`fetch`, `Headers`, `localStorage`). Marked `"use client"`.

## Used by
Imported by 25 files, including all NetworkChains admin pages under `app/garage-admin/(admin-dashboard)/networkchains/` (ai-cost, axons, earngpt-learning, meet, meet/live, offerings, posthog, sentry, subscriptions, users), `components/nc-admin/nc-admin-gate.tsx` (the gate that renders the refusal or retry state from `ensureNcAdminToken`), `components/nc-admin/axons/*`, `components/nc-admin/users/*`, `lib/hooks/use-admin-funnels.ts`, `lib/hooks/use-admin-usage.ts`, and the sibling clients `admin.ts`, `admin-axons.ts`, `admin-funnels.ts`, `admin-posthog.ts` and `admin-sentry.ts`.

## Notes
- Security: the NC admin token lives in localStorage, so it is readable by any script on the origin. It is reused until a 401 arrives; there is no expiry check on the client.
- Whether access is granted is decided entirely by the NC backend's elevation endpoint. Client-side checks only shape the UI.
