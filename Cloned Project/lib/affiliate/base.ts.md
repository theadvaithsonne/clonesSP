# `lib/affiliate/base.ts`

> A small `fetch` wrapper (`api()`) for the ported 1Network affiliate feature, with its own base URL and an auth fallback chain that ends at the garage-admin token.

**Kind:** frontend library · **Lines:** 67

## Purpose
The affiliate "Links" feature was ported from the NetworkChains (NC) app. This file copies the shape of the main `api()` helper in `lib/api.ts`, so the ported code only needed its import changed from `@/lib/api` to `@/lib/affiliate/base`. The header comment says every affiliate, feed and org call goes to the Garage backend, not NC's own backend. NC and Garage share a JWT secret and a user database, so an NC token works on Garage.

## How it works
- `GARAGE_API_URL` is `NEXT_PUBLIC_GARAGE_API_URL`, or `https://test.garage.app` if that is unset. Unlike `lib/api.ts`, it does **not** use `NEXT_PUBLIC_API_URL`, so in this merged project it only reaches the in-process `/backend` if `NEXT_PUBLIC_GARAGE_API_URL` points there.
- `api<T>(path, opts, token?)` picks a bearer token in this order:
  1. the explicit `token` argument
  2. `getToken()` (the consumer session `garage_tok`)
  3. `getAdminToken()` (the garage-admin console's `garage_admin_token`)

  The admin fallback exists for screens like the admin funnel CTA product picker, which have no consumer session. The backend accepts the admin token on these routes and maps it to the admin's own user record.
- It sets `Content-Type: application/json` unless the body is `FormData`. Headers passed in `opts.headers` override the defaults. Every request uses `cache: "no-store"`.
- If the network fails (no response at all), it reports the error to Sentry with tags `feature: affiliate, action: request` and rethrows.
- If the response is not OK, it reads the body. The error message is the JSON `error` or `message` field, or `Server error (<status>)` if neither exists. Status 500 and above is also sent to Sentry, with the URL, method and status. Every non-OK response throws an `Error`.
- A successful response is returned as parsed JSON.

## Exports
- `GARAGE_API_URL: string` - base URL for every affiliate request.
- `api<T>(path: string, opts?: RequestInit, token?: string): Promise<T>` - JSON fetch with auth fallback and Sentry reporting. Throws on any non-2xx response.

## Interfaces
- **Environment variables:** `NEXT_PUBLIC_GARAGE_API_URL` - backend base URL (default `https://test.garage.app`).
- **Browser storage / cookies:** reads the localStorage keys `garage_tok` and `garage_admin_token` through `lib/auth.ts`.
- **External services:** Sentry (error capture). It also calls `https://test.garage.app` when the env var is unset.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken`, `getAdminToken`.
- **Packages:** `@sentry/nextjs` - exception capture.

## Used by
- `lib/affiliate/links-api.ts` (the only importer).

## Notes
- The default host is a remote test server, not this app's `/backend`. If `NEXT_PUBLIC_GARAGE_API_URL` is unset, calls made by the Links page leave this deployment.
- Unlike `lib/api.ts`'s `api()`, this helper does not accept absolute URLs in `path`. It always prefixes `GARAGE_API_URL`.
