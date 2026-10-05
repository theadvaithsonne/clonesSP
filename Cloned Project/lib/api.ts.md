# `lib/api.ts`

> The app's main HTTP helper: `API_URL` (the backend base URL) and `api()`, a `fetch` wrapper that attaches the user's JWT and turns error responses into thrown `Error`s.

**Kind:** frontend library · **Lines:** 74

## Purpose
Almost every frontend file that talks to the Express backend imports `API_URL` or `api()` from here (about 300 importers). In the combined project `NEXT_PUBLIC_API_URL` is `<app origin>/backend`, so `api("/floors/roster?orgId=X")` becomes `GET /backend/floors/roster?orgId=X`, which `server/main.ts` hands to the Express app with the prefix removed.

## How it works
- **`API_URL`** is `process.env.NEXT_PUBLIC_API_URL`, falling back to `http://localhost:4000` (the old standalone backend port).
- **`api<T>(path, opts?, token?)`**:
  1. Picks the bearer token: the explicit `token` argument, otherwise `getToken()` (the `garage_tok` localStorage value from `lib/auth.ts`). With neither, it sends no `Authorization` header.
  2. Sets `Content-Type: application/json` unless `opts.body` is a `FormData`, so the browser can add the multipart boundary itself.
  3. Uses `path` as-is when it is already absolute (`http://`, `https://` or `//`). Otherwise it joins it to `API_URL`, normalising slashes on both sides.
  4. Calls `fetch` with `cache: "no-store"`. Headers passed in `opts.headers` override the defaults.
  5. A network failure is logged and re-thrown as `Failed to connect to API at <url>...`.
  6. A non-2xx response throws an `Error` carrying the body's JSON `error` or `message`, or `Server error (<status>)` if neither is present.
  7. On success it returns `res.json()`. It does not handle 204 or non-JSON bodies, so a success response without JSON makes the call throw.
- **`garageAdminApi<T>(path, opts?)`** works like `api()` but authenticates with the admin-console token from localStorage key `garage_admin_token`. It passes the token both as an explicit header and as the `token` argument.
- **`GARAGE_ADMIN_API_URL`** is a hard-coded constant pointing at `https://my.revenue.network`, an external service that the garage-admin revenue-network pages use.

## Exports
- `API_URL: string` - backend base URL (`NEXT_PUBLIC_API_URL`).
- `GARAGE_ADMIN_API_URL: string` - external revenue.network origin.
- `api<T>(path: string, opts?: RequestInit, token?: string): Promise<T>` - authed JSON fetch.
- `garageAdminApi<T>(path: string, opts?: RequestInit): Promise<T>` - the same call, authenticated with the garage-admin token.

## Interfaces
- **Backend endpoints called:** any. The callers supply the path (for example `/floors/roster` becomes `GET /backend/floors/roster`).
- **External services:** `https://my.revenue.network` (exported constant only).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL.
- **Browser storage / cookies:** reads localStorage `garage_admin_token` (`garageAdminApi`). Reads `garage_tok` indirectly through `getToken()`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()` for the consumer JWT.
- **Packages:** none.

## Used by
299 importers, including `app/(dashboard)/layout.tsx`, `app/(dashboard)/workspace/WorkspaceClient.tsx`, workspace hooks (`useFloors`, `useLocalMedia`, `useRecording`, `useMediasoupAudience`, `useWorkshopPreview`), auth pages (`app/(auth)/verify/page.tsx`, guest login and verify), onboarding pages (`organization`, `team`, `floor-plan`, `office-payment`, `downgrade`), affiliate pages, `app/(dashboard)/mail/page.tsx`, `app/(dashboard)/ask-cabinet/page.tsx`, and 274 more. Also used by other API clients in this folder, such as `lib/announcements.ts`, `lib/api/tickets.ts`, `lib/api/voice-memos.ts` and `lib/api/conference-notes.ts`.

## Notes
- The thrown error contains only a message. Callers that need the HTTP status code can't get it from here.
- Because the fallback is `http://localhost:4000`, a build without `NEXT_PUBLIC_API_URL` silently points at localhost.
