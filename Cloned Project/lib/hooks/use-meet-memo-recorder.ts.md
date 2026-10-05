# `lib/hooks/use-meet-memo-recorder.ts`

> A React hook that records a mixed audio track of everyone's microphone in a LiveKit meeting, in the recording user's browser, and builds a timestamped active-speaker timeline alongside it.

**Kind:** frontend library · **Lines:** 378

## Purpose
In a LiveKit conference, a user can record a "voice memo" of the meeting that the backend later turns into a speaker-attributed transcript. This hook does the capture side: it mixes all participants' mic tracks into a single `MediaRecorder` stream and records which participants LiveKit reports as active speakers over time. The caller (`components/dashboard/ConferenceMemoPanel.tsx`) uploads the resulting `Blob`, the speaker timeline and the meeting snapshot through `useVoiceMemos().upload` (`POST /backend/voice-memos`).

## How it works
**State machine.** `state` moves `idle -> recording <-> paused -> stopped`; `reset()` returns to `idle`. The hook also exposes `elapsedSeconds`, `activeSpeakerIdentities`, `heardSpeakers`, `blob`, `mimeType`, `error`, `meetingContext` and `timeline`. Refs hold the live Web Audio graph, the recorder, chunks, timing and the room-listener teardown function.

**`pickMimeType()`** returns the first type `MediaRecorder` supports among `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4`, or `""` to use the browser default.

**Audio mixing (L136-L171).** `attachParticipantAudio(participant)` walks the participant's track publications, takes only `Track.Source.Microphone` tracks that have a `mediaStreamTrack`, wraps each in a `MediaStream`, creates a `MediaStreamAudioSourceNode` and connects it to a shared `MediaStreamAudioDestinationNode`. It attaches at most one source per participant identity (map `attachedRef`). `detachParticipantAudio(identity)` disconnects and forgets the source.

**`start()` (L173-L302).**
1. Sets an error "No active meeting" and returns if `room` is null.
2. Creates an `AudioContext` (falls back to `webkitAudioContext`) and destination, then attaches the local participant and every current remote participant.
3. Creates a `MediaRecorder` on the destination stream; chunks are collected on `dataavailable`; `recorder.start(250)` emits a chunk every 250 ms.
4. Snapshots `meetingContext = { roomId: room.name, roomName: room.name, participants }`. The participant list is fixed at start: people who join later are still recorded but appear only as raw identities in the attributed transcript.
5. Subscribes to LiveKit room events: `ActiveSpeakersChanged` appends `{ tMs, speakers }` to the timeline (offset from start minus paused time) and grows `heardSpeakers`; `ParticipantConnected`, `TrackSubscribed` and `TrackPublished` attach audio; `ParticipantDisconnected` detaches it. The matching `room.off` calls are stored for teardown.
6. Starts a 250 ms interval that updates `elapsedSeconds`, excluding paused time.
On any exception it tears everything down, returns to `idle`, sets `error` and rethrows.

**`pause()` / `resume()`** call the recorder's pause/resume only from the right state and track paused time in `accumulatedPauseRef`, so both the elapsed timer and timeline offsets skip pauses.

**`stop()`** resolves with the final `Blob` (type is the recorder's mime type, or `audio/webm`) once the recorder's `onstop` fires, sets `state = "stopped"` and tears down. It resolves `null` if there is no recorder or `stop()` throws.

**Teardown (`stopTracking`)** clears the timer, removes room listeners, disconnects all sources, closes the `AudioContext` and drops the recorder. It also runs on unmount.

## Exports
- `useMeetMemoRecorder(room: Room | null): UseMeetMemoRecorderResult` - the recorder hook described above.
- `type MeetMemoState` - `"idle" | "recording" | "paused" | "stopped"`.
- `interface MemoParticipant` - `{ identity, name? }`.
- `interface SpeakerTimelineEntry` - `{ tMs, speakers }`, offset in ms from recording start and the identities speaking at that moment.
- `interface UseMeetMemoRecorderResult` - shape of the hook's return value (state fields plus `start`, `pause`, `resume`, `stop`, `reset`).

## Interfaces
- **External services:** listens to events on a LiveKit `Room` (LiveKit cloud, `wss://lk.garage.app`); no network calls of its own.

## Dependencies
- **Packages:** `livekit-client` - `Room`, `RoomEvent`, `Track` and participant/track types; `react` - state, refs, callbacks.

## Used by
- `components/dashboard/ConferenceMemoPanel.tsx`

## Notes
- Privacy: the recording happens only in the recorder's browser and other participants are **not** notified. The source comment states this is a product decision (consent handled by T&Cs/org policy) and suggests broadcasting a data-channel event from `start()`/`stop()` if that changes.
- Only microphone audio is captured; screen-share audio is not.
- If a participant's mic track is replaced (for example after re-publishing), the identity is already in `attachedRef`, so the new track is not attached until the participant disconnects and is detached.
- Remote audio comes from subscribed tracks only; participants whose tracks are not subscribed in this client are not recorded.
