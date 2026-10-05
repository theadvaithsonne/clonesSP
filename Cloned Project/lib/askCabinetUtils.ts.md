# `lib/askCabinetUtils.ts`

> Builds the standard "Ask Cabinet" AI analysis prompt for an uploaded file and gives a human-readable label for its format.

**Kind:** frontend library · **Lines:** 48

## Purpose
Ask Cabinet is the AI work-analysis feature that reviews recordings and documents stored in the Cabinet. When a workspace recording finishes uploading (or a user asks about a file from the Cabinet UI), the caller needs a ready-made prompt. This file holds that prompt text in one place so every entry point asks the AI the same question.

## How it works
Both functions classify a file the same way, using the MIME type first and the file extension as a fallback:
- **Video**: MIME starts with `video/`, or extension is `webm`, `mp4`, `mov`, `avi`, `mkv` -> "screen recording"
- **PDF**: MIME `application/pdf` or extension `pdf` -> "PDF document"
- **Audio**: MIME starts with `audio/`, or extension is `mp3`, `wav`, `ogg`, `m4a` -> "audio recording"
- Anything else -> `file (<extension>)` (or "unknown format" / "unknown" when there is no extension)

`generateAskCabinetPrompt` inserts that label into a fixed prompt asking for bullet points covering **Tasks Completed**, 2-3 **Efficiency Improvements**, and 3-5 **AI Tools** (each with a usage explanation and a `**Link:** [URL]`). The prompt always speaks of "the user's work session", even for PDFs.

## Exports
- `generateAskCabinetPrompt(fileName: string, mimeType?: string): string` - the full analysis prompt for the file.
- `getFileFormatDescription(fileName: string, mimeType?: string): string` - just the format label ("screen recording", "PDF document", "audio recording" or `file (ext)`).

## Dependencies
None (pure string logic).

## Used by
- `app/(dashboard)/workspace/hooks/useRecording.ts` - auto-requests analysis after a workspace recording is uploaded.
- `components/dashboard/AskCabinetSidebar.tsx`
- `components/dashboard/AskFileDialog.tsx`

## Notes
- The classification logic is duplicated between the two functions; change both together.
- In `generateAskCabinetPrompt` the initial `fileFormat = 'screen recording'` assignment is immediately overwritten by the if/else chain and has no effect.
