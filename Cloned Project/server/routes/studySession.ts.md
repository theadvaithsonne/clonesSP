# `server/routes/studySession.ts`

> Express router with 4 endpoints, mounted at `/study-sessions`.

**Kind:** Express router · **Lines:** 120 · **Mounted at:** `/study-sessions` (browser: `/backend/study-sessions`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/start` | `/backend/study-sessions/start` | `requireAuth` | inline | 12 |
| POST | `/end` | `/backend/study-sessions/end` | `requireAuth` | inline | 44 |
| PATCH | `/heartbeat` | `/backend/study-sessions/heartbeat` | `requireAuth` | inline | 71 |
| GET | `/stats` | `/backend/study-sessions/stats` | `requireAuth` | inline | 102 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 119 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/studySession.ts` — `* as studySessionService`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/study-sessions`.
