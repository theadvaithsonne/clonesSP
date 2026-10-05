# `server/note-taker/routes/transcripts.ts`

> Express router with 3 endpoints, mounted at `/note-taker`.

**Kind:** Note-Taker module — Express router · **Lines:** 187 · **Mounted at:** `/note-taker` (browser: `/backend/note-taker`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/sessions/:id/transcript` | `/backend/note-taker/sessions/:id/transcript` | `requireAuth` | inline | 55 |
| GET | `/sessions/:id/transcript/download` | `/backend/note-taker/sessions/:id/transcript/download` | `requireAuth` | inline | 83 |
| GET | `/search` | `/backend/note-taker/search` | `requireAuth` | inline | 142 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 186 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findOne`, `find`
  - `NoteTranscript` (server/note-taker/models/note-transcript.model.ts) — reads: `findOne`, `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/note-taker/models/note-transcript.model.ts` — `NoteTranscript`, `INoteTranscript`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/note-taker`.
