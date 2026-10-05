# `lib/hooks/use-voice-memos.ts`

> A hand-rolled list hook for the user's voice memos: it fetches on mount, polls while memos are still processing, and exposes upload/rename/delete/reprocess helpers that refetch afterwards.

**Kind:** frontend library · **Lines:** 130

## Purpose
Voice memos (meeting recordings and standalone memos) are transcribed and analysed by NetworkChains' voice-agent service. The Garage backend route `server/routes/voiceMemos.ts`, mounted at `/voice-memos`, proxies these requests to that service and scopes them to the caller. This hook gives the memo panels a simple React Query-like interface over `voiceMemosApi` from `lib/api/voice-memos.ts`.

## How it works
- **Options:** `page` (default 1), `pageSize` (default 20), optional `status` filter, `enabled` (default true). When `enabled` is false nothing is fetched or polled.
- **`refetch()`** calls `voiceMemosApi.list({ page, page_size, status })` and stores `items` and `total`; it manages `loading` and `error` ("Failed to load memos" fallback). It runs on mount and whenever its inputs change.
- **Polling:** a 4-second interval (`ACTIVE_POLL_MS`, matching NetworkChains' cadence) checks `memosRef` (a live ref to the latest list, so the interval is not recreated on every render) and refetches only if some memo is not terminal. `isMemoTerminal` treats `ready` and `failed` as terminal.
- **Mutations:**
  - `upload(input)` - posts audio plus optional `title`, `recordedAt`, `meetingContext` and `speakerTimeline`, then refetches so the new pending memo shows up; resolves `{ memo_id }`.
  - `rename(id, title)` - PATCH then refetch.
  - `remove(id)` - DELETE, then removes the memo from local state and decrements `total` immediately, then refetches.
  - `reprocess(id)` - re-queues processing, then refetches.
  Mutation errors are not caught here; they reject to the caller.

## Exports
- `useVoiceMemos(opts?: { page?, pageSize?, status?, enabled? })` - returns `{ memos, total, loading, error, refetch, upload, rename, remove, reprocess }` (the internal `UseVoiceMemosResult` interface).

## Interfaces
- **Backend endpoints called** (through `voiceMemosApi`):
  - `GET /backend/voice-memos?page=&page_size=&status=` - list.
  - `POST /backend/voice-memos` (multipart: `audio`, `title`, `recorded_at`, `meeting_context`, `speaker_timeline`) - upload.
  - `PATCH /backend/voice-memos/:id` - rename.
  - `DELETE /backend/voice-memos/:id` - delete.
  - `POST /backend/voice-memos/:id/reprocess` - re-run the pipeline.
  All require auth (`requireAuth` on the backend) and are forwarded to NetworkChains' voice-agent service.
- **Background work:** 4 s polling interval while any memo is mid-pipeline.

## Dependencies
- **Internal:** `lib/api/voice-memos.ts` - `voiceMemosApi`, `isMemoTerminal` and the `VoiceMemo`/`MemoStatus`/`SpeakerTimelineEntry` types.
- **Packages:** `react` - state, refs, effects, callbacks.

## Used by
- `components/dashboard/ConferenceMemoPanel.tsx` (uploads recordings made with `use-meet-memo-recorder.ts`)
- `components/voice-memos/VoiceMemoPanel.tsx`

## Notes
- The header comment says the Garage app does not ship `@tanstack/react-query`. That is out of date: other hooks in this folder (for example `use-admin-funnels.ts`) use it. The hand-rolled version still works.
- `refetch` calls are not de-duplicated or cancelled, so a slow response can briefly overwrite a newer one.
