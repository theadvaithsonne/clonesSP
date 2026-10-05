# `lib/mediasoupClient.ts`

> Thin mediasoup-client wrapper that holds a module-level `Device` and creates send/receive WebRTC transports and consumers by talking to the webinar SFU over Socket.IO acknowledgements.

**Kind:** frontend library · **Lines:** 219

## Purpose
Webinars use a self-hosted mediasoup SFU that runs inside the backend (`server/realtime/mediasoupHandlers.ts`). The browser side of that protocol is mediasoup-client: load a `Device` with the router's RTP capabilities, create transports, produce local tracks and consume remote producers. This file packages those steps as promise-returning helpers so `hooks/useMediasoup.ts` can drive the flow without re-implementing the signalling each time.

## How it works

### Device singleton (L8-L26)
One `Device` lives in a module variable. `loadDevice(rtpCapabilities)` always creates a fresh `Device`, loads it with `routerRtpCapabilities` and stores it; `getDevice()` reads it; `resetDevice()` clears it (used when leaving a webinar so the next join starts clean).

### Send transport (L48-L100)
`createSendTransport(socket, webinarId)` emits `webinar:createWebRtcTransport` with `consuming: false` and waits for the ack `{ success, error?, params }`. On success it calls `device.createSendTransport(params)` and wires:
- `connect` -> emits `webinar:connectTransport` `{ webinarId, transportId, dtlsParameters }`, calling mediasoup's `callback`/`errback` from the ack.
- `produce` -> emits `webinar:produce` `{ webinarId, transportId, kind, rtpParameters, appData }`, passing the server's `producerId` back to mediasoup as `{ id }`.
It rejects if the server reports failure or the device was never loaded.

### Receive transport (L102-L148)
`createRecvTransport(socket, webinarId)` does the same with `consuming: true` and `device.createRecvTransport`. It wires only `connect` (same `webinar:connectTransport` event) and logs `connectionstatechange` and `icegatheringstatechange` for diagnostics, with `[mediasoup]`-prefixed console logs around DTLS connect.

### Consuming (L150-L218)
`consumeStream(socket, webinarId, recvTransport, producerId)`:
1. Emits `webinar:consume` with the transport id, producer id and the device's `rtpCapabilities`.
2. On success calls `recvTransport.consume(params)` and logs the consumer's state.
3. Fire-and-forget emits `webinar:resumeConsumer` `{ webinarId, consumerId }` (the server creates consumers paused) and only logs the ack.
4. Resolves immediately with `{ consumer, stream: new MediaStream([consumer.track]) }`.
The comment says this "consume -> fire-and-forget resume -> return stream" order deliberately matches a working reference implementation ("garageWebinar").

## Exports
- `getDevice(): Device | null` - current device.
- `loadDevice(rtpCapabilities): Promise<Device>` - create and load a new device.
- `resetDevice(): void` - drop the device.
- `createSendTransport(socket, webinarId): Promise<Transport>` - producing transport.
- `createRecvTransport(socket, webinarId): Promise<Transport>` - consuming transport.
- `consumeStream(socket, webinarId, recvTransport, producerId): Promise<ConsumeResult>` - consume one remote producer.
- `interface ConsumeResult { consumer: Consumer; stream: MediaStream }`.

## Interfaces
- **Socket.IO events:** emits (all with ack callbacks) `webinar:createWebRtcTransport`, `webinar:connectTransport`, `webinar:produce`, `webinar:consume`, `webinar:resumeConsumer`. Handled in `server/realtime/mediasoupHandlers.ts`. Listens for nothing itself; producer announcements are handled by the calling hook.

## Dependencies
- **Internal:** none (the socket is passed in by the caller).
- **Packages:** `mediasoup-client` - `Device` and transport/consumer types; `socket.io-client` - `Socket` type only.

## Used by
- `hooks/useMediasoup.ts` - the webinar SFU hook.

## Notes
- The device is a module-level singleton, so only one mediasoup session per browser tab is supported at a time.
- The router RTP capabilities passed to `loadDevice` must come from the server (fetched by the caller); this file does not request them.
- Because resume is not awaited, the returned stream's track may be briefly muted until the server resumes the consumer.
- Verbose `console.log` diagnostics are left on in the receive path.
