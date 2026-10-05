# `lib/kasm-api.ts`

> Typed client for the Kasm Workspaces public API (the "Deskstream" virtual-desktop service), routed through the app's own `/api/kasm-proxy` Next.js route.

**Kind:** frontend library · **Lines:** 244

## Purpose
The Deskstream page lets users list, start, stop, restart, inspect and create Kasm virtual-desktop sessions hosted on an external Kasm server (`https://deskstream.garage.app`). Browsers cannot call that server directly because of CORS, so this module sends every request to the same-origin proxy `app/api/kasm-proxy/[...path]/route.ts`, which forwards it to Kasm's `/api/public/<endpoint>` and attaches the API credentials server-side. The file also defines the TypeScript shapes of Kasm session objects.

## How it works
- **Configuration (`KASM_CONFIG`, L71-L78):** base URL, a Kasm API key and API secret (hard-coded, see Notes), `useProxy: true` and `proxyUrl: '/api/kasm-proxy'`.
- **`kasmApiCall<T>(endpoint, options)` (L106-L158, private):** builds the URL as `/api/kasm-proxy<endpoint>` (or, only if `useProxy` were false, `<baseUrl>/api/public<endpoint>` with auth headers). With the proxy, only caller headers are sent. Non-2xx responses become `{ success: false, data: null, error: "Kasm API error: <status> ..." }`; a `TypeError` "Failed to fetch" becomes a `CORS_ERROR:` message; successful responses return `{ success: true, data: <json> }`. It never throws.
- **Direct-mode helpers (unused while `useProxy` is true):** `getKasmAuthHeaders()` builds `Authorization`/`X-API-Key`/`X-Timestamp`/`X-Nonce` headers using a base64 string of key, timestamp, nonce and secret (the comment admits this is a simplified stand-in for real HMAC; it relies on Node's `Buffer`). `getKasmAuthData()` returns the key/secret JSON body fields and is not called anywhere in this file.
- **`kasmApi` operations (L161-L244):** Kasm has no pause/resume, so several methods map onto the same two calls:
  - `getSessions()` - GET `/get_kasms`.
  - `getSession(sessionId, userId?)` - POST `/get_kasm_status` with `{ kasm_id, user_id }`.
  - `startSession`, `resumeSession` - POST `/request_kasm` with `{ kasm_id }`.
  - `stopSession`, `pauseSession`, `deleteSession` - POST `/destroy_kasm` with `{ kasm_id }` (pause is really a destroy).
  - `restartSession` - `/destroy_kasm` then `/request_kasm`; the destroy result is ignored.
  - `createSession({ image_id, user_id, zone_name? })` - POST `/request_kasm`, `zone_name` defaulting to `"default"`.

## Exports
- `interface KasmSession` - a Kasm session: ids, user, image, server, dates, resources, `operational_status`, optional `kasm_url`/`share_id`/`port_map`/`client_settings` flags.
- `interface KasmApiResponse<T>` - `{ success, data, message?, error? }` wrapper returned by every call.
- `interface KasmSessionListResponse` - `{ kasms: KasmSession[]; current_time }`.
- `kasmApi` - object of async methods listed above.

## Interfaces
- **Endpoints called:** same-origin Next.js route handler `/api/kasm-proxy/<endpoint>` (GET/POST), which forwards to Kasm.
- **External services:** Kasm Workspaces server at `https://deskstream.garage.app` (`/api/public/get_kasms`, `get_kasm_status`, `request_kasm`, `destroy_kasm`), reached via the proxy.

## Dependencies
- None internal or npm; uses global `fetch` (and `Buffer` in the unused direct-auth path).

## Used by
- `components/dashboard/DeskstreamPage.tsx` - the Deskstream dashboard (list, actions, status polling, create).

## Notes
- **Hard-coded secrets:** a Kasm API key (L73) and API secret (L74) are committed in source in a file that is bundled into client code, so they ship to every browser. The proxy route `app/api/kasm-proxy/[...path]/route.ts` hard-codes the same pair (L6-L7). These should be moved to server-only environment variables and rotated.
- `pauseSession` destroys the session; any unsaved desktop state is lost unless Kasm persistent profiles are enabled.
- The comment on L110 says the proxy is for development only, but `useProxy` is unconditionally `true`.
- See `KASM_INTEGRATION.md` in the original frontend repo for integration background.
