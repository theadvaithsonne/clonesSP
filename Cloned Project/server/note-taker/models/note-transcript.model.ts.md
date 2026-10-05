# `server/note-taker/models/note-transcript.model.ts`

> Mongoose model `NoteTranscript` (collection `notetranscripts`) with 7 top-level fields.

**Kind:** Note-Taker module — Mongoose model · **Lines:** 44

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `NoteTranscript`

- **Collection:** `notetranscripts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `sessionId` | `Schema.Types.ObjectId` | required, index, ref 'NoteSession' |
| `fullText` | `String` | default '' |
| `segments` | `[transcriptSegmentSchema]` | — |
| `language` | `String` | default 'en' |
| `wordCount` | `Number` | default 0 |
| `speakerCount` | `Number` | default 0 |
| `sttProvider` | `String` | default 'deepgram' |

### Indexes

- `{ fullText: 'text' }` (L41)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `INoteTranscript` | interface |  | 4 |
| `NoteTranscript` | model | `mongoose.model<INoteTranscript>('NoteTranscript', noteTranscriptSchema)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/note-taker/types.ts` — `TranscriptSegment`
- **Packages:**
  - `mongoose` — `Document`, `Schema`, `Types`

## Used by

- `server/note-taker/distribution/email-template.ts`
- `server/note-taker/jobs/distribute.worker.ts`
- `server/note-taker/routes/sessions.ts`
- `server/note-taker/routes/transcripts.ts`
- `server/note-taker/summarization/summarizer.ts`
- `server/note-taker/transcription/transcript-builder.ts`
