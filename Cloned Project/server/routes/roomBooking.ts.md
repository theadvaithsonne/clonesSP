# `server/routes/roomBooking.ts`

> Express router with 5 endpoints, mounted at `/room-bookings`.

**Kind:** Express router · **Lines:** 358 · **Mounted at:** `/room-bookings` (browser: `/backend/room-bookings`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/room-bookings` | `requireAuth` | inline | 35 |
| GET | `/` | `/backend/room-bookings` | `requireAuth` | inline | 142 |
| GET | `/current` | `/backend/room-bookings/current` | `requireAuth` | inline | 189 |
| PATCH | `/:id` | `/backend/room-bookings/:id` | `requireAuth` | inline | 232 |
| PATCH | `/:id/cancel` | `/backend/room-bookings/:id/cancel` | `requireAuth` | inline | 319 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 357 |

## Interfaces

- **Socket.IO events:**
  - emits: `room-booking:created`, `room-booking:updated`, `room-booking:cancelled`
- **Database (Mongoose models used):**
  - `RoomBooking` (server/models/roomBooking.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/roomBooking.model.ts` — `RoomBooking`
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/room-bookings`.
