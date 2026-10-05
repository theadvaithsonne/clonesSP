# `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`

> The full-screen Flowboard card editor: edit a card's title, description, assignees, labels, dates, attachments, tasks with checklists, completion state and comments, persisted to the external Flowboard API and kept in sync over the Flowboard board socket.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2551

## Purpose
Flowboard is the app's Trello-style kanban board, at `/flowboard/[symbol]` where `[symbol]` is the board id. Clicking a card on the board view, the list view or a card tile opens this modal. It is the single place where a card's details are edited. Data lives in the external Flowboard service at `https://uatapi.garage.app/flowboard`, which is not part of this repo's Express backend. Most calls go through the zustand stores in `store/flowboard/`; a few are made directly from this file.

The parent owns the board's `columns` state. Every successful edit here is copied into that state through the `setColumns` prop, so the card tile behind the modal updates without a reload. The parents (`kanban-board.tsx`, `kanban-board-list-view.tsx`) then pass the updated card object back in as `card`.

## File layout
| Lines | Section |
|---|---|
| L1-L80 | Imports, `CommentItem` / `CardModalProps` / `ChecklistItem` types, the `LABEL_COLORS` palette (10 Tailwind `bg-*` classes) |
| L82-L238 | `CardModal` setup: store hooks, local state, task loading, card-count sync, attachments state, date state, assignee loading |
| L240-L345 | Member search (debounced) and syncing local state from the `card` prop |
| L346-L379 | Fetching labels when the label popover opens; comment-count callback |
| L380-L662 | Mutations: complete toggle, add member, delete card, description, dates |
| L664-L844 | Labels: attach to card, tag socket listeners, create/rename/delete label |
| L846-L912 | Saving attachments (bulk endpoint) |
| L914-L974 | Derived values, click-to-blur helper, due-date formatter |
| L975-L1904 | JSX: session-expired dialog, header, left column (members, labels, due date, description, attachments, tasks, activity), right sidebar ("Add to card" popovers and Actions) |
| L1906-L2550 | `TaskItem` sub-component: one task with its own checklist, counts, socket listeners and editing |

## How it works

### Session-expiry guard (repeated)
Almost every mutation handler starts with the same block:
1. Read `localStorage.garage_tok`.
2. Base64-decode the JWT payload with `atob(token.split('.')[1])`.
3. If `exp` has passed, open the "Session Expired" dialog (L979-L993), whose Login button calls `router.push("/login")`, and stop.

The copies sit in `handleToggleComplete`, `toggleMember`, `handleDelete`, `handleSaveDesc`, `handleSaveDates`, `handleRemoveDates`, `handleToggleTag`, `handleCreateLabel`, `handleDeleteTag`, `handleSaveAttachments`, the title `onBlur`, the member-remove button and the label-remove button. The check runs only in the browser and has no security value; the server must still reject expired tokens.

### Read-only (observer) mode
`isReadOnly` is passed down by the parent; it is true when the user's board role is `observer`. `blockIfReadOnly()` shows the "Observers can only view cards" toast and returns true. Inputs and sidebar buttons are disabled. The flag is also passed to `CardAttachments` and `TaskItem`.

### Loading and syncing state (L82-L345)
- **Stores used:**
  - `useMemberStore`: `cardMembers`, `assignCardMemberlist`, `isLoadingAssign`, `fetchMembersForCards`, `fetchAssignForCards`, `removeMembersForCards`, `removeAssignedMember`, `setAssignedMembers`.
  - `useCardStore`: `updateCard`, `deleteCard`, `toggleComplete`.
  - `useTaskStore`: `tasks`, `fetchTasks`, `createTask`, `hasMore`, `currentPage`, `isLoading`, `isCreatingTask`.
  - `useTagStore`: `createTag`, `updateTag`, `deleteTag`.
  - `useBoardStore`: `decrementCardCount`.
  - `useChecklistStore`: destructured, but only `checklistItems` feeds the unused `checklistProgress`.
- **Tasks:** `fetchTasks(card._id, 1, false)` runs when the card id changes. The task store requests `GET /v1/tasks?cardId=…&size=5&page=…`.
  - Infinite scroll is on the modal's own scroll container. `handleTaskScroll` loads `tasksCurrentPage + 1` (append mode) when the scroll is within 100px of the bottom, `hasMore` is true and no load is running.
  - An effect then sums `childCount` / `completedChildCount` across the loaded tasks and writes `TaskDataCount` onto the card in `columns`. That count is the "x/y" progress shown on board tiles.
