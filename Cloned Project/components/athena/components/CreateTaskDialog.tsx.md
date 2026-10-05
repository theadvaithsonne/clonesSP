# `components/athena/components/CreateTaskDialog.tsx`

> Modal dialog for creating a Taskroom task or subtask (room, status, assignees, dates, priority, tags and an optional AI-written description), posting it to the external Taskroom API.

**Kind:** React component · **Lines:** 1274

## Purpose
This is the single "Create Task" form of the Athena / Taskroom project-management module. `ProjectMangement.tsx` mounts it once and opens it from its own "add" buttons or when any view (for example `CalendarView`) dispatches the `taskroom:open-create-task` window event. Tasks live in the external Taskroom service (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`), not in this repo's Express backend. After a successful create it updates the visible kanban column locally and broadcasts `taskroom:task-created` so other views can refresh.

## How it works

### Local helpers and sub-pickers (L30-L535)
- Constants: yellow accent `#FACC15`, dropdown background, `STAGE_PAGE_SIZE = 20`, `PARENT_TASK_PAGE_SIZE = 10`.
- `sortStages` orders stages by `stageType`: `tostart`, `active`, `done`, `closed`, then anything else.
- `transformCardCustom(card, stageId)` converts a Taskroom task response (`title`, `tags` objects, `assignedToIds`, `TaskDataCount`, ...) into the kanban `Card` shape used by board columns (`name`, `tags` as ids, `tagData`, `members`).
- `stageStatusLabel`, `priorityLabel`, `capitalizeName` produce display text; `FieldLabel` / `FieldButton` are styled form primitives.
- Three in-file dropdowns share one pattern (close on outside `mousedown`, infinite scroll by both an `IntersectionObserver` sentinel and a scroll-near-bottom check):
  - `StageStatusPicker` - choose the stage (status column).
  - `RoomPicker` - choose a room within the current space; calls `onOpen` when opened (to refresh rooms); can be `disabled` to lock the room.
  - `ParentTaskPicker` - choose the parent task for a subtask.

### Context resolution (L537-L622)
- `workspaceId` comes from `searchParams.workspaceId` when the URL carries `shareTask`, otherwise from `useWorkspaceStore().currentWorkspace._id`.
- The space (`defaultSpaceId`) is the URL `spaceId` for shared links, else the store's `activeSpaceId`, the current room's `spaceId`, or the URL `spaceId`. The space is not user-selectable in this dialog.
- `selectedRoomId` is only valid while the selected room belongs to that space.
- Rooms for the space come from the Taskroom workspace store (`rooms`, `roomMetadata`, `loadingSpaces`, `fetchRooms`, which calls `GET {TASKROOM_URL}rooms/me?spaceId=&page=&size=50`).
- `workspaceName`, `spaceName`, `roomName` are derived only to give the AI prompt context.

### Form lifecycle (L624-L732)
- Each time the dialog opens, `resetForm` clears all fields and seeds `startDateMs` / `dueDateMs` from `initialStartDateMs` / `initialDueDateMs` (this is how a calendar click pre-fills the date).
- With `defaultToCurrentRoom`, the room is forced to the current room and the room picker is disabled.
- When the space changes, the selected room falls back to the current room (if in that space), and stages, assignees, tags and parent-task state are cleared; rooms are force-refetched.
- `handleRoomSelect` likewise clears room-dependent state when another room is picked.

### Remote data (L734-L898)
- `fetchStages(page)` - `GET {TASKROOM_URL}stages/room/:roomId?page=&size=20`; results are sorted; on the first page the first stage is auto-selected. Re-runs whenever the dialog opens or the room changes. A ref guards against concurrent fetches.
- `fetchParentTasks(page)` - `GET {TASKROOM_URL}tasks/?roomId=&page=&size=10`; maps `title || name` and keeps `stageId` and `rootId` (defaulting to the task's own id); auto-selects the first. Runs when the Subtask tab is active.
- Both accept `status` or `success` truthy responses and use `metadata.totalPages` (or a full-page heuristic) for `hasMore`.

### AI description (L900-L937)
`handleWriteWithAi` requires a task name, then `POST /api/taskroom/generate-description` (a Next.js route handler in this repo) with `{ taskName, workspaceName, spaceName, roomName, taskType }` and the `garage_tok` bearer token. The returned `description` replaces the textarea content.

### Create (L939-L1039)
Validation: a name, a room and a stage are required.
- **Subtask tab:** requires a parent; uses the parent's stage (falling back to the selected one) and posts directly to `POST {TASKROOM_URL}tasks` with `title, roomId, stageId, assignedToIds, priority, tags, startDate, dueDate, parentId, rootId, description`.
- **Task tab:** calls `useCardStore().createCard(...)` (also `POST {TASKROOM_URL}tasks`) with priority defaulting to `"normal"`. If the room is the one currently on screen, the new card is prepended to its column in `useTaskroomWorkspacetore().columns` and `localCardCount` is incremented (newest-first, matching the server order).
- On success: closes the dialog, calls `onCreated`, and dispatches `taskroom:task-created` on `window`. Any error shows "Failed to create task.".

### Render (L1041-L1272)
Radix `Dialog` with header and close button; Task/Subtask tabs (hidden when `hideSubtaskTab`); then room picker, parent task picker (subtask only), name input, description textarea with "Write with AI", status, assignee (`AssigneePicker`, keyed by room so it resets), due date (`CustomDatePicker`, opening on its "due" tab and setting both start and due), priority (`PriorityPicker`) and tags (`TagPicker`, scoped to the workspace id and space). The Create button is disabled while submitting or without a name or stage.

## Exports
- `CreateTaskDialog(props: CreateTaskDialogProps)` - the dialog component.
- `CreateTaskDialogProps` (type) - `open`, `onOpenChange(open)`, optional `initialDueDateMs`, `initialStartDateMs`, `onCreated()`, `hideSubtaskTab`, `defaultToCurrentRoom`.

## Interfaces
- **Backend endpoints called:** `POST /api/taskroom/generate-description` - Next.js route in this repo that generates the description text (authenticated via `verifyTaskroomUser`).
- **External services:** Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`): `GET stages/room/:roomId`, `GET tasks/?roomId=`, `POST tasks` (directly and via `cardStore.createCard`), `GET rooms/me` (via the workspace store).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the bearer token.
- **Window events:** dispatches `taskroom:task-created`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - current room/workspace/space, rooms cache, `columns`/`setColumns`; `store/taskroom/workspaceStore.ts` - current workspace id; `store/athena/cardStore.ts` - `createCard`; `components/ui/dialog.tsx`; `assignee-picker.tsx`, `custom-date-picker.tsx`, `priority-picker.tsx` (and `PriorityLevel` type), `tag-picker.tsx` in the same folder; `lib/utils.ts` (`cn`).
- **Packages:** `react`, `next/navigation` (`useSearchParams`), `date-fns` (`format`), `sonner` (toasts), `lucide-react` (icons).

## Used by
`components/athena/ProjectMangement.tsx`, which renders it only when a space is active and the current room is not read-only, and opens it in response to `taskroom:open-create-task`.

## Notes
- Creating a regular task shows two success toasts: `createCard` toasts the API message and this dialog toasts "Task created.".
- The subtask path checks `response.ok` before parsing, so server error messages are lost and only the generic toast appears.
- The local `columns` update only happens for the regular-task path; subtasks rely on listeners of `taskroom:task-created` to refresh.
- The space cannot be changed from this dialog; a missing space leaves the room picker showing "No space selected".
