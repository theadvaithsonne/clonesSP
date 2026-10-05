# `hooks/office/useConferenceRecordings.ts`

> Client hook that lists a conference room's saved recordings from `GET /backend/livekit/conference/recordings`, refetches on recording socket events, and deletes recordings optimistically.

**Kind:** React hook · **Lines:** 113

## Purpose
Backs the Recordings panel of the standalone conference room. LiveKit Egress recordings end up as `OrganizationFile` documents (with an S3 object). This hook loads the ones belonging to one named conference room and keeps the list fresh.

## How it works
- `refresh()`:
  - Does nothing when `enabled` is false or there is no token.
  - Otherwise sets `loading`, clears `error` and fetches `GET ${API_URL}/livekit/conference/recordings?roomId=<roomId>` with a bearer token.
  - Stores `data.recordings ?? []`. On failure `error` gets the server's `error` text or "Failed to load recordings".
- The hook calls `refresh()` on mount and whenever `roomId` or `enabled` changes.
- **Live refresh:** while enabled, it subscribes (via `connectSocket()`) to `livekit:recording-stopped` and `livekit:recording-ready` and refetches unconditionally on either event.
- `remove(id)`:
  - Throws "Not authenticated" when there is no token.
  - Removes the row from state first (optimistic), then sends `DELETE /livekit/conference/recordings/:id`.
  - On failure it calls `refresh()` to restore the server's list and throws the error.
- **Server side** (`listConferenceRecordingsHandler` in `server/routes/livekitRecording.ts`): reads `OrganizationFile` rows for the caller's `orgId` with `metadata.recordingSource: "conference"`, `status: "ready"` and `metadata.spaceId = hq-room:<orgId>:<roomId>`. The delete route checks the org, deletes the S3 object (best effort) and then the `OrganizationFile` row.

## Exports
- `useConferenceRecordings({ roomId: string; enabled?: boolean }): { recordings: ConferenceRecording[]; loading: boolean; error: string | null; refresh(): Promise<void>; remove(id: string): Promise<void> }`
- `interface ConferenceRecording { id; name; size; sizeMB; createdAt; durationSeconds: number | null; spaceId: string | null; downloadUrl; streamUrl; playUrl }`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/livekit/conference/recordings?roomId=` - list recordings (requireAuth, org-scoped).
  - `DELETE /backend/livekit/conference/recordings/:id` - delete the S3 object and the `OrganizationFile` row (any member of the org may delete).
- **Socket.IO events:** listens for `livekit:recording-stopped`, `livekit:recording-ready`.
- **Database (via backend):** `OrganizationFile` - read / delete.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base, defaulting to `https://backend.networkchains.com`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`; `lib/socket.ts` - `connectSocket()`.
- **Packages:** `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`)
- `components/office/RecordingsPanel.tsx`

## Notes
- The code comment says the backend emits these events from the egress webhook after the file row is saved. A search of `server/` finds no code that emits `livekit:recording-stopped` or `livekit:recording-ready`, so in practice the list only updates on mount or a manual `refresh()`.
- Deleting is destructive (S3 object plus DB row) and the backend does not check for a host role.
