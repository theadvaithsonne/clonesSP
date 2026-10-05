# `hooks/useMediasoup.ts`

> The legacy client-side mediasoup (SFU) media hook for the webinar room: it builds send and receive transports, publishes camera, mic and screen, consumes remote producers into the webinar store, and tears everything down.

**Kind:** React hook · **Lines:** 526

## Purpose
Webinars were first built on a self-hosted mediasoup SFU, with signalling over the main Socket.IO connection (server side: `server/realtime/mediasoupHandlers.ts`). This hook was the browser half of that design. It wraps the transport helpers in `lib/mediasoupClient.ts` into a small imperative API (`initDevice`, `startMedia`, `toggleMic`, `shareScreen`, `consume`, `cleanup`, ...). It writes local and remote streams and mic/camera flags into the zustand `webinarStore`, which the webinar UI renders.

**The live webinar room no longer uses this hook.** `app/webinar/[id]/WebinarRoomClient.tsx` now uses `hooks/useWebinarLiveKit.ts`, whose return value has the same shape ("Shape matches the legacy useMediasoup hook"). The only importer is `hooks/useWebinarSocket.ts`, which imports just its *type* and is itself unused. The audience-only preview popup uses a different hook, `app/(dashboard)/workspace/hooks/useMediasoupAudience.ts`.

## How it works
**Parameters.** `useMediasoup(socketRef, webinarId)` takes a ref to an already-connected Socket.IO client and the webinar id. All state lives in refs: send/recv transports, a pending-send-transport promise, the producer map (`video`, `audio`, `screen`, `screenAudio`), consumers keyed by producer id, and a queue of consume requests.

**Device and transports (`initDevice`).** Loads the mediasoup `Device` with the router RTP capabilities from the server, then always creates a recv transport. It creates a send transport only if `webinarStore.role` is `host` or `panelist`. Finally it drains consume requests that arrived during setup. `ensureSendTransport()` creates the send transport lazily, for example when an attendee is promoted, and shares one in-flight promise so concurrent callers do not create two.

**Publishing.**
- `startMedia()` stops any previous local stream, makes sure a send transport exists, and calls `getUserMedia` (video ideally 1920x1080 at 30 fps, minimum 640x480 at 15 fps; audio at 48 kHz, stereo, with echo cancellation, noise suppression and AGC). It stores the stream in the store. Video is produced with three simulcast layers (`r0` 300 kbps at 1/4 scale, `r1` 800 kbps at 1/2, `r2` 2.5 Mbps at full; `S1T3`) and `appData.type: "camera"`. Audio is produced with `appData.type: "audio"` and announced with `webinar:micState { muted: false }`. If the camera track ends, its producer is closed and the camera flag is cleared.
- `shareScreen()` calls `getDisplayMedia` (with audio), marks the store as screen sharing, sets `contentHint = "detail"`, and produces a single 5 Mbps layer (`appData.type: "screen"`), plus a `screenAudio` producer when the browser supplies system audio. When the browser's "stop sharing" ends the track, `stopScreenShare` runs.
- `stopScreenShare()` emits `webinar:closeProducer` for the screen and screen-audio producers, closes them, stops the screen tracks and clears the store flags.

**Controls.** `toggleMic()` / `toggleCam()` pause or resume the producer rather than closing it, update the store, and broadcast `webinar:micState { muted }` / `webinar:cameraState { enabled }`. The comment explains why: receivers do not reliably get a WebRTC `mute` event for a paused producer, which caused frozen camera frames, so the state is broadcast explicitly. `forceMute()` (triggered when the host mutes someone) pauses the mic and emits `muted: true`.

**Consuming.** `consume(producerId, producerSocketId, kind, appData)` queues the request if the recv transport is not ready yet. Otherwise `doConsume` skips producers already consumed, calls `consumeStream` (which uses the `webinar:consume` / `webinar:resumeConsumer` handshake in `lib/mediasoupClient.ts`), and stores the resulting stream with `updatePeerStream(socketId, stream, slot)`. The slot is `screen` / `screenAudio` from `appData.type`, otherwise `audio` / `video` by kind.

**Recovery and teardown.**
- `refreshConsumers()` asks the server for all producers (`webinar:getProducers` with an ack), skips its own and those already open, and re-consumes any that are missing or closed. It is meant to run after a demotion.
- `cleanupSendOnly()` closes every producer (emitting `webinar:closeProducer`) and the send transport, but keeps the recv transport and consumers, so a demoted panelist keeps watching.
- `cleanup()` closes all producers, consumers and both transports, and clears every ref.

## Exports
- `useMediasoup(socketRef: React.MutableRefObject<Socket | null>, webinarId: string)` - returns `{ initDevice(rtpCapabilities), startMedia(), toggleMic(), forceMute(), toggleCam(), shareScreen(), stopScreenShare(), consume(producerId, producerSocketId, kind, appData?), cleanup(), cleanupSendOnly(), refreshConsumers(), ensureSendTransport() }`.

## Interfaces
- **Socket.IO events:** emits `webinar:micState`, `webinar:cameraState`, `webinar:closeProducer`, `webinar:getProducers` (with ack). Indirectly, through `lib/mediasoupClient.ts`, it emits `webinar:createWebRtcTransport`, `webinar:connectTransport`, `webinar:produce`, `webinar:consume`, `webinar:resumeConsumer`. All are handled in `server/realtime/mediasoupHandlers.ts`.

## Dependencies
- **Internal:** `lib/mediasoupClient.ts` - `loadDevice`, `createSendTransport`, `createRecvTransport`, `consumeStream`; `store/webinarStore.ts` - `useWebinarStore` actions (`setLocalStream`, `setScreenStream`, `setMicEnabled`, `setCamEnabled`, `setScreenSharing`, `updatePeerStream`), `role`, `localStream`, `screenStream`, and the `PeerStreams` type.
- **Packages:** `mediasoup-client` - types only; `socket.io-client` - `Socket` type; `react`.

## Used by
- `hooks/useWebinarSocket.ts` (type import only; that file is itself unused).
In practice this hook appears unused: the webinar room page uses `hooks/useWebinarLiveKit.ts` instead.

## Notes
- `"use client"`; it relies on browser media APIs.
- `useWebinarStore()` is called without a selector, so the hook re-renders the host component on every store change.
- If `getUserMedia` or `getDisplayMedia` rejects (permission denied), the error goes to the caller; nothing is caught here.
