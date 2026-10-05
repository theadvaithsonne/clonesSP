# `server/routes/tickets.ts`

> User-facing support tickets — file a ticket, view your own list, reply in the thread, upload attachments.

**Kind:** Express router · **Lines:** 259 · **Mounted at:** `/tickets` (browser: `/backend/tickets`)

<!-- docgen:auto -->

## Purpose
User-facing support tickets — file a ticket, view your own list,
reply in the thread, upload attachments. Admin replies + status
updates come through `/garage-admin/tickets/*` (OTP-gated panel)
so this router intentionally has no admin-allowlist logic.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/public` | `/backend/tickets/public` | — | inline | 33 |
| POST | `/upload-url-public` | `/backend/tickets/upload-url-public` | — | inline | 78 |
| POST | `/upload-url` | `/backend/tickets/upload-url` | `requireAuth` | inline | 99 |
| POST | `/` | `/backend/tickets` | `requireAuth` | inline | 118 |
| GET | `/mine` | `/backend/tickets/mine` | `requireAuth` | inline | 167 |
| GET | `/:id` | `/backend/tickets/:id` | `requireAuth` | inline | 187 |
| POST | `/:id/messages` | `/backend/tickets/:id/messages` | `requireAuth` | inline | 213 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 258 |

## Interfaces

- **Database (Mongoose models used):**
  - `Ticket` (server/models/ticket.model.ts) — reads: `find`, `findById`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/ticket.model.ts` — `Ticket`
  - `server/models/user.model.ts` — `User`
  - `server/services/ticketAttachments.service.ts` — `presignTicketUpload`, `TicketUploadValidationError`
  - `server/services/ticketHelpers.ts` — `sanitiseAttachments`, `withViewUrls`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/tickets`.
