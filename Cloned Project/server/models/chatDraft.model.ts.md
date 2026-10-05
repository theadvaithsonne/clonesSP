# `server/models/chatDraft.model.ts`

> src/models/chatDraft.model.ts

**Kind:** Mongoose model · **Lines:** 43

<!-- docgen:auto -->

## Purpose
src/models/chatDraft.model.ts

Unsent message drafts, so a draft started on the phone is there on the web.

P2-4 in the spec and explicitly optional — drafts living only on the device
is normal for chat apps. Built because it is three routes on the same shape
as the rest of /chat/*; the client decides whether to use it.

An empty string deletes the row rather than storing a blank, so `GET
/chat/drafts` never returns entries the UI would have to filter out.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChatDraft`

- **Collection:** `chatdrafts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `convKey` | `String` | required, trim |
| `text` | `String` | default "" |

### Indexes

- `{ userId: 1, convKey: 1 }, { unique: true }` (L40)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_DRAFT_LENGTH` | const | `= 5000` — Matches the message composer's own limit. | 15 |
| `IChatDraft` | interface |  | 17 |
| `ChatDraft` | model | `model<IChatDraft>("ChatDraft", ChatDraftSchema)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/chat.ts`
