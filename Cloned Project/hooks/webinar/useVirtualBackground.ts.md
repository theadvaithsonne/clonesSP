# `hooks/webinar/useVirtualBackground.ts`

> Client hook that applies background blur or a virtual background image to the webinar host's LiveKit camera track and keeps the local preview in `webinarStore` in step with the processed video.

**Kind:** React hook · **Lines:** 208

## Purpose
The webinar room does not wrap its call in a `<LiveKitRoom>` provider. It holds an imperative LiveKit `Room` inside `useWebinarLiveKit`, so `useLocalParticipant()` from `@livekit/components-react` is not available. This hook takes a `getRoom()` accessor instead and attaches `@livekit/track-processors` processors to the local camera publication. A source comment says it mirrors a similar hook in NetworkChain's meet app.

## How it works
- **`getLiveVideoTrack`** returns the local participant's `Track.Source.Camera` track, but only when its `mediaStreamTrack.readyState === "live"`. Otherwise it returns null.
- **`clearProcessor`** calls `track.stopProcessor()` (errors ignored), then syncs the store with the track's now-raw `mediaStreamTrack` and resets `processorRef`.
- **`applyToTrack(type, imageUrl?)`** sets `isProcessing`, clears any existing processor and then:
  - `"none"`: resets the state to no background.
  - No live camera yet: stores the choice in `pendingRef`, updates the state and calls `room.localParticipant.setCameraEnabled(true)`.
  - Otherwise it dynamically imports `@livekit/track-processors`, builds `BackgroundBlur(10)` or `VirtualBackground(imageUrl)` and calls `track.setProcessor(...)`. It then pushes the processed `mediaStreamTrack` into the store. Errors are logged as `[VirtualBackground] apply failed:`.
- **`syncLocalStreamWithProcessedTrack(track)`** (module-private) works around a stale preview. When a processor is attached, LiveKit swaps the underlying `MediaStreamTrack`, but `webinarStore.localStream` still holds the original getUserMedia track. The helper builds a new `MediaStream` from the new video track plus the existing audio track and calls `setLocalStream`, so the host's own tile (VideoGrid) re-renders with the processed video. It sets `null` if there are no tracks.
- **Deferred apply effect:** while a background is chosen or pending, it checks every 500ms, up to 20 times (about 10s), for a live camera track. Once one is live and has no processor (`getProcessor?.()`), it applies the pending or current choice. It polls because the imperative Room exposes no convenient camera-enabled signal here.
- **Unmount:** calls `clearProcessor()`.

## Exports
- `type BackgroundType = "none" | "blur" | "image"`.
- `useVirtualBackground(getRoom: () => Room | null)` - returns `{ backgroundType, backgroundImage, isProcessing, setBlur(), setImage(url), removeBackground() }`.

## Interfaces
- **Background work:** a short-lived 500ms `setInterval` (at most 20 ticks) that waits for the camera to go live.

## Dependencies
- **Internal:** `store/webinarStore.ts` - reads `localStream` and calls `setLocalStream` through `getState()`.
- **Packages:** `livekit-client` - `Track`, `LocalVideoTrack`, `Room` · `@livekit/track-processors` - `BackgroundBlur` and `VirtualBackground` (imported dynamically, MediaPipe-based) · `react`.

## Used by
- `components/webinar/ControlBar.tsx` - calls `useVirtualBackground(getRoom ?? (() => null))`.
- `components/webinar/VirtualBackgroundPicker.tsx` - imports only the `BackgroundType` type.

## Notes
- The blur strength is hardcoded at 10.
- `processorRef` is written but never read for control flow. The live processor is checked through `track.getProcessor`.
- Choosing a background while the camera is off turns the camera on as a side effect.
