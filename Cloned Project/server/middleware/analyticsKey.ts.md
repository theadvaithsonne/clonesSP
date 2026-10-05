# `server/middleware/analyticsKey.ts`

> Express middleware that guards the public analytics API with one shared `X-API-KEY` value taken from the environment.

**Kind:** Express middleware · **Lines:** 52

## Purpose
Partners that pull affiliate analytics call the `/public/analytics/*` endpoints with a single shared key instead of a per-partner `ThirdPartyClient` key. This file holds that check. The header comment explains the trade-off: the key lives in one place (the environment), so it can be handed over without a database step, but there are no scopes, no per-partner revocation, and rotating it means redeploying.

## How it works
`requireAnalyticsKey` runs these checks in order:
1. If `ANALYTICS_API_KEY` is not set, it returns **503** `{ code: "NOT_CONFIGURED" }`. With no key configured the API is off.
2. It reads the `x-api-key` header. A missing or non-string header returns **401** `MISSING_API_KEY`.
3. It compares the header with the expected key using `crypto.timingSafeEqual`. That function needs buffers of equal length, so a length mismatch is rejected first (the length is not treated as secret). Any mismatch returns **401** `INVALID_API_KEY`.
4. Otherwise it calls `next()`. Nothing is attached to the request.

## Exports
- `requireAnalyticsKey(req, res, next): void` - a synchronous guard that lets the request through only when the shared analytics key matches.

## Interfaces
- **Environment variables:** `ANALYTICS_API_KEY` - the shared secret. If it is unset, the guard returns 503.

## Dependencies
- **Packages:** `express` (types), `crypto` (`timingSafeEqual` for the constant-time compare).

## Used by
- `server/routes/publicAnalytics.ts`, which applies it with `router.use(requireAnalyticsKey)`. That router is mounted at `/public/analytics` in `server/app.ts`, so the browser path is `/backend/public/analytics/*`, or `/public/analytics/*` on BACKEND_HOSTS. Examples are `GET /affiliate/direct`, `/affiliate/indirect`, `/categories` and `/affiliate/:userId/details`.

## Notes
- It reads the same `x-api-key` header name as `thirdPartyAuth.ts`, but the two mechanisms are separate. A ThirdPartyClient key (`gu_tp_...`) does not work here.
