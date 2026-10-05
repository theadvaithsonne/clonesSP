# `server/routes/calendar.ts`

> Express router with 7 endpoints, mounted at `/calendar`.

**Kind:** Express router · **Lines:** 396 · **Mounted at:** `/calendar` (browser: `/backend/calendar`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/availability` | `/backend/calendar/availability` | `requireAuth` | inline | 14 |
| GET | `/availability` | `/backend/calendar/availability` | `requireAuth` | inline | 14 |
| GET | `/:userId/slots` | `/backend/calendar/:userId/slots` | `requireAuth` | inline | 81 |
| GET | `/bookings` | `/backend/calendar/bookings` | `requireAuth` | inline | 150 |
| POST | `/bookings` | `/backend/calendar/bookings` | `requireAuth` | inline | 170 |
| PATCH | `/bookings/:bookingId/cancel` | `/backend/calendar/bookings/:bookingId/cancel` | `requireAuth` | inline | 196 |
| GET | `/unified` | `/backend/calendar/unified` | `requireAuth` | inline | 226 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 396 |

## Interfaces

- **Database (Mongoose models used):**
  - `Availability` (server/models/availability.model.ts) — reads: `find`, `exists`, `findOne`; **writes:** `insertMany`, `bulkWrite`
  - `Booking` (server/models/booking.model.ts) — reads: `find`, `findOne`; **writes:** `create`
  - `Event` (server/models/event.model.ts) — reads: `find`
  - `CallBooking` (server/models/callBooking.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/availability.model.ts` — `Availability`
  - `server/models/booking.model.ts` — `Booking`
  - `server/models/user.model.ts` — `User`
  - `server/models/event.model.ts` — `Event`
  - `server/models/callBooking.model.ts` — `CallBooking`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/calendar`.
