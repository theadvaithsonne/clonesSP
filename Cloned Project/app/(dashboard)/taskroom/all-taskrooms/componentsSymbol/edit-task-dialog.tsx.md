# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/edit-task-dialog.tsx`

> Full-screen "Task Details" dialog for a Taskroom kanban card: edits the task's fields, manages subtasks, attachments and comments, and supports share links, all against the external Taskroom API at `uatapi.garage.app`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2298

## Purpose
Clicking a card on the Taskroom kanban board (or opening a shared `?card=<taskId>` link) opens this dialog. It is the single place where a task is edited after creation. The left half holds the editable fields (title, description, assignee, stage, priority, dates, tags) and a subtasks panel. The right half shows metadata, an attachments manager and the comments thread (`CommentsPanel`). The Taskroom data does not live in this repo's backend. Every task, subtask and file call goes to the external service `https://uatapi.garage.app/taskroom`, which is hardcoded here. The only call to this repo's backend is a token check against `/auth/me`.

## How it works

### Module-level constants and types (L1-L68)
- `baseurl = "https://uatapi.garage.app/taskroom"` and `API_URL = "https://uatapi.garage.app"` are hardcoded. They do not use `NEXT_PUBLIC_API_URL`.
- Local types: `Employee` (`id`, `name`, optional `email/color/avatar`), `Attachment` (`fileLink`, `fileName`, `fileType: "document" | "image" | "video"`, `comment`), and `EditTaskPayload`, the shape of the partial PUT body.
- `getInitials(name)` returns the initials of the first two words, or the first two letters.
- The auth token is always read from `localStorage.getItem("garage_tok")` and sent as `Authorization: Bearer <token>` on the calls that send auth at all (see Notes).

### `SubtaskAssigneeDropdown` (L70-L213)
A hand-rolled multi-select popover, not a Radix Select. A button shows up to 3 initial-avatars with tooltips plus a `+N` chip, and opening it reveals a searchable checkbox list of employees. A document `mousedown` listener closes it on an outside click. `onChange(ids)` receives the toggled id array.

### `EditSubtaskDialog` (L215-L331)
A small modal that edits one subtask's `subTaskDetail` and assignee list. When the subtask changes it copies `assignedToIds` into local state, wrapping a single string in an array. **Save** calls `onSave(id, detail, assigneeIds)` and **Delete** calls `onDelete(id)`. Both close the dialog only after the promise settles.

### `SubtasksPanel` (L333-L813)
Subtasks are lifted into the parent board (`subtasks` / `setSubtasks` props), and this panel fetches and mutates them.
- **Fetch (L370-L448):** `GET {baseurl}/v1/sub_tasks?taskId=<code || taskId>&page=N&size=8`. When a shared `card` query param (`code`) exists, it is used as the task id. Page 1 replaces the list. Later pages are merged and deduplicated by `_id`. Paging state is derived from `metadata.currentPage / totalPages / nextPage`, and numeric strings are tolerated. `isFetchingPage` is a ref that blocks duplicate requests for the same page. The initial fetch runs once on mount (`useEffect(..., [])`).
- **Reset (L450-L476):** when the dialog closes or `taskId` empties, the panel clears subtasks, paging, the add form and the IntersectionObserver.
- **Infinite scroll (L478-L499):** `lastElementRef` attaches an IntersectionObserver (200px root margin) to the last subtask row and loads `nextPage`.
- **Add (L501-L537):** `POST {baseurl}/v1/sub_tasks` with `{ subTaskDetail, assignedToIds, taskId, roomId, stageId, userId }`. The new subtask is prepended. Pressing Enter in the input also submits.
- **Toggle complete (L539-L562):** an optimistic flip of `isCompleted`, then `PUT {baseurl}/v1/sub_tasks/:id` with `{ isCompleted }`. A failure rolls the flip back.
- **Edit (L569-L621):** the previous and new assignee lists are diffed. The PUT body is `{ subTaskDetail, addAssignedTo?, removeAssignedToIds? }`, and each assignee key is included only when it has entries.
- **Delete (L623-L640):** `DELETE {baseurl}/v1/sub_tasks/:id`.
- **Render (L653-L812):** the add form (input, assignee dropdown, Add button), then a skeleton loader, an empty state, or the list. Each row has a checkbox, the detail text (struck through when complete), "Assigned to: ..." names resolved via `employees`, and a hover-revealed edit button.

