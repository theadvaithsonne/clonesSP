# `server/models/supportTicket.model.ts`

> Mongoose model for the legacy per-organisation support ticket (subject, module, priority, status, assignment and a thread of responses).

**Kind:** Mongoose model · **Lines:** 129

## Purpose
This model backed the original `/support-tickets` feature. Members of an org raised tickets, and a global admin could assign them to a Garage HQ user or floor. The feature has been **retired** in favour of the newer `Ticket` model served at `/tickets` and `/garage-admin/tickets`. In `server/app.ts` the mount `app.use("/support-tickets", supportTicketsRoutes)` is commented out and kept for rollback. Legacy documents are copied into `Ticket` by `server/scripts/migrate-support-tickets.ts`.

## How it works
### Fields
- `orgId` -> `Organization` and `createdBy` -> `User`: both required and indexed.
- `subject`: required, trimmed, max 200. `description`: required, trimmed, max 5000.
- `module`: required, trimmed, default `"General"` (the product area the ticket is about).
- `priority`: `low | medium | high | urgent`, default `medium`.
- `status`: `open | in_progress | resolved | closed`, default `open`, indexed.
- `attachments`: array of file URLs, default `[]`.
- **Assignment:** `assignedTo` -> `User` (indexed), `assignedToFloor` -> `Floor` (indexed; any member of that floor can handle the ticket), `assignedAt`, `assignedBy` -> `User`.
- `responses[]`: `{ respondedBy -> User (required), message (required, max 5000), attachments[], createdAt (default now) }`.
- `timestamps: true`.

### Indexes
`{ orgId, status }`, `{ orgId, createdBy }`, `{ orgId, createdAt: -1 }`.

## Exports
- `SupportTicket` - Mongoose model `"SupportTicket"` (collection `supporttickets`).
- `ISupportTicket` - document interface.

## Interfaces
- **Database:** `SupportTicket` (collection `supporttickets`). Read and written by the legacy route; read by the migration script.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/supportTickets.ts`. Its endpoints (`POST /`, `GET /my`, `GET /all`, `GET /global`, `GET /:id`, `PATCH /:id/status`, `POST /:id/response`, `PATCH /:id/assign`, and more) are **not mounted** at the moment.
- `server/scripts/migrate-support-tickets.ts`, a one-off migration run by hand with tsx (dry run by default, `--apply` to write). It reads these documents and inserts `Ticket` documents, tagging each with `legacySupportTicketId` so re-runs skip migrated rows. It runs against the production database (`MONGODB_URI`).

## Notes
- This is dead code at runtime unless the route mount is restored. New support work belongs on `Ticket`.
