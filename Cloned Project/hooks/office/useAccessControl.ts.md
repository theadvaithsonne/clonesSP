# `hooks/office/useAccessControl.ts`

> Client hook for the conference "access control" feature: holds the room's unmute/present policy, lets participants ask the host for mic or screen-share permission, and lets hosts approve or deny those requests in real time.

**Kind:** React hook · **Lines:** 253

## Purpose
A host can lock a LiveKit room so participants cannot unmute or present without approval. This hook is the frontend side of that flow. It keeps the current policy, the local participant's own outstanding request (to show a "Waiting for host…" spinner), and, for hosts, the queue of pending requests. It talks to the REST routes in `server/routes/livekitRecording.ts` and listens to the Socket.IO events those routes emit.

## How it works
**State (L52-L58).**
- `policy: AccessPolicy` starts from `initialPolicy`, or `{ allowUnmute: true, allowPresent: true }` (fully open).
- `pending: PendingRequest[]` is the host's inbound queue.
- `myPending: PermissionKind | null` is this user's own outstanding request.

**Socket listeners (L60-L123).** Uses the shared socket from `connectSocket()` and ignores any event whose `roomName` is not this room:
- `livekit:policy-updated` replaces `policy` (values coerced to booleans).
- `livekit:permission-request` adds or replaces the request in `pending`. It is de-duplicated by `userId`, matching the backend's one-request-per-user map.
- `livekit:permission-granted` / `livekit:permission-denied` remove that user from `pending` and clear `myPending` if the user is the local one (`localUserId`).
Listeners are removed on cleanup; the effect re-subscribes when `roomName` or `localUserId` changes.

**Host snapshot on mount (L125-L150).** When `isHost` and a token exist, the hook fetches `GET /livekit/policy?roomName=…` and loads both `policy` and `pending`. This covers a host who reloads mid-meeting after requests arrived. Failures are ignored.

**Actions.** All send `Authorization: Bearer <getToken()>` and throw `Error(data.error || …)` on non-2xx responses:
- `setRoomPolicy(next)`: POSTs `{ roomName, allowUnmute, allowPresent }` to `/livekit/policy`, then sets `policy` locally.
- `requestPermission(kind)`: sets `myPending` optimistically, then POSTs `{ roomName, kind }` to `/livekit/permission/request`. `myPending` is rolled back on failure.
- `grantPermission(participantIdentity, kind)`: POSTs to `/livekit/permission/grant`. The local queue is not touched here; it updates when the `permission-granted` event arrives.
- `denyPermission(participantIdentity)`: POSTs to `/livekit/permission/deny`.

**Derived.** `pendingCount = pending.length`; `locked` is true when either flag is off.

**Server side, for context.**
- The policy and pending requests live in server memory (`setConferencePolicy`, `addPending`), not in MongoDB.
- Granting widens the participant's LiveKit `canPublishSources`. `unmute` adds the microphone; `present` adds screen share and screen-share audio; `both` adds all. The camera is always allowed.
- Grant and deny return 403 for non-moderators only in webinar rooms (host/panelist check). Other rooms allow any authenticated user.

## Exports
- `useAccessControl({ roomName, isHost, initialPolicy?, localUserId }): { policy, setRoomPolicy, pending, pendingCount, myPending, requestPermission, grantPermission, denyPermission, locked }`
- `interface AccessPolicy { allowUnmute: boolean; allowPresent: boolean }`
- `type PermissionKind = 'unmute' | 'present' | 'both'`
- `interface PendingRequest { userId: string; name: string; kind: PermissionKind; requestedAt: number }`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/livekit/policy?roomName=` - current policy plus pending list (hosts, on mount).
  - `POST /backend/livekit/policy` - host sets the policy.
  - `POST /backend/livekit/permission/request` - participant asks for `unmute` / `present` / `both`.
  - `POST /backend/livekit/permission/grant` - host approves.
  - `POST /backend/livekit/permission/deny` - host rejects.
- **Socket.IO events:** listens for `livekit:policy-updated`, `livekit:permission-request`, `livekit:permission-granted`, `livekit:permission-denied`; emits nothing.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base, defaulting to `https://backend.networkchains.com`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`; `lib/socket.ts` - `connectSocket()` (Socket.IO singleton).
- **Packages:** `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`)
- `components/office/AccessControlModal.tsx`
- `components/webinar/ParticipantsList.tsx`

## Notes
- The server emits `livekit:policy-updated` only to the `workspace` Socket.IO room. The permission events go through `emitPermissionEvent`, which also reaches the webinar room. So in webinars, policy changes made by others may not arrive live.
- `setRoomPolicy` updates local state only after the POST succeeds; `requestPermission` is optimistic.
- Requests are held in server memory, so they are lost on a backend restart.
