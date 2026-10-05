# `server/models/globalMessage.model.ts`

> Mongoose model for platform-wide direct messages between any two users, independent of any organisation.

**Kind:** Mongoose model · **Lines:** 43

## Purpose
Office DMs are scoped to an organisation; "global DMs" let any two Garage users talk regardless of org. This model stores those messages. Live sending happens over Socket.IO in `server/realtime/socket.ts`; history, read receipts, edit and delete are REST endpoints in `server/routes/globalDm.ts`.

## How it works
- `convId` - conversation key `global-dm:<a>:<b>` with the two user ids sorted, so both sides share it (indexed). It doubles as the Socket.IO room name.
- No `orgId` by design.
- `from`, `to` (ref `User`, required, indexed).
- `text` (trimmed), `attachments[]` (`fileName`, `fileSize`, `fileType`, `fileUrl`, `fileKey` = S3 key, `uploadedAt`).
- `replyTo` (ref `GlobalMessage`), `editedAt`, `readAt`.
- `reactions` - `Map<emoji, userId[]>`, same shape as office DMs and group messages.
- `clientMsgId` - sender-generated id for idempotent sends.
- Timestamps on.

Indexes: `{ convId, createdAt: -1 }` for paging history; partial unique `{ from, clientMsgId }` (only where `clientMsgId` is a string) so a resent message is not duplicated.

## Exports
- `GlobalMessage` - model `"GlobalMessage"` (default collection `globalmessages`), guarded against re-registration.

## Interfaces
- **Database:** collection `globalmessages` (read/write).
- **Socket.IO events (in `socket.ts`, using this model):** `global-dm:join`, `global-dm:leave`, `global-dm:message` (creates via `createOnce`), `global-dm:react` (emits `global-dm:message-reactions`), `global-dm:typing`, `global-dm:stopTyping`.
- **REST (in `routes/globalDm.ts`, mounted at `/global-dm`):** `GET /backend/global-dm/:otherId/messages`, `POST /backend/global-dm/:otherId/read`, `PUT /backend/global-dm/message/:messageId`, `DELETE /backend/global-dm/message/:messageId`, `GET /backend/global-dm/unread`, `/last-messages`, `/conversations`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/realtime/socket.ts` and `server/routes/globalDm.ts`.

## Notes
- The attachment sub-schema keeps Mongoose's default `_id`, unlike the group message variant which adds media metadata fields.