- **Assignees:** `fetchAssignForCards(card._id)` runs on mount (`GET /v1/cards/:cardId/assignees`). It fills `assignCardMemberlist`, which drives the "Members" avatars.
- **Prop to local state:** separate effects copy `card.description`, `card.name`, `card.isCompleted`, `card.attachments` and `card.startDate`/`card.dueDate` into local state whenever the prop changes. Edits made elsewhere, or arriving over the socket via the parent's `columns`, therefore show up live.

### Members (assign / unassign)
- **Opening the "Members" popover:** calls `fetchMembersForCards(card._id)` (`GET /v1/cards/:cardId/members?size=50`), which fills `cardMembers` with the board members who can be assigned.
- **Search:** typing is debounced 300 ms. `searchMembers` then calls `GET https://uatapi.garage.app/flowboard/v1/cards/:cardId/members?size=50&search=…` directly. Responses are normalised to `{ _id, id, name, email, userId }`; nested `userData` objects are flattened.
- **`toggleMember(member)` only assigns**, despite its name.
  1. It runs one at a time (`togglingMemberIds`).
  2. It calls `updateCard(card._id, { assignedToIds: [...current ids, memberId], socketId, userAssignedToIds: memberId })`.
  3. It removes the member from the candidate list (`removeMembersForCards`) and adds them to `assignCardMemberlist` (`setAssignedMembers`).
  4. It patches `members` / `assignedToIds` on the card in `columns`.
- **Unassigning:** the hover X on an assignee avatar (L1132-L1200).
  1. After a `confirm()`, it calls `updateCard` with the reduced `assignedToIds` and `userRemoveAssignedToIds`.
  2. It then calls `removeAssignedMember` and patches `columns`.
- `userAssignedToIds` and `userRemoveAssignedToIds` are presumably what the Flowboard server uses to notify the affected user.

### Labels (tags)
- **Opening the "Labels" popover:** fetches `GET https://uatapi.garage.app/flowboard/v1/tags?boardId=…&size=100` into `fetchedTagData`. Results can be filtered client-side by name (`searchLabel`).
- **Attaching (`handleToggleTag`):**
  - Clicking a label that is already on the card only shows "Already this label is selected". It does not remove it.
  - Otherwise it calls `updateCard(card._id, { tags: [...ids, tag._id], socketId, tagItemIds: tag._id })` and appends `{ _id, name, color }` to the card's `tagData` in `columns`.
- **Detaching:** the hover X on a label chip under "Labels" (L1234-L1294). After a `confirm()` it calls `updateCard(card._id, { tags })` without a `socketId` and filters `tags`/`tagData` in `columns`.
- **Creating and renaming (`handleCreateLabel`):** a label's name and colour are picked from `LABEL_COLORS`.
  - In edit mode it calls `updateTag(id, { name, color, socketId })` and renames that label on every card in `columns` that carries it.
  - Otherwise it calls `createTag({ boardId, name, color, socketId })` and appends the result to `fetchedTagData`.
  - The tag store sends `PUT /v1/tags/:id` and `POST /v1/tags`.
- **Deleting (`handleDeleteTag`):** after a `confirm()` it calls `deleteTag(id, socketId)` (`DELETE /v1/tags/:id?socketId=…`), but only when the board socket has an id. It then strips the tag from every card in `columns`.
- **Socket:** `tag:created`, `tag:updated` and `tag:deleted` update `fetchedTagData` (L717-L739).

### Dates
- The "Dates" popover has checkboxes and `<input type="date">` fields for start and due dates. Dates before today cannot be picked, and the due date cannot be before the start date.
- **`handleSaveDates`:**
  - Checks that an enabled field has a value and that the order is valid.
  - Converts start to local start-of-day ms and due to local end-of-day ms (23:59:59.999).
  - Calls `applyDateUpdate`, which sends `updateCard(card._id, { startDate, dueDate, socketId })` and patches `columns`.
- **`handleRemoveDates`:** sends both values as `null`.
- **Due date section:** shown under the labels when `card.dueDate` is set. `getDueDateWithStatus` formats it in the `en-IN` locale and appends " (overdue)" when it is in the past.

### Title, description, completion, delete
- **Title:** an inline input. On blur, if the text changed, it calls `updateCard(card._id, { name, socketId })` and patches `columns`.
- **Description:** click to edit, then Save. `handleSaveDesc` calls `updateCard(card._id, { description, socketId })` only if the text changed.
- **Mark Complete / Completed (`handleToggleComplete`):**
  1. Flips local `isCompleted` straight away.
  2. Calls `toggleComplete(card._id, newStatus, …)`. The store sends `PUT /v1/cards/complete/:id` with `{ isCompleted, socketId }`.
  3. Patches `columns`, and reverts on failure.
  4. The button's look follows `card.isCompleted` from the prop, not the local state.
