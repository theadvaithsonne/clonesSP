# `server/routes/aiProviders.ts`

> Express router with 3 endpoints, mounted at `/ai-providers`.

**Kind:** Express router · **Lines:** 17 · **Mounted at:** `/ai-providers` (browser: `/backend/ai-providers`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/keys` | `/backend/ai-providers/keys` | `requireGarageAdminAuth` | `getAIProviderKeys` | 12 |
| POST | `/keys` | `/backend/ai-providers/keys` | `requireGarageAdminAuth` | `saveAIProviderKey` | 13 |
| DELETE | `/keys/:providerId` | `/backend/ai-providers/keys/:providerId` | `requireGarageAdminAuth` | `deleteAIProviderKey` | 14 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/controllers/aiProviderKey.controller.ts` — `getAIProviderKeys`, `saveAIProviderKey`, `deleteAIProviderKey`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/ai-providers`.
