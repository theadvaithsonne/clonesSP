# `hooks/office/useHostControls.ts`

> Client hook giving a conference host "kick participant" and "mute participant" actions backed by `POST /backend/livekit/kick` and `POST /backend/livekit/mute`.

**Kind:** React hook · **Lines:** 50

## Purpose
Moderation controls for the standalone LiveKit conference room. The hook wraps the two backend calls that use LiveKit's server SDK (which needs the server-only API secret) to remove a participant or mute one of their tracks, and exposes busy flags so the UI can disable buttons while a request is in flight. It was vendored from NetworkChains; only the URLs changed from `/meet/*` to `/livekit/*`.

## How it works
- `API_URL` is `process.env.NEXT_PUBLIC_API_URL`, defaulting to `https://backend.networkchains.com` when unset (`??`, so an empty string is kept).
- `kickParticipant(roomName, participantIdentity)` sets `kicking`, sends `POST ${API_URL}/livekit/kick` with JSON `{ roomName, participantIdentity }` and `Authorization: Bearer <getToken()>`, throws `Error(data.error || 'Failed to kick participant')` on failure, and clears `kicking` in `finally`.
- `muteParticipant(roomName, participantIdentity, trackSid)` sends `POST ${API_URL}/livekit/mute` with `{ roomName, participantIdentity, trackSid }`, toggling `muting`.
- On the server (`server/routes/livekitRecording.ts`) both routes require `requireAuth`; kick wraps `RoomServiceClient.removeParticipant`. The route comment notes the backend does not check that the caller is the room's host: the frontend only shows the buttons to the host.

## Exports
- `useHostControls(): { kickParticipant, muteParticipant, kicking, muting }`
  - `kickParticipant(roomName: string, participantIdentity: string): Promise<void>`
  - `muteParticipant(roomName: string, participantIdentity: string, trackSid: string): Promise<void>`
  - `kicking: boolean`, `muting: boolean`.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/livekit/kick` - remove a participant from the LiveKit room.
  - `POST /backend/livekit/mute` - mute a participant's track (`trackSid`).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()` for the JWT.
- **Packages:** `react` - `useState`, `useCallback`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`).

## Notes
- Host-only behaviour is enforced in the UI, not by the backend route; any authenticated user can call these endpoints.
- Errors are thrown, not stored: callers must `try/catch`. A failed response without a JSON body makes `res.json()` throw a parse error instead.
- The same router is also mounted at `/workspace/conference`, so the endpoints are reachable at `/backend/workspace/conference/kick|mute` too (used by the mobile app).
- `hooks/livekit/useHostControls.ts` is an unused copy pointing at non-existent `/meet/kick|mute` routes.
