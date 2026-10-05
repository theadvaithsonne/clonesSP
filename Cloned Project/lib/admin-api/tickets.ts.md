# `lib/admin-api/tickets.ts`

> Garage-admin client for support tickets: list, read, create on a member's behalf, reply, change status or priority, and assign to an admin.

**Kind:** frontend library · **Lines:** 115

## Purpose
This module backs the admin Tickets page. It uses `garageAdminApi`, which attaches the garage-admin JWT; that is a different token from the member's user login. Members create tickets on the member-facing side. Tickets can also be raised from a support chat, either by an admin or automatically by the AI (see `lib/admin-api/support-chats.ts`).

## How it works
- `AdminTicket` describes the full ticket:
  - who raised it (`userId`, which may be null, `userEmail`, `userName`, `isGuest`), and `orgId`;
  - title, description, `status` (`open | in_progress | resolved | closed`), `priority` (`low | medium | high | urgent`), `category`;
  - `source` (`chat` or `manual`) and `aiGenerated`;
  - assignment fields: `assignedToId/Name/Email`, `assignedBy` (`ai` when routed automatically on creation, `admin` when a person set it), `assignedAt`, `assignReason`;
  - attachments and a `messages` thread (each message has `authorRole` `user` or `admin`);
  - `lastActivityAt` and unread flags for each side.
- `adminTicketsApi` is a plain object of thin wrappers. Each returns the backend response unchanged (`{ tickets }` for the list, the ticket itself for everything else).

## Exports
- Types: `AdminTicketStatus`, `AdminTicketPriority`, `AdminTicketAttachment` (`key`, `url?`, `name?`, `contentType?`, `size?`), `AdminTicketMessage`, `AdminTicket`.
- `adminTicketsApi`:
  - `list(status?)` - all tickets, optionally filtered by status
  - `get(id)` - one ticket
  - `create({ title, description, forEmail, forName?, priority?, category? })` - raise a ticket by hand for a member, outside any chat
  - `reply(id, body, attachments?)` - post an admin message
  - `update(id, { status?, priority?, category? })` - change ticket fields
  - `assign(id, adminId)` - hand the ticket to an admin (sets `assignedBy` to `"admin"`)
  - `unassign(id)` - clear the assignment

## Interfaces
- **Backend endpoints called** (`server/routes/garageAdminTickets.ts`, mounted at `/garage-admin/tickets`):
  - `GET /backend/garage-admin/tickets?status=` - list
  - `GET /backend/garage-admin/tickets/:id` - read
  - `POST /backend/garage-admin/tickets` - create
  - `POST /backend/garage-admin/tickets/:id/messages` - reply
  - `PATCH /backend/garage-admin/tickets/:id` - update fields
  - `PATCH /backend/garage-admin/tickets/:id/assign` - assign
  - `PATCH /backend/garage-admin/tickets/:id/unassign` - unassign

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/tickets/page.tsx`
