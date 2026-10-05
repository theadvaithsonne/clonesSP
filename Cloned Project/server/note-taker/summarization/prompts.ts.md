# `server/note-taker/summarization/prompts.ts`

> Module exporting `buildUserPrompt`, `buildChunkUserPrompt`, `buildMergeUserPrompt`.

**Kind:** Note-Taker module — summarization · **Lines:** 110

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MEETING_SUMMARY_SYSTEM_PROMPT` | const | `` = `You are an expert meeting analyst. You will receive a meeting transcript formatted as … `` | 1 |
| `buildUserPrompt` | function | `buildUserPrompt(transcript: string, title?: string): string` | 32 |
| `CHUNK_SUMMARY_SYSTEM_PROMPT` | const | `` = `You are analyzing ONE SEGMENT of a longer meeting. Other segments are being analyzed i… `` | 39 |
| `buildChunkUserPrompt` | function | `buildChunkUserPrompt(chunkText: string, index: number, total: number, title?: string): string` | 67 |
| `MERGE_SUMMARY_SYSTEM_PROMPT` | const | `` = `You are consolidating partial summaries of a meeting into one final summary. The parti… `` | 83 |
| `buildMergeUserPrompt` | function | `buildMergeUserPrompt(partials: unknown[], title?: string): string` | 100 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/note-taker/summarization/summarizer.ts`