### `EditTaskRoom`: state and loading (L826-L1107)
- Props: `open`, `onOpenChange`, `task`, `employees`, `columns`, `setColumns`, `roomId`, `onCancel`, `setStagecolumns`, `userId`, `workspaceUserId`, `userRole`, `conversationId`, `subtasks`, `setSubtasks`.
- Form state is seeded from `task`. An `originals` snapshot records the server values so that save can send only the changed fields.
- `code = useSearchParams().get('card')` supports share links. The reset/load effect (L966-L1023) clears the whole form when the dialog is closed. Otherwise it calls `fetchTaskData(code ?? task._id)`.
- `fetchTaskData` (L926-L963): `GET https://uatapi.garage.app/taskroom/v1/tasks/:id`, sent without an auth header. It fills every field, `taskDeatails` (used for the Created and Created By metadata) and `originals`, and clears pending attachments.
- Files, first page (L1026-L1064): when the dialog is open, files have not been fetched yet and `activeTab === "files"` (it always is, because the tab switcher is commented out), it calls `GET .../taskroom/v1/files?roomId=&taskId=&page=1&size=50`.
- Files, next pages (L1066-L1107): `lastElementRef` on the last attachment row bumps `currentPage`, and an effect fetches that page and appends it. `hasNextPage` comes from `metadata.nextPage`.

### Field editing (L1109-L1154, JSX L1739-L1970)
- Assignee: a custom single-select dropdown with a name filter (`personFilter`). An older Radix Select version remains commented out at L1825-L1856.
- Status (stage): a Radix Select over `columns`, with a coloured dot and a search box (`stageSearch`).
- Priority: low, medium or high.
- Start and end dates use Popover + Calendar, formatted `dd-MM-yyyy`. Days before `todayNY` are disabled. `todayNY` is "now minus 4 hours" truncated to midnight, a rough New York offset. Picking a start date after the due date clears the due date. A due date earlier than the start is rejected with a toast. The due date is stored as 23:59:59.999 local time of the chosen day, or of today when cleared.
- Tags: add on Enter or with the + button. Duplicates are ignored, and the x on a chip removes it.

### Attachments (L1156-L1301, JSX L2031-L2140)
- `uploadFilesToS3(files)` sends `POST {API_URL}/api/s3upload/multiple` (multipart field `files`, `folder=task-attachments`, Bearer token) to the external uatapi service. It classifies each upload as `image`, `video` or `document` from the MIME type. When the MIME type is missing (for example `.mov` on Safari/iOS), it falls back to the file extension.
- `processFiles` is the shared entry point for the hidden file input, the drag-and-drop zone, and paste. Paste works in the "Quick Paste Zone" input **and in the Description textarea**, so pasting an image into the description uploads it as an attachment. Uploaded files are added to `newAttachments` (pending, not yet linked to the task).
- `addVideoLink` adds a pasted URL as a pending `video` attachment, skipping duplicates.
- **Save Files** (`handleSubmitFiles`, L1482-L1509): `POST {baseurl}/v1/files/bulk` with `{ roomId, userId, taskId, attachments }`, sent without an auth header. On success the pending items move into `originalAttachments`. Only pending items can be removed (trash icon).
- `openPreview` picks a preview mode. Images use `<img>`. Videos use `<video>` when `isDirectVideoFile(url)` is true (a known extension, or a host that is not a known embed platform such as YouTube or Vimeo), and an `<iframe>` otherwise. PDFs use an iframe. `.doc` and `.docx` use the Google Docs viewer iframe. Anything else falls back to a video player or a "Preview not available" message with a Download button.
- `handleDownload(url, filename)` fetches `https://uatapi.garage.app/api/s3upload/download-url?url=<url>` (a server-side proxy that avoids S3 CORS), then saves the blob through a temporary `<a download>`.

