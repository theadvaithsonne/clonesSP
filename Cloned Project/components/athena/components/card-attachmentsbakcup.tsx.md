# `components/athena/components/card-attachmentsbakcup.tsx`

> An unused backup copy of the Athena/Taskroom card attachments panel: lists, uploads, previews and deletes files attached to a task card.

**Kind:** React component · **Lines:** 857

## Purpose
This is an older snapshot of `components/athena/components/card-attachments.tsx`, the attachments section shown inside the Athena task-card modal (`card-modal.tsx`). The file name is a misspelling of "backup". Nothing imports it; the live modal imports `./card-attachments` instead. It is kept as a reference copy, and it still talks to the external Taskroom ("flowboard") API at `https://uatapi.garage.app`, not to this repo's `/backend`.

## How it works
**Constants (L54-L55).** `API_URL = "https://uatapi.garage.app"` is used for S3 uploads. `FLOWBOARD_API_URL = "https://uatapi.garage.app/taskroomv2/v2"` is used for attachment listing and deletion. Both are hardcoded and ignore environment variables.

**Helpers (L58-L164).**
- `detectFileType(mime, name)` sorts a file into `"image"`, `"video"` or `"document"` using the MIME type and the file extension. Any `video/*` MIME type, or the special value `video/link`, counts as video.
- `formatFileSize`, plus `formatDate`, which prints relative times ("Just now", "5m ago", "3h ago") and switches to a short date after a day.
- `FileIcon` picks a lucide icon or coloured badge for each extension (PDF, Word, spreadsheet, slides, archive, audio, code). `GridThumbnail` shows the image itself or a tinted icon tile. `Avatar` shows the uploader's initial on a colour chosen from that initial.

**Fetching (L198-L325).** When `cardId` and `boardId` are set, the first effect loads page 1: `GET {FLOWBOARD_API_URL}/attachments?roomId=&taskId=&page=1&size=50`. It sends the `garage_tok` token from localStorage as a Bearer token. Each server record is mapped to an `Attachment` (it accepts `link`/`fileUrl`, `fileSize`/`size`, and `createdAt`/`uploadedAt`), then passed to the parent through `onAttachmentsChange`. If `metadata.nextPage` is present, more pages exist. An `IntersectionObserver` with a 200px root margin watches the last row; when it comes into view, `currentPage` goes up and a second effect appends the next page. When `showAttachments` turns false, the fetch flags reset, so the list reloads the next time the panel opens.

**Uploading (L340-L430).** `uploadFilesToS3` posts a multipart form (`files[]`, `folder=task-attachments`) to `POST {API_URL}/api/s3upload/multiple`. It expects `{ success, data: [{ url, fileName }] }` back. `processFiles` appends the uploaded files to the current list. It then calls `onSave` if one was given (in the live modal, `onSave` persists the list) and reports the result with a toast. Files can arrive from the hidden file input, from drag-and-drop on the drop zone, or from a paste into a read-only text box: `handlePaste` takes the file items from the clipboard.

**Video links (L433-L451).** A pasted URL becomes a `"video"` attachment named after the last part of its path. Duplicate links are rejected.

**Removing (L453-L480).** If the attachment has a server `_id`, the panel calls `DELETE {FLOWBOARD_API_URL}/v1/files/{_id}` before removing it from the list. Attachments that were never saved are only removed locally. Read-only viewers get a toast saying observers can only view.

**Preview (L483-L499, L773-L854).** Clicking a file opens a full-screen overlay (z-index 9999) that Escape closes. Images use `<img>`. Videos use `<video>` with an `<iframe>` fallback. PDFs open in an iframe, and Word files open in an iframe through the Google Docs viewer (`docs.google.com/viewer?url=...&embedded=true`). Other types show a "Preview not available" message with a download button. `downloadAll` clicks a temporary anchor for every attachment that is not a video.

**Layout.** The header holds a collapse toggle, a count badge, download-all, grid and list view switches, an Expand button with no handler, and an upload "+" button. List view is a table with Name, Size, Modified and Author columns. Grid view is a 3-column grid of thumbnails.

## Exports
- `CardAttachments(props: CardAttachmentsProps)`: the attachments panel. Props: `cardId`, `boardId` (the Taskroom room id), `attachments`, `onAttachmentsChange`, optional `onSave(attachments) => Promise<void>`, `showAttachments` (default false), `isReadOnly` (default false).
- `interface Attachment`: `{ _id?, link, name, fileType: "document" | "image" | "video", comment, fileSize?, uploadedAt?, uploaderName?, uploaderAvatar? }`.

## Interfaces
- **External services:** Taskroom/flowboard API at `https://uatapi.garage.app/taskroomv2/v2`:
  - `GET /attachments?roomId&taskId&page&size` lists attachments.
  - `DELETE /v1/files/{id}` deletes one.
- **External services:** `POST https://uatapi.garage.app/api/s3upload/multiple` uploads files to S3. Google Docs viewer is used for Word previews.
- **Browser storage / cookies:** reads the `garage_tok` JWT from localStorage.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx` (shadcn UI controls).
- **Packages:** `react`, `lucide-react` (icons), `sonner` (toasts).

## Used by
Nothing imports this file, so it appears unused (dead code). The live version is `components/athena/components/card-attachments.tsx`, which `card-modal.tsx` imports. That file is 981 lines and, unlike this copy, deletes through `{FLOWBOARD_API_URL}/attachments/{id}` instead of `/v1/files/{id}`.

## Notes
- This is a backup file and can probably be deleted. Note that `newbackupAttachment.tsx` in the same folder is another backup.
- The next-page effect closes over `attachments` but does not list it as a dependency, so in some cases it can append pages to an out-of-date list.
- The second page mapping does not copy `uploaderAvatar`, but the first page mapping does.
- The `Maximize2` "Expand" button does nothing.
