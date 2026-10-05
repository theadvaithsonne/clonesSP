# `server/routes/meet.ts`

> Express router with 5 endpoints, mounted at `/meet`.

**Kind:** Express router · **Lines:** 294 · **Mounted at:** `/meet` (browser: `/backend/meet`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/create` | `/backend/meet/create` | — | inline | 31 |
| GET | `/list` | `/backend/meet/list` | — | inline | 112 |
| GET | `/:meetId` | `/backend/meet/:meetId` | — | inline | 180 |
| GET | `/:meetId/participants` | `/backend/meet/:meetId/participants` | — | inline | 222 |
| PATCH | `/:meetId/cancel` | `/backend/meet/:meetId/cancel` | — | inline | 255 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 293 |

## Interfaces

- **Database (Mongoose models used):**
  - `Meet` (server/models/meet.model.ts) — reads: `find`, `findById`; **writes:** `create`, `findByIdAndUpdate`
  - `MeetParticipant` (server/models/meetParticipant.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/meetParticipant.model.ts` — `MeetParticipant`
  - `server/utils/meetCode.ts` — `generateMeetJoinCode`, `generateMeetAgoraChannel`
  - `server/services/livekit.ts` — `createRoom`, `getLivekitUrl`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/meet`.
