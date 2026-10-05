# `server/utils/videoCompression.ts`

> Module exporting `compressVideo`, `isFfmpegAvailable`.

**Kind:** backend utility · **Lines:** 83

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `compressVideo` | function | `async compressVideo(inputBuffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }>` — Compresses a video file using ffmpeg | 15 |
| `isFfmpegAvailable` | function | `async isFfmpegAvailable(): Promise<boolean>` — Check if ffmpeg is available on the system | 74 |

## Interfaces

- **Filesystem writes:** `writeFile(inputPath)` (L35)

## Dependencies

- **Internal:** none
- **Packages:**
  - `child_process` — `exec`
  - `util` — `promisify`
  - `fs` — `promises as fs`
  - `path`
  - `os`

## Used by

- `server/controllers/cabinet.controller.ts`
- `server/routes/dailyWebhook.ts`
- `server/routes/livekitRecording.ts`