- **Delete (`handleDelete`):**
  1. After a `confirm()`, calls `deleteCard(card._id, card.stageId)`. The store sends `DELETE /v1/cards/:id?boardSocketId=…&notificationSocketId=…`.
  2. Removes the card from its column and decrements `localCardCount`.
  3. Calls `decrementCardCount(boardId)` on the board store, then `onClose()`.

### Attachments
- `attachments` state starts from `card.attachments`. The "Attachment" sidebar button sets `showAttachments`, which reveals the upload controls inside `CardAttachments`.
- **`handleSaveAttachments(newAttachments)`** is the `onSave` passed to `CardAttachments`.
  1. Sends `POST https://uatapi.garage.app/flowboard/v1/files/bulk` with `{ boardId, cardId, attachments: [{ fileLink, fileName, fileType }] }`.
  2. Writes the list onto the card in `columns`.
  3. Shows a success toast.

### Comments
The left column ends with `<CardActivity>`, which receives `boardId`, `cardId`, `userId` and `connected`. Its `onCommentCountChange` is `handleCommentCountChange`, which adjusts `commentCount` on the card in `columns`.

### Tasks and checklists: `TaskItem` (L1906-L2550)
- **Adding a task:** the sidebar "Task" popover calls `createTask(card._id, name, boardSocketService.socketId)` (`POST /v1/tasks/`), but only when the board socket has an id.
- **Rendering:** each loaded task is drawn as a `TaskItem`. Each one keeps its own checklist list (starting from `task.checklistData`) and `localCounts` (`total`/`completed` from `childCount`/`completedChildCount`), and shows a progress bar.
- **Task title:**
  - Click to edit. Enter or the check button calls `updateTask(task._id, { name, socketId })` (`PUT /v1/tasks/:id`).
  - Delete asks for confirmation, then calls `deleteTask(task._id, socketId)` (`DELETE /v1/tasks/:id?socketId=…`).
- **Checklist items** are called directly from this file, each with a Bearer token and the board `socketId`:
  - Add: `POST /v1/tasks/:taskId/checklists` with `{ description, socketId }`.
  - Toggle: `PUT /v1/tasks/checklists/:itemId/complete` with `{ isCompleted, socketId }`. Only one toggle can run at a time (`togglingItemId`).
  - Edit: `PUT /v1/tasks/checklists/:itemId` with `{ description, socketId }`. This is optimistic and does not revert on failure.
  - Delete: `DELETE /v1/tasks/checklists/:itemId?socketId=…`.
  - Load more: `GET /v1/tasks/checklists/?size=10&page=…&boardId=…&taskId=…`. The button is shown only when `childCount > 10` and `hasMoreChecklists` is true. Paging state comes from `metadata.currentPage`/`totalPages`.
- Each successful add, toggle or delete updates the item list, `localCounts`, and the card's `TaskDataCount` in `columns` (±1 on total or completed).
- **Socket (L2013-L2080):** each `TaskItem` registers its own listeners:
  - `checklist:created` - only applied when `payload.taskObj._id` matches this task; appends `payload.checklist`.
  - `checklist:updated` - if `completionData` is present, flips `isCompleted` and adjusts the completed count; otherwise updates `description`.
  - `checklist:deleted` - removes the item and adjusts the counts.

  Socket updates change the task's local counts only, not the card's `TaskDataCount`.

## Exports
- `CardModal(props: CardModalProps)` - the modal. Props:
  - `card: Card` - the card object from the board's `columns`.
  - `columnId?` - unused.
  - `boardId` - the board id.
  - `orgId` - unused.
  - `onClose()` - closes the modal.
  - `setColumns` - setter for the parent's columns state.
  - `userId` - the current user, used by the comment thread for author controls.
  - `isReadOnly?` - observer mode.
  - `connected` - board-socket status, passed through to `CardActivity`.
  - `updateTaskAndCardCounts` - accepted but never called; `TaskItem` defines its own unused copy.

`TaskItem` is file-private.

