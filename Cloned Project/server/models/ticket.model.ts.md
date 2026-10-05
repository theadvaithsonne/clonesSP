# `server/models/ticket.model.ts`

> Mongoose model for Garage support tickets (user, guest, admin-manual and AI-from-chat), with an embedded message thread and a post-save hook that mirrors new tickets to the Taskroom board.

**Kind:** Mongoose model · **Lines:** 156

## Purpose
Support tickets are raised by signed-in users, by guests (no account), by garage admins manually, or automatically by the AI from a support group chat. Each ticket holds the reporter details, status and priority, an AI- or admin-assigned owner, the conversation between user and admins, attachments, and unread flags for both sides. It replaced the legacy support-tickets endpoint (see the comment around the commented-out `/support-tickets` mount in `server/app.ts`; migration via `server/scripts/migrate-support-tickets.ts`).

## How it works

### Types and sub-schemas
- `TicketStatus`: `open | in_progress | resolved | closed`. `TicketPriority`: `low | medium | high | urgent`. `TicketAuthorRole`: `user | admin`.
- `AttachmentSchema` (`_id: false`): `key` (required; a storage key, not a URL), `name`, `contentType`, `size`.
- `MessageSchema` (has its own `_id`): `authorRole`, `authorId`, `authorName`, `body` (all required), `attachments[]`, `createdAt` (defaults to now).

### Ticket fields (L84-L125)
- Reporter: `userId` (nullable, indexed; null for guests), `userEmail` (required, lowercased, indexed), `userName` (required), `orgId` (nullable, indexed), `isGuest` (default false, indexed).
- Content: `title` (required, max 200), `description` (required, max 5000), `category`, `attachments[]`, `messages[]`.
- State: `status` (default `open`, indexed), `priority` (default `medium`), `lastActivityAt` (default now, indexed), `hasUnreadForUser` (default false), `hasUnreadForAdmin` (default true, so a new ticket shows as unread in the admin queue).
- Chat origin: `source` (`chat | manual`), `groupId` (-> `Group`), `sourceMessageId` (-> `GroupMessage`), `aiGenerated` (default false).
- Assignment: `assignedToId` (-> `GarageAdmin`, indexed), denormalised `assignedToName` / `assignedToEmail` so the queue renders without a join, `assignedBy` (`ai | admin`), `assignedAt`, `assignReason` (AI rationale shown as an admin tooltip).
- Taskroom mirror: `taskroomTaskId`, `taskroomRoomId`.
- Compound indexes: `{ status, lastActivityAt: -1 }` (admin queue) and `{ userId, lastActivityAt: -1 }` (a user's tickets). Timestamps on.

### Taskroom mirroring hooks (L130-L146)
Every newly created ticket is mirrored onto the shared "Garage Support" Taskroom board. A `pre("save")` hook records `this.isNew` into `$locals.wasNewTicket` (because `isNew` is already false in post-save); a `post("save")` hook then dynamically imports `server/services/supportTicketTaskroom.ts` and calls `createTaskForTicket(id)` fire-and-forget, swallowing errors. Doing it in the model means all four creation paths get the mirror. `createTaskForTicket` itself is idempotent (it returns early when `taskroomTaskId` is already set) and is skipped when `SUPPORT_TICKET_TASKROOM_DISABLED === "true"`. Taskroom is an external service.

### Collection pinning
The model is bound explicitly to collection **`tickets_garage`**: Garage and NetworkChain share the same production cluster and database, and NetworkChain uses `tickets_networkchain`.

## Exports
- `Ticket` - Mongoose model `"Ticket"` on collection `tickets_garage`.
- `type TicketStatus`, `type TicketPriority`, `type TicketAuthorRole`.
- `interface ITicketAttachment`, `interface ITicketMessage`, `interface ITicket`.

## Interfaces
- **Database:** `Ticket` (collection `tickets_garage`).
- **External services:** Taskroom (via `supportTicketTaskroom.ts`) on every new ticket.
- **Environment variables:** indirectly `SUPPORT_TICKET_TASKROOM_DISABLED` (read by the service).

## Dependencies
- **Internal:** `server/services/supportTicketTaskroom.ts` - lazily imported in the post-save hook (dynamic import avoids a load-time model/service cycle).
- **Packages:** `mongoose`.

## Used by
`server/routes/tickets.ts` (mounted at `/tickets`: user-facing and public guest path), `server/routes/garageAdminTickets.ts` (`/garage-admin/tickets`), `server/routes/garageAdminSupportChats.ts`, services `supportChatTaskroom.ts`, `supportTicketAuto.ts`, `supportTicketSuggest.ts`, `supportTicketTaskroom.ts`, `ticketAutoAssign.ts`, `ticketHelpers.ts`, and the hand-run migration `server/scripts/migrate-support-tickets.ts`.

## Notes
- The mirror only fires through `save()` / `create()`. Tickets inserted with `insertMany` or raw driver calls skip it.
- `userId`, `orgId` and `assignedToId` have no `ref` on `userId`/`orgId`, so `populate` on them needs an explicit model.
