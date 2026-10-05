# `server/middleware/franchiseApiAuth.ts`

> Shared-secret Express guard for the franchise app's read API: it checks the `X-Franchise-API-Key` header against `FRANCHISE_API_KEY` in constant time.

**Kind:** Express middleware · **Lines:** 49

## Purpose
A separate franchise admin application (the comment names it `roam-admin-prod`) reads data from this backend server-to-server. It has no user session. It sends a fixed secret on every request, and this middleware validates it.

## How it works
`requireFranchiseApiKey`:
1. Returns **500** `FRANCHISE_API_NOT_CONFIGURED` when `FRANCHISE_API_KEY` is unset or empty.
2. Returns **401** `MISSING_API_KEY` when the `x-franchise-api-key` header is absent.
3. Compares the header with the expected value using `crypto.timingSafeEqual`. A length mismatch is rejected before the compare because the function needs buffers of equal length. A failed compare returns **401** `INVALID_API_KEY`.
4. Otherwise calls `next()`. No identity is attached to the request.

## Exports
- `requireFranchiseApiKey(req, res, next): void` - the franchise API key gate.

## Interfaces
- **Environment variables:** `FRANCHISE_API_KEY` - the shared secret.
- **External services:** the franchise admin app (`roam-admin-prod`) is the caller.

## Dependencies
- **Packages:** `express` (types), `crypto` (`timingSafeEqual`).

## Used by
- `server/routes/franchiseApi.ts`, through `router.use(requireFranchiseApiKey)`. That router is mounted at `/franchise-api` in `server/app.ts`, so the browser path is `/backend/franchise-api/*` (for example `/scope/countries` and `/dashboard/summary`). On BACKEND_HOSTS the same paths are served without the `/backend` prefix.
