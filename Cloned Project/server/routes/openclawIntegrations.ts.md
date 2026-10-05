# `server/routes/openclawIntegrations.ts`

> Express router with 7 endpoints, mounted at `/openclaw-integrations`.

**Kind:** Express router · **Lines:** 106 · **Mounted at:** `/openclaw-integrations` (browser: `/backend/openclaw-integrations`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-integrations` | `requireAuth` | inline | 16 |
| POST | `/` | `/backend/openclaw-integrations` | `requireAuth` | inline | 27 |
| GET | `/agent/:agentId` | `/backend/openclaw-integrations/agent/:agentId` | `requireAuth` | inline | 38 |
| GET | `/:integrationId/logs` | `/backend/openclaw-integrations/:integrationId/logs` | `requireAuth` | inline | 50 |
| POST | `/:integrationId/assign` | `/backend/openclaw-integrations/:integrationId/assign` | `requireAuth` | inline | 62 |
| PATCH | `/:integrationId` | `/backend/openclaw-integrations/:integrationId` | `requireAuth` | inline | 78 |
| DELETE | `/:integrationId` | `/backend/openclaw-integrations/:integrationId` | `requireAuth` | inline | 94 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 105 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/openclaw.ts` — `callOpenClaw`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-integrations`.
