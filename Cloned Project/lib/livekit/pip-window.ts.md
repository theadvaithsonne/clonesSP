# `lib/livekit/pip-window.ts`

> Shared helpers for the browser Document Picture-in-Picture API: feature detection, opening a styled PiP window with a React mount point, and a tiny placeholder video stream.

**Kind:** frontend library · **Lines:** 87

## Purpose
Both the global meeting PiP (`components/meet/PersistentPipRenderer.tsx`) and the webinar/LiveKit PiP hook (`hooks/livekit/usePictureInPicture.ts`) need to pop the call out into a floating always-on-top window when the user switches tabs. This file holds the low-level, framework-free part of that work so the two callers stay consistent.

## How it works
- **Feature detection:** `isDocumentPipSupported()` returns true only in a browser where `window.documentPictureInPicture` exists (Chromium-based browsers at the time of writing). It is SSR-safe.
- **Opening a window:** `requestPipWindow(opts)`:
  1. Returns `null` when the API is missing.
  2. With `skipIfVisible` (default `true`) it returns `null` while the host tab is still visible (`document.hidden === false`), so an automatic "tab hidden" trigger does not open an empty PiP on top of a visible page. Callers that open PiP from an explicit button click pass `skipIfVisible: false`.
  3. Calls `documentPictureInPicture.requestWindow({ width, height })` (defaults 340x240).
  4. Copies every stylesheet of the host document into the PiP document: linked sheets as `<link>` tags, inline sheets by concatenating their `cssRules` into a `<style>`. Cross-origin sheets that throw on `cssRules` access are skipped silently. This is what makes Tailwind classes work inside the PiP.
  5. Forces a dark base: `color-scheme: dark`, background `#181818`, white text, no margin/padding, hidden overflow, 100% height. The comment explains the PiP window does not inherit `prefers-color-scheme`.
  6. Appends a full-size `<div id="pip-root">` that callers render React into (typically with a portal).
  7. Returns the PiP `Window`, or `null` on failure. A `NotAllowedError` (no user activation) returns `null` quietly; other errors are logged with a `[PiP]` prefix.
- **Placeholder stream:** `createCanvasMediaStream()` draws a 2x2 black canvas and returns `canvas.captureStream(1)`, a 1 fps black video stream. Callers use it as a dummy source for a hidden `<video>` element (a common trick for keeping a media session / PiP-eligible element alive).

## Exports
- `isDocumentPipSupported(): boolean` - whether Document PiP is available.
- `interface PipWindowOptions { width?; height?; skipIfVisible? }` - options for `requestPipWindow`.
- `requestPipWindow(opts?: PipWindowOptions): Promise<Window | null>` - opens and prepares the PiP window, or `null`.
- `createCanvasMediaStream(): MediaStream` - 1 fps black placeholder video stream.

## Dependencies
- **Internal:** none.
- **Packages:** none (browser APIs only).

## Used by
- `components/meet/PersistentPipRenderer.tsx` - global meeting PiP (auto on tab hide and manual).
- `hooks/livekit/usePictureInPicture.ts` - webinar / LiveKit PiP hook.

## Notes
- `requestWindow` needs transient user activation; automatic triggers on `visibilitychange` can be rejected, which is why `NotAllowedError` is swallowed.
- Uses `// @ts-expect-error` because the Document PiP API is not in TypeScript's DOM lib.
- Styles are copied once at open time; stylesheets added to the main document later are not mirrored.
