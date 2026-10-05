# `lib/hooks/useCabinetUploadGestures.ts`

> A hook that adds "paste it or drop it into this folder" uploading to cabinet (file storage) pages: page-wide Ctrl/Cmd+V of files, drag-and-drop of files and whole folders, sequential uploads with progress, and the related toasts.

**Kind:** React hook · **Lines:** 324

## Purpose
The personal, organisation, founder and floor cabinets each have their own upload endpoint and refresh logic, but the paste/drop gestures should behave the same everywhere. This hook owns the gestures, sequencing and feedback; the page supplies the actual upload call (`uploadFile`), optional sub-folder creation (`ensureFolder`) and a `refresh`. By default gestures do not upload directly: they stage files for review in the page's upload dialog (`onStageFiles`), so a stray paste or a folder dropped on the wrong tab can be cancelled.

## How it works
**Options (`Options` interface, L39-L74).** `enabled` (a folder is open), `canUpload` (permission, default true), `uploadFile(file, target)`, `ensureFolder?(relativePath)`, `refresh()`, `onUploaded?(files)` (cabinets use it for the affiliate share toast from `useAffiliateShare`), `disabledReason?` and `onStageFiles?(files)`. Every option is mirrored into `optionsRef` on each render, so listeners bound once never see stale values.

**Two gating rules.**
- `enabled === false` means "not ready": gestures show the toast `disabledReason` or "Open a folder before uploading".
- `canUpload === false` means "not allowed": the hook does not intercept at all. Paste stays a normal browser paste and dragover is not prevented, so the browser shows its "no drop" cursor. The comment explains that a member pasting into a founder-only cabinet should not get a dialog they cannot use.

**`uploadFiles(incoming)` (L136-L206).** Accepts `File[]` or `PickedFile[]` (normalised via `toPickedFiles`). Files upload **one at a time** so progress stays accurate and one failure does not abort the batch; `uploadProgress` reports `{ done, total, name }`. For files from a dropped folder (non-empty `relativePath`), `ensureFolder` is called **once per distinct path** and memoised; if it throws, the file goes into the open folder. Uploads that return nothing are recorded as `{ _id: "", name }`. After the batch, if anything succeeded it awaits `refresh()` and then calls `onUploaded(uploaded)`; failures produce one error toast (a single file name or a count).

**`handleIncoming(files)`.** Re-checks permission and readiness, then either stages the files (`onStageFiles`) or uploads straight away.

**Paste (L237-L255).** A `document` `paste` listener ignores events while the user is typing in an input or editor (`isTypingTarget`). Otherwise it takes files from `filesFromClipboard()`, calls `preventDefault()` and hands them on.

**Drag and drop (L257-L314).** `dragDepthRef` counts enter/leave pairs so the drop overlay (`isDraggingFiles`) does not flicker over child elements. `onDragOver` sets `dropEffect = "copy"` and prevents the browser from navigating to the file. `onDrop` calls `filesFromDrop()`, which walks dropped directories asynchronously, and shows an error toast for folders the browser cannot read and a warning when a huge folder was truncated.

## Exports
- `useCabinetUploadGestures(options)` - returns `{ isDraggingFiles, uploadProgress, uploading, uploadFiles, dropZoneProps }`; spread `dropZoneProps` (`onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`) onto the drop-zone element.
- `interface UploadedCabinetFile` - `{ _id, name }` returned by a page's upload call.
- `interface UploadTarget` - `{ relativePath, cabinetId? }` passed to `uploadFile`.
- `interface UploadProgress` - `{ done, total, name }`.

## Interfaces
- **Browser events:** a global `document` `paste` listener while mounted; React drag events on the element that receives `dropZoneProps`.
- No network calls of its own; uploads go through the page-supplied `uploadFile`.

## Dependencies
- **Internal:** `lib/clipboard-files.ts` - `dragHasFiles`, `filesFromClipboard`, `filesFromDrop`, `isTypingTarget`, `toPickedFiles`, `PickedFile`.
- **Packages:** `react` - state, refs, effects; `sonner` - toasts.

## Used by
- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/FloorCabinetPage.tsx`
- `components/dashboard/FounderCabinetPage.tsx`
- `components/dashboard/cabinet-upload-ui.tsx`

## Notes
- The paste listener is document-wide, so two mounted cabinet surfaces would both react to one paste.
- Upload order is sequential by design; large batches are slower, but feedback stays accurate.
