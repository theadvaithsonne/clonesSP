# `server/models/message.model.ts`

> Mongoose model for one-to-one direct messages (DMs), including attachments with media metadata, replies, reactions, delivery/read receipts and idempotent sends.

**Kind:** Mongoose model · **Lines:** 70

## Purpose
`Message` holds every DM between two users. Group chat uses a different model (`GroupMessage`). DMs are scoped to a conversation id (`convId = dm:<a>:<b>` with the two user ids sorted) and optionally to an organization. The model backs the DM REST routes, the Socket.IO send path and the mobile app's idempotent sending.

## How it works
### `AttachmentSchema`
- Required: `fileName`, `fileSize`, `fileType`, `fileUrl`, `fileKey` (S3 key used for management). `uploadedAt` defaults to now.
- Optional playback/layout metadata, stored exactly as the client sends it, so the receiver can size a bubble before the file loads:
  - `durationMs` (audio/video), `width`/`height` (image/video).
  - `thumbnailUrl` - a poster frame the client already uploaded. It is never generated server-side.
  - `waveform` - up to 64 samples in 0..1 for voice notes. The cap is applied in the socket handler, which trims rather than rejects, "so a bad waveform must never cost someone their message".

### `MessageSchema`
- `convId` (indexed), `orgId` (ref `Organization`, indexed), `from` and `to` (ref `User`, required, indexed).
- `text` (trimmed), `attachments[]`, `replyTo` (ref `Message`, default null).
- `editedAt`, `readAt`, `deliveredAt`, `deletedAt` - all default null. `deliveredAt` is the "second grey tick", set when the recipient's app acknowledges receipt or when they reconnect with the message still pending. A set `readAt` implies delivered, so readers check `readAt` first. `deletedAt` is a soft delete.
- `reactions` - `Map<emoji, userId[]>`, default empty map.
- `clientMsgId` - a sender-generated id that makes a send idempotent: a retry after a lost ack returns the stored message instead of writing a copy. Only the mobile app sends it (see `realtime/idempotentSend.ts`).
- Timestamps on.

### Indexes
- `{ convId: 1, createdAt: -1 }` - paging a thread newest-first, and the conversation-scoped scan behind `/chat/search`. Before it existed, every page ended in a blocking in-memory sort.
- `{ from: 1, clientMsgId: 1 }` **unique, partial** (`clientMsgId` is a string) - idempotency. Old rows without `clientMsgId` are excluded and cannot collide.
- Deliberately **no text index**: Mongo text search matches whole stemmed words, so "re" would match nothing and "rep" would not find "report". Search is a case-insensitive regex bounded by the `convId` index instead.

## Exports
- `Message` - `models.Message || model("Message", MessageSchema)`. The guard reuses an already-compiled model, which avoids an `OverwriteModelError` if the module is evaluated twice.

## Interfaces
- **Database:** `Message` (collection `messages`) - read/write.
- **Background work:** `server/index.ts` runs a daily DM-retention sweep. For each conversation with `messageRetentionDays > 0` in `DmSettings`, it soft-deletes older messages (sets `deletedAt`, empties `text`, `attachments` and `reactions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/realtime/socket.ts`, `server/realtime/idempotentSend.ts` - real-time DM sending, delivery and read receipts.
- `server/routes/dm.ts` (mounted at `/dm`, browser `/backend/dm`), `server/routes/chat.ts` (mounted at `/chat`).
- `server/services/memberCleanup.service.ts` - cleanup when members are removed.
- `server/index.ts` - DM retention sweeper.
- Scripts `server/scripts/migrate-dm-to-org.ts` and `server/scripts/migrate-to-public-urls.ts` (one-off migrations run by hand against the production database).

## Notes
- There is no TypeScript interface; the model is loosely typed.
