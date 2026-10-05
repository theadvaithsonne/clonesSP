# `components/athena/components/card-activity.tsx`

> The comment thread for an Athena task card: paginated comment history (loading older messages on scroll-up), a composer with file attach/paste/drag-drop, and in-place editing of comment text and attachments.

**Kind:** React component · **Lines:** 1126

## Purpose
Every Athena (Taskroom) task opened in `card-modal.tsx` has an "Activity" pane where people discuss the task and share files. This component owns that pane end to end. Comments live in the external Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`) and files are uploaded to S3 through the external UAT API (`https://uatapi.garage.app/api/s3upload/multiple`); neither goes through this repo's Express backend.

## How it works

### Types and helpers (L18-L146)
- `Attachment` (`link`, `name`, `fileType`, optional `_id`/`tags`/`status`), `CommentItem` (comment with populated `userId`, and attachments under either `attachmentIds` or `attachments` - the API returns both shapes, so the code always prefers a non-empty `attachmentIds`), plus edit-state types `AttachmentEdit` / `EditState`.
- `normalizeFileType(mime, fileName)` maps a MIME type, falling back to the file extension, onto one of `image`, `video`, `audio`, `pdf`, `document`, `spreadsheet`, `archive` or `file`.
- `FileIcon` and `fileTypeBadgeColor` give each type an icon and colour; `isUrl` detects http(s) links; `isSameUser` compares IDs as strings (currently unused, see Notes).

### Attachment rendering (L147-L428)
- `AttachmentPreview` - a staged file chip in the composer (image thumbnail or typed icon, open/remove buttons).
- `CommentAttachment` - view mode by type: image thumbnail linking to the file, inline `<video>` / `<audio>` players, coloured download cards for PDF, document, spreadsheet and archive, a cyan "Link" card for URLs, and a generic file card.
- `AttachmentEditRow` - edit mode for one existing attachment: rename inline, stage a replacement file (with blob preview for images), clear the replacement, or mark the attachment deleted (shown struck through with Undo).

### Upload helper (L430-L458)
`uploadFilesToS3(files)` posts multipart `files[]` plus `folder: "task-attachments"` with the `garage_tok` bearer token to `https://uatapi.garage.app/api/s3upload/multiple`, and maps the returned `{url, fileName}` array back onto the input files (by index) as `{ fileLink, fileName, fileType, comment }`.

### Loading and pagination (L470-L584)
- On `boardId`/`cardId` change: reset and fetch page 1 via `GET {TASKROOM}comments?roomId=<boardId>&taskId=<cardId>&page=&size=30`. `boardId` is the room ID. `metadata.totalPages` / `currentPage` drive `hasMore`.
- After the first load it scrolls to the bottom (newest last).
- A sentinel at the top of the scroll container is watched by an `IntersectionObserver`; when visible and more pages exist it loads `currentPage + 1`, prepends the older comments and restores the scroll offset with `requestAnimationFrame` so the view does not jump.
- A "Beginning of conversation" divider is shown when no pages remain.

### Composer and posting (L586-L657, L1009-L1123)
- Files can be staged from the hidden file input (images, video, audio, PDF, Office files, zip/rar/7z, txt, csv), pasted from the clipboard, or dropped onto the composer. Image files get blob-URL previews, which are revoked when removed or posted.
- The composer expands on focus or when it has content. Enter (without Shift) posts; Escape collapses; Cancel clears text and staged files.
- `handlePost`: uploads staged files first, then `POST {TASKROOM}comments/attachment` with `{ roomId, taskId, comment, attachments }`. The created comment (from `data.data.data` or `data.data`) is appended, `onCommentCountChange(1)` is called and the view scrolls down. Errors show a toast. The text box is cleared before the request, so text is lost if posting fails.

### Delete (L659-L678)
Browser `confirm()`, then optimistic removal and `DELETE {TASKROOM}comments/:id`; on failure the previous list is restored. Success calls `onCommentCountChange(-1)`.

### Edit (L680-L775)
- `beginEdit` seeds an `EditState` with the text and one `AttachmentEdit` per attachment, keyed by `_id` (or `link`).
- `handleSaveEdit` uploads any replacement files, builds the final attachment list (dropping those marked deleted, applying new names and replaced links/types), sends `PUT {TASKROOM}comments/:id` with `{ comment, attachments }`, then updates the local comment in whichever attachment field it originally used. Enter saves, Escape cancels; cancelling revokes blob previews.

### Read-only mode
`isReadOnly` hides the per-comment edit/delete bar and the whole composer.

## Exports
- `CardActivity({ boardId, cardId, userId?, className?, connected?, onCommentCountChange?, setColumns?, isReadOnly? })` - the activity pane. `boardId` is sent as `roomId`, `cardId` as `taskId`; `onCommentCountChange(diff)` lets the parent keep the card's comment badge in sync. `userId`, `connected` and `setColumns` are accepted but not used.

## Interfaces
- **External services:** Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`): `GET comments`, `POST comments/attachment`, `PUT comments/:id`, `DELETE comments/:id`. S3 upload service `POST https://uatapi.garage.app/api/s3upload/multiple`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base (defaults to `""`, which would make requests relative to the current origin).
- **Browser storage:** `localStorage.garage_tok` - bearer token on every request.

## Dependencies
- **Internal:** `components/athena/components/Dashbaord.tsx` (type-only import of `Column`), `components/ui/{avatar,button,textarea}`, `lib/utils.ts` (`cn`).
- **Packages:** `react`, `date-fns` (`formatDistanceToNow` for "x minutes ago"), `lucide-react` (icons), `sonner` (toasts).

## Used by
- `components/athena/components/card-modal.tsx`

## Notes
- **Ownership is not enforced in the UI:** `isOwner` is hardcoded to `true` (L826), so every user sees edit/delete on every comment; any restriction must come from the Taskroom API. `isSameUser` exists for this check but is never called.
- The upload host is hardcoded to the UAT API (`API_URL = "https://uatapi.garage.app"`).
- `uploadFilesToS3` assumes the response array is in the same order as the uploaded files.
- The fetch effects intentionally omit `fetchComments` from their dependency arrays; the observer effect re-subscribes on page/loading changes instead.
- There is no real-time update: new comments by other users appear only after the pane is reopened.
