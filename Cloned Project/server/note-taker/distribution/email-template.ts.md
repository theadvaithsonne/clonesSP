# `server/note-taker/distribution/email-template.ts`

> Module exporting `buildSummaryEmail`, `buildTranscriptFallbackEmail`.

**Kind:** Note-Taker module — distribution · **Lines:** 177

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `buildSummaryEmail` | function | `buildSummaryEmail(summary: INoteSummary, sessionId: string, meetingTitle: string, meetingDate: string, durationMinutes: number, participantNames: string[]): string` | 5 |
| `buildTranscriptFallbackEmail` | function | `buildTranscriptFallbackEmail(transcript: INoteTranscript, sessionId: string, meetingTitle: string, meetingDate: string, durationMinutes: number, participantNames: string[]): string` — Fallback email used when summary generation failed (e.g. | 113 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/note-taker/models/note-summary.model.ts` — `INoteSummary`
  - `server/note-taker/models/note-transcript.model.ts` — `INoteTranscript`
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/note-taker/jobs/distribute.worker.ts`
