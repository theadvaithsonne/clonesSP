# `server/models/aiProviderKey.model.ts`

> Mongoose model `AIProviderKey`: an organisation's stored (encrypted) API key for one AI provider.

**Kind:** Mongoose model · **Lines:** 51

## Purpose
Stores third-party AI provider credentials per organisation so admins and founders can configure which AI keys Garage uses for that org. The ciphertext and a masked display version are kept; the plaintext key is never stored here.

## How it works
- `providerId` - required, one of `openai`, `anthropic`, `replicate`, `google-gemini`, `garage-copilot`.
- `encryptedKey` - required ciphertext. Encryption happens in `server/controllers/aiProviderKey.controller.ts` (AES-256-CBC with a scrypt-derived key from `API_KEY_ENCRYPTION_SECRET`, stored as `ivHex:cipherHex`).
- `maskedKey` - required display string (e.g. `sk-...abc123`).
- `organizationId` - required, stored as a **string**, not an ObjectId.
- `createdBy` (required) / `updatedBy` - refs `GarageAdmin`.
- `isActive` - default `true`.
- Unique index `{ providerId, organizationId }`: one key per provider per org.
- Timestamps on; collection `aiproviderkeys`.

## Exports
- `AIProviderKeyModel` - Mongoose model `"AIProviderKey"`.
- `type AIProviderKey` - `InferSchemaType` of the schema.

## Interfaces
- **Database:** `AIProviderKey` (collection `aiproviderkeys`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/controllers/aiProviderKey.controller.ts` - used by `server/routes/aiProviders.ts`, mounted at `/ai-providers` (browser `/backend/ai-providers`).
- `server/routes/founderAiProviders.ts` - mounted at `/founder-ai-providers` (browser `/backend/founder-ai-providers`): `GET/POST /keys`, `DELETE /keys/:providerId`.

## Notes
- The schema comment says "in production, use proper encryption". The controller falls back to a hardcoded default passphrase when `API_KEY_ENCRYPTION_SECRET` is unset (controller line 9) and uses a fixed scrypt salt, so the security of stored keys depends on that env var being set.
- `createdBy` refs `GarageAdmin`, yet the founder route also writes keys; check what id it stores there before relying on `populate`.
