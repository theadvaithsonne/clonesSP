# `server/note-taker/transcription/transcription-manager.ts`

> Module exporting `TranscriptionManager`.

**Kind:** Note-Taker module — transcription · **Lines:** 178

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TranscriptionManager` | class | Manages real-time transcription for a single bot session. | 21 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Timers / queues:** `setTimeout` at L149

## Dependencies

- **Internal:**
  - `server/note-taker/agents/bot-session.ts` — `BotSession`, `ParticipantInfo`
  - `server/note-taker/transcription/deepgram-stream.ts` — `DeepgramStream`
  - `server/note-taker/transcription/segment-accumulator.ts` — `SegmentAccumulator`
  - `server/note-taker/transcription/transcript-builder.ts` — `buildAndSaveTranscript`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/note-taker/agents/bot-manager.ts`
