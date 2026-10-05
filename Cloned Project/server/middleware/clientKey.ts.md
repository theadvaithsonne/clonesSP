# `server/middleware/clientKey.ts`

> Small Express guard that requires the `x-client-key` header to equal the `PUBLIC_CLIENT_KEY` environment value.

**Kind:** Express middleware · **Lines:** 19

## Purpose
Some endpoints on the otherwise unauthenticated `/public` router should only be called by known client apps, not by anyone on the internet. This middleware is that light gate. It is a shared "client key", not a user credential.

## How it works
`requireClientKey`:
- Returns **500** `{ error: "PUBLIC_CLIENT_KEY not configured" }` when the environment variable is missing.
- Returns **401** `{ error: "invalid client key" }` when the `x-client-key` header does not exactly equal the expected value.
- Otherwise calls `next()`.

## Exports
- `requireClientKey(req, res, next): void` - the shared client-key check.

## Interfaces
- **Environment variables:** `PUBLIC_CLIENT_KEY` - the expected header value.

## Dependencies
- **Packages:** `express` (types only).

## Used by
- `server/routes/public.ts`, on one route: `GET /owner-by-email`. The `/public` router is mounted at `/public`, so the browser path is `/backend/public/owner-by-email`.

## Notes
- The comparison is a plain `!==`, not constant-time like `analyticsKey.ts` and `franchiseApiAuth.ts`. That is a minor timing side channel.
- A missing configuration returns 500 here, whereas the sibling key middlewares return 503.
