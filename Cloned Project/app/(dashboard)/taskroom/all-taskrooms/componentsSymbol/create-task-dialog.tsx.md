# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/create-task-dialog.tsx`

> The "Create New Task" modal for a taskroom board: a form for title, description, assignee, start and end dates, priority, stage, tags and attachments that uploads files to S3 and creates the task on the external Taskroom API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 947

## Purpose
This is how users add a task to a taskroom (`/taskroom/all-taskrooms`), either from the board's global "add task" action or from a column's `+` button (which pre-selects that stage). `kanban-board.tsx` controls whether the dialog is open and passes in the stages, employees and an `onCreateTask` callback. On success the callback adds the new task to the board without a reload.

## How it works

### Module-level setup (L33-L97)
- Hard-coded bases: `baseurl = "https://uatapi.garage.app/taskroom"` and `API_URL = "https://uatapi.garage.app"`.
- `today` / `todayNY` hold local midnight **at module load time**. They are the default start date and the earliest selectable date. The "NY" name is a leftover; no New York timezone is applied.
- `getUTCStartOfDay` / `getUTCEndOfDay` are helpers; only `getUTCStartOfDay` is used, inside a debug `console.log`.
- `resetForm(...)` takes all 13 setters and clears the form (start date back to `todayNY`, priority back to `medium`).

### Form state and reset (L114-L169)
Each time the dialog opens, the form is reset. The stage is then set to `initialStageId` if given (column `+` button), otherwise to the first column.

### Field behaviour
- **Assignee:** a `Select` over `employees`, with a search box at the top (`onKeyDown` stops propagation so typing does not trigger the Select's type-ahead). Shows a spinner while `isLoadingEmployees` is true.
- **Start / End date:** `Calendar` popovers formatted `dd-MM-yyyy`. Dates before today are disabled, as are end dates before the start. Picking a start date after the current end date clears the end date with a toast. The end date is always stored as 23:59:59.999 local time of the chosen day.
- **Priority** (low/medium/high, coloured dots) and **Initial Status** (stage `Select` with its own search box).
- **Tags:** free text, added on Enter or `+`, duplicates ignored, removable chips.
- **Attachments & video links** (L200-L311, L753-L854):
  - Files come from a click-to-browse input (`image/*,.pdf,.doc,.docx,.txt`), drag-and-drop, or pasting into the description or the "Quick Paste Zone".
  - `uploadFilesToS3` posts them as multipart `files` with `folder=task-attachments` to `POST https://uatapi.garage.app/api/s3upload/multiple` (with the bearer token), and expects `{ success, data: [{ url, fileName }] }`. Each result becomes `{ fileLink, fileName, fileType, comment: "Uploaded via FilesView" }`, where `normalizeFileType` maps `image/*` to `image` and everything else to `document`.
  - Video links are added by URL (duplicates ignored; the file name is the last path segment) with `fileType: "video"`.
  - Clicking an attachment opens a preview modal: images inline; videos in an `iframe`; PDFs in an `iframe`; DOC/DOCX through the Google Docs viewer (`https://docs.google.com/viewer?url=…&embedded=true`); anything else as "Preview not available" with a download button.

### Submit (`handleSubmit`, L393-L496)
1. Client-side checks with toasts: title, start date, due date, due date not before start date, stage, room id.
2. **Token check:** `GET ${NEXT_PUBLIC_API_URL}/auth/me` with `Authorization: Bearer <garage_tok>`, i.e. `GET /backend/auth/me` on this project's Express app (`server/routes/auth.ts`, `requireAuth`). If it fails, the user sees "Invalid or expired token. Please log in again." and nothing is created.
3. `POST https://uatapi.garage.app/taskroom/v1/tasks` with `{ title, description, roomId, stageId, userId, priority, assignedToId, startDate, dueDate, tags, attachments }`. Dates are sent as epoch milliseconds.
4. On `status: true`: calls `onCreateTask(...)` with the payload plus the returned `_id` and `createdAt`, toasts "Task Created Successfully", resets the form and closes. Otherwise it toasts the API's message.

`addMembersToTaskroomChat(uid)` (L498-L521) would add the assignee to the taskroom chat (`POST https://uatapi.garage.app/api/chat/conversations/:conversationId/participants`), but its call in the success path is commented out, so it is never used.

## Exports
- `CreateTaskDialog(props: CreateTaskDialogProps)` - the dialog. Props: `open`, `onOpenChange`, `userId`, `onCreateTask(task)`, `taskRoomId`, `columns` (stages), `employees`, `isLoadingEmployees`, `conversationId`, `setMembers`, `members`, `initialStageId?`.

## Interfaces
- **Backend endpoints called:** `GET /backend/auth/me` - checks the stored token before creating a task.
- **External services:** Taskroom API `POST https://uatapi.garage.app/taskroom/v1/tasks` (task create); Garage UAT `POST https://uatapi.garage.app/api/s3upload/multiple` (attachment upload to S3); Google Docs viewer (DOC/DOCX preview); the UAT chat participants endpoint (defined but unused).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base for the `/auth/me` check.
- **Browser storage / cookies:** reads `localStorage.garage_tok` for every authenticated call.

## Dependencies
- **Internal:** `../types/kanban` - `Column`, `Task`, `Employee`, `Member` types; `components/ui/button`, `dialog`, `input`, `label`, `textarea`, `select`, `badge`, `calendar`, `popover`.
- **Packages:** `react`; `date-fns` - `format`; `lucide-react` - icons; `sonner` - toasts; `js-cookie` - imported but unused.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`, which opens it via `handleGlobalAddTask` (no preset stage) and `handleColumnAddTask(columnId)` (preset stage). Reached on `/taskroom/all-taskrooms`.

## Notes
- Any exception during submit, including a network failure on the task POST, is reported as "Invalid or expired token", which is misleading.
- `todayNY` is computed once when the module loads, so a tab left open past midnight still allows yesterday's date and defaults to it.
- `setMembers` and `members` are accepted but only referenced in commented-out code.
- `handleStartDateSelect` closes the start popover, and choosing an end date with no start date is still validated on submit.
- Several debug `console.log` calls fire on every render (e.g. `"startDate222"`).
- The file name hint `"Uploaded via FilesView"` in attachment comments was copied from `files-view.tsx`.
