# `server/models/chatClear.model.ts`

> src/models/chatClear.model.ts

**Kind:** Mongoose model · **Lines:** 96

<!-- docgen:auto -->

## Purpose
src/models/chatClear.model.ts

"Clear chat for me" — a per-user watermark, not a delete.

Nothing is removed from Message/GroupMessage: the other participants must
keep their copy. Reads for THIS user are filtered to `createdAt > clearedAt`,
which is also why the value is a timestamp rather than a boolean — clearing
twice moves the line forward, and messages sent after a clear reappear.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChatClear`

- **Collection:** `chatclears` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `convKey` | `String` | required, trim |
| `clearedAt` | `Date` | required |

### Indexes

- `{ userId: 1, convKey: 1 }, { unique: true }` (L36)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IChatClear` | interface |  | 13 |
| `ChatClear` | model | `model<IChatClear>("ChatClear", ChatClearSchema)` | 38 |
| `clearedAtFor` | function | `async clearedAtFor(userId: string, convKey: string): Promise<Date \| null>` — The clear watermark for one conversation, or null if never cleared. | 45 |
| `dmClearedNorClauses` | function | `async dmClearedNorClauses(userId: string): Promise<Array<{ convId: string; createdAt: { $lte…` — `$nor` clauses that exclude every DM message sitting at or before one of the caller's clear watermarks. | 67 |
| `clearedAtMap` | function | `async clearedAtMap(userId: string): Promise<Map<string, Date>>` — Watermarks for every conversation a user has cleared, keyed by convKey. | 88 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/conv.ts` — `dmConvId`
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/chat.ts`
- `server/routes/dm.ts`
- `server/routes/groups.ts`
