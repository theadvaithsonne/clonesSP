# `server/note-taker/agents/bot-session.ts`

> One hidden, subscribe-only LiveKit participant (the note-taker bot) that tracks the room's human participants and re-emits each person's raw audio frames as Node events.

**Kind:** Note-Taker module — agents · **Lines:** 246

## Purpose
This is the low-level media half of the note-taker. It connects to a LiveKit room with the server-side `@livekit/rtc-node` SDK, subscribes to every human's audio track, and turns LiveKit room events into a small, stable event API. The header comment says these are the same events the older mediasoup-based session emitted, so the downstream pipeline (`TranscriptionManager` → Deepgram → summarise/distribute workers) did not have to change when the note-taker moved to LiveKit. Instances are created and owned by `BotManager`.

## How it works
- **Construction.** `new BotSession(opts)` creates a `Room` and registers handlers right away. Nothing connects until `connect()` is called.
- **`connect()`** calls `room.connect(livekitUrl, token, { autoSubscribe: true, dynacast: false })`, marks the session connected, then runs `handleParticipantConnected` for every participant already in `room.remoteParticipants`. That replay is why `BotManager` attaches the `TranscriptionManager` before connecting.
- **Bot filtering.** `isOtherBot()` parses a participant's JSON `metadata` and treats `isBot: true` as a bot. Bots are never added to the participant map and their audio is ignored, so the bot does not transcribe other bots (including recorders that use the same metadata convention).
- **Participants.** On `ParticipantConnected` the human is stored as `ParticipantInfo { identity, name (falls back to identity), metadata }` and `participant-joined` is emitted. On `ParticipantDisconnected` the entry and any audio stream are removed and `participant-left` is emitted (with the stored info, or just `{ identity }`).
- **Auto-leave.** When the last human leaves (`participants.size === 0`) while connected, the session disconnects itself. Disconnecting is what triggers transcript finalisation downstream.
- **Audio.** On `TrackSubscribed` for an audio track (`TrackKind.KIND_AUDIO`) from a human, an `AudioStream` is created and consumed with `for await`. Each frame (`{ data: Int16Array, sampleRate, channels, samplesPerChannel }`) is emitted as `audio-frame(identity, frame)`. Stream errors are logged only while still connected. `TrackUnsubscribed` closes that participant's stream. Streams are keyed by participant identity, so a participant with a second audio track replaces the first stream in the map.
- **`disconnect()`** is idempotent: it returns early if already disconnected, closes all audio streams, calls `room.disconnect()`, and emits `disconnected`. A LiveKit-side `RoomEvent.Disconnected` also clears the connected flag and emits `disconnected`.

## Exports
- `class BotSession extends EventEmitter`
  - `constructor(opts: BotSessionOptions)`
  - getters `roomName`, `botIdentity`, `isConnected`
  - `getParticipants(): ParticipantInfo[]` - current humans.
  - `getHumanParticipantCount(): number` - size of that list.
  - `connect(): Promise<void>` / `disconnect(): Promise<void>`
  - Events: `participant-joined` (info), `participant-left` (info), `audio-frame` (identity, frame), `disconnected`.
- `interface BotSessionOptions` - `{ webinarId, roomName, botIdentity, livekitUrl, token }`; the token is expected to be minted with `canPublish=false` and bot metadata.
- `interface ParticipantInfo` - `{ identity: string; name?: string; metadata?: string }`.

## Interfaces
- **External services:** LiveKit server (WebRTC connection through `@livekit/rtc-node`).

## Dependencies
- **Packages:** `@livekit/rtc-node` - `Room`, `RoomEvent`, `AudioStream`, track types; `events` - `EventEmitter`.

## Used by
`server/note-taker/agents/bot-manager.ts` (creates and stores sessions) and `server/note-taker/transcription/transcription-manager.ts` (listens to its events, imports `ParticipantInfo`). Callers of `BotManager.join()` also attach their own `once("disconnected")` handlers to the returned session.

## Notes
- `disconnected` can fire twice: once from `disconnect()` and again if LiveKit then raises `RoomEvent.Disconnected`. Listeners that do work on disconnect should use `once` or be idempotent. The callers in `webinarRoutes.ts` and `socket.ts` use `once`.
- The `webinarId` option is stored but not read inside this class.
- `TranscriptionManager` reads `userId` from the participant `metadata` passed through here, so the metadata string is forwarded untouched.
