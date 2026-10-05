# `server/routes/openclawJobs.ts`

> Express router with 5 endpoints, mounted at `/openclaw-jobs`.

**Kind:** Express router · **Lines:** 108 · **Mounted at:** `/openclaw-jobs` (browser: `/backend/openclaw-jobs`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-jobs` | `requireAuth` | inline | 21 |
| GET | `/:jobId/detail` | `/backend/openclaw-jobs/:jobId/detail` | `requireAuth` | inline | 60 |
| POST | `/:jobId/trigger` | `/backend/openclaw-jobs/:jobId/trigger` | `requireAuth` | inline | 72 |
| PATCH | `/:jobId` | `/backend/openclaw-jobs/:jobId` | `requireAuth` | inline | 84 |
| DELETE | `/:jobId` | `/backend/openclaw-jobs/:jobId` | `requireAuth` | inline | 96 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 107 |

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

Entry: mounted in `server/app.ts` at `/openclaw-jobs`.
