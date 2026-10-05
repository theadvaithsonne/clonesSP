# `server/models/chatPin.model.ts`

> src/models/chatPin.model.ts

**Kind:** Mongoose model · **Lines:** 38

<!-- docgen:auto -->

## Purpose
src/models/chatPin.model.ts

Pinned chats, synced across a user's devices.

Stored as ONE ordered array per user rather than a row per pin, because the
order is the whole point and the client always writes the complete list.
A row-per-pin shape would need an explicit `order` column plus a transaction
to keep it consistent on reorder; an array is atomic for free.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChatPin`

- **Collection:** `chatpins` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, unique, ref "User" |
| `pins` | `[String]` | default [] |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_PINNED_CHATS` | const | `= 5` — Client-side cap is 5; enforced server-side too so the array cannot grow. | 13 |
| `IChatPin` | interface |  | 15 |
| `ChatPin` | model | `model<IChatPin>("ChatPin", ChatPinSchema)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/chat.ts`
