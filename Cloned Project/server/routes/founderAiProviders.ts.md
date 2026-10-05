# `server/routes/founderAiProviders.ts`

> Express router with 3 endpoints, mounted at `/founder-ai-providers`.

**Kind:** Express router · **Lines:** 256 · **Mounted at:** `/founder-ai-providers` (browser: `/backend/founder-ai-providers`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/keys` | `/backend/founder-ai-providers/keys` | `requireAuth` | inline | 78 |
| POST | `/keys` | `/backend/founder-ai-providers/keys` | `requireAuth` | inline | 140 |
| DELETE | `/keys/:providerId` | `/backend/founder-ai-providers/keys/:providerId` | `requireAuth` | inline | 200 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getOrgApiKey` | function | `async getOrgApiKey(providerId: string, organizationId: string): Promise<string \| null>` — Get a decrypted API key (internal use only) This is exported for use by other services (like Betty) | 235 |
| `default (router)` | default |  | 255 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `AIProviderKeyModel` (server/models/aiProviderKey.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`, `findOneAndDelete`
- **Environment variables (`process.env`):** `API_KEY_ENCRYPTION_SECRET`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/aiProviderKey.model.ts` — `AIProviderKeyModel`
  - `server/models/user.model.ts` — `User`
  - `server/utils/http.ts` — `ok`, `fail`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `crypto`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`
- `server/routes/betty.ts`
- `server/routes/simulatedAudience.ts`

Entry: mounted in `server/app.ts` at `/founder-ai-providers`.
