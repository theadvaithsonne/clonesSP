# `server/routes/coworkingSpaceBooking.ts`

> Express router with 7 endpoints, mounted at `/coworking-bookings`.

**Kind:** Express router · **Lines:** 40 · **Mounted at:** `/coworking-bookings` (browser: `/backend/coworking-bookings`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/request` | `/backend/coworking-bookings/request` | `requireAuth` | `createBookingRequest` | 18 |
| GET | `/my-bookings` | `/backend/coworking-bookings/my-bookings` | `requireAuth` | `getMyBookings` | 21 |
| PATCH | `/:id/cancel` | `/backend/coworking-bookings/:id/cancel` | `requireAuth` | `cancelBooking` | 24 |
| GET | `/admin/requests` | `/backend/coworking-bookings/admin/requests` | `requireGarageAdminAuth` | `getAllBookingRequests` | 28 |
| GET | `/admin/stats` | `/backend/coworking-bookings/admin/stats` | `requireGarageAdminAuth` | `getBookingStats` | 31 |
| GET | `/admin/requests/:id` | `/backend/coworking-bookings/admin/requests/:id` | `requireGarageAdminAuth` | `getBookingRequestById` | 34 |
| PATCH | `/admin/requests/:id/status` | `/backend/coworking-bookings/admin/requests/:id/status` | `requireGarageAdminAuth` | `updateBookingStatus` | 37 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 39 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/controllers/coworkingSpaceBooking.controller.ts` — `createBookingRequest`, `getMyBookings`, `cancelBooking`, `getAllBookingRequests`, `getBookingRequestById`, `updateBookingStatus`, `getBookingStats`
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/coworking-bookings`.
