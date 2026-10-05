# `server/note-taker/summarization/summarizer.ts`

> Module exporting `generateAndSaveSummary`.

**Kind:** Note-Taker module — summarization · **Lines:** 238

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SummaryResult` | interface |  | 37 |
| `generateAndSaveSummary` | function | `async generateAndSaveSummary(sessionId: Types.ObjectId): Promise<Types.ObjectId>` — Generate and save a meeting summary for a NoteSession. | 49 |

## Interfaces

- **Database (Mongoose models used):**
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findById`; **writes:** `findByIdAndUpdate`
  - `NoteTranscript` (server/note-taker/models/note-transcript.model.ts) — reads: `findOne`
  - `NoteSummary` (server/note-taker/models/note-summary.model.ts) — **writes:** `create`
- **Environment via `server/config/env.ts`:** `env.OPENAI_API_KEY`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/note-taker/models/note-transcript.model.ts` — `NoteTranscript`
  - `server/note-taker/models/note-summary.model.ts` — `NoteSummary`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
  - `server/note-taker/summarization/prompts.ts` — `MEETING_SUMMARY_SYSTEM_PROMPT`, `buildUserPrompt`, `CHUNK_SUMMARY_SYSTEM_PROMPT`, `buildChunkUserPrompt`, `MERGE_SUMMARY_SYSTEM_PROMPT`, `buildMergeUserPrompt`
  - `server/note-taker/summarization/transcript-preprocess.ts` — `preprocessSegments`, `formatForPrompt`, `estimateTokens`, `chunkForMapReduce`
- **Packages:**
  - `openai`
  - `mongoose` — `Types`

## Used by

- `server/note-taker/jobs/summarize.worker.ts`
