# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/comments-panel.tsx`

> The comments thread shown inside a taskroom task's edit dialog: it lists, posts, edits and deletes task comments through the external Taskroom API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 381

## Purpose
When a user opens a task on a taskroom board (`/taskroom/all-taskrooms`), `edit-task-dialog.tsx` renders this panel beneath the task details so team members can discuss the task. The panel is self-contained: it fetches its own data from the Taskroom service at `https://uatapi.garage.app/taskroom` and keeps the comment list in local state.

## How it works
- **Fetch** (L68-L89): whenever the dialog is `open` and a `taskId` exists (and again when `taskId` or `roomId` change) it calls `GET {base}/v1/comments?taskId=…&roomId=…` and stores `data.data` (or `[]`). Errors show the toast "Failed to load comments". Eight pulsing skeleton rows show while loading.
- **Post** (`handlePost`, L94-L123): Enter (without Shift) or the send button. The input is cleared **before** the request. `POST {base}/v1/comments` with `{ roomId, taskId, userId, comment }`. On `status: true` with `data.data.data`, the returned comment is appended; otherwise a toast. Network errors go into the inline `error` text.
- **Edit** (`handleSaveEdit`, L156-L187): inline `Textarea`. An empty edit just exits edit mode. `PUT {base}/v1/comments/:id` with `{ comment }`, then the text is updated in place.
- **Delete** (`handleDelete`, L128-L151): `DELETE {base}/v1/comments/:id`, then the comment is removed from the list. A thrown error restores the previous list.
- **Display:** each comment shows an avatar initial and author name (resolved from the `employees` prop, "You" for the current `userId`, "Unknown" if not found) plus a relative time (`formatDistanceToNow`, e.g. "5 minutes ago"). The edit/delete popover menu only appears on the viewer's own comments (`c.userId === userId`).
- The input and send button are disabled while `isLoading` is true (during the initial fetch and during deletes).

## Exports
- `CommentsPanel({ roomId, taskId, userId, currentUser, className?, open, employees })` - the comments panel. `taskId` may be `undefined` (nothing loads then); `open` gates fetching; `currentUser` (`{ id, name, avatarUrl? }`) is accepted but not used.

## Interfaces
- **External services:** Taskroom API, base `https://uatapi.garage.app/taskroom` (hard-coded):
  - `GET /v1/comments?taskId=&roomId=` - list comments for a task
  - `POST /v1/comments` - create `{ roomId, taskId, userId, comment }`
  - `PUT /v1/comments/:id` - update `{ comment }`
  - `DELETE /v1/comments/:id` - delete

## Dependencies
- **Internal:** `lib/utils` - `cn` class merger; `components/ui/avatar`, `button`, `input`, `textarea`, `popover`.
- **Packages:** `react`; `date-fns` - `formatDistanceToNow`; `lucide-react` - icons; `sonner` - toasts.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/edit-task-dialog.tsx` (the task edit dialog), and through it the boards on `/taskroom/all-taskrooms`. The dialog passes `currentUser` built from the task's assignee, which this panel ignores.

## Notes
- **No authentication:** none of the four requests send an `Authorization` header, and authorship is the `userId` in the body. The "only your own comments" rule is enforced only in the UI; whether the Taskroom service checks ownership cannot be seen from this repo.
- A failed post loses the typed text because the input is cleared first.
- Edits only change `comment` locally; `updatedAt` and the displayed time stay the same.
- `className` is applied to both the outer container and the "Comments" header chip.
