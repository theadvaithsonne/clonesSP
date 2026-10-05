# `hooks/useWebinarLiveKit.ts`

> The webinar room's media transport hook, built on LiveKit: it exchanges the user's or guest's auth token for a LiveKit token, connects a `Room`, publishes camera, mic and screen, mirrors remote tracks, speakers, quality, recording state and auction pings into the webinar store, and heals unexpected disconnects.

**Kind:** React hook · **Lines:** 812

## Purpose
Webinars originally ran on a self-hosted mediasoup SFU (see `hooks/useMediasoup.ts`). This hook replaced it with LiveKit and keeps **the same public surface** (`initDevice`, `startMedia`, `toggleMic`, `forceMute`, `toggleCam`, `shareScreen`, `stopScreenShare`, `consume`, `cleanup`, `cleanupSendOnly`, `refreshConsumers`, `ensureSendTransport`). That way `app/webinar/[id]/WebinarRoomClient.tsx` and its Socket.IO overlays (chat, Q&A, polls, hand-raise, pinned products, the join-request "knock") did not need rewriting. The doc comment at L30-L44 maps old concepts to new ones: two transports become one `Room`, `produce` becomes `publishTrack`, `consume` becomes automatic subscription, and `appData.type` becomes `Track.Source`. Socket.IO is still used for roster and signalling; LiveKit carries only media and a data channel.

## How it works

### Identity mapping (L117-L129)
The webinar store keys peers by Socket.IO `socketId`, but LiveKit identifies participants by `identity` (the user id or a `guest_...` id). `peerSocketIdForIdentity` finds the store peer whose `userId` or `socketId` equals the identity. Track handlers use it to decide which peer tile receives a stream.

### Remote track handlers (L133-L199)
- `TrackSubscribed` wraps the track in a fresh `MediaStream`, so components can key off stream identity, and calls `updatePeerStream(socketId, stream, slot)`. The slot comes from `slotForSource`: Camera -> `video`, Microphone -> `audio`, ScreenShare -> `screen`, ScreenShareAudio -> `screenAudio`. If the peer is not in the store yet (the socket roster can arrive after LiveKit), it retries once after 250 ms and otherwise gives up.
- `TrackUnsubscribed` clears the slot.
- `TrackMuted` / `TrackUnmuted` on a microphone update the peer's `isMuted` with `updatePeerMuted`.

### Connecting: `initDevice({ role, panelistToken?, guestToken? })` (L203-L448)
- Remembers the args for rejoin and clears the manual-close flag. Returns the current room if it is connected, or the in-flight promise if a connect is already running. Disposes a dead `Room` before building a new one.
- Auth is the logged-in `garage_tok` (`getToken()`), falling back to `guestToken`. It throws if neither exists.
- `POST ${NEXT_PUBLIC_API_URL}/webinar/<webinarId>/livekit-token` with `Authorization: Bearer <token>` and `{ role, panelistToken }`. The server (`server/routes/webinarRoutes.ts`) checks the role (host only for the workshop creator, panelist only with a matching panelist link) and returns `{ token, livekitUrl, room, identity }`. A response with `success` false throws.
- Room options: `adaptiveStream { pixelDensity: "screen" }`, `dynacast`, 1080p capture, simulcast layers h360/h720/h1080 (h180 is dropped so viewers never see a 180p floor), and screen share at 5 Mbps / 30 fps.
- Other room event wiring:
  - `ActiveSpeakersChanged` -> `setActiveSpeakers(identities)` and `setIsLocalSpeaking`.
  - `RecordingStatusChanged` -> `setIsRecording`. After connecting it also reads `room.isRecording`, so late joiners see the recording banner.
  - `DataReceived` on topic `nc:bid` (`NC_BID_TOPIC`) -> `dispatchLocalPing(productId)`, a window event that makes the live-auction lot refetch at once instead of waiting for its 3 s poll. It uses the same wire format as the NetworkChain/store rooms and the phone app.
  - `ConnectionQualityChanged` -> `excellent | good | poor | lost | unknown`, stored as `setLocalConnectionQuality` or `updatePeerConnectionQuality(identity, q)`.
  - `ParticipantConnected` for an identity the socket roster does not know -> calls `onRosterOutOfSyncRef.current()` so the page resyncs its roster (a missed `webinar:peerJoined`).
  - `ParticipantDisconnected` -> if the store holds "ghost" peers for that user (`socketStale` true), shows "`<name>` left" and calls `removeStalePeersByUserId`. LiveKit is treated as the authority on presence.
  - `Reconnecting` / `Reconnected` -> toasts (id `lk-reconnect`). On reconnect it re-runs the subscribe handler for every subscribed track to rebind streams.
  - `Disconnected` -> ignored for a superseded room, a deliberate `cleanup()`, or `CLIENT_INITIATED`. `DUPLICATE_IDENTITY` shows "opened from another device or tab" and does **not** reconnect, to avoid two tabs taking the session back and forth forever. `PARTICIPANT_REMOVED` / `ROOM_DELETED` are left to the socket events that handle kicks and the webinar ending. Anything else triggers a rejoin.

