# `server/scripts/migrate-support-tickets.ts`

> One-time migration: copy legacy `SupportTicket` docs into the new `Ticket` collection so we can retire the old `/support-tickets` route + mobile screen.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 173

<!-- docgen:auto -->

## Purpose
One-time migration: copy legacy `SupportTicket` docs into the new
`Ticket` collection so we can retire the old `/support-tickets`
route + mobile screen.

Field mapping:
  subject              → title
  description          → description
  module               → category
  priority             → priority   (identical enum)
  status               → status     (identical enum)
  createdBy (ObjectId) → userId      + look up name/email from User
  orgId                → orgId
  attachments: string[] (URLs)
                       → attachments[].name (URL stored as display name;
                                             key = same URL since we have
                                             no S3 key for legacy uploads) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `SupportTicket` (server/models/supportTicket.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/supportTicket.model.ts` — `SupportTicket`
  - `server/models/ticket.model.ts` — `Ticket`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-support-tickets.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
