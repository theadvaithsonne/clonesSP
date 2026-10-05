# `server/middleware/thirdPartyAuth.ts`

> Partner-API authentication: it resolves an `x-api-key` to an active `ThirdPartyClient`, using a prefix lookup followed by a bcrypt check, and provides a per-route scope guard.

**Kind:** Express middleware · **Lines:** 85

## Purpose
External partners integrate with the Garage invoice and wallet APIs under `/api/v1/third-party`. Each partner is a `ThirdPartyClient` document with a hashed API key and a list of scopes, such as `invoices:read` and `invoices:write`. This file authenticates those partners and enforces their scopes.

## How it works
**`requireThirdPartyApiKey`** (async):
- **Idempotent.** If `req.thirdPartyClient` is already set, it calls `next()` straight away. Two routers (invoice and wallet) are both mounted on `/api/v1/third-party`, each with a router-level `use`, so without this check a request would be verified twice, and bcrypt is deliberately slow.
- Reads the `x-api-key` header. If it is missing, returns **401** `MISSING_API_KEY`.
- Calls `extractKeyPrefix`; keys have the form `gu_tp_<prefix>_<hex>`. A malformed key returns **401** `INVALID_API_KEY`.
- Loads the active candidates with `ThirdPartyClient.find({ apiKeyPrefix, isActive: true })` and runs `verifyApiKey` (bcrypt compare) against each one until a hash matches. If none matches, returns **401** `INVALID_API_KEY`.
- Attaches `req.thirdPartyClient`, starts a background update of `lastUsedAt` (errors are only logged), and calls `next()`.

**`requireScope(scope)`** returns a handler that:
- returns **401** `NOT_AUTHENTICATED` if no client is attached;
- returns **403** `MISSING_SCOPE` if `client.scopes` does not include `scope`;
- otherwise calls `next()`.

## Exports
- `requireThirdPartyApiKey(req, res, next): Promise<void>` - authenticates the partner.
- `requireScope(scope: ThirdPartyScope): RequestHandler` - a scope guard that must run after the authenticator.
- `type ThirdPartyAuthRequest` - `Request & { thirdPartyClient: IThirdPartyClient }`.

## Interfaces
- **Database:** `ThirdPartyClient` - read on each request, and `lastUsedAt` written in the background.

## Dependencies
- **Internal:** `server/models/thirdPartyClient.model.ts` - the model, the `IThirdPartyClient` and `ThirdPartyScope` types, `extractKeyPrefix` and `verifyApiKey`.
- **Packages:** `express`.

## Used by
- `server/routes/thirdPartyInvoice.ts`, with `router.use(requireThirdPartyApiKey)` and per-route `requireScope("invoices:read" | "invoices:write")`.
- `server/routes/thirdPartyWallet.ts`.

Both routers are mounted at `/api/v1/third-party`, so the browser path is `/backend/api/v1/third-party/*`. Partners usually call the root path on a BACKEND_HOSTS domain instead.

## Notes
- `requireAnalyticsKey` and `requirePlatformKey` are separate mechanisms. The platform key reuses the same model and helpers but checks a different header (`X-Garage-Platform`).
