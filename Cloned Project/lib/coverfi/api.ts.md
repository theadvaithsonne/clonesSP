# `lib/coverfi/api.ts`

> The base HTTP client for the Coverfi insurance-brokerage module: it sends authenticated JSON requests to the separate Coverfi backend.

**Kind:** frontend library · **Lines:** 45

## Purpose
Coverfi is an insurance-brokerage feature inside the Garage dashboard (route `/coverfi`). Its API is **not** part of this repository's Express server: it is a separate Coverfi backend reached through `NEXT_PUBLIC_COVERFI_API_URL`, which defaults to `http://localhost:4100`. That backend accepts the user's Garage JWT, so both share one login. Every `lib/coverfi/*-api.ts` module calls through `coverfiApi`.

## How it works
- `COVERFI_API_URL` is read once from the environment, with the localhost default.
- `coverfiApi<T>(path, opts)`:
  - reads the Garage token from `getToken()` (localStorage `garage_tok`) and adds `Authorization: Bearer <token>` when one is present;
  - sets `Content-Type: application/json` unless `opts.body` is `FormData`;
  - merges any headers the caller passed in after these defaults, so caller headers win;
  - always sends with `cache: "no-store"`;
  - when the response is not OK, reads the body text and, if it is JSON, uses its `error` or `message` field. It throws `Error(msg)`, falling back to `HTTP <status>`;
  - otherwise returns `res.json()` cast to `T`.
- Callers usually pass `ApiResult<X>` as `T` and then unwrap `.data`.

## Exports
- `COVERFI_API_URL: string` - the Coverfi backend base URL.
- `coverfiApi<T>(path: string, opts?: RequestInit): Promise<T>` - authenticated fetch helper.

## Interfaces
- **External services:** the Coverfi backend (separate service; all paths start `/v1/coverfi/...`). `app/(dashboard)/coverfi/page.tsx` calls `GET /v1/coverfi/health` directly through this helper.
- **Environment variables:** `NEXT_PUBLIC_COVERFI_API_URL` - Coverfi backend origin.
- **Browser storage / cookies:** reads the `garage_tok` localStorage token through `lib/auth.ts`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.

## Used by
`app/(dashboard)/coverfi/page.tsx` and the nine Coverfi API modules: `brokerage-api`, `communication-api`, `companies-api`, `corporate-api`, `insurance-api`, `office-locations-api`, `policy-settings-api`, `products-api` and `roles-api`.

## Notes
- If `NEXT_PUBLIC_COVERFI_API_URL` is not set in a deployed build, every Coverfi call goes to `http://localhost:4100` on the visitor's own machine and fails.
- The main Garage backend refers to Coverfi only in `server/routes/auth.ts` and `server/models/user.model.ts`. There, a flag on users provisioned by the Coverfi backend flips the first time they log in to Garage normally.
- File uploads for Coverfi forms do not use this client. They go to the Garage backend through `lib/coverfi/uploadFile.ts`.
