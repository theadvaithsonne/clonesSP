# `hooks/livekit/useHostControls.ts`

> Client hook exposing host "kick participant" and "mute participant" actions that POST to `/meet/kick` and `/meet/mute` on the backend.

**Kind:** React hook · **Lines:** 50

## Purpose
Wraps two meeting-moderation calls behind callbacks with in-flight flags, so a participant list can show a spinner while a host removes or mutes someone. This is the original NetworkChains-style version of the hook; the copy actually used in Garage is `hooks/office/useHostControls.ts`, which targets `/livekit/kick` and `/livekit/mute` instead.

## How it works
- `API_URL` is `process.env.NEXT_PUBLIC_API_URL`, falling back to `http://localhost:4000`.
- `kickParticipant(roomName, participantIdentity)` sets `kicking`, POSTs JSON `{ roomName, participantIdentity }` with a `Bearer` token from `getToken()`, and throws `Error(data.error || 'Failed to kick participant')` on a non-2xx response. `kicking` is reset in `finally`.
- `muteParticipant(roomName, participantIdentity, trackSid)` does the same against the mute endpoint with `{ roomName, participantIdentity, trackSid }`, toggling `muting`.
- Errors are thrown to the caller; the hook does not store them.

## Exports
- `useHostControls(): { kickParticipant, muteParticipant, kicking, muting }`
  - `kickParticipant(roomName: string, participantIdentity: string): Promise<void>`
  - `muteParticipant(roomName: string, participantIdentity: string, trackSid: string): Promise<void>`
  - `kicking: boolean`, `muting: boolean` - request-in-flight flags.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/meet/kick` - remove a participant from a room.
  - `POST /backend/meet/mute` - mute one of a participant's tracks.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()` for the bearer token.
- **Packages:** `react` - `useState`, `useCallback`.

## Used by
Nothing imports this file; it appears unused.

## Notes
- `server/routes/meet.ts` (mounted at `/meet`) only defines `POST /create`, `GET /list`, `GET /:meetId` and `GET /:meetId/participants`. There is no `/meet/kick` or `/meet/mute` route in this backend, so these calls would fail if the hook were used. The working equivalents are `POST /livekit/kick` and `POST /livekit/mute` in `server/routes/livekitRecording.ts`, called by `hooks/office/useHostControls.ts`.
- If a failed response has no JSON body, `res.json()` itself throws and the caller sees a parse error rather than the friendly message.
