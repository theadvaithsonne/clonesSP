# `server/note-taker/transcription/segment-accumulator.ts`

> Module exporting `SegmentAccumulator`.

**Kind:** Note-Taker module — transcription · **Lines:** 75

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SegmentAccumulator` | class | Accumulates transcript segments from multiple participants. | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/note-taker/types.ts` — `TranscriptSegment`
  - `server/note-taker/transcription/deepgram-stream.ts` — `TranscriptionResult`
- **Packages:** none

## Used by

- `server/note-taker/transcription/transcript-builder.ts`
- `server/note-taker/transcription/transcription-manager.ts`
