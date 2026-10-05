# `server/middleware/internalService.ts`

> Guard for service-to-service endpoints. It requires the shared `X-Internal-Token` header and rejects any request that also carries a user `Authorization` header.

**Kind:** Express middleware · **Lines:** 32

## Purpose
Some backend operations are meant to be triggered only by another internal service, never by a browser. One example is marking a crypto invoice as paid and fulfilling it. This middleware keeps that internal surface separate from user authentication.

## How it works
`requireInternalService`:
1. Reads `INTERNAL_SERVICE_TOKEN`. When it is empty, it returns **503** `internal_service_disabled`, so the feature is off unless a token is configured.
2. When the `x-internal-token` header is missing or differs from the token, it returns **401** `invalid_internal_token`.
3. When an `authorization` header is present, it returns **400** `authorization_header_not_allowed`. This is a confused-deputy defence: a caller holding a user JWT must never be able to reach the internal endpoints, and a legitimate internal caller never sends one.
4. Otherwise calls `next()`.

## Exports
- `requireInternalService(req, res, next)` - the internal-token gate.

## Interfaces
- **Environment variables:** `INTERNAL_SERVICE_TOKEN` - the shared secret for internal calls.

## Dependencies
- **Packages:** `express` (types only).

## Used by
- `server/routes/internalCrypto.ts`, through `router.use(requireInternalService)`. That router is mounted at `/internal`, so the endpoint `POST /internal/invoices/:invoiceId/fulfill-paid` is reached at `/backend/internal/...`, or at the root on BACKEND_HOSTS.

## Notes
- The token comparison is a plain `!==`, not constant-time.
- This is a different mechanism from `requireInternalKey` in `auth.ts`, which reads the `X-Internal-Api-Key` header and the `INTERNAL_API_KEY` variable. The two use different headers and different variables.
