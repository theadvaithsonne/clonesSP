# `server/note-taker/transcription/deepgram-stream.ts`

> Module exporting `TranscriptionResult`, `OnTranscriptCallback`, `DeepgramStream`.

**Kind:** Note-Taker module — transcription · **Lines:** 152

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TranscriptionResult` | interface |  | 4 |
| `OnTranscriptCallback` | type |  | 13 |
| `DeepgramStream` | class | Wraps a Deepgram live transcription WebSocket for a single participant. | 19 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.DEEPGRAM_API_KEY`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `@deepgram/sdk` — `createClient`, `LiveTranscriptionEvents`

## Used by

- `server/note-taker/transcription/segment-accumulator.ts`
- `server/note-taker/transcription/transcription-manager.ts`
