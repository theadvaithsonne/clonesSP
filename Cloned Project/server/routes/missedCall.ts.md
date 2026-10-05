# `server/routes/missedCall.ts`

> Express router with 5 endpoints, mounted at `/missed-calls`.

**Kind:** Express router · **Lines:** 180 · **Mounted at:** `/missed-calls` (browser: `/backend/missed-calls`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/missed-calls` | `requireAuth` | inline | 21 |
| GET | `/unread-count` | `/backend/missed-calls/unread-count` | `requireAuth` | inline | 61 |
| POST | `/mark-viewed` | `/backend/missed-calls/mark-viewed` | `requireAuth` | inline | 89 |
| DELETE | `/:id` | `/backend/missed-calls/:id` | `requireAuth` | inline | 120 |
| POST | `/clear` | `/backend/missed-calls/clear` | `requireAuth` | inline | 158 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 179 |

## Interfaces

- **Database (Mongoose models used):**
  - `MissedCall` (server/models/missedCall.model.ts) — reads: `find`, `countDocuments`; **writes:** `updateMany`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/missedCall.model.ts` — `MissedCall`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/missed-calls`.
