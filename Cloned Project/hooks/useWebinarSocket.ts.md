# `hooks/useWebinarSocket.ts`

> A legacy React hook that joins a mediasoup webinar room over Socket.IO, subscribes to every room event (peers, producers, chat, Q&A, polls, reactions, recording, host actions) and mirrors them into the zustand webinar store.

**Kind:** React hook · **Lines:** 457

## Purpose
In the original mediasoup-based webinar design this hook was the signalling half that paired with `hooks/useMediasoup.ts`. It handled the `webinar:joinRoom` handshake and the room's inbound events, then passed media work (consume, force-mute, start or stop media) to the mediasoup hook it is given. **Nothing in the project imports it**. The current room page, `app/webinar/[id]/WebinarRoomClient.tsx`, handles signalling itself and uses `hooks/useWebinarLiveKit.ts` for media. Treat this file as dead code kept for reference.

## How it works
**Signature.** `useWebinarSocket(socketRef, webinarId, mediasoup)`, where `mediasoup` is the object returned by `useMediasoup`.

**Inbound events (effect at L116-L315).** Handlers write to the store with `useWebinarStore.getState()` so they always see fresh state:
- Peers: `webinar:peerJoined` -> `addPeer`; `webinar:peerLeft` -> `removePeer`; `webinar:peerRoleChanged` -> `updatePeerRole`; `webinar:peerMicState` -> `updatePeerMuted`.
- Media: `webinar:newProducer` -> `mediasoup.consume(...)`; `webinar:consumerClosed` and `webinar:screenShareStopped` clear the matching slot (`screen` / `screenAudio` / `audio` / `video`) with `updatePeerStream(socketId, null, slot)`.
- Host actions: `webinar:forceMuted` -> `mediasoup.forceMute()`. `webinar:roleChanged` sets the role; promotion to `panelist` auto-starts camera and mic, and demotion to `attendee` stops screen share and runs a full `mediasoup.cleanup()`. `webinar:removedFromRoom` cleans up and redirects to `/`. `webinar:webinarEnded` does the same after a 2 s delay ("to allow any upload to continue").
- Content: `webinar:newMessage` -> `addMessage`; `webinar:recordingStarted` / `webinar:recordingStopped` -> `setIsRecording`; `webinar:reaction` -> `addReaction` (skips the echo of the user's own reaction by comparing `socketId` with `socket.id`); `webinar:handRaised` -> `updateHandRaised`; `webinar:newQA` / `webinar:qaUpdated` -> `addQuestion` / `updateQuestion`; `webinar:newPoll` / `webinar:pollUpdated` -> `addPoll` / `updatePoll`.
All listeners are removed on cleanup. The effect depends on `socketRef.current` and `webinarId`.

**`joinRoom(options?)` (L331-L443).** Refuses if there is no socket or the room has already been joined (`hasJoinedRef`). It emits `webinar:joinRoom { webinarId, role (default "attendee"), panelistToken, deviceType: detectLocalDeviceType() }` with an ack. On success it stores the webinar id, title, assigned role and chat history, and adds existing peers. It then runs `mediasoup.initDevice(rtpCapabilities)`, asks for current producers with `webinar:getProducers` and consumes each one, and auto-starts media for `host` / `panelist`. It resolves `{ success, role }`, or `{ success: false, error }` on rejection or a mediasoup init failure.

**`leaveRoom()`** emits `webinar:leaveRoom { webinarId }` and runs `doCleanup()`. `doCleanup()` calls `socket.removeAllListeners()`, then `mediasoup.cleanup()` and `resetRoom()`, and resets the joined flag.

## Exports
- `useWebinarSocket(socketRef: React.MutableRefObject<Socket | null>, webinarId: string, mediasoup: ReturnType<typeof useMediasoup>)` - returns `{ joinRoom(options?: { role?, panelistToken?, userId? }), leaveRoom() }`.

## Interfaces
- **Socket.IO events:** emits `webinar:joinRoom` (ack), `webinar:getProducers` (ack), `webinar:leaveRoom`. Listens for `webinar:peerJoined`, `webinar:peerLeft`, `webinar:peerRoleChanged`, `webinar:peerMicState`, `webinar:newProducer`, `webinar:consumerClosed`, `webinar:screenShareStopped`, `webinar:forceMuted`, `webinar:roleChanged`, `webinar:removedFromRoom`, `webinar:webinarEnded`, `webinar:newMessage`, `webinar:recordingStarted`, `webinar:recordingStopped`, `webinar:reaction`, `webinar:handRaised`, `webinar:newQA`, `webinar:qaUpdated`, `webinar:newPoll`, `webinar:pollUpdated`. The server side lives in `server/realtime/mediasoupHandlers.ts`.

## Dependencies
- **Internal:** `store/webinarStore.ts` - `useWebinarStore`, `detectLocalDeviceType`, and the types `WebinarRole`, `WebinarPeer`, `ChatMessage`, `QAQuestion`, `Poll`, `PeerStreams`; `hooks/useMediasoup.ts` - type of the `mediasoup` argument only.
- **Packages:** `next` - `useRouter` from `next/navigation` for the redirect to `/`; `socket.io-client` - `Socket` type; `react`.

## Used by
Appears unused: no file imports it. The webinar room (`/webinar/[id]`) uses `hooks/useWebinarLiveKit.ts` and in-page socket handling instead.

## Notes
- `doCleanup()` calls `socket.removeAllListeners()` on the shared socket, which would also remove listeners registered by other parts of the app.
- `joinRoom` accepts `userId`, but it is never used (the comment about filtering out self is not implemented).
- `useWebinarStore()` is destructured without a selector, so the host component re-renders on every store change. Several destructured actions are unused because the handlers call `getState()`.
