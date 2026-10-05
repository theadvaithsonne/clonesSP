# `hooks/livekit/useRecording.ts`

> Client hook that starts and stops a server-side LiveKit room recording through `/meet/recording/start` and `/meet/recording/stop`.

**Kind:** React hook · **Lines:** 62

## Purpose
Exposes a `recording` flag plus `start` / `stop` callbacks for a room recording handled by the backend (LiveKit Egress). This is the original NetworkChains-style version. The copy Garage actually uses, `hooks/office/useRecording.ts`, has the same logic but calls `/livekit/recording/*`.

## How it works
- `API_URL` = `process.env.NEXT_PUBLIC_API_URL` or `http://localhost:4000`.
- `start()`:
  - Sets `error` to "Room name not available" and returns if `roomName` is falsy.
  - POSTs `{ roomName }` with a bearer token from `getToken()`.
  - HTTP `409` means a recording is already running; the returned `egressId` is adopted and `recording` becomes true.
  - Any other non-OK response throws `data.message`. On success the `egressId` is stored in a ref.
  - If the error text contains "room does not exist", the hook shows a friendlier "Cannot record -- join the room first with audio/video".
- `stop()` does nothing unless `recording` and an `egressId` exist; it POSTs `{ egressId }`, records any network error in `error`, and always resets `recording` and the ref.

## Exports
- `useRecording(roomName: string | undefined): { recording: boolean; start(): Promise<void>; stop(): Promise<void>; error: string }`

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/meet/recording/start` - start an Egress recording.
  - `POST /backend/meet/recording/stop` - stop it by `egressId`.
- **Environment variables:** `NEXT_PUBLIC_API_URL`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** `react`.

## Used by
Nothing imports this file; it appears unused.

## Notes
- `server/routes/meet.ts` (mounted at `/meet`) has no `/recording/start` or `/recording/stop` routes, so these calls would not work in this backend. The working routes are `POST /livekit/recording/start|stop` in `server/routes/livekitRecording.ts`, used by `hooks/office/useRecording.ts`.
- `stop()` ignores the HTTP status of the stop call; a server-side failure still flips the UI to "not recording".
