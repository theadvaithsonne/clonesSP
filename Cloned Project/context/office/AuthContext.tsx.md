# `context/office/AuthContext.tsx`

> Client-side auth context for the external "office" (networkchains) API: restores a session from a refresh cookie and exposes login, signup and logout.

**Kind:** React context · **Lines:** 86

## Purpose
The `components/office/*` area talks to a separate office/chat backend that is **not** part of this repo (base URL `NEXT_PUBLIC_OFFICE_API_URL`, via `lib/office-api.ts`). This context keeps that backend's user and access token separate from the main Garage auth (`store/authStore.tsx`, `garage_tok`). `context/office/SocketContext.tsx` depends on it to know when to open its socket.

## How it works
- State: `user` (`AuthUser | null`) and `loading` (starts `true`).
- **Session restore on mount:** `POST /api/auth/refresh` on the office API (relies on a refresh-token cookie set by that service). On success it stores `data.accessToken` in localStorage `office_access_token`, then `GET /api/auth/me` and sets `user` from `me.data.user`. Any failure removes the stored token. `loading` becomes `false` either way.
- **Forced logout:** listens for a `window` event `auth:logout` and clears `user`. The comment attributes this to an axios refresh interceptor, but `lib/office-api.ts` currently only has a request interceptor and nothing in the repo dispatches `auth:logout`.
- `login(email, password)` -> `POST /api/auth/login`; `signup(name, email, password)` -> `POST /api/auth/register`. Both store `data.accessToken` and set `user` from `data.user`. Errors propagate to the caller.
- `logout()` -> `POST /api/auth/logout` (errors swallowed), removes the token, clears `user`.
- The access token is attached to every office API request by the `officeApi` request interceptor (`Authorization: Bearer ...`).

## Exports
- `OfficeAuthProvider({ children })` - provider holding the office user session.
- `useOfficeAuth()` - returns `{ user, loading, login, signup, logout, setUser }`; throws if used outside `OfficeAuthProvider`.
- `interface AuthUser` - `{ _id, name, email, avatar?, status: 'online'|'away'|'busy'|'offline', officeId?, role: 'owner'|'admin'|'member' }`.

## Interfaces
- **External services:** office API at `NEXT_PUBLIC_OFFICE_API_URL` (default `https://backend.networkchains.com` in `lib/office-api.ts`): `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`.
- **Browser storage / cookies:** localStorage `office_access_token` (read by `lib/office-api.ts` and `SocketContext`); refresh-token cookie owned by the office service.
- **Environment variables:** `NEXT_PUBLIC_OFFICE_API_URL` (indirectly, via `lib/office-api.ts`).

## Dependencies
- **Internal:** `lib/office-api.ts` - preconfigured axios instance (`officeApi`) for the office backend.
- **Packages:** `react`.

## Used by
- `components/office/ChatPanel.tsx` (`useOfficeAuth`)
- `context/office/SocketContext.tsx` (`useOfficeAuth`)

## Notes
- `OfficeAuthProvider` is not rendered anywhere in the repo, and `components/office/ChatPanel.tsx` is not imported by anything, so this context currently appears unused at runtime. Any consumer mounted without the provider would throw.
