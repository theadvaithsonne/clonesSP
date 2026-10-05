# `components/athena/components/newbackupAttachment.tsx`

> An unused backup copy of a card-attachments panel: it lists a task's files from the external Flowboard/Taskroom API, uploads new files through an S3 upload endpoint, accepts video links, and opens a full-screen previewer.

**Kind:** React component · **Lines:** 857

## Purpose
As the file name suggests, this is a saved "new backup" version of the `CardAttachments` widget used in task/card detail modals. Nothing in the repo imports it. It shows how the attachments panel worked at one point: it talks directly to the external `uatapi.garage.app` services rather than to this repo's `/backend`. Treat it as reference code, not live code.

## How it works
**Helpers (L57-L164)**
- `detectFileType(mime, fileName)` sorts files into `"image"`, `"video"` or `"document"` using lists of MIME types and file extensions. The pseudo-MIME `video/link` also counts as video.
- `formatFileSize` produces B, KB or MB strings.
- `formatDate` produces relative times ("Just now", "5m ago", "3h ago") or a short date.
- `FileIcon` picks an icon or a coloured badge by file extension: PDF, Word, spreadsheet, slides, archive, audio, code, video.
- `GridThumbnail` shows the image itself, or a large icon on a tinted tile.
- `Avatar` is an initial in a colour chosen from the character code.

**Loading files (L197-L317)**
- The first page loads when both `cardId` and `boardId` are set and files have not been fetched yet. It sends `GET https://uatapi.garage.app/taskroomv2/v2/attachments?roomId=<boardId>&taskId=<cardId>&page=1&size=50`, with a Bearer token read from `localStorage.garage_tok`.
- Rows are normalised into `Attachment` objects (`fileLink`/`fileUrl`, uploader name and avatar, size, date) and handed back through `onAttachmentsChange`.
- `hasNextPage` follows `metadata.nextPage`.
- A callback ref on the last row (`lastElementRef`, an IntersectionObserver with a 200px margin) increments `currentPage`. A second effect then fetches that page and appends it.
- Setting `showAttachments` to false resets the fetch state, so reopening refetches.

**Uploading (L339-L397)**
- `uploadFilesToS3` sends `POST https://uatapi.garage.app/api/s3upload/multiple` as multipart form data: a `files` field per file, plus `folder=task-attachments`. It expects `{ success, data: [{ url, fileName }] }` back and maps each result to an attachment with the comment "Uploaded via CardAttachments".
- `processFiles` appends the new attachments to the list. If an `onSave` callback was supplied, it awaits `onSave` first and only then calls `onAttachmentsChange`; otherwise it calls `onAttachmentsChange` directly. It shows success or failure toasts.
- Files can come from the hidden file input, a drag-and-drop zone, or a read-only "paste here" text box whose `onPaste` handler pulls files from the clipboard.

**Video links (L432-L451)**
- `addVideoLink` adds a URL as a `video` attachment. It rejects duplicates, takes the file name from the last part of the URL path, and calls `onSave` if supplied.

**Removing (L453-L480)**
- An attachment that has an `_id` is deleted on the server with `DELETE https://uatapi.garage.app/taskroomv2/v2/v1/files/:id` and then removed locally.
- An unsaved attachment (no `_id`) is only removed locally.
- In read-only mode, a toast says observers can only view attachments.

**Preview and download (L482-L511, L772-L854)**
- Images and videos are shown inline.
- PDFs are shown in an iframe.
- `.doc` and `.docx` files are shown through the Google Docs viewer (`docs.google.com/viewer?url=...&embedded=true`).
- Other types show a "Preview not available" panel with a download button.
- The full-screen overlay closes on Escape.
- "Download all" clicks a temporary `<a download>` for every attachment that is not a video.

**Rendering (L513-L770)**
- A collapsible header with the attachment count and buttons for download-all, grid view, list view, expand (a button with no handler) and add.
- The upload area is hidden when `isReadOnly` is set.
- Attachments are shown as a list (columns: name, size, modified, author, delete) or as a three-column grid.

## Exports
- `interface Attachment` - `{ _id?, fileLink, fileName, fileType: "document" | "image" | "video", comment, fileSize?, uploadedAt?, uploaderName?, uploaderAvatar? }`.
- `CardAttachments({ cardId, boardId, attachments, onAttachmentsChange, onSave?, showAttachments?, isReadOnly? })` - the attachments panel component.

## Interfaces
- **External services:** `https://uatapi.garage.app/taskroomv2/v2/attachments` (list), `.../taskroomv2/v2/v1/files/:id` (delete), `https://uatapi.garage.app/api/s3upload/multiple` (upload), Google Docs viewer (preview). None of these are part of this repo.
- **Browser storage / cookies:** reads `localStorage.garage_tok` as the Bearer token.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx`.
- **Packages:** `react`; `lucide-react` - icons; `sonner` - toasts.

## Used by
Nothing. No file imports it, so it appears unused (dead code).

## Notes
- The base URLs are hard-coded to the UAT host (`uatapi.garage.app`) rather than read from environment variables.
- The next-page effect closes over `attachments` but does not list it in its dependencies, so appending can use a stale list.
- Unlike the first-page mapping, the next-page mapping does not copy `uploaderAvatar`.
- The `videoMime.some(v => mime.startsWith("video/"))` check ignores `v`. Any `video/*` MIME type matches as long as the list is non-empty.
