# `server/routes/callBooking.ts`

> Express router with 10 endpoints, mounted at `/call-bookings`.

**Kind:** Express router · **Lines:** 475 · **Mounted at:** `/call-bookings` (browser: `/backend/call-bookings`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/founder/slots` | `/backend/call-bookings/founder/slots` | `requireAuth` | inline | 29 |
| POST | `/` | `/backend/call-bookings` | `requireAuth` | inline | 67 |
| GET | `/me` | `/backend/call-bookings/me` | `requireAuth` | inline | 124 |
| GET | `/founder` | `/backend/call-bookings/founder` | `requireAuth` | inline | 144 |
| GET | `/:bookingId` | `/backend/call-bookings/:bookingId` | `requireAuth` | inline | 178 |
| PATCH | `/:bookingId/complete` | `/backend/call-bookings/:bookingId/complete` | `requireAuth` | inline | 217 |
| PATCH | `/:bookingId/cancel` | `/backend/call-bookings/:bookingId/cancel` | `requireAuth` | inline | 264 |
| PATCH | `/:bookingId/reschedule` | `/backend/call-bookings/:bookingId/reschedule` | `requireAuth` | inline | 313 |
| POST | `/:bookingId/rate` | `/backend/call-bookings/:bookingId/rate` | `requireAuth` | inline | 366 |
| PATCH | `/:bookingId/no-show` | `/backend/call-bookings/:bookingId/no-show` | `requireAuth` | inline | 417 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 474 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `CallPurchase` (server/models/callPurchase.model.ts) — reads: `findById`; **writes:** `findByIdAndUpdate`
  - `CallBooking` (server/models/callBooking.model.ts) — reads: `findById`
  - `CallOffering` (server/models/callOffering.model.ts) — **writes:** `findByIdAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/services/call.ts` — `* as callService`
  - `server/models/callBooking.model.ts` — `CallBooking`
  - `server/models/callPurchase.model.ts` — `CallPurchase`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/call-bookings`.
