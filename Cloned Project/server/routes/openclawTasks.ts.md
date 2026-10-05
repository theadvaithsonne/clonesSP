# `server/routes/openclawTasks.ts`

> Express router with 2 endpoints, mounted at `/openclaw-tasks`.

**Kind:** Express router · **Lines:** 85 · **Mounted at:** `/openclaw-tasks` (browser: `/backend/openclaw-tasks`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-tasks` | `requireAuth` | inline | 17 |
| PATCH | `/:taskId/issues/:issueIndex/resolve` | `/backend/openclaw-tasks/:taskId/issues/:issueIndex/resolve` | `requireAuth` | inline | 69 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 84 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/openclaw.ts` — `callOpenClaw`
  - `server/utils/openclawAccess.ts` — `getAccessibleAgentIds`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-tasks`.
