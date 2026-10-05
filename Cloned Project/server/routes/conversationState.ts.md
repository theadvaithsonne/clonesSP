# `server/routes/conversationState.ts`

> Per-user inbox state for DMs + groups.

**Kind:** Express router · **Lines:** 158 · **Mounted at:** `/conv-state` (browser: `/backend/conv-state`)

<!-- docgen:auto -->

## Purpose
Per-user inbox state for DMs + groups. Powers the LinkedIn-style
archive / mark-unread features without forking the message or group
models. See `models/conversationState.model.ts` for the schema
rationale; this router is the thin REST surface on top.

Endpoints (all auth-required):

  GET    /conv-state            list every state doc the user owns
                                — the inbox UI calls this once on
                                mount and overlays the result onto
                                the existing DM + group lists.

  POST   /conv-state/archive    { convId, kind }
  POST   /conv-state/unarchive  { convId }
  POST   /conv-state/mark-unread { convId, kind }
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/conv-state` | `requireAuth` | inline | 43 |
| POST | `/archive` | `/backend/conv-state/archive` | `requireAuth` | inline | 58 |
| POST | `/unarchive` | `/backend/conv-state/unarchive` | `requireAuth` | inline | 71 |
| POST | `/mark-unread` | `/backend/conv-state/mark-unread` | `requireAuth` | inline | 82 |
| POST | `/archive-bulk` | `/backend/conv-state/archive-bulk` | `requireAuth` | inline | 97 |
| POST | `/unarchive-bulk` | `/backend/conv-state/unarchive-bulk` | `requireAuth` | inline | 122 |
| POST | `/mark-unread-bulk` | `/backend/conv-state/mark-unread-bulk` | `requireAuth` | inline | 134 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 157 |

## Interfaces

- **Database (Mongoose models used):**
  - `ConversationState` (server/models/conversationState.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`, `bulkWrite`, `updateMany`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/conversationState.model.ts` — `ConversationState`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/conv-state`.
