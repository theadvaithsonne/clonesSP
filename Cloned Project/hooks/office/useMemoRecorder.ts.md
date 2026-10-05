# `hooks/office/useMemoRecorder.ts`

> Client hook wrapping `MediaRecorder` to capture a personal microphone-only voice memo during a meeting, with pause/resume and a live elapsed-seconds counter.

**Kind:** React hook · **Lines:** 177

## Purpose
The recording half of the conference "voice memo" feature: press record, get an audio `Blob` back, then the parent uploads it with `useVoiceMemos().upload`. The header comment says it is deliberately smaller than the NetworkChains version, which also mixes remote participants' audio and tracks who is speaking. This one records only the local mic.

## How it works
**MIME choice.** `pickMimeType()` returns the first of these that `MediaRecorder.isTypeSupported` accepts, or `''`:
1. `audio/webm;codecs=opus`
2. `audio/webm`
3. `audio/ogg;codecs=opus`
4. `audio/mp4`

**State machine.** `state: MemoState` moves `idle -> recording <-> paused -> stopped`. The hook also exposes `blob`, `mimeType`, `elapsed` (seconds) and `error`. Refs hold the `MediaStream`, the recorder, the chunk array and timing values.

**start().**
- Resets `blob`, `error` and `elapsed`, then calls `getUserMedia({ audio: true })`.
- Creates the `MediaRecorder` with the chosen MIME type (or the browser default) and records `mimeType`.
- Collects non-empty chunks and calls `rec.start(1000)`. The 1 s timeslice means partial data always exists.
- A 250 ms interval updates `elapsed` from `accruedRef + (now - startTsRef)`.
- The recorder's `onstop` builds the final `Blob` and sets `state = 'stopped'`; `onerror` sets `error` and `stopped`.
- If the mic is refused, it sets `error` ("Microphone access denied" by default), returns to `idle` and cleans up.

**pause() / resume().** Act only in the matching recorder state. Pause adds the live segment to `accruedRef` and stops the timer. Resume restarts the segment clock and the timer.

**stop().** Returns a `Promise<Blob | null>`.
- If the recorder is missing or inactive, it resolves with the current `blob`.
- Otherwise it wraps the existing `onstop` so the promise resolves with a `Blob` built from the chunks once recording has stopped. This avoids waiting for React state.
- It then calls `rec.stop()` (resolving `null` if that throws), stops the mic tracks and clears the timer.

**reset() / cleanup.** `cleanup()` stops the timer and mic tracks and clears the refs. It also runs on unmount. `reset()` calls it and returns all state to `idle`.

## Exports
- `useMemoRecorder(): { state, elapsed, blob, mimeType, error, start(), pause(), resume(), stop(): Promise<Blob | null>, reset() }`
- `type MemoState = 'idle' | 'recording' | 'paused' | 'stopped'`

## Interfaces
- **External services:** browser `getUserMedia` / `MediaRecorder` (microphone permission).

## Dependencies
- **Packages:** `react` - state, refs, effects, callbacks.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`) - passes `start/pause/resume/stop/reset`, `elapsed` and `error` into the memos panel.
- `components/office/MemosPanel.tsx` - imports only the `MemoState` type.

## Notes
- It opens a second microphone stream with `getUserMedia`, separate from the LiveKit-published mic. Muting yourself in the call does not mute the memo.
- `cleanup()` resets `chunksRef`; calling `reset()` while recording discards the audio.
- `stop()` stops the mic tracks but leaves `recorderRef` set; a later `start()` replaces it.
