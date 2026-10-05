# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/files-view.tsx`

> The "Files" tab of a Taskroom: a paginated grid of every file attached anywhere in the room, with type filters, search, upload, preview, download and delete, backed by the external Taskroom API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 695

## Purpose
The Taskroom kanban board has view tabs (Kanban, List, Timeline, Files). This component renders the Files tab. It lists the room's files at room level (no `taskId` filter), unlike the per-task attachments in `edit-task-dialog.tsx`, and it lets a member upload a standalone file into the room. All data comes from the external service `https://uatapi.garage.app`, which is hardcoded. Nothing in this repo's `/backend` is called.

## How it works

### Data model
Server records are mapped to a local `FileItem`: `id` (`_id`), `name` (`fileName`), `type` (`document | image | video`), `size`, `author` (`{ name: userId, avatar }`), `date` (`YYYY-MM-DD` from `createdAt`) and `fileLink`. If the server's `fileType` is not one of the three known values, the type is inferred from the extension: jpg/jpeg/png/gif/webp/svg become image, mp4/webm/ogg/mov/avi become video, and everything else is a document. The size is always `"Unknown"` for fetched files.

### Fetching and pagination
An effect keyed on `[taskRoomId, page]` calls `GET https://uatapi.garage.app/taskroom/v1/files?roomId=<id>&size=50&page=<n>`. It reads `metadata.totalPages`, `nextPage` and `currentPage`, and if the server corrects the page number, it is adopted. Each page **replaces** `files`, so this is classic page navigation, not infinite scroll. `renderPageNumbers` shows every page when there are 7 or fewer. Otherwise it shows the first two, a window around the current page, ellipses and the last two. `goToPage` ignores out-of-range or duplicate requests and scrolls the window to the top.

### Filtering and search
The three type cards toggle `selectedType`. Combined with a case-insensitive name search, it produces `filteredFiles`. Counts per type come from the current page only. The header's total MB is summed from `size` strings matching `N MB`, so it is effectively `0.0` except for files uploaded in this session.

### Upload (`handleFileChange`)
1. One file is posted as multipart (`file`, `folder="Uploads"`) to `POST https://uatapi.garage.app/api/s3upload/single`.
2. The file is registered with the room through `POST https://uatapi.garage.app/taskroom/v1/files` with `{ roomId, userId: currentUser, fileLink, fileName, fileType, comment: "Uploaded via FilesView" }`.
3. A `FileItem` is built (size in MB when the upload response reports it) and prepended, but only if the user is on page 1.

Neither request sends an Authorization header.

### Preview, download, delete
- **Preview:** images use `<img>`, videos use an `<iframe>`, and all documents go through the Google Docs viewer iframe (`docs.google.com/viewer?url=...&embedded=true`).
- **Download** (menu item): `handleDownload` fetches `https://uatapi.garage.app/api/s3upload/download-url?url=<fileLink>` and saves the blob under the file's name. The preview dialog's download button and the "Download File" fallback instead just `window.open` the raw link. The function `handleDownloadFile` (also `window.open`) is defined but unused.
- **Delete:** a confirmation dialog leads to `DELETE https://uatapi.garage.app/taskroom/v1/files/:id`, and the item is then removed locally.

### Authors
`getEmployeeName(userId)` resolves the uploader through the `employees` prop and shows "Unknown User" when there is no match. `getInitials` takes the first letter of that name.

## Exports
- `FilesView({ taskRoomId, currentUser, employees })` - the room files tab. `taskRoomId` is the room id, `currentUser` is the current user's id (written as the uploader), and `employees` is used to resolve names.

## Interfaces
- **External services:** the Taskroom API `https://uatapi.garage.app/taskroom/v1/files` (GET list, POST record, DELETE `/:id`); `https://uatapi.garage.app/api/s3upload/single` (upload) and `/api/s3upload/download-url` (download proxy); the Google Docs viewer.

## Dependencies
- **Internal:** `../types/kanban` (`Employee`); `@/components/ui/avatar`, `button`, `dialog`, `dropdown-menu`, `input`.
- **Packages:** `react`; `lucide-react` (icons); `sonner` (toasts).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx` renders it when `activeTab === "files"`. The board is reached through the route `/taskroom/all-taskrooms`.

## Notes
- None of the calls here are authenticated from the client side.
- `download-url?url=${url}` is not URL-encoded.
- Video previews always use an iframe, so direct MP4 links depend on the browser rendering them inside a frame.
- A debug `console.log("previewItemz", ...)` runs on every render.
- The type cards show counts for the current page, not for the whole room.