### Saving and deleting the task (L1303-L1538)
- `handleSaveWrapper` (bound to **Save Changes**): if the assignee changed, it first verifies the session with `GET ${NEXT_PUBLIC_API_URL}/auth/me` (this repo's backend) and aborts with a toast if that fails. It then calls `handleSave`. A follow-up step that adds the new assignee to the taskroom chat is commented out.
- `handleSave` checks that `task._id`, title, start date, due date and stage are present and that the due date is not before the start. It builds a **diff-only** payload against `originals` (dates are sent as epoch milliseconds) and shows "No changes detected" when the diff is empty. The request is `PUT {baseurl}/v1/tasks/:id`. On success it merges the returned fields into the task and updates the board's `columns` locally, moving the card between columns when the stage changed. It then calls `onCancel()` to close the dialog.
- `handleDelete` (after a confirmation dialog): `DELETE {baseurl}/v1/tasks/:id`. It then removes the task from `stagecolumns` (list/timeline data) and from its column, decrements `taskCount`, and closes the dialog.

### Share (L1664-L1704)
`handleCopy` copies `https://taskrooms.garage.app/all-taskrooms/<roomId>?card=<taskId>` with the Clipboard API. Where that is unavailable it falls back to a hidden textarea and `execCommand('copy')`. Opening such a link sets `card`, which the board uses to auto-open this dialog.

### Layout (L1705-L2285)
The dialog fills the viewport with a fixed 64px header (back, Share, Save Changes, Delete). The body is two columns on `md+` and stacks on mobile. The right column shows Created, Updated (relative, via `formatDistanceToNow`) and Created By, then the attachments card and `CommentsPanel`. There are also nested dialogs for delete confirmation and file preview. `AttachmentSkeleton` (L2287-L2298) is the loading placeholder.

## Exports
- `EditTaskRoom(props)` - the task details dialog component described above. It is the only export. `SubtaskAssigneeDropdown`, `EditSubtaskDialog`, `SubtasksPanel` and `AttachmentSkeleton` are module-private.

## Interfaces
- **Backend endpoints called:** `GET /backend/auth/me` (via `NEXT_PUBLIC_API_URL`) - token check before a save that changes the assignee (`requireAuth`, `server/routes/auth.ts`).
- **External services:**
  - Taskroom API `https://uatapi.garage.app/taskroom/v1/...`: `GET/PUT/DELETE tasks/:id`, `GET/POST sub_tasks`, `PUT/DELETE sub_tasks/:id`, `GET files`, `POST files/bulk`.
  - `https://uatapi.garage.app/api/s3upload/multiple` (upload) and `/api/s3upload/download-url` (download proxy).
  - `https://uatapi.garage.app/api/chat/conversations/:id/participants`, defined in `addMembersToTaskroomChat` but never called.
  - Google Docs viewer (`docs.google.com/viewer`) for `.doc`/`.docx` previews.
  - A hardcoded S3 image URL in the unused `downloadImage`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base for the `/auth/me` check.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`. Reads the `card` URL query param.

## Dependencies
- **Internal:** `./comments-panel` (`CommentsPanel`, the task comment thread); `../types/kanban` (`Column`, `Task`, `Subtask`); `@/components/ui/*` (badge, button, calendar, dialog, input, label, popover, select, tabs, textarea, tooltip); `@/lib/utils` (`cn`).
- **Packages:** `react`; `next/navigation` (`useSearchParams`; `useParams` is imported but unused); `date-fns` (`format`, `formatDistanceToNow`); `sonner` (toasts); `lucide-react` (icons); `js-cookie` (imported but unused).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx` renders `<EditTaskRoom>`. The board is rendered by `components/TaskroomSubPage.tsx`, which is mounted by the route `/taskroom/all-taskrooms`.

## Notes
- **Auth is inconsistent.** Task and subtask mutations send the Bearer token, but `GET tasks/:id`, both files GETs and `POST files/bulk` send none.
- **Shared-link gaps.** When the dialog opens only from `?card=` (no `task` prop), `fetchTaskData` and the subtask fetch use `code`. However, the files query, `handleSave`, `handleDelete`, adding a subtask and saving files all use `task?._id`. The result is an empty `taskId` in the files query and "No task selected" on save or delete.
- `handleSave` returns the value of `toast.error(...)` (a toast id, which is truthy) on validation failures. `handleSaveWrapper`'s `if (!saveSuccess) return` therefore does not catch them. The step it guards is commented out, so this is harmless today.
- Moving a task to another stage through Save does not adjust either column's `taskCount`, but delete does.
- `CommentsPanel` receives `currentUser` built from the **assignee** (falling back to `"user-1"`), not the logged-in user.
- `download-url?url=${url}` is not URL-encoded.
- Dead code includes `downloadImage`, `addMembersToTaskroomChat`, the Tabs triggers and contents, the `Cookies` and `useParams` imports, the unused props `userRole` and `workspaceUserId`, and several unused state values (`assigneeSearch`, `chosenPersonId`, `copied`).
- Debug `console.log` calls remain at L1510 and L1581.
