# `lib/api/voice-memos.ts`

> A client for voice memos: upload audio for transcription and summarisation, then list, read, rename, delete and reprocess memos through the backend's `/voice-memos` proxy.

**Kind:** frontend library · **Lines:** 182

## Purpose
Users can record voice memos, including inside calls and webinars, and get back a transcript (speaker-attributed when a speaker timeline is supplied), a summary, key points and action items. The processing itself happens in NetworkChains' voice-agent service. This repo's backend route (`server/routes/voiceMemos.ts`, mounted at `/voice-memos`) proxies to it. Status names and JSON shapes match NC's service, so status badges and polling logic can be reused.

## How it works
- **Types:**
  - `MemoStatus`: `pending | transcribing | processing | ready | failed`.
  - `VoiceMemo`: snake_case fields as NC returns them, including the transcript, `attributed_transcript`, summary, `key_points`, `action_items`, `chunks_count`, timestamps, and `meeting_context` (`roomId`, optional `roomName`, participants).
  - `VoiceMemoListResponse` (paginated).
  - `ListMemosQuery` (`page`, `page_size`, `status`, `search`, and `room_id`, which filters on `meeting_context.roomId`; the Recorded Live Stream view uses it to show a host's notes for one webinar).
  - `SpeakerTimelineEntry` (`tMs` offset and the active `speakers` at that moment).
  - `UploadMemoInput`.
- `authHeaders()` and `handle<T>()` work the same way as in `conference-notes.ts`. The error body is read as text once and then parsed, which avoids a "body stream already read" error hiding the real message. A 204 response returns `undefined`.
- **`voiceMemosApi`**:
  - `upload(input)`: builds a `FormData` with `audio` (filename `memo.mp4` when the blob type contains `mp4`, otherwise `memo.webm`; NC validates by mime type), plus optional `title`, `recorded_at`, `meeting_context` (JSON) and `speaker_timeline` (JSON, only when not empty). It `POST`s to `/voice-memos` and returns `{ task_id, memo_id, status: "queued" }`.
  - `list(query)`: `GET /voice-memos?...` with only the parameters that are set.
  - `get(id)`, `update(id, { title })` (PATCH JSON), `delete(id)`, `reprocess(id)` (`POST /:id/reprocess`, returns `{ memo_id, status: "queued" }`).
- `isMemoTerminal(status)` returns true for `ready` and `failed`.

## Exports
- Types: `MemoStatus`, `VoiceMemo`, `VoiceMemoListResponse`, `ListMemosQuery`, `SpeakerTimelineEntry`, `UploadMemoInput`.
- `voiceMemosApi` - `{ upload, list, get, update, delete, reprocess }`.
- `isMemoTerminal(status: MemoStatus): boolean`

## Interfaces
- **Backend endpoints called** (served by `server/routes/voiceMemos.ts`; the read and write routes use `requireAuth`):
  - `POST /backend/voice-memos` - multipart upload (the backend accepts files up to 100 MB).
  - `GET /backend/voice-memos?page=&page_size=&status=&search=&room_id=`
  - `GET /backend/voice-memos/:id`, `PATCH /backend/voice-memos/:id`, `DELETE /backend/voice-memos/:id`
  - `POST /backend/voice-memos/:id/reprocess`
- **External services (via backend):** the NetworkChains voice-agent service (`NC_BACKEND_URL`, default `https://backend.networkchains.com`), which the backend calls with a service token.
- **Browser storage / cookies:** reads `garage_tok` through `getToken()`.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL`. `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `components/voice-memos/VoiceMemoPanel.tsx` - memo list and recorder UI.
- `components/voice-memos/VoiceMemoStatusBadge.tsx` - status display.
- `components/dashboard/RecordedLiveStreamPage.tsx` - a webinar's host notes (`room_id` filter).
- `lib/hooks/use-voice-memos.ts` - data hook.
