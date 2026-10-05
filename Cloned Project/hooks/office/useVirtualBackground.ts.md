# `hooks/office/useVirtualBackground.ts`

> Client hook that applies background blur or an image background to the local LiveKit camera track with `@livekit/track-processors`, and re-applies it whenever the camera is turned back on.

**Kind:** React hook · **Lines:** 138

## Purpose
Backs the virtual-background picker in the conference control bar. LiveKit track processors are attached to one camera track; turning the camera off and on creates a new track and loses the effect. This hook remembers the chosen background and puts it back automatically. Must run under a `<LiveKitRoom>` provider.

## How it works
**State.**
- `backgroundType: 'none' | 'blur' | 'image'`, `backgroundImage` (URL) and `isProcessing`.
- `processorRef` holds the active processor.
- `pendingRef` holds a background chosen while the camera was not live yet.

**Helpers.**
- `getLiveVideoTrack()` returns the camera publication's `LocalVideoTrack` only when its `mediaStreamTrack.readyState === 'live'`.
- `clearProcessor()` calls `track.stopProcessor()` on the camera track, ignoring errors.

**applyToTrack(type, imageUrl?) (L40-L86).**
1. Sets `isProcessing` and clears any existing processor.
2. `'none'`: resets the state and returns.
3. No live camera track: stores the choice in `pendingRef`, updates state and calls `localParticipant.setCameraEnabled(true)`, so picking a background also switches the camera on.
4. Otherwise it dynamically imports `@livekit/track-processors`, which keeps the large processing bundle out of the initial load. It builds `BackgroundBlur(10)` or `VirtualBackground(imageUrl)` and runs `track.setProcessor(processor)`.
5. Errors are logged; `isProcessing` is cleared in `finally`.

**Public setters.** `setBlur()`, `setImage(url)` and `removeBackground()` are thin wrappers.

**Re-apply on camera enable (L100-L120).** When `isCameraEnabled` becomes true, the hook takes the pending choice, or the current `backgroundType` and image. After a 600 ms delay (so the new `MediaStreamTrack` is live) it applies the background if the track has no processor yet.

**Unmount.** Clears the processor.

## Exports
- `useVirtualBackground(): { backgroundType: BackgroundType; backgroundImage: string; isProcessing: boolean; setBlur(): Promise<void>; setImage(url: string): Promise<void>; removeBackground(): Promise<void> }`
- `type BackgroundType = 'none' | 'blur' | 'image'`

## Interfaces
- **External services:** LiveKit local camera track (processing runs in the browser via `@livekit/track-processors`). Image URLs are loaded from wherever the caller points them.

## Dependencies
- **Packages:**
  - `@livekit/components-react` - `useLocalParticipant`.
  - `livekit-client` - `Track.Source.Camera`, `LocalVideoTrack`.
  - `@livekit/track-processors` - `BackgroundBlur`, `VirtualBackground` (dynamic import).
  - `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`) - calls the hook.
- `components/office/ControlBar.tsx`, `components/office/VirtualBackgroundPicker.tsx` - import only the `BackgroundType` type.

## Notes
- The re-apply effect depends only on `isCameraEnabled`; it reads the other values from the render in which the camera turned on, and the lint rule for exhaustive dependencies is not satisfied here.
- If `type === 'image'` is passed without a URL, no processor is created and the state is left unchanged, apart from the processor cleared at the start.
- Blur strength is fixed at 10.
