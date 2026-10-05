# `server/routes/openclawActivity.ts`

> Activity feed with per-user scoping.

**Kind:** Express router · **Lines:** 54 · **Mounted at:** `/openclaw-activity` (browser: `/backend/openclaw-activity`)

<!-- docgen:auto -->

## Purpose
Activity feed with per-user scoping.

Founders see all activity for agents in their org (including
system-generated rows with user_id=NULL).
Employees see only rows whose user_id equals their own — across the
agents assigned to them. An agent not in their assigned set returns
404.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:agentId/activity` | `/backend/openclaw-activity/:agentId/activity` | `requireAuth` | inline | 17 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 53 |

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

Entry: mounted in `server/app.ts` at `/openclaw-activity`.
