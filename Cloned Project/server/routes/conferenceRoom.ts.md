# `server/routes/conferenceRoom.ts`

> Express router with 4 endpoints, mounted at `/conference-rooms`.

**Kind:** Express router · **Lines:** 361 · **Mounted at:** `/conference-rooms` (browser: `/backend/conference-rooms`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/conference-rooms` | `requireAuth` | inline | 45 |
| GET | `/` | `/backend/conference-rooms` | `requireAuth` | inline | 178 |
| PUT | `/:id` | `/backend/conference-rooms/:id` | `requireAuth` | inline | 226 |
| DELETE | `/:id` | `/backend/conference-rooms/:id` | `requireAuth` | inline | 307 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 360 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `ConferenceRoom` (server/models/conferenceRoom.model.ts) — reads: `countDocuments`, `find`, `findOne`; **writes:** `create`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/conferenceRoom.model.ts` — `ConferenceRoom`, `conferenceRoomSpaceId`
  - `server/services/conferenceRoomBilling.ts` — `applyAddRoomsBilling`, `applyCancelRoomBilling`, `pruneExpiredRoomsForOrg`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/conference-rooms`.
