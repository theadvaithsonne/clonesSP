# `server/note-taker/jobs/distribute.worker.ts`

> Module exporting `startDistributeWorker`.

**Kind:** Note-Taker module — BullMQ job/worker · **Lines:** 113

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `startDistributeWorker` | function | `startDistributeWorker(): Worker` | 11 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findById`
  - `NoteSummary` (server/note-taker/models/note-summary.model.ts) — reads: `findOne`
  - `NoteTranscript` (server/note-taker/models/note-transcript.model.ts) — reads: `findOne`
- **Timers / queues:** `new Worker("notetaker-distribute")` at L12

## Dependencies

- **Internal:**
  - `server/note-taker/jobs/queue.ts` — `redisConnection`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
  - `server/note-taker/models/note-summary.model.ts` — `NoteSummary`
  - `server/note-taker/models/note-transcript.model.ts` — `NoteTranscript`
  - `server/note-taker/distribution/participant-resolver.ts` — `resolveParticipantEmails`
  - `server/note-taker/distribution/email-template.ts` — `buildSummaryEmail`, `buildTranscriptFallbackEmail`
  - `server/note-taker/distribution/email-sender.ts` — `sendEmail`
- **Packages:**
  - `bullmq` — `Worker`, `Job`
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
