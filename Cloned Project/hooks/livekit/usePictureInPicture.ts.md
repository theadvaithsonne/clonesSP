# `hooks/livekit/usePictureInPicture.ts`

> Document Picture-in-Picture hook for the webinar room: opens a floating PiP window manually, when the tab is hidden, or through Chrome's Media Session "enterpictureinpicture" action.

**Kind:** React hook · **Lines:** 176

## Purpose
Keeps a webinar visible when the viewer switches tabs. It manages the lifetime of a Document PiP `Window` (a real mini browser window the caller renders React into, for example with a portal into `#pip-root`) and wires up the browser hooks that can open it automatically. The header comment notes it is used by the standalone webinar page only; the meet flow uses a global `PipProvider` instead. Low-level window creation lives in `lib/livekit/pip-window.ts`.

## How it works
**State.** `pipWindow` (state, for rendering) mirrored in `pipWindowRef` (for synchronous checks in event handlers). `mediaSessionVideoRef` holds a hidden `<video>`, and `canvasStreamRef` a placeholder stream. `supported` is computed once with `isDocumentPipSupported()` (checks `documentPictureInPicture` in `window`).

**Manual open/close.** `openPip()` does nothing if a window is already open, otherwise calls `requestPipWindow({ skipIfVisible: false })`, stores the window and listens for its `pagehide` event to clear state when the user closes it. `closePip()` closes and clears it.

**Hidden media element (L51-L92).** While `inCall` and supported, the hook appends a 1x1, invisible, muted, `autopictureinpicture` `<video>` to `document.body`. Its `srcObject` is `fallbackTrack` when given, or a 2x2 black canvas stream from `createCanvasMediaStream()` when the camera and mic are both off. It sets `navigator.mediaSession.metadata` (title "Garage Webinar", artist "In progress") and `playbackState = "playing"`. Chrome needs this playing media before it will offer automatic PiP.

**Media Session action (L94-L122).** Registers an `enterpictureinpicture` action handler (Chrome-only, hence the `@ts-expect-error`). The handler calls `requestPipWindow({ skipIfVisible: true })`, so it will not open an empty PiP window over a page that is still visible. The handler is unregistered on cleanup.

**Auto-open on tab hide (L124-L143).** A `visibilitychange` listener opens the PiP window when `document.hidden` becomes true and none is open.

**Cleanup.** When `inCall` turns false, `closePip()` runs. On unmount the window is closed, the hidden video is detached and removed, and the canvas stream's tracks are stopped.

## Exports
- `usePictureInPicture(inCall: boolean, fallbackTrack: MediaStreamTrack | null): { pipWindow: Window | null; openPip(): Promise<void>; closePip(): void; isPipSupported: boolean }`

## Interfaces
- **External services:** browser Document Picture-in-Picture API and Media Session API (Chromium browsers).

## Dependencies
- **Internal:** `lib/livekit/pip-window.ts` - `isDocumentPipSupported`, `requestPipWindow` (opens a 340x240 window, copies the page's stylesheets, adds a dark `#pip-root` mount node), `createCanvasMediaStream`.
- **Packages:** `react` - hooks.

## Used by
- `app/webinar/[id]/WebinarRoomClient.tsx` (route `/webinar/[id]`).

## Notes
- `requestWindow` normally needs a user gesture. The `visibilitychange` path may be refused by the browser; `requestPipWindow` returns `null` on `NotAllowedError`, so the hook quietly does nothing.
- The `pagehide` registration logic is repeated in three places (manual, media-session, visibility).
- Despite the folder name, nothing here is LiveKit-specific; it only needs a `MediaStreamTrack`.
