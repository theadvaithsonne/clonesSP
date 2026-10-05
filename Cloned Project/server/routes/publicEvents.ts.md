# `server/routes/publicEvents.ts`

> Express router with 6 endpoints, mounted at `/public/events`.

**Kind:** Express router · **Lines:** 708 · **Mounted at:** `/public/events` (browser: `/backend/public/events`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/validate-guest` | `/backend/public/events/validate-guest` | — | inline | 36 |
| POST | `/join-guest` | `/backend/public/events/join-guest` | — | inline | 125 |
| GET | `/participants` | `/backend/public/events/participants` | — | inline | 251 |
| GET | `/validate-code` | `/backend/public/events/validate-code` | — | inline | 337 |
| POST | `/join-public` | `/backend/public/events/join-public` | — | inline | 486 |
| GET | `/participants-public` | `/backend/public/events/participants-public` | — | inline | 629 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 707 |

## Interfaces

- **Database (Mongoose models used):**
  - `EventGuest` (server/models/eventGuest.model.ts) — reads: `find`; **writes:** `create`
  - `Event` (server/models/event.model.ts) — reads: `findById`; **writes:** `findByIdAndUpdate`

## Dependencies

- **Internal:**
  - `server/utils/guestToken.ts` — `verifyEventGuestToken`, `markGuestAsJoined`, `verifyPublicJoinCode`
  - `server/services/jwt.ts` — `generateGuestSocketToken`
  - `server/models/eventGuest.model.ts` — `EventGuest`
  - `server/models/event.model.ts` — `Event`
  - `server/services/livekit.ts` — `createRoom`, `createParticipantToken`, `toLivekitRoomName`, `getLivekitUrl`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/events`.
