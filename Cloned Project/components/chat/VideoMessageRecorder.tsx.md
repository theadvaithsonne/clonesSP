# `components/chat/VideoMessageRecorder.tsx`

> Camera button plus modal recorder that captures a short webcam video note in the browser and hands it to the chat composer as a `File`.

**Kind:** React component · **Lines:** 295

## Purpose
Chat composers (DMs, global DMs, group chats and the admin support-chat console) let users send short video messages. This component owns the whole capture flow: request camera/mic, show a live preview, record with `MediaRecorder`, play back, retake or send. It does no uploading; it only produces a `File` and gives it to the host, which uploads and sends it like any other attachment.

## How it works
- **Closed state:** renders a small ghost icon button ("Record video message"). Clicking it opens the modal and immediately calls `getUserMedia({ video: 640x480 ideal, audio: true })`. The stream is attached to the live `<video>` (muted) on the next animation frame, after the element mounts. A `NotAllowedError` shows "Camera/microphone permission was denied."; any other failure shows "Unable to access camera."
- **Recording:** `pickMime()` chooses the first supported type from `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/webm`, `video/mp4` (fallback `video/webm`). Chunks are collected on `dataavailable`; a one-second interval updates the elapsed counter and auto-stops at `maxSeconds` (default 60). A red pulsing badge shows `elapsed / max`.
- **On stop:** chunks are joined into a Blob, an object URL is created for the playback `<video controls>`, and the camera stream is stopped (camera light goes off).
- **Preview actions:** Retake (reset and reopen the camera) or Send. Send wraps the blob as `video-note-<timestamp>.mp4|webm` (by blob type) and calls `onSend(file)` if provided, otherwise `onRecordingComplete(file)`, then closes.
- **Cleanup:** `reset()` stops the timer and tracks, revokes the preview URL and clears state; closing the modal or unmounting does the same. While recording or holding an unsent clip, a `beforeunload` handler asks the browser to confirm leaving the page.
- The modal is a fixed full-screen overlay at `z-[100]`.

## Exports
- `VideoMessageRecorder({ onRecordingComplete, onSend?, maxSeconds?, className? })`
  - `onRecordingComplete(file: File)` - called with the clip when `onSend` is not given.
  - `onSend?(file: File)` - preferred callback on Send.
  - `maxSeconds?: number` - auto-stop limit, default 60.
  - `className?: string` - extra classes for the trigger button.

## Interfaces
- **Browser APIs:** `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `URL.createObjectURL`, `beforeunload`.
- **Background work:** a 1-second `setInterval` while recording.

## Dependencies
- **Internal:** `components/ui/button.tsx` - buttons; `lib/utils.ts` - `cn`.
- **Packages:** `react`, `lucide-react` (icons).

## Used by
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`

## Notes
- The interval callback calls `stopRecording()` from inside a `setElapsed` updater; it works but is a side effect inside a state updater (may run twice under React Strict Mode).
- The unmount cleanup captures the initial `previewUrl` (null), so a preview URL that exists at unmount time is not revoked by that cleanup.
- `MediaRecorder.isTypeSupported` is called without a guard, so very old browsers without `MediaRecorder` would throw when recording starts.
