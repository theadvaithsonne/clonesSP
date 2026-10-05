# `server/note-taker/summarization/transcript-preprocess.ts`

> Module exporting `preprocessSegments`, `formatForPrompt`, `estimateTokens`, `chunkForMapReduce`.

**Kind:** Note-Taker module — summarization · **Lines:** 149

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CompactSegment` | interface |  | 50 |
| `preprocessSegments` | function | `preprocessSegments(segments: TranscriptSegment[]): CompactSegment[]` — Preprocess raw Deepgram segments into a compact, speaker-attributed form suitable for LLM consumption. | 70 |
| `formatForPrompt` | function | `formatForPrompt(segments: CompactSegment[]): string` — Render compact segments as speaker-attributed dialogue with timestamps. | 103 |
| `estimateTokens` | function | `estimateTokens(text: string): number` — Approximate token count. | 116 |
| `chunkForMapReduce` | function | `chunkForMapReduce(segments: CompactSegment[], targetTokens: number): string[]` — Chunk preprocessed segments into prompt-ready strings, each under `targetTokens`. | 126 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/note-taker/types.ts` — `TranscriptSegment`, `(types only)`
- **Packages:** none

## Used by

- `server/note-taker/summarization/summarizer.ts`
