# `server/routes/openclawContexts.ts`

> Express router with 9 endpoints, mounted at `/openclaw-contexts`.

**Kind:** Express router · **Lines:** 126 · **Mounted at:** `/openclaw-contexts` (browser: `/backend/openclaw-contexts`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (9)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-contexts` | `requireAuth` | inline | 16 |
| POST | `/` | `/backend/openclaw-contexts` | `requireAuth` | inline | 27 |
| GET | `/agent/:agentId` | `/backend/openclaw-contexts/agent/:agentId` | `requireAuth` | inline | 38 |
| POST | `/assign` | `/backend/openclaw-contexts/assign` | `requireAuth` | inline | 50 |
| DELETE | `/unassign/:agentId/:contextId` | `/backend/openclaw-contexts/unassign/:agentId/:contextId` | `requireAuth` | inline | 61 |
| GET | `/:contextId` | `/backend/openclaw-contexts/:contextId` | `requireAuth` | inline | 76 |
| GET | `/:contextId/content` | `/backend/openclaw-contexts/:contextId/content` | `requireAuth` | inline | 89 |
| PATCH | `/:contextId` | `/backend/openclaw-contexts/:contextId` | `requireAuth` | inline | 102 |
| DELETE | `/:contextId` | `/backend/openclaw-contexts/:contextId` | `requireAuth` | inline | 114 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 125 |

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

Entry: mounted in `server/app.ts` at `/openclaw-contexts`.
