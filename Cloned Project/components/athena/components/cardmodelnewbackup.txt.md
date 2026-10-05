# `components/athena/components/cardmodelnewbackup.txt`

> A plain-text backup of an intermediate, ClickUp-style version of the Athena card/task detail modal, `CardModal`, kept partway through the move from the flowboard API to the taskroom API.

**Kind:** React component (backup snapshot saved as `.txt`, not compiled) · **Lines:** 1756

## Purpose
This file holds TSX source for `CardModal`, saved with a `.txt` extension so the build ignores it. It records a stage between the older flowboard-based modal (`card-modal.tsx.backup`) and the current live component (`card-modal.tsx`). In this stage the modal was redesigned as a near-full-screen task view, with ClickUp-style field rows, a status picker, a date picker, subtasks and a right-hand activity panel, and most API traffic moved to the taskroom service. Nothing imports it. It is useful only as a historical reference or to recover code.

## How it works
Two components are defined: the exported `CardModal` (L86-L1258) and a private `TaskItem` (L1261-L1756). Auth now uses the `localStorage` key `garage_tok` as the bearer token. The `auth-token` cookie used by the older backup is no longer read; `js-cookie` is still imported but unused.

### Props, stores and state (L40-L213)
- `CardModalProps` is the same as in the older backup: `card`, `boardId`, `orgId`, `userId`, `onClose`, `setColumns`, `isReadOnly`, `connected`, `updateTaskAndCardCounts`. Of these, `updateTaskAndCardCounts`, `orgId` and `columnId` are unused.
- Stores: `useMemberStore`, `useCardStore` (`updateCard`, `deleteCard`, `toggleComplete`), `useTaskStore` (tasks, which are labelled "Checklist Groups" in this UI, plus paging and `createTask`), `useTagStore`, `useBoardStore` (`decrementCardCount`) and `useChecklistStore` (destructured but unused).
- `useSearchParams()` reads `spaceId` from the URL into `Idspace`. The tag list is scoped by this value.
- `stageData` (L197-L209) looks up the card's column by `card.stageId` inside a no-op `setColumns(prev => prev)` updater, then stores that column's `stageType` and `name` through `setTimeout(…, 0)`. This is a workaround for not having the columns array as a prop. The status button shows the result.
- On mount, the effects fetch page 1 of the card's tasks (`fetchTasks`) and the card's assigned members (`fetchAssignForCards`). Another effect recomputes the card's `TaskDataCount` from the task totals (L147-L158). Further effects copy `name`, `description`, `isCompleted`, `attachments`, `startDate` and `dueDate` from `card` into local state whenever they change.

### Network calls (L215-L290, L611-L636)
- Member search waits 300 ms after typing stops, then calls `GET https://uatapi.garage.app/taskroomv2/v2/tasks/:cardId/members?size=50&search=...` and flattens each result to `{ _id, id, name, email, userId }`.
- When the Labels popover opens, tags load from `GET ${NEXT_PUBLIC_TASKROOM_URL}tags?spaceId=<Idspace>&size=100`.
- `handleSaveAttachments` sends `POST https://uatapi.garage.app/taskroomv2/v2/attachments/bulk` with `{ roomId: boardId, taskId: card._id, attachments }`. Both branches of its response check are empty. It always shows `data.message` (or "Failed to save attachments") as a toast and then "Attachments saved successfully", whatever the outcome. The local `setColumns` update is commented out.

### Guards
- `blockIfReadOnly()` shows the toast "Observers can only view cards" and stops the action when `isReadOnly` is true.
- `checkToken()` (L302-L319) decodes the `garage_tok` JWT payload and opens the "Session Expired" dialog, with a Login button to `/login`, when `exp` has passed. This replaces the copy-pasted block in the older backup. `toggleMember` skips this check: its copy is commented out.

