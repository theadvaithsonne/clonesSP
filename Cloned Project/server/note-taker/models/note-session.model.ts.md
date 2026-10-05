# `server/note-taker/models/note-session.model.ts`

> Mongoose model `NoteSession` (collection `notesessions`) with 21 top-level fields.

**Kind:** Note-Taker module — Mongoose model · **Lines:** 98

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `NoteSession`

- **Collection:** `notesessions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `roomName` | `String` | required, index |
| `roomId` | `String` | required, index |
| `source` | `String` | index, default 'manual', enum ['meet', 'webinar', 'office', 'conference',… |
| `meetSessionId` | `Schema.Types.ObjectId` | ref 'MeetSession' |
| `orgId` | `Schema.Types.ObjectId` | required, index |
| `botIdentity` | `String` | — |
| `botJoinedAt` | `Date` | — |
| `botLeftAt` | `Date` | — |
| `title` | `String` | — |
| `startedAt` | `Date` | required |
| `endedAt` | `Date` | — |
| `durationSeconds` | `Number` | — |
| `participants` | `[participantSchema]` | — |
| `status` | `String` | default 'recording', enum ['recording', 'transcribing', 'summarizing'… |
| `error` | `String` | — |
| `transcriptId` | `Schema.Types.ObjectId` | — |
| `summaryId` | `Schema.Types.ObjectId` | — |
| `audioFileKey` | `String` | — |
| `emailsSentAt` | `Date` | — |
| `emailRecipients` | `[String]` | — |
| `settings` | `{ autoJoin, language, enableSummary, enableEmailDistribution }` | nested |

### Indexes

- `{ orgId: 1, startedAt: -1 }` (L94)
- `{ roomName: 1, startedAt: -1 }` (L95)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NoteSessionSource` | type |  | 4 |
| `INoteSession` | interface |  | 6 |
| `NoteSession` | model | `mongoose.model<INoteSession>('NoteSession', noteSessionSchema)` | 97 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/note-taker/types.ts` — `NoteSessionStatus`
- **Packages:**
  - `mongoose` — `Document`, `Schema`, `Types`

## Used by

- `server/note-taker/jobs/distribute.worker.ts`
- `server/note-taker/jobs/summarize.worker.ts`
- `server/note-taker/routes/sessions.ts`
- `server/note-taker/routes/summaries.ts`
- `server/note-taker/routes/transcripts.ts`
- `server/note-taker/summarization/summarizer.ts`
- `server/note-taker/transcription/transcript-builder.ts`
- `server/note-taker/transcription/transcription-manager.ts`
- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/socket.ts`
- `server/routes/webinarRoutes.ts`
