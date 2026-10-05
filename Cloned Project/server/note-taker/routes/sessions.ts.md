# `server/note-taker/routes/sessions.ts`

> Express router with 6 endpoints, mounted at `/note-taker/sessions`.

**Kind:** Note-Taker module — Express router · **Lines:** 220 · **Mounted at:** `/note-taker/sessions` (browser: `/backend/note-taker/sessions`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/join` | `/backend/note-taker/sessions/join` | `requireAuth` | inline | 14 |
| POST | `/leave` | `/backend/note-taker/sessions/leave` | `requireAuth` | inline | 70 |
| GET | `/` | `/backend/note-taker/sessions` | `requireAuth` | inline | 112 |
| GET | `/:id` | `/backend/note-taker/sessions/:id` | `requireAuth` | inline | 149 |
| DELETE | `/:id` | `/backend/note-taker/sessions/:id` | `requireAuth` | inline | 168 |
| POST | `/:id/send` | `/backend/note-taker/sessions/:id/send` | `requireAuth` | inline | 195 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 219 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findOne`, `find`, `countDocuments`; **writes:** `create`, `findOneAndDelete`
  - `NoteTranscript` (server/note-taker/models/note-transcript.model.ts) — **writes:** `findByIdAndDelete`
  - `NoteSummary` (server/note-taker/models/note-summary.model.ts) — **writes:** `findByIdAndDelete`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
  - `server/note-taker/models/note-transcript.model.ts` — `NoteTranscript`
  - `server/note-taker/models/note-summary.model.ts` — `NoteSummary`
  - `server/note-taker/agents/bot-manager.ts` — `BotManager`
  - `server/note-taker/jobs/queue.ts` — `enqueueDistribute`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/note-taker/sessions`.
