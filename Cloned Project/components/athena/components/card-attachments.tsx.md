# `components/athena/components/card-attachments.tsx`

> The "Attachments" section of an Athena task card: loads the task's files from the Taskroom API with infinite scroll, uploads new files to S3 (picker, drag-drop, paste) or adds video links, deletes attachments, and previews images, videos, PDFs and Word documents in a full-screen viewer.

**Kind:** React component · **Lines:** 982

## Purpose
Each Athena (Taskroom) task opened in `card-modal.tsx` can carry files. This component is the self-contained file manager for one task. The attachment list itself is owned by the parent (`attachments` + `onAttachmentsChange`), and persisting new attachments is delegated to the parent's `onSave` callback (in `card-modal.tsx` that is `handleSaveAttachments`, which POSTs to the Taskroom `attachments/bulk` endpoint). Fetching, uploading, deleting and previewing happen here. All servers involved are external (`uatapi.garage.app`), not this repo's Express backend.

## How it works

### Helpers (L57-L210)
- `detectFileType(mime, name)` collapses everything into three buckets the Taskroom API understands: `image`, `video` (including the pseudo-MIME `video/link`) or `document`.
- `formatFileSize` (B/KB/MB) and `formatDate` ("Just now", "5m ago", "3h ago", or a short date).
- `FileIcon` picks an icon by type and extension (PDF badge, Word, sheet, slides, archive, audio, code); `GridThumbnail` shows the image itself or a tinted icon tile; a local initial-letter `Avatar` (currently unused in the render); skeleton rows/cards for loading states.

### Fetching (L248-L387)
- First page: when `cardId` and `boardId` are set and nothing has been fetched yet, `GET https://uatapi.garage.app/taskroomv2/v2/attachments?roomId=<boardId>&taskId=<cardId>&page=1&size=50` with the `garage_tok` bearer token. API records are normalised (`link`/`fileUrl`, `name`/`fileName`, `createdAt`, `createdBy.name`, size) and handed to `onAttachmentsChange`. A generation counter (`fetchGenerationRef`) discards a response that arrives after a newer upload, so an in-flight fetch cannot overwrite freshly uploaded files.
- Next pages: a callback ref on the last item (grid or list) uses an `IntersectionObserver` (200px root margin) to bump `currentPage`; an effect then fetches that page and appends it while `metadata.nextPage` is truthy.
- When `showAttachments` becomes false, fetch state is reset so the list reloads the next time the section is shown.

### Upload area visibility (L389-L403, L593-L601)
On first render the drop zone opens automatically if the task has no attachments (and the user is not read-only); it auto-closes once attachments appear, unless the user toggled it manually with the "+" header button.

### Adding files (L417-L530)
- `uploadFilesToS3` posts multipart `files[]` with `folder: "task-attachments"` to `https://uatapi.garage.app/api/s3upload/multiple` and maps the returned URLs back onto the files by index.
- `processFiles` (used by the file picker, drag-drop and the "Click & paste" box) uploads, appends the new attachments optimistically, calls `onSave(uploaded)` with only the new items, bumps the fetch generation and shows a toast.
- `addVideoLink` adds a URL as a `video` attachment (name taken from the URL path), rejecting duplicates, then calls `onSave` with the whole list.

### Deleting (L532-L559)
Saved attachments (with `_id`) are deleted via `DELETE .../taskroomv2/v2/attachments/:id` before being removed locally; unsaved ones are just removed. Read-only users get an "Observers can only view attachments" toast.

### Preview and download (L561-L590, L900-L979)
- `handlePreview` opens a full-screen overlay (`z-[9999]`, closed by Escape or the X button): images inline, videos in a `<video>` player, PDFs in an iframe, `.doc`/`.docx` through the Google Docs viewer (`https://docs.google.com/viewer?url=...&embedded=true`), anything else as "Preview not available" with a download button.
- "Download all" creates a temporary `<a download>` for every non-video attachment and clicks it.

### Layout (L602-L898)
Collapsible header (chevron toggle) with download-all, grid/list toggle and add button. Grid view (default) shows thumbnail cards with name, date and size; list view shows name and modified date. Both include a delete button (always visible on mobile, on hover on desktop), skeleton placeholders while loading, and an empty state.

## Exports
- `CardAttachments(props: CardAttachmentsProps)` - props: `cardId`, `boardId` (sent as `roomId`), `attachments`, `onAttachmentsChange(list)`, `onSave?(list): Promise<void>`, `showAttachments?` (default false), `isReadOnly?` (default false).
- `interface Attachment` - `{ _id?, link, name, fileType: "document" | "image" | "video", comment, fileSize?, uploadedAt?, uploaderName?, uploaderAvatar? }`; also imported by `card-modal.tsx`.

## Interfaces
- **External services:** Taskroom API at the hardcoded `https://uatapi.garage.app/taskroomv2/v2` (`GET attachments`, `DELETE attachments/:id`); S3 upload service `POST https://uatapi.garage.app/api/s3upload/multiple`; Google Docs viewer for Word previews.
- **Browser storage:** `localStorage.garage_tok` - bearer token.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx`.
- **Packages:** `react`, `lucide-react` (icons), `sonner` (toasts).

## Used by
- `components/athena/components/card-modal.tsx`

## Notes
- The Taskroom base URL is hardcoded here (`FLOWBOARD_API_URL`, despite the name) instead of using `NEXT_PUBLIC_TASKROOM_URL` like sibling components, so it always targets UAT.
- `addVideoLink` passes the full attachment list to `onSave`, while `processFiles` passes only the new uploads. With `card-modal.tsx`'s bulk-save handler this may resubmit existing attachments when a video link is added.
- `handleExpandToggle` and `handleAddClick` contain commented-out `fetchFirstPage()` calls; loading actually happens in the effect regardless of whether the section is expanded.
- The "next page" effect reads `attachments` from its closure but does not list it as a dependency.
- The mobile "Tip" message reads `window.innerWidth` during render, so it does not react to resizing.
- `Maximize2` and the local `Avatar` component are unused.
