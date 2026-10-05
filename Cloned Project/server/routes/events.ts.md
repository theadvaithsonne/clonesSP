# `server/routes/events.ts`

> Express router with 11 endpoints, mounted at `/events`.

**Kind:** Express router · **Lines:** 833 · **Mounted at:** `/events` (browser: `/backend/events`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (11)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/events` | `requireAuth` | inline | 38 |
| GET | `/` | `/backend/events` | `requireAuth` | inline | 159 |
| GET | `/active` | `/backend/events/active` | `requireAuth` | inline | 225 |
| GET | `/:eventId` | `/backend/events/:eventId` | `requireAuth` | inline | 262 |
| GET | `/:eventId/guests` | `/backend/events/:eventId/guests` | `requireAuth` | inline | 303 |
| PATCH | `/:eventId` | `/backend/events/:eventId` | `requireAuth` | inline | 364 |
| PATCH | `/:eventId/start` | `/backend/events/:eventId/start` | `requireAuth` | inline | 435 |
| PATCH | `/:eventId/end` | `/backend/events/:eventId/end` | `requireAuth` | inline | 506 |
| PATCH | `/:eventId/members` | `/backend/events/:eventId/members` | `requireAuth` | inline | 577 |
| PATCH | `/:eventId/cancel` | `/backend/events/:eventId/cancel` | `requireAuth` | inline | 761 |
| DELETE | `/:eventId` | `/backend/events/:eventId` | `requireAuth` | inline | 800 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 832 |

## Interfaces

- **Socket.IO events:**
  - emits: `event:created`, `event:started`, `event:ended`, `event:member-removed`, `event:members-updated`
- **Database (Mongoose models used):**
  - `Event` (server/models/event.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndDelete`
  - `EventGuest` (server/models/eventGuest.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/event.model.ts` — `Event`
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/utils/guestToken.ts` — `generatePublicJoinCode`
  - `server/services/mailer.ts` — `sendEventGuestInvitation`, `sendEventCancellationEmail`
  - `server/models/user.model.ts` — `User`
  - `server/models/eventGuest.model.ts` — `EventGuest`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/events`.
