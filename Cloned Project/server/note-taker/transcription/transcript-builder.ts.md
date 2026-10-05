# `server/note-taker/transcription/transcript-builder.ts`

> Module exporting `buildAndSaveTranscript`.

**Kind:** Note-Taker module — transcription · **Lines:** 43

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `buildAndSaveTranscript` | function | `async buildAndSaveTranscript(sessionId: Types.ObjectId, accumulator: SegmentAccumulator, language = 'en'): Promise<Types.ObjectId>` — Build and save a finalized NoteTranscript document from accumulated segments. | 10 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteTranscript` (server/note-taker/models/note-transcript.model.ts) — **writes:** `create`
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — **writes:** `findByIdAndUpdate`

## Dependencies

- **Internal:**
  - `server/note-taker/models/note-transcript.model.ts` — `NoteTranscript`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
  - `server/note-taker/transcription/segment-accumulator.ts` — `SegmentAccumulator`
  - `server/note-taker/jobs/queue.ts` — `enqueueSummarize`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/note-taker/transcription/transcription-manager.ts`
