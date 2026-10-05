# `server/routes/chat.ts`

> src/routes/chat.ts

**Kind:** Express router · **Lines:** 717 · **Mounted at:** `/chat` (browser: `/backend/chat`)

<!-- docgen:auto -->

## Purpose
src/routes/chat.ts

Cross-device chat state: mutes, pins, stars, blocks, drafts, and search.

Everything here is keyed on a viewer-relative `convKey` —
`dm:<otherUserId>` or `group:<groupId>` — which is the key the mobile client
and the push payload (`data.chatId`) already use. DM message rows are keyed
on the SORTED `convId` (`dm:<a>:<b>`) instead, so the two are converted at
the boundary by `convIdForKey` rather than anywhere deeper.

Guards are attached PER ROUTE, never `router.use(requireAuth)` — see the
Express note in CLAUDE.md. This router owns the whole `/chat` prefix today,
but a second router mounted alongside it later would be intercepted by a
router-level guard, which is exactly how admin login broke once.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (14)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/mutes` | `/backend/chat/mutes` | `requireAuth` | inline | 119 |
| PUT | `/mutes/:convKey` | `/backend/chat/mutes/:convKey` | `requireAuth` | inline | 147 |
| DELETE | `/mutes/:convKey` | `/backend/chat/mutes/:convKey` | `requireAuth` | inline | 175 |
| GET | `/pins` | `/backend/chat/pins` | `requireAuth` | inline | 195 |
| PUT | `/pins` | `/backend/chat/pins` | `requireAuth` | inline | 213 |
| POST | `/stars` | `/backend/chat/stars` | `requireAuth` | inline | 249 |
| DELETE | `/stars/:messageId` | `/backend/chat/stars/:messageId` | `requireAuth` | inline | 284 |
| GET | `/stars` | `/backend/chat/stars` | `requireAuth` | inline | 310 |
| GET | `/blocks` | `/backend/chat/blocks` | `requireAuth` | inline | 449 |
| PUT | `/blocks/:userId` | `/backend/chat/blocks/:userId` | `requireAuth` | inline | 465 |
| DELETE | `/blocks/:userId` | `/backend/chat/blocks/:userId` | `requireAuth` | inline | 492 |
| GET | `/drafts` | `/backend/chat/drafts` | `requireAuth` | inline | 515 |
| PUT | `/drafts/:convKey` | `/backend/chat/drafts/:convKey` | `requireAuth` | inline | 542 |
| GET | `/search` | `/backend/chat/search` | `requireAuth` | inline | 590 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 716 |

## Interfaces

- **Database (Mongoose models used):**
  - `Message` (server/models/message.model.ts) — reads: `findOne`, `find`
  - `Group` (server/models/group.model.ts) — reads: `findOne`, `find`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `findOne`, `find`
  - `ChatMute` (server/models/chatMute.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`, `deleteOne`
  - `ChatPin` (server/models/chatPin.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
  - `ChatStar` (server/models/chatStar.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`, `deleteOne`, `deleteMany`
  - `ChatBlock` (server/models/chatBlock.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`, `deleteOne`
  - `ChatDraft` (server/models/chatDraft.model.ts) — reads: `find`; **writes:** `deleteOne`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/message.model.ts` — `Message`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/group.model.ts` — `Group`
  - `server/models/chatMute.model.ts` — `ChatMute`
  - `server/models/chatPin.model.ts` — `ChatPin`, `MAX_PINNED_CHATS`
  - `server/models/chatStar.model.ts` — `ChatStar`
  - `server/models/chatBlock.model.ts` — `ChatBlock`
  - `server/models/chatDraft.model.ts` — `ChatDraft`, `MAX_DRAFT_LENGTH`
  - `server/models/chatClear.model.ts` — `clearedAtMap`
  - `server/utils/conv.ts` — `dmConvId`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/chat`.
