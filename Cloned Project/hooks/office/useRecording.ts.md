# `hooks/office/useRecording.ts`

> Client hook that starts and stops a server-side LiveKit Egress recording of a conference room through `POST /backend/livekit/recording/start|stop`.

**Kind:** React hook · **Lines:** 62

## Purpose
Powers the record button in the standalone conference room. The browser only asks the backend to start or stop; the backend drives LiveKit's Egress API. The finished file is later stored as an `OrganizationFile` and listed through `hooks/office/useConferenceRecordings.ts`.

## How it works
- `API_URL` = `process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com'`.
- `start()`:
  - Without a `roomName` it sets `error = 'Room name not available'` and returns.
  - Otherwise it POSTs `{ roomName }` to `/livekit/recording/start` with `Authorization: Bearer <getToken()>`.
  - **409** = already recording: the response's `egressId` is adopted and `recording` set to true, so a second host or a reload does not start a duplicate egress.
  - Other errors throw `data.message`, which becomes `error`. A message containing "room does not exist" is replaced with "Cannot record — join the room first with audio/video". LiveKit only creates a room once someone has joined.
  - On success the `egressId` is kept in a ref and `recording` becomes true.
- `stop()` returns early unless `recording` and an `egressId` exist. It POSTs `{ egressId }` to `/livekit/recording/stop`, stores any thrown error, and in `finally` resets `recording` and the ref.

## Exports
- `useRecording(roomName: string | undefined): { recording: boolean; start(): Promise<void>; stop(): Promise<void>; error: string }`

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/livekit/recording/start` - body `{ roomName }`; returns `egressId` (409 when one is already running).
  - `POST /backend/livekit/recording/stop` - body `{ egressId }`.
- **Environment variables:** `NEXT_PUBLIC_API_URL`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** `react` - `useState`, `useRef`, `useCallback`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`).

## Notes
- In `server/routes/livekitRecording.ts`, the two recording routes are registered without `requireAuth`, so the bearer token is sent but not checked there.
- `stop()` does not check the HTTP status; the UI shows "not recording" even if the backend failed to stop the egress.
- The recording state is local to this hook. Other participants learn about it only if the page broadcasts it separately.
- `hooks/livekit/useRecording.ts` is an unused twin pointing at `/meet/recording/*`.
