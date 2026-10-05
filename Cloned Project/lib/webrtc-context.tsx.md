# `lib/webrtc-context.tsx`

> React context provider that runs one-to-one peer-to-peer WebRTC audio/video calls (used for direct-message calls), signalled over Socket.IO.

**Kind:** frontend library · **Lines:** 429

## Purpose
Garage has several calling stacks (LiveKit for workspace/meeting calls, mediasoup for webinars). This file is the oldest and simplest one: a plain browser `RTCPeerConnection` between two users, with the offer/answer/ICE exchange relayed by the backend Socket.IO server. It is mounted once in the dashboard layout so an incoming call can ring anywhere under the `(dashboard)` route group, and the DM page and the audio/video call overlays read its state through `useWebRTC()`.

## How it works

### ICE configuration (L17-L32)
`ICE_SERVERS` lists five public Google STUN servers plus two public "free" TURN providers (`openrelay.metered.ca` on ports 80/443/443-TCP and `freeturn.tel:3478` UDP/TCP). The TURN username/credential pairs are hardcoded on L25-L30 (they are the providers' published shared credentials, not Garage secrets). There is no Garage-owned TURN server in this config, so calls between users behind strict NATs depend on these free relays.

### State
Held in React state: `localStream`, `remoteStream`, `inCall`, `incomingCall` (`{ from, offer, callType }`), `callPartnerId`, `callType` (`'audio' | 'video'`), `isMuted`, `isVideoOff`. Refs: `peerConnection` (the single active `RTCPeerConnection`) and `remoteStreamRef` (a mutable merged remote `MediaStream`).

### Event naming
Every signalling event is prefixed with the call type: `audio:*` for audio calls, `video:*` for video calls. The provider computes the prefix from `callType` each time.

### Placing a call - `startCall(partnerId, callType)` (L219-L251)
1. `getUserMedia({ audio: true, video: callType === 'video' })`.
2. Sets local stream / partner / type, `inCall = true`, and emits `workspace:status-change { status: "busy" }`.
3. Creates the peer connection, adds all local tracks, creates and sets an SDP offer.
4. Emits `<prefix>:call-user { to, offer, callType }`. The backend (`server/realtime/socket.ts`) forwards it to the room `user:<to>` as `<prefix>:incoming-call { from, offer, callType }` and also sends a push notification (`sendCallPushNotification`) to the callee's mobile devices.
Any error (e.g. permission denied) runs `cleanup()`.

### Receiving a call (L331-L404)
A `useEffect` subscribes to ten socket events (`audio:`/`video:` x `incoming-call`, `call-accepted`, `ice-candidate`, `call-ended`, `call-declined`) on the shared socket from `connectSocket()` and removes them on cleanup. It re-subscribes whenever `inCall` or `cleanup` changes.
- `incoming-call`: normalises a missing `callType` to `'video'` (older clients). If already `inCall`, auto-declines by emitting `<prefix>:call-declined`; otherwise stores `incomingCall` so an overlay can ring.
- `call-accepted`: sets the remote SDP answer on the existing connection.
- `ice-candidate`: adds the candidate if a connection exists (otherwise it is silently dropped).
- `call-ended` / `call-declined`: emits `workspace:status-change { status: "available" }` and runs `cleanup()`.

### Answering / declining
- `answerCall()` (L253-L294): grabs media, marks the user busy, clears `incomingCall`, creates the connection, sets the stored offer as remote description, creates an answer and emits `<prefix>:call-answered { to, answer }` (the backend relays it to the caller as `<prefix>:call-accepted`).
- `declineCall()` (L296-L303): emits `<prefix>:call-declined { to }` and clears `incomingCall`. It does not emit a status change.

### Peer connection - `createPeerConnection` (L121-L214)
- `onicecandidate` sends each local candidate as `<prefix>:ice-candidate { to, candidate }` (no batching).
- `onconnectionstatechange`: on `failed` or `closed` stops remote tracks and runs `cleanup()`. ICE/gathering state changes are only logged.
- `ontrack` merges incoming tracks into `remoteStreamRef`, keeping at most one track per kind (a new track of the same kind replaces the old one). After each change it publishes a **new** `MediaStream` object via `setRemoteStream` so React consumers re-render (the "fix" comment). Track `ended`, `mute` and `unmute` handlers also republish the stream, or set it to `null` when no tracks remain.

### Ending and controls
- `endCall()` emits `<prefix>:call-ended { to }` (if a partner is known) plus `workspace:status-change { status: "available" }`, then `cleanup()`.
- `cleanup()` closes the connection, stops local and remote tracks and resets call state (it does not reset `isMuted` / `isVideoOff`).
- `toggleMute()` / `toggleVideo()` flip `enabled` on the first local audio/video track and mirror it into `isMuted` / `isVideoOff`. No signalling is sent; the remote side just receives silence/black frames.

## Exports
- `useWebRTC()` - returns the context value; throws `"useWebRTC must be used within a WebRTCProvider"` outside the provider. Value: `localStream`, `remoteStream`, `inCall`, `isMuted`, `isVideoOff`, `incomingCall`, `callPartnerId`, `callType`, `startCall(partnerId, callType)`, `endCall()`, `answerCall()`, `declineCall()`, `toggleMute()`, `toggleVideo()`.
- `WebRTCProvider({ children })` - the provider component that owns all call state and socket listeners.

## Interfaces
- **Socket.IO events:** emits `audio:call-user` / `video:call-user`, `audio:call-answered` / `video:call-answered`, `audio:ice-candidate` / `video:ice-candidate`, `audio:call-ended` / `video:call-ended`, `audio:call-declined` / `video:call-declined`, `workspace:status-change`; listens for `audio:`/`video:` `incoming-call`, `call-accepted`, `ice-candidate`, `call-ended`, `call-declined`. Server relays live in `server/realtime/socket.ts` (around L2317-L2429).
- **External services:** Google public STUN servers; openrelay.metered.ca and freeturn.tel public TURN relays.
- **Browser APIs:** `navigator.mediaDevices.getUserMedia`, `RTCPeerConnection`.

## Dependencies
- **Internal:** `lib/socket.ts` - `connectSocket()` returns the shared Socket.IO client; `lib/auth.ts` - `getUserIdFromToken()` (called into `me`, which is currently unused).
- **Packages:** `react` - context, state, refs, callbacks, effects.

## Used by
- `app/(dashboard)/layout.tsx` - wraps the whole dashboard tree in `<WebRTCProvider>`.
- `components/dashboard/AudioCallOverlay.tsx`, `components/dashboard/VideoCallOverlay.tsx` - ringing and in-call UI.
- `components/dashboard/DMPage.tsx` - starts calls from a direct-message conversation.

## Notes
- **Trickle-ICE race:** the caller starts emitting candidates immediately after `setLocalDescription`, but the callee has no `RTCPeerConnection` until it presses Answer, so those early candidates are dropped by `handleIceCandidate`. Connectivity then relies on the callee's candidates (and peer-reflexive discovery). `addIceCandidate` is also not awaited/caught.
- **Stale closure:** `createPeerConnection` captures `cleanup` at creation time, when `localStream` state is still `null`, so a `failed`/`closed` connection may reset state without stopping the local camera/mic tracks.
- CLAUDE.md describes ICE batching and exponential-backoff reconnection "in lib/webrtc-context.tsx"; none of that exists in this file (those features belong to the workspace `useWebRTC` hook).
- Logs heavily to the console with a `WebRTC:` prefix.
