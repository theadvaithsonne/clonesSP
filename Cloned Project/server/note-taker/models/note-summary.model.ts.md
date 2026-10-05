# `server/note-taker/models/note-summary.model.ts`

> Mongoose model `NoteSummary` (collection `notesummaries`) with 10 top-level fields.

**Kind:** Note-Taker module — Mongoose model · **Lines:** 44

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `NoteSummary`

- **Collection:** `notesummaries` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `sessionId` | `Schema.Types.ObjectId` | required, index, ref 'NoteSession' |
| `overview` | `String` | default '' |
| `keyTopics` | `[String]` | — |
| `actionItems` | `[actionItemSchema]` | — |
| `decisions` | `[String]` | — |
| `questions` | `[String]` | — |
| `markdownSummary` | `String` | default '' |
| `aiModel` | `String` | default 'gpt-4o' |
| `promptTokens` | `Number` | default 0 |
| `completionTokens` | `Number` | default 0 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `INoteSummary` | interface |  | 4 |
| `NoteSummary` | model | `mongoose.model<INoteSummary>('NoteSummary', noteSummarySchema)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/note-taker/types.ts` — `ActionItem`
- **Packages:**
  - `mongoose` — `Document`, `Schema`, `Types`

## Used by

- `server/note-taker/distribution/email-template.ts`
- `server/note-taker/jobs/distribute.worker.ts`
- `server/note-taker/routes/sessions.ts`
- `server/note-taker/routes/summaries.ts`
- `server/note-taker/summarization/summarizer.ts`