### Card mutations (L321-L609)
After each call, the handler patches the card in `setColumns`.
- `handleToggleComplete` - optimistic flip of `isCompleted`, then `toggleComplete`, reverting if the call fails.
- `toggleMember` - adds a member through `updateCard(card._id, { assignedToIds, socketId, userAssignedToIds })`. Here `socketId` is the literal string `"boardSocketService.socketId || undefined;"`. An earlier version is kept commented out above it (L339-L373). Removal uses the hover "X" on each assignee avatar (`userRemoveAssignedToIds`).
- `handleDelete` - after confirming "Do you want to delete this task?", calls `deleteCard`, removes the card from its column, lowers the column's `localCardCount` and the board card count, then closes the modal.
- `handleSaveDesc` - saves the description only when it changed. It leaves edit mode only on success.
- Dates: `applyDateUpdate`, `handleSaveDates` and `handleRemoveDates` send epoch milliseconds (start of day, end of day) or `null`. The UI only uses `applyDateUpdate`, through `CustomDatePicker`; `handleSaveDates` and `handleRemoveDates` are defined but never wired to anything.
- Labels: `handleToggleTag` (add only), `handleCreateLabel` (create with `createTag`, or rename/recolour with `updateTag` and patch every card's `tagData`), `startEditLabel`, and `handleDeleteTag`, which only changes local state; no delete request is made.
- The title input saves on blur with `updateCard(card._id, { title })`. Note `title`, not `name` as in the older backup. If the call fails, the input reverts.

### Layout (L675-L1257)
- Overlay `bg-black/60` with a panel `max-w-[98%]` and `h-[92vh]`. Clicking the backdrop closes it.
- Top toolbar: a large title input; Delete, Bell, Maximize and More icon buttons (only Delete does anything); and Close.
- Left pane:
  - "Field rows": Status (`StatusPicker`); placeholder labels for "Time estimate" and "Track time"; Assignees (avatars plus an add-member popover); Dates (`CustomDatePicker`, showing start → due and "(overdue)"); Tags (chips plus the label popover).
  - Description editor ("Add description, or write with AI").
  - `SubtaskManager` (`cardId`, `roomId`, `stageId`).
  - Attachments (`CardAttachments`).
  - "Checklist Group" section: a popover that creates a task/group via `createTask(card._id, name, "boardSocketService.socketId")`, the list of `TaskItem`s, and a "Load More" button driven by the task store's `hasMore`.
- Status change (L761-L796): calls `updateCard(card._id, { stageId })`, then moves the card from its old column to the new one in `setColumns` and shows a toast. The dot colour depends on `stageType`: `tostart`, `active`, `done`, `closed`, or anything else.
- Right pane (35% wide): an "Activity" header with icon buttons that do nothing, and `CardActivity` (comments; it receives `isReadOnly`, `connected` and `setColumns`).

### `TaskItem` (L1261-L1756)
One checklist group, with a progress count and bar, editable title, item list, item add/edit/delete/toggle and paging. The endpoints are a mix of old and new:
- Add item - `POST ${NEXT_PUBLIC_TASKROOM_URL}checklist/groups/:taskId/items` with `{ description }`.
- Toggle - still `PUT https://uatapi.garage.app/flowboard/v1/tasks/checklists/:itemId/complete`, the old flowboard endpoint. The live component has since moved this to `checklist/groups/items/:itemId/complete`.
- Delete - `DELETE ${NEXT_PUBLIC_TASKROOM_URL}checklist/groups/items/:itemId`.
- Load more - `GET ${NEXT_PUBLIC_TASKROOM_URL}checklist/groups/items?ChecklistGroupId=:taskId&size=10&page=N`. It reads `metadata.currentPage` / `totalPages`, and the button is shown only when `taskchild.childCount > 10`.
- Edit text - `PUT ${NEXT_PUBLIC_TASKROOM_URL}checklist/groups/:itemId/items` with `{ description, socketId: "" }`. The item updates locally first, and the response is not checked.
- Title save - `updateTask(task._id, { name })`. Delete group - `deleteTask(task._id, "boardSocketService.socketId")` after a `confirm()`.
- Each handler adjusts the parent card's `TaskDataCount` by plus or minus one through `setColumns`.

## Exports
- `CardModal(props: CardModalProps)` - named export; there is no default export. The file is never compiled, so the export cannot be reached.

`TaskItem`, `CardModalProps`, `ChecklistItem`, `CommentItem` and `LABEL_COLORS` are module-private.

## Interfaces
- **Backend endpoints called:** none in this repo.
- **External services:**
  - taskroom API at `https://uatapi.garage.app/taskroomv2/v2/` (hardcoded) and at `NEXT_PUBLIC_TASKROOM_URL` - members search, tags, attachments bulk, checklist-group items.
  - flowboard API at `https://uatapi.garage.app/flowboard/v1/` - checklist toggle only.
  - Store methods make their own requests, as defined in `store/athena/*`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - base URL of the external taskroom API (it must end in `/`, because paths are appended directly).
- **Browser storage / cookies:** `localStorage` key `garage_tok` - bearer token, also decoded for the session-expiry check. URL search param `spaceId` - scopes the tag list.

## Dependencies
- **Internal:** `./Dashbaord` (`Card`, `Column` types); `./subtaskCompoent` (`SubtaskManager`); `./card-activity` (`CardActivity`); `./card-attachments` (`CardAttachments`, `Attachment`); `./status-picker` (`StatusPicker`); `./custom-date-picker` (`CustomDatePicker`); `@/store/athena/memberStore`, `cardStore`, `taskStore`, `tagStore`, `boardStore`, `checklistStore`; `@/components/ui/popover`, `skeleton`, `dialog`, `button`.
- **Packages:** `react`; `lucide-react`; `sonner`; `date-fns` (`format`; `formatDistanceToNowStrict`, `isPast` and `enIN` are imported but unused); `js-cookie` (imported but unused); `next/navigation` (`useRouter`, `useSearchParams`).

## Used by
Nothing. No importers were found, and a `.txt` file is never part of the build. The live modal is `components/athena/components/card-modal.tsx`. It is imported by `Dashbaord.tsx`, `kanban-card.tsx`, `ListView.tsx`, `CalendarView.tsx`, `AssignedToMe.tsx` and `subtaskCompoent.tsx`. Note that `subtaskCompoent.tsx` itself imports the live `CardModal`, so the `SubtaskManager` used in this backup and the modal depend on each other.

## Notes
- **Dead or stale code.** Treat this file as an archive. Several endpoints here have since changed in the live component: the checklist toggle has moved to taskroom, and the live component also has room context, short URLs and `onCardPatched`. The file mixes two backend generations, flowboard and taskroom.
- Literal placeholder socket ids (`"boardSocketService.socketId"`, `"boardSocketService.socketId || undefined;"`) are sent as real request values. They are leftovers from a removed socket service.
- The attachment save always reports success. Label deletion is local only. `toggleMember` skips the session-expiry check.
- Several toolbar and Activity-panel icon buttons (Bell, Maximize, More, Eye, AlignJustify) have no handlers.
- Leftover `console.log` debug lines print task, card and member data.
