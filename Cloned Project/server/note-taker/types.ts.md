# `server/note-taker/types.ts`

> Shared TypeScript types for the Note-Taker module: session participants, transcript segments, action items and the session status union.

**Kind:** Note-Taker module — types.ts · **Lines:** 29

## Purpose
The Note-Taker module records meetings, transcribes them and produces AI summaries. This file holds the plain data shapes that its Mongoose models, the transcription segment accumulator and the summarisation preprocessor all agree on, so they are declared once instead of per file. It contains types only; there is no runtime code.

## How it works
- A comment (L3-L4) points out that `AuthRequest` and `JwtPayload` are declared globally in the backend's shared types and auth middleware, and should be imported from there rather than from this module.
- `NoteSessionParticipant` identifies someone in a recorded session by a required `identity` string (the room/participant identity), with optional display `name`, linked `userId` (a Mongo `ObjectId`) and `email`.
- `TranscriptSegment` is one spoken chunk: `speaker`, optional `speakerName`, `startTime`/`endTime` (numbers), `text` and an optional `confidence` score.
- `ActionItem` is a summary output entry: `description`, optional `assignee` and `deadline` (both free-form strings).
- `NoteSessionStatus` is the session lifecycle: `'recording'` -> `'transcribing'` -> `'summarizing'` -> `'ready'`, or `'failed'`.

## Exports
- `interface NoteSessionParticipant` - `{ identity; name?; userId?: Types.ObjectId; email? }`.
- `interface TranscriptSegment` - `{ speaker; speakerName?; startTime; endTime; text; confidence? }`.
- `interface ActionItem` - `{ description; assignee?; deadline? }`.
- `type NoteSessionStatus` - `'recording' | 'transcribing' | 'summarizing' | 'ready' | 'failed'`.

## Dependencies
- **Packages:** `mongoose` - only for the `Types.ObjectId` type used by `NoteSessionParticipant.userId`.

## Used by
- `server/note-taker/models/note-session.model.ts`
- `server/note-taker/models/note-summary.model.ts`
- `server/note-taker/models/note-transcript.model.ts`
- `server/note-taker/summarization/transcript-preprocess.ts`
- `server/note-taker/transcription/segment-accumulator.ts`

## Notes
- The status values here must match whatever enum the session model stores; change both together.
