# `server/note-taker/routes/summaries.ts`

> Express router with 3 endpoints, mounted at `/note-taker`.

**Kind:** Note-Taker module — Express router · **Lines:** 143 · **Mounted at:** `/note-taker` (browser: `/backend/note-taker`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/sessions/:id/summary` | `/backend/note-taker/sessions/:id/summary` | `requireAuth` | inline | 12 |
| GET | `/by-workshop/:workshopId/summary` | `/backend/note-taker/by-workshop/:workshopId/summary` | `requireAuth` | inline | 54 |
| POST | `/sessions/:id/regenerate-summary` | `/backend/note-taker/sessions/:id/regenerate-summary` | `requireAuth` | inline | 104 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 142 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findOne`
  - `NoteSummary` (server/note-taker/models/note-summary.model.ts) — reads: `findOne`, `findById`; **writes:** `findByIdAndDelete`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/note-taker/models/note-summary.model.ts` — `NoteSummary`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
  - `server/note-taker/jobs/queue.ts` — `enqueueSummarize`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/note-taker`.
