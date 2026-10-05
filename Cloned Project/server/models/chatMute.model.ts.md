# `server/models/chatMute.model.ts`

> src/models/chatMute.model.ts

**Kind:** Mongoose model · **Lines:** 67

<!-- docgen:auto -->

## Purpose
src/models/chatMute.model.ts

Per-user, per-conversation notification mute.

`convKey` is viewer-relative — `dm:<otherUserId>` or `group:<groupId>` —
which is the same key the push payload already carries as `data.chatId`.
Deliberately NOT the DM `convId` (`dm:<a>:<b>` sorted), because the client
mutes "this chat" from its own point of view and never knows the sorted pair.

`until: null` means muted indefinitely. A date in the past is treated as
expired rather than cleaned up eagerly — the read path already has to compare
against now, so a sweeper would buy nothing.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChatMute`

- **Collection:** `chatmutes` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `convKey` | `String` | required, trim |
| `until` | `Date` | default null |

### Indexes

- `{ userId: 1, convKey: 1 }, { unique: true }` (L41)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IChatMute` | interface |  | 16 |
| `ChatMute` | model | `model<IChatMute>("ChatMute", ChatMuteSchema)` | 43 |
| `mutedUserIds` | function | `async mutedUserIds(userIds: string[], convKey: string): Promise<Set<string>>` — Which of these users have an ACTIVE mute for this conversation? | 52 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/chat.ts`
- `server/services/pushNotification.ts`
