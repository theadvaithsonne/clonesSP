# `server/realtime/idempotentSend.ts`

> Helpers for the Socket.IO chat server: de-duplicate re-sent chat messages by a client-supplied `clientMsgId`, and mark a user's pending direct messages as delivered when they connect.

**Kind:** Socket.IO / realtime · **Lines:** 114

## Purpose
The mobile app keeps unsent messages in an outbox and re-sends them after reconnecting. If the first attempt was saved but its ack was lost, a plain re-send would store the message twice. This file gives `server/realtime/socket.ts` a "create once per (sender, clientMsgId)" primitive that works with any chat model, plus the "second grey tick" delivery sweep that runs on every socket connect.

## How it works

### Idempotent create (L6-L63)
- The header comment explains why `tempId` is *not* reused as the idempotency key: web clients build it from `Date.now()` alone, so two sends in the same millisecond would collide and the second would be silently dropped. A separate random `clientMsgId` is used instead.
- `validClientMsgId(value)` accepts only a non-empty string of at most 100 characters (`MAX_CLIENT_MSG_ID_LENGTH`); anything else becomes `undefined`, which disables de-duplication for that send.
- `findExisting` (private) looks up `{ from: ObjectId(from), clientMsgId }` on the given model, populates `replyTo` and returns a lean document.
- `createOnce(model, doc, from, clientMsgId)`:
  1. No `clientMsgId` -> just `model.create(doc)` and return `{ created }`.
  2. Otherwise look for a prior copy; if found return `{ existing }`.
  3. Else create `{ ...doc, clientMsgId }`. If two retries raced past the lookup, the unique index rejects one with Mongo error code `11000`; the function then re-reads the winner and returns it as `{ existing }`. Any other error is re-thrown.
- Contract for callers: on `{ existing }` the caller acks with the stored message and skips every side effect (broadcast, notification, push), because those already ran for the first copy.

### Delivery sweep (L65-L113)
- `markPendingDMsDelivered(io, userId)` runs when a user's socket connects. It matches `Message` rows addressed to them (`to`) that are not yet delivered, read or deleted (`deliveredAt`, `readAt`, `deletedAt` all `null`) and were created within the last 7 days (`DELIVERY_SWEEP_WINDOW_MS`). The window stops a first connect from back-filling years of history.
- It groups the matches by `(from, convId)` with an aggregation. For each sender:
  - If the recipient has blocked the sender (`hasBlocked(userId, senderId)`), it is skipped, so a blocked sender keeps seeing a single tick. A failed block lookup is treated as "blocked" (`.catch(() => true)`), which errs on the side of not leaking delivery.
  - Otherwise it sets `deliveredAt` on that conversation's pending messages with `updateMany`, and if any rows changed emits `dm:delivered` to the sender's `user:<senderId>` room with `{ convId, by, deliveredAt, since }`. `since` lets the sender's client tick only messages inside the sweep window.

## Exports
- `validClientMsgId(value: unknown): string | undefined` - sanitises the client-supplied idempotency key.
- `createOnce(model, doc, from, clientMsgId): Promise<{ created } | { existing }>` - creates a message once per sender and key.
- `markPendingDMsDelivered(io: Server, userId: string): Promise<void>` - delivery sweep on connect.

## Interfaces
- **Socket.IO events:** emits `dm:delivered` to `user:<senderId>` rooms.
- **Database:** `Message` (`server/models/message.model.ts`) - aggregate and `updateMany` on `deliveredAt`; `createOnce` reads and writes whatever model it is given. In `socket.ts` that is `Message` (`dm:message`), `GlobalMessage` (`global-dm:message`) and `GroupMessage` (`group:message`). Each of those schemas has a `clientMsgId` field and a partial unique index on `{ from: 1, clientMsgId: 1 }` (only string `clientMsgId` values are indexed, so older rows without one cannot collide). Block state comes from `hasBlocked` in `server/models/chatBlock.model.ts`.

## Dependencies
- **Internal:** `server/models/message.model.ts` - `Message` model for the delivery sweep; `server/models/chatBlock.model.ts` - `hasBlocked(blockerId, senderId)`.
- **Packages:** `mongoose` - `Types.ObjectId`, `Model` type; `socket.io` - `Server` type for emitting.

## Used by
- `server/realtime/socket.ts` only. It calls `markPendingDMsDelivered` in the connection handler right after the socket joins its `user:<id>` room, and wraps the saves in the `dm:message`, `global-dm:message` and `group:message` handlers with `createOnce(..., validClientMsgId(clientMsgId))`.

## Notes
- The race handling in `createOnce` depends on the partial unique index existing in MongoDB. If the index has not been built, concurrent retries can still produce duplicates.
- `findExisting` always calls `.populate("replyTo")`, so any model passed to `createOnce` needs a `replyTo` path (or populate is a no-op for it).
- The sweep handles only 1:1 `Message` DMs, not global or group messages.
