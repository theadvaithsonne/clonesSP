# `server/routes/supportTickets.ts`

> Express router with 13 endpoints, mounted at `/support-tickets`.

**Kind:** Express router · **Lines:** 745 · **Mounted at:** `/support-tickets` (browser: `/backend/support-tickets`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/support-tickets` | `requireAuth` | inline | 48 |
| GET | `/my` | `/backend/support-tickets/my` | `requireAuth` | inline | 104 |
| GET | `/all` | `/backend/support-tickets/all` | `requireAuth` | inline | 128 |
| GET | `/global` | `/backend/support-tickets/global` | `requireAuth` | inline | 159 |
| GET | `/check-global-admin` | `/backend/support-tickets/check-global-admin` | `requireAuth` | inline | 203 |
| GET | `/:id` | `/backend/support-tickets/:id` | `requireAuth` | inline | 216 |
| PATCH | `/:id/status` | `/backend/support-tickets/:id/status` | `requireAuth` | inline | 268 |
| POST | `/:id/response` | `/backend/support-tickets/:id/response` | `requireAuth` | inline | 361 |
| DELETE | `/:id` | `/backend/support-tickets/:id` | `requireAuth` | inline | 464 |
| GET | `/assignment/team-members` | `/backend/support-tickets/assignment/team-members` | `requireAuth` | inline | 498 |
| GET | `/assignment/floors` | `/backend/support-tickets/assignment/floors` | `requireAuth` | inline | 540 |
| PATCH | `/:id/assign` | `/backend/support-tickets/:id/assign` | `requireAuth` | inline | 580 |
| PATCH | `/:id/unassign` | `/backend/support-tickets/:id/unassign` | `requireAuth` | inline | 682 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 744 |

## Interfaces

- **Socket.IO events:**
  - emits: `support:new-ticket`, `support:ticket-status-changed`, `support:ticket-response`, `support:ticket-assigned`, `support:ticket-unassigned`
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`, `countDocuments`
  - `SupportTicket` (server/models/supportTicket.model.ts) — reads: `findById`, `find`, `findOne`; **writes:** `create`, `findByIdAndUpdate`, `findOneAndUpdate`, `deleteOne`
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `findById`
  - `Floor` (server/models/floor.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/supportTicket.model.ts` — `SupportTicket`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/support-tickets`.
