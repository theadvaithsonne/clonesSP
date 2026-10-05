# `server/routes/team.ts`

> Express router with 5 endpoints, mounted at `/team`.

**Kind:** Express router · **Lines:** 455 · **Mounted at:** `/team` (browser: `/backend/team`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/list` | `/backend/team/list` | `requireAuth` | inline | 11 |
| GET | `/network-stats` | `/backend/team/network-stats` | `requireAuth` | inline | 174 |
| POST | `/bulk-transfer` | `/backend/team/bulk-transfer` | `requireAuth` | inline | 271 |
| GET | `/guests` | `/backend/team/guests` | `requireAuth` | inline | 373 |
| PATCH | `/guests/:userId/graduate` | `/backend/team/guests/:userId/graduate` | `requireAuth` | inline | 417 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 454 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `aggregate`, `countDocuments`, `findById`; **writes:** `updateMany`, `updateOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/services/memberCleanup.service.ts` — `memberCleanupService`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/team`.
