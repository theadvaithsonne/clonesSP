# `server/routes/garageAdminTickets.ts`

> Garage-admin ticket endpoints — mirrors user-facing read/reply/status but gated by the garage-admin JWT (`requireGarageAdminAuth`).

**Kind:** Express router · **Lines:** 394 · **Mounted at:** `/garage-admin/tickets` (browser: `/backend/garage-admin/tickets`)

<!-- docgen:auto -->

## Purpose
Garage-admin ticket endpoints — mirrors user-facing read/reply/status
but gated by the garage-admin JWT (`requireGarageAdminAuth`). Mounted
at `/garage-admin/tickets`.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/tickets` | — | inline | 23 |
| POST | `/` | `/backend/garage-admin/tickets` | — | inline | 82 |
| GET | `/support-board` | `/backend/garage-admin/tickets/support-board` | — | inline | 162 |
| GET | `/support-board/options` | `/backend/garage-admin/tickets/support-board/options` | — | inline | 173 |
| PUT | `/support-board` | `/backend/garage-admin/tickets/support-board` | `requireGarageSuperAdmin` | inline | 184 |
| GET | `/:id` | `/backend/garage-admin/tickets/:id` | — | inline | 211 |
| POST | `/:id/messages` | `/backend/garage-admin/tickets/:id/messages` | — | inline | 232 |
| PATCH | `/:id` | `/backend/garage-admin/tickets/:id` | — | inline | 271 |
| PATCH | `/:id/assign` | `/backend/garage-admin/tickets/:id/assign` | — | inline | 333 |
| PATCH | `/:id/unassign` | `/backend/garage-admin/tickets/:id/unassign` | — | inline | 371 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth` (L20)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 393 |

## Interfaces

- **Database (Mongoose models used):**
  - `Ticket` (server/models/ticket.model.ts) — reads: `find`, `findById`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/ticket.model.ts` — `Ticket`, `TicketStatus`
  - `server/models/user.model.ts` — `User`
  - `server/services/ticketHelpers.ts` — `sanitiseAttachments`, `withViewUrls`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/tickets`.
