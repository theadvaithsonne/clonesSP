# `lib/office-api.ts`

> Creates a shared axios client for the external NetworkChains "office" API and attaches the office bearer token to every browser request.

**Kind:** frontend library · **Lines:** 14

## Purpose
The office feature (`components/office/*`, `context/office/AuthContext.tsx`) talks to a separate backend that is **not part of this repository**: the NetworkChains office API. This file is the single place where that client is set up, so its base URL and auth header are configured once.

## How it works
- `axios.create` is called with `baseURL` set to `process.env.NEXT_PUBLIC_OFFICE_API_URL`. If that variable is unset, it falls back to the hardcoded `https://backend.networkchains.com`.
- A request interceptor runs before each call. In the browser (`typeof window !== 'undefined'`) it reads `office_access_token` from `localStorage` and, when present, sets `Authorization: Bearer <token>`. During SSR it does nothing, so server-side calls go out without auth.
- There is no response interceptor: 401s and other errors go straight back to the caller.

## Exports
- `officeApi: AxiosInstance` - the preconfigured axios instance. Callers use `officeApi.get/post/...` with paths relative to the office API.

## Interfaces
- **External services:** NetworkChains office API (`NEXT_PUBLIC_OFFICE_API_URL`, default `https://backend.networkchains.com`).
- **Environment variables:** `NEXT_PUBLIC_OFFICE_API_URL` - base URL of the office API.
- **Browser storage / cookies:** reads `localStorage["office_access_token"]`. This is not the main Garage token (`garage_tok` / `auth-token`); the office auth context stores it separately.

## Dependencies
- **Internal:** none
- **Packages:** `axios` - HTTP client with interceptors.

## Used by
- `components/office/ChatPanel.tsx`
- `components/office/InviteModal.tsx`
- `context/office/AuthContext.tsx` - which presumably logs in and stores `office_access_token`.

## Notes
- Requests to this client never hit the combined app's `/backend/*` Express server.
