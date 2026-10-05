# `lib/api/tickets.ts`

> The user-facing support-ticket client: create tickets, list your own, read one, reply, and upload attachments straight to storage through presigned URLs.

**Kind:** frontend library · **Lines:** 115

## Purpose
Signed-in users can open support tickets and talk with admins in a thread. This file wraps the authenticated `/tickets` backend routes using the shared `api()` helper, which attaches the user's JWT automatically. It also provides a helper that uploads attachment files without the bytes passing through the server.

## How it works
- **Types:** `TicketStatus` (`open | in_progress | resolved | closed`), `TicketPriority` (`low | medium | high | urgent`), `TicketAttachment` (storage `key` plus an optional URL, name, content type and size), `TicketMessage` (`authorRole` of `user` or `admin`), `Ticket` (owner, org, optional `isGuest`, title, description, status, priority, category, attachments, messages, `lastActivityAt`, and the `hasUnreadForUser`/`hasUnreadForAdmin` flags), and `PresignUploadOutput`.
- **`ticketsApi`**:
  - `presignUpload({ mimeType, filename?, sizeBytes? })`: `POST /tickets/upload-url`.
  - `create({ title, description, priority?, category?, attachments? })`: `POST /tickets`.
  - `listMine()`: `GET /tickets/mine`, returns `{ tickets }`.
  - `get(id)`: `GET /tickets/:id`.
  - `addMessage(id, body, attachments = [])`: `POST /tickets/:id/messages`, returns the updated ticket.
- **`uploadTicketFile(file)`** presigns (with mime type defaulting to `application/octet-stream`), then `PUT`s the file to `uploadUrl` with the returned `uploadHeaders`. It throws `Upload failed: <status>` on failure and returns a `TicketAttachment` with the key, `publicUrl`, name, type and size. That attachment is then passed to `create` or `addMessage`.
- Errors come from `api()`: a thrown `Error` with the server's `error` or `message`.

## Exports
- Types: `TicketStatus`, `TicketPriority`, `TicketAttachment`, `TicketMessage`, `Ticket`, `PresignUploadOutput`.
- `ticketsApi` - `{ presignUpload, create, listMine, get, addMessage }`.
- `uploadTicketFile(file: File): Promise<TicketAttachment>`
- `API_URL`, `getToken` - re-exported from `lib/api.ts` and `lib/auth.ts`. The comment says these are "for the admin-side helper that lives elsewhere".

## Interfaces
- **Backend endpoints called** (all `requireAuth`, served by `server/routes/tickets.ts`, mounted at `/tickets`):
  - `POST /backend/tickets/upload-url` - presign an attachment upload (`presignTicketUpload`, which validates type and size).
  - `POST /backend/tickets` - create a ticket.
  - `GET /backend/tickets/mine` - the caller's tickets.
  - `GET /backend/tickets/:id` - one ticket.
  - `POST /backend/tickets/:id/messages` - reply.
- **External services:** the presigned `uploadUrl` (object storage; the backend decides the provider). The browser PUTs the file there directly.
- **Database (via backend):** `Ticket` model.
- **Browser storage / cookies:** `garage_tok` through `api()`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()`, `API_URL`. `lib/auth.ts` - `getToken` (re-exported only).
- **Packages:** none.

## Used by
- `app/(dashboard)/tickets/page.tsx` - ticket list (`/tickets`).
- `app/(dashboard)/tickets/new/page.tsx` - new ticket (`/tickets/new`).
- `app/(dashboard)/tickets/[id]/page.tsx` - ticket thread (`/tickets/[id]`).

## Notes
- The backend also has unauthenticated `POST /tickets/public` and `POST /tickets/upload-url-public` routes for guests. This client doesn't use them.
