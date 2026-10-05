# `server/models/chatStar.model.ts`

> src/models/chatStar.model.ts

**Kind:** Mongoose model · **Lines:** 44

<!-- docgen:auto -->

## Purpose
src/models/chatStar.model.ts

Starred (saved) messages, synced across devices.

Only the POINTER is stored — `convKey` + `messageId`. The message body is
resolved at read time from Message/GroupMessage, so an edited message shows
its current text and a deleted one can be dropped. Storing a snapshot (what
the phone does today) is what makes on-device stars drift from reality.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChatStar`

- **Collection:** `chatstars` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `convKey` | `String` | required, trim |
| `messageId` | `Schema.Types.ObjectId` | required |

### Indexes

- `{ userId: 1, messageId: 1 }, { unique: true }` (L38)
- `{ userId: 1, createdAt: -1 }` (L40)
- `{ userId: 1, convKey: 1, createdAt: -1 }` (L41)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IChatStar` | interface |  | 12 |
| `ChatStar` | model | `model<IChatStar>("ChatStar", ChatStarSchema)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/chat.ts`