## Interfaces
- **External services:** Flowboard API at `https://uatapi.garage.app/flowboard` (each call with `Authorization: Bearer <garage_tok>`).
  - Called directly from this file:
    - `GET /v1/cards/:cardId/members?size=50&search=…` - search assignable members
    - `GET /v1/tags?boardId=…&size=100` - board labels
    - `POST /v1/files/bulk` - save the card's attachment list
    - `POST /v1/tasks/:taskId/checklists` - add a checklist item
    - `PUT /v1/tasks/checklists/:itemId/complete` - toggle an item
    - `PUT /v1/tasks/checklists/:itemId` - edit an item
    - `DELETE /v1/tasks/checklists/:itemId?socketId=…` - delete an item
    - `GET /v1/tasks/checklists/?size=10&page=…&boardId=…&taskId=…` - more items
  - Called through stores: `PUT /v1/cards/:id`, `PUT /v1/cards/complete/:id`, `DELETE /v1/cards/:id`, `GET /v1/cards/:id/assignees`, `GET /v1/cards/:id/members`, `GET|POST /v1/tasks`, `PUT|DELETE /v1/tasks/:id`, `POST /v1/tags`, `PUT|DELETE /v1/tags/:id`.
- **Socket.IO events** (Flowboard `/boards` namespace via `boardSocketService`, which re-emits every server event): listens for `tag:created`, `tag:updated`, `tag:deleted`, `checklist:created`, `checklist:updated` and `checklist:deleted`. Nothing is emitted. Instead, the socket ids `boardSocketService.socketId` (and `notificationSocketService.socketId` for complete/delete) go into REST payloads so the server can skip echoing changes back to the sender.
- **Browser storage / cookies:** reads `localStorage.garage_tok`, both for Bearer auth and for the client-side expiry check.

## Dependencies
- **Internal:**
  - `./card-activity` - the comment thread.
  - `./card-attachments` - attachment UI and the `Attachment` type.
  - `./kanban-board` - the `Card` / `Column` types.
  - `../../lib/board-socket-service` - the board socket singleton.
  - `../../lib/notification-socket-service` - the notification socket id.
  - `store/flowboard/memberStore.ts`, `cardStore.ts`, `taskStore.ts`, `tagStore.ts`, `boardStore.tsx`, `checklistStore.ts` - data actions.
  - `components/ui/popover.tsx`, `skeleton.tsx`, `dialog.tsx`, `button.tsx` - UI primitives.
- **Packages:**
  - `react` - state and effects.
  - `next` - `useRouter` from `next/navigation`, for the login redirect.
  - `date-fns` - `format`.
  - `sonner` - toasts.
  - `lucide-react` - icons.
  - Imported but unused: `js-cookie`, and `formatDistanceToNowStrict`, `isPast` and `enIN` from `date-fns`.

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx` - opened from the `?cardId=` search param. Closing removes the param.
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx` - rendered through `createPortal` into `document.body`.
- `app/(dashboard)/flowboard/[symbol]/components/kanban-card.tsx` - opened from a card tile.
- Reached in the browser on `/flowboard/[symbol]`.

## Notes
- **Stale closures in socket handlers.** The tag listeners (L717-L739) and the checklist listeners in `TaskItem` (L2013-L2080) are registered once, with `[]` dependencies, and read state captured at mount:
  - `tag:created` / `tag:deleted` rebuild `fetchedTagData` from the mount-time array, which is usually empty.
  - `tag:updated` matches on `editingTagId`, which is `null` at mount, so it never applies.
  - `checklist:deleted` looks the item up in the mount-time `checklistitems`, so items added after mount are ignored and their counts drift.
- `checklist:updated` is not filtered by task; it relies on item ids being unique. Every open `TaskItem` handles every checklist event.
- `handleSaveAttachments` shows "Attachments saved successfully" even when the bulk endpoint returns an error. The error message is toasted first, then the success toast follows.
- `createTask` and `deleteTag` are skipped silently when `boardSocketService.socketId` is null, for example before the socket's `your-id` event has arrived.
- `handleSaveTitle` in `TaskItem` resets the input to the old `task.name` straight after saving. The new title shows only once the store's task list updates.
- `toggleComplete` is called with four arguments, but the store's implementation takes `(id, isCompleted)` and reads the socket id itself. The extra arguments are ignored.
- **Leftover code:**
  - Values computed but never used: `updateCardTaskCounts`, `checklistProgress`, `avatarColors`, `boardTags`, `reminder`, `assignlistData`.
  - The `notificationSocketId` locals are assigned and never read.
  - Several lucide icons are imported but unused.
  - `console.log` calls with nonsense labels run on every render.
- Clicking the dark backdrop calls `onClose`. Clicks inside the panel stop propagation and blur any focused input (`handleModalClick`).