### Rejoin (L668-L716)
`rejoinRef.current` (kept in a ref so the `Disconnected` closure always calls the latest version) retries `initDevice(lastArgs)` after `1500 ms x attempt`, for up to 3 attempts. After that it shows "reload the page to rejoin" and resets the counter. On success it republishes the camera and/or mic if the store says they were on before the drop, so a network blip does not silently take a host off air.

### Local media (L452-L577)
- `startMedia()` enables camera and mic together with `setCameraEnabled` / `setMicrophoneEnabled`; each failure is logged rather than thrown. It rebuilds the store's `localStream` from the published tracks, sets the cam/mic flags, emits `webinar:micState { muted }`, and returns the local stream. It throws if the room is not connected.
- `toggleMic()` / `forceMute()` change the LiveKit mic and emit `webinar:micState`. `toggleCam()` changes the camera, rebuilds `localStream` and emits `webinar:cameraState { enabled }`. This explicit signal lets viewers switch to the avatar at once instead of showing a frozen frame.
- `shareScreen()` calls `setScreenShareEnabled(true, { audio: true })`, builds `screenStream` from the screen and screen-audio tracks, and sets the screen-sharing flag. A one-time `ended` listener on the screen track runs `stopScreenShare()` when the browser's "Stop sharing" is used. `stopScreenShare()` disables screen share and clears the store.

### Teardown and parity (L581-L662)
- `cleanupSendOnly()` (used on demotion) turns off camera, mic and screen and clears the local store state, but stays connected and subscribed.
- `cleanup()` marks the close as deliberate, disconnects the room and clears the refs.
- `consume()` and `ensureSendTransport()` are no-ops kept for API compatibility. `refreshConsumers()` re-runs the subscribe handler for all subscribed tracks.
- `getRoom()` exposes the raw `Room` to feature hooks such as virtual background.

### Auction and devices (L727-L789)
- `publishBidPing(productId)` publishes `{ type: "nc:bid", productId }` reliably on the data channel through `lib/webinar/bid-channel.ts`. It is best-effort: the bid is already committed on the server.
- `listMediaDevices()` returns the `videoinput` / `audioinput` / `audiooutput` lists. `setVideoDevice` / `setAudioDevice` call `room.switchActiveDevice` and rebuild the local stream. `setOutputDevice` switches the speaker; browsers without `setSinkId` silently ignore it.

## Exports
- `useWebinarLiveKit(socketRef: React.MutableRefObject<Socket | null>, webinarId: string, onRosterOutOfSyncRef?: React.MutableRefObject<(() => void) | null>)` - returns `{ initDevice, startMedia, toggleMic, forceMute, toggleCam, shareScreen, stopScreenShare, consume, cleanup, cleanupSendOnly, refreshConsumers, ensureSendTransport, getRoom, publishBidPing, listMediaDevices, setVideoDevice, setAudioDevice, setOutputDevice }`.

## Interfaces
- **Backend endpoints called:** `POST /backend/webinar/:workshopId/livekit-token` - Bearer user JWT or guest webinar JWT; returns the LiveKit token, server URL, room name and identity.
- **Socket.IO events:** emits `webinar:micState { webinarId, muted }` and `webinar:cameraState { webinarId, enabled }` (handled in `server/realtime/mediasoupHandlers.ts`).
- **External services:** the LiveKit server whose `livekitUrl` the backend returns (the project uses LiveKit cloud, `wss://lk.garage.app`). It uses the LiveKit data channel topic `nc:bid`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (defaults to `http://localhost:4000`; in this project it is `<origin>/backend`).
- **Browser storage / cookies:** reads localStorage `garage_tok` through `getToken()`.
- **Background work:** rejoin timers (1.5 s, 3 s, 4.5 s), and the 250 ms retry for subscriptions that arrive before the roster.

## Dependencies
- **Internal:** `store/webinarStore.ts` - stream, flag, speaker, quality, recording and peer actions plus the `PeerStreams` type; `lib/auth.ts` - `getToken`; `lib/webinar/bid-channel.ts` - `NC_BID_TOPIC`, `dispatchLocalPing`, `publishBidPing`.
- **Packages:** `livekit-client` - `Room`, events, track sources, presets, connection quality, disconnect reasons; `sonner` - reconnect and presence toasts; `socket.io-client` - `Socket` type; `react`.

## Used by
- `app/webinar/[id]/WebinarRoomClient.tsx`, the webinar room page at `/webinar/[id]`, which calls it as `const mediasoup = useWebinarLiveKit(socketRef, webinarId, rosterResyncRef)`.

## Notes
- The variable in the page is still named `mediasoup` for historical reasons.
- `InitDeviceArgs.role` also allows `"pre-guest"`; the server decides the actual grants.
- `shareScreen` closes over `stopScreenShare`, which is declared after it, with exhaustive-deps disabled. This works because the listener only runs later, but the callback is not refreshed if `stopScreenShare` changes.
- `useWebinarStore()` is called without a selector, so the page re-renders on every store change.
