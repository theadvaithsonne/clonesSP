# `hooks/use-voice-recorder.ts`

> A browser-only React hook that records microphone audio with `MediaRecorder`, exposes pause/resume/stop controls, an elapsed-time counter and a live input-level meter, and returns the finished recording as a `Blob`.

**Kind:** React hook · **Lines:** 224

## Purpose
Voice memos are recorded in two places in the app (the general voice-memo panel and the conference memo panel). This hook holds all the low-level recording logic: microphone permission, codec selection, chunk collection, the level meter and timer, and resource cleanup, so the UI components only deal with state and buttons. It does not upload anything; callers take the returned `Blob` and send it wherever they need.

## How it works
**Codec choice.** `pickMimeType()` returns the first type `MediaRecorder.isTypeSupported` accepts from `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4`, or `""` (browser default). The type the browser actually used is exposed as `mimeType`.

**State machine.** `state` is `"idle" | "recording" | "paused" | "stopped"`.
- `start()` clears `error`, calls `getUserMedia({ audio: { echoCancellation, noiseSuppression, autoGainControl } })`, creates the `MediaRecorder`, and starts it with a 250 ms timeslice so `ondataavailable` pushes chunks into `chunksRef` continuously. It resets `elapsedSeconds` and `blob` and moves to `"recording"`. On failure (for example, permission denied) it cleans up, returns to `"idle"`, stores the message in `error` and **re-throws**, so callers must catch.
- `pause()` / `resume()` only act when the recorder is in the matching state.
- `stop()` returns a Promise. In `recorder.onstop` it joins the chunks into a `Blob` (type falls back to `audio/webm`), stores it, moves to `"stopped"`, cleans up and resolves with the blob. If `recorder.stop()` throws it resolves `null`. With no active recorder it resolves `null` straight away.
- `reset()` cleans up and returns every field to its initial value.

**Level meter.** An `AudioContext` (with `webkitAudioContext` fallback) feeds the stream into an `AnalyserNode` (`fftSize` 1024). `tickLevel` runs on `requestAnimationFrame`, computes the RMS of the time-domain samples, multiplies by 3 and clamps to 0-1 as `level`.

**Timer.** A 250 ms `setInterval` updates `elapsedSeconds` from `startedAt` plus an `accumulated` counter that `recorder.onpause` adds to.

**Cleanup.** `cleanup()` cancels the animation frame and interval, closes the `AudioContext`, stops every microphone track and drops the recorder reference. It runs on unmount, after stop, on reset and on start failure.

## Exports
- `useVoiceRecorder(): UseVoiceRecorderResult` - the recorder hook.
- `formatElapsed(seconds: number): string` - formats seconds as `mm:ss`.
- `type RecorderState` - `"idle" | "recording" | "paused" | "stopped"`.
- `interface UseVoiceRecorderResult` - `{ state, elapsedSeconds, level, blob, mimeType, error, start, pause, resume, stop, reset }`.

## Dependencies
- **Packages:** `react` - hooks and refs.

## Used by
- `components/dashboard/ConferenceMemoPanel.tsx`
- `components/voice-memos/VoiceMemoPanel.tsx`

## Notes
- **Paused time is not excluded correctly**, although the docstring says it is. The interval keeps running while paused, `startedAt` is never moved forward on resume, and `onpause` adds the total time since start to `accumulated` rather than the length of the segment. After a pause the counter keeps rising and can jump ahead. The recorded audio itself is fine; only `elapsedSeconds` is affected.
- The level meter also keeps running while paused, because the analyser reads the live microphone stream.
- `"use client"`: it relies on browser-only APIs (`navigator.mediaDevices`, `MediaRecorder`, `AudioContext`).
