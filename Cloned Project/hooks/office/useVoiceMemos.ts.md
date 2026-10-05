# `hooks/office/useVoiceMemos.ts`

> Client hook that lists, uploads and deletes the voice memos recorded in one conference room, through the backend's `/backend/voice-memos` proxy to the NetworkChains voice-agent service.

**Kind:** React hook · **Lines:** 138

## Purpose
Backs the Memos tab of the conference sidebar. A participant records a personal audio memo during the meeting (see `useMemoRecorder`). This hook uploads it and shows the memo list for the current room. Transcription, titling and summaries happen upstream in NetworkChains' voice-agent service; Garage's backend only forwards requests with a service token.

## How it works
- `refresh()`:
  - Returns if there is no token.
  - Fetches `GET ${API_URL}/voice-memos`. The response may be an array or `{ memos }`.
  - Keeps only memos whose `meeting_context.roomId` equals `roomId`. Memos without a meeting context (freestanding recordings) are hidden.
  - Sets `loading` and `error` around the call. It runs on mount and when `roomId` changes.
- `upload({ blob, title?, roomName?, participants? })` builds `FormData` with:
  - `audio` - the blob, named `memo_<ISO timestamp>.webm`;
  - `title` - optional;
  - `recorded_at` - now, ISO format;
  - `meeting_context` - JSON `{ roomId, roomName, participants }`.

  It POSTs this to `/voice-memos` with `uploading` set, throws on failure, and then calls `refresh()`. The upstream service returns a shell record first; the transcript arrives later, so a refetch picks up whatever exists.
- `remove(id)` drops the memo from state optimistically, then sends `DELETE /voice-memos/:id`. On failure it refetches and throws.
- **Server side** (`server/routes/voiceMemos.ts`, mounted at `/voice-memos`, all `requireAuth`): forwards to `${NC_BACKEND_URL}/voice-agent/memos` with `X-Service-Token` and `X-Service-User-Id: garage:<userId>`. The `garage:` prefix keeps Garage memos separate from NetworkChains' own. Uploads are capped at 100 MB (multer, in memory).

## Exports
- `useVoiceMemos({ roomId: string }): { memos: VoiceMemo[]; loading: boolean; error: string | null; uploading: boolean; refresh(): Promise<void>; upload(opts): Promise<void>; remove(id: string): Promise<void> }`
- `interface VoiceMemo { id; title: string | null; audio_url: string | null; duration_seconds: number | null; status: 'pending' | 'transcribing' | 'processing' | 'ready' | 'failed'; created_at; meeting_context?: { roomId?; roomName? } | null }` - a trimmed copy of the upstream response shape.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/voice-memos` - list the caller's memos (proxied).
  - `POST /backend/voice-memos` - multipart upload (`audio`, `title`, `recorded_at`, `meeting_context`).
  - `DELETE /backend/voice-memos/:id` - delete a memo.
- **External services:** NetworkChains voice-agent (`/voice-agent/memos`), reached only through the backend proxy.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base, defaulting to `https://backend.networkchains.com`. Server side: `NC_BACKEND_URL` and `NC_VOICE_AGENT_SERVICE_TOKEN`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`)
- `components/office/MemosPanel.tsx` - imports only the `VoiceMemo` type.

## Notes
- Filtering is done in the browser: the list endpoint returns all of the user's memos, and the hook discards those from other rooms.
- The upload file name always ends in `.webm`, even when `useMemoRecorder` picked an `ogg` or `mp4` MIME type; the blob's own MIME type is still sent.
- Without `NC_VOICE_AGENT_SERVICE_TOKEN` on the server, every call fails with 502 "… failed: NC_VOICE_AGENT_SERVICE_TOKEN not configured".
- Memo status does not update by itself; the UI must call `refresh()` to see a transcript become `ready`.
