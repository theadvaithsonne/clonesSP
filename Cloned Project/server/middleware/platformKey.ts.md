# `server/middleware/platformKey.ts`

> Express middleware that checks an `X-Garage-Platform` key against the `ThirdPartyClient` collection and requires the `offices:grace` scope before the office grace-programme routes run.

**Kind:** Express middleware · **Lines:** 82

## Purpose
The "office grace programme" lets selected integrating platforms create offices for users without the usual Unilevel Plus licence gate. Those routes need two credentials:
- a normal user JWT, which says who the office is for;
- a platform key, which says which platform is vouching for that user.

This file checks the platform key. Keys are issued to only a few platforms. The main web and mobile apps never send one, so the licence gate still applies to them. Platform keys are stored as `ThirdPartyClient` documents, which gives them the same hashing, rotation and admin surface as partner API keys. No billing `productConfig` is required.

## How it works
`requirePlatformKey`, which is async:
1. Reads the `x-garage-platform` header. If it is missing, returns **401** `missing_platform_key`.
2. Gets the key's prefix with `extractKeyPrefix`; keys have the form `gu_tp_<8-char prefix>_<hex>`. It then loads the active clients with that prefix: `ThirdPartyClient.find({ apiKeyPrefix, isActive: true })`.
3. Runs `verifyApiKey` (bcrypt) against each candidate's `apiKeyHash` until one matches. Narrowing by prefix first avoids running bcrypt against every key in the collection on every request.
4. If nothing matches, returns **401** `invalid_platform_key`. If the client lacks the `offices:grace` scope, returns **403** `missing_scope`, naming the client.
5. Attaches the matched client as `req.platformClient` and calls `next()`.

Every error body has the shape `{ success: false, error, message }`.

## Exports
- `requirePlatformKey(req, res, next): Promise<void>` - the platform-key and scope gate.
- `type PlatformRequest` - `Request & { platformClient: IThirdPartyClient }`, the request type that handlers cast to.

## Interfaces
- **Database:** `ThirdPartyClient` (model `ThirdPartyClient`) - read only.

## Dependencies
- **Internal:** `server/models/thirdPartyClient.model.ts` - the `ThirdPartyClient` model, the `IThirdPartyClient` type, and the `extractKeyPrefix` and `verifyApiKey` helpers.
- **Packages:** `express` (types).

## Used by
- `server/routes/platformOffices.ts`, as `router.use(requireAuth, requirePlatformKey)`. That router is mounted at `/platform`, so it serves `/backend/platform/offices/eligibility` and the other office routes.

## Notes
- If the key is malformed, `extractKeyPrefix` returns `null` and the query runs with `apiKeyPrefix: null`. That query normally finds nothing, so the result is still a 401. `thirdPartyAuth.ts` rejects a malformed key explicitly instead.
- Unlike `thirdPartyAuth.ts`, this middleware does not update the client's `lastUsedAt`.
