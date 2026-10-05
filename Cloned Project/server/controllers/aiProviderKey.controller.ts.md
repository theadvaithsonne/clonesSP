# `server/controllers/aiProviderKey.controller.ts`

> Garage-admin handlers that list, save (encrypted) and delete per-organisation API keys for AI providers, plus a server-side helper that decrypts a stored key.

**Kind:** Express controller · **Lines:** 171 · **Mounted at:** `/ai-providers` (browser: `/backend/ai-providers`)

## Purpose
Platform admins store API keys for third-party AI providers (OpenAI, Anthropic, Replicate, Google Gemini, "garage-copilot") from the admin console page `app/garage-admin/(admin-dashboard)/ai-providers/page.tsx`. This controller backs that page. Keys are encrypted with AES-256-CBC before they reach MongoDB, and only a masked version is ever sent back to the client. Founders manage their own organisation's keys through the separate router `server/routes/founderAiProviders.ts` (`/founder-ai-providers/keys`). That router writes to the same `AIProviderKey` collection and repeats this file's encryption code.

## How it works
- **Encryption** (L8-L30): the key is derived with `crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)`. `encrypt` creates a random 16-byte IV and stores `"<ivHex>:<cipherHex>"`. `decrypt` splits on `:` and reverses that. `ENCRYPTION_KEY` comes from `API_KEY_ENCRYPTION_SECRET`; if that is unset, a hardcoded fallback string is used (L9).
- **Masking** (L32-L35): `maskApiKey` keeps the first 4 and last 4 characters and puts at most 20 `*` between them. Keys of 8 characters or fewer become `****`.
- **`getAIProviderKeys`** (L47-L71): `orgId` comes from the query string and defaults to `"global"`. It returns the active keys for that organisation as `{ keys: [{ providerId, maskedKey, createdAt }] }`. The encrypted value is never selected.
- **`saveAIProviderKey`** (L77-L121): checks the body against zod: `providerId` must be one of the 5 providers, `apiKey` must be non-empty, `orgId` is optional. An empty or missing `orgId` becomes `"global"`. It then upserts on `{ providerId, organizationId }`. On every save it sets `encryptedKey`, `maskedKey`, `updatedBy` (the admin id) and `isActive: true`. On insert only, it also sets `createdBy`. It returns `{ providerId, maskedKey, message }`. Validation errors return 400 and include zod's message.
- **`deleteAIProviderKey`** (L127-L146): hard-deletes (`findOneAndDelete`) the key for `:providerId` and `orgId` (default `"global"`). Returns 404 if no key matched.
- **`getDecryptedKey`** (L152-L170): a plain async function, not a route handler. It returns the decrypted key for an active provider/organisation pair, or `null` when no key exists or decryption fails. It is meant for server-side use only.

All errors are logged and returned as `fail(...)` with status 500.

## Exports
- `getAIProviderKeys(req: GarageAdminRequest, res)` - list the masked keys for an organisation.
- `saveAIProviderKey(req: GarageAdminRequest, res)` - encrypt and upsert a key.
- `deleteAIProviderKey(req: GarageAdminRequest, res)` - delete a key.
- `getDecryptedKey(providerId: string, organizationId = "global"): Promise<string | null>` - server-side decryption helper.

## Interfaces
- **Endpoints served** (through `server/routes/aiProviders.ts`; each route uses `requireGarageAdminAuth`. In `server/app.ts` the `/ai-providers` prefix is also gated by `garageAdminPageGate` + `requireAdminVerified`, which map to the `ai_providers` admin page with the actions `add-key` and `delete-key` in `server/config/adminPages.ts`):
  - `GET /backend/ai-providers/keys?orgId=` - list masked keys.
  - `POST /backend/ai-providers/keys` - body `{ providerId, apiKey, orgId? }`, save a key.
  - `DELETE /backend/ai-providers/keys/:providerId?orgId=` - delete a key.
- **Database:** `AIProviderKeyModel` (model `AIProviderKey`, collection `aiproviderkeys`): read, upsert and delete. There is a unique index on `{ providerId, organizationId }`.
- **Environment variables:** `API_KEY_ENCRYPTION_SECRET` - the secret the AES key is derived from.

## Dependencies
- **Internal:** `server/models/aiProviderKey.model.ts` - key storage; `server/middleware/garageAdminAuth.ts` - the `GarageAdminRequest` type (supplies `req.garageAdmin.id`); `server/utils/http.ts` - `ok`/`fail` envelopes.
- **Packages:** `crypto` (Node built-in: AES-256-CBC and scrypt), `express` (types), `zod` (validation).

## Used by
- `server/routes/aiProviders.ts`, mounted at `/ai-providers` in `server/app.ts`.
- Called from the frontend admin page `app/garage-admin/(admin-dashboard)/ai-providers/page.tsx`.
- `getDecryptedKey` is not imported anywhere at present.

## Notes
- **Security:** if `API_KEY_ENCRYPTION_SECRET` is unset, a hardcoded fallback secret is used (L9), together with a fixed scrypt salt (`"salt"`). Anyone who can read the source can then decrypt the stored keys. Make sure the env var is set in every environment. Changing it later makes existing keys impossible to decrypt, and `getDecryptedKey` then returns `null`.
- The model's `createdBy`/`updatedBy` reference `GarageAdmin`. When a founder saves a key through `founderAiProviders.ts`, those fields hold user ids instead.
- `getAIProviderKeys` filters on `isActive: true`, but `deleteAIProviderKey` deletes the document outright rather than setting `isActive` to false.
- The encryption helpers are duplicated in `server/routes/founderAiProviders.ts`. The two copies must stay identical, or keys saved through one path cannot be read through the other.
