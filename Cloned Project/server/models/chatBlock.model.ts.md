# `server/models/chatBlock.model.ts`

> src/models/chatBlock.model.ts

**Kind:** Mongoose model · **Lines:** 73

<!-- docgen:auto -->

## Purpose
src/models/chatBlock.model.ts

Server-enforced blocking, synced across devices.

Direction matters: `userId` is the blocker, `blockedUserId` the blocked. A
block is one-way — the blocked person is never told, and their send still
acks `ok: true`, so the UI gives nothing away. The message is persisted as
normal and simply not delivered or pushed to the blocker.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChatBlock`

- **Collection:** `chatblocks` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `blockedUserId` | `Schema.Types.ObjectId` | required, index, ref "User" |

### Indexes

- `{ userId: 1, blockedUserId: 1 }, { unique: true }` (L38)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IChatBlock` | interface |  | 12 |
| `ChatBlock` | model | `model<IChatBlock>("ChatBlock", ChatBlockSchema)` | 40 |
| `hasBlocked` | function | `async hasBlocked(blockerId: string, senderId: string): Promise<boolean>` — Has `blockerId` blocked `senderId`? | 43 |
| `blockersOf` | function | `async blockersOf(candidateIds: string[], senderId: string): Promise<Set<string>>` — Of `candidateIds`, which have blocked `senderId`? | 60 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/realtime/idempotentSend.ts`
- `server/realtime/socket.ts`
- `server/routes/chat.ts`
- `server/services/pushNotification.ts`
