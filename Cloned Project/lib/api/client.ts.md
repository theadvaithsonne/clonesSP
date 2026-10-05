# `lib/api/client.ts`

> A pre-configured axios instance that adds the user's JWT, clears the session on 401, surfaces server error messages and reports network or 5xx failures to Sentry.

**Kind:** frontend library · **Lines:** 55

## Purpose
This is the shared HTTP client for code ported from the NetworkChains apps. Its only importer is `lib/api/funnels.ts`. The fallback base URL is `https://backend.networkchains.com`, which shows where it came from.

## How it works
- `axios.create` with `baseURL` set to `NEXT_PUBLIC_API_URL` (fallback `https://backend.networkchains.com`) and a default JSON `Content-Type`.
- **Request interceptor:** adds `Authorization: Bearer <token>` when `getToken()` returns one.
- **Response error interceptor:**
  - On HTTP 401 in the browser it logs the error and calls `clearToken()`. That removes the session and org id from localStorage and fires the `garage:logout` window event. The interceptor doesn't navigate anywhere itself, despite the "redirect" wording in its log message.
  - If the response body has a non-empty string `error` or `message`, it replaces `error.message` with it, so toasts show the server's reason instead of axios's generic "Request failed with status code N".
  - It sends the error to Sentry (`Sentry.captureException`, tags `feature: api`, `action: request`, plus URL, method and status) when there was no response at all (network error or CORS) or the status is 500 or higher. 4xx errors are not reported.
  - It always re-rejects the error.

## Exports
- `default` - the axios instance (same object as `apiClient`).
- `apiClient` - the configured `AxiosInstance`.

## Interfaces
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base URL.
- **Browser storage / cookies:** reads `garage_tok` through `getToken()`. On a 401, `clearToken()` deletes it and the org id.
- **External services:** Sentry (error reporting). The fallback host `backend.networkchains.com` is external.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken`, `clearToken`.
- **Packages:** `axios` - the HTTP client. `@sentry/nextjs` - exception capture.

## Used by
- `lib/api/funnels.ts`.

## Notes
- Every importer of `lib/api/funnels.ts` imports only *types* from it, so `funnelsApi`, and with it this client, is never reached at runtime today.
- Any 401 from any call made through this client signs the user out of the main app, not just out of the feature that made the call.
