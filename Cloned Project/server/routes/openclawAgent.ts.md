# `server/routes/openclawAgent.ts`

> Express router with 7 endpoints, mounted at `/openclaw-agent`.

**Kind:** Express router · **Lines:** 473 · **Mounted at:** `/openclaw-agent` (browser: `/backend/openclaw-agent`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-agent` | `requireAuth` | inline | 12 |
| POST | `/` | `/backend/openclaw-agent` | `requireAuth`, `requireFounder` | inline | 89 |
| PATCH | `/:agentId` | `/backend/openclaw-agent/:agentId` | `requireAuth`, `requireFounder` | inline | 212 |
| DELETE | `/:agentId` | `/backend/openclaw-agent/:agentId` | `requireAuth`, `requireFounder` | inline | 322 |
| POST | `/:agentId/restore` | `/backend/openclaw-agent/:agentId/restore` | `requireAuth`, `requireFounder` | inline | 365 |
| GET | `/:agentId/assignments` | `/backend/openclaw-agent/:agentId/assignments` | `requireAuth`, `requireFounder` | inline | 411 |
| PUT | `/:agentId/assignments` | `/backend/openclaw-agent/:agentId/assignments` | `requireAuth`, `requireFounder` | inline | 434 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 472 |

## Interfaces

- **Database (Mongoose models used):**
  - `OpenClawAgent` (server/models/openclawAgent.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `updateOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
  - `server/models/openclawAgent.model.ts` — `OpenClawAgent`
  - `server/utils/openclaw.ts` — `callOpenClaw`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-agent`.
