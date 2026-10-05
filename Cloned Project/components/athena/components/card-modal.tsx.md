# `components/athena/components/card-modal.tsx`

> The full-screen task detail modal for Athena (the Taskroom board/kanban app). It edits a task card's title, status, priority, time, assignees, dates, tags, description, attachments and checklist groups, and shows the card's activity feed.

**Kind:** React component · **Lines:** 2595

## Purpose
Athena is the Taskroom project-management UI, which lives under `components/athena/`. Its boards (kanban, list, calendar, "Assigned to me") open this modal when a user clicks a card. The modal is a ClickUp-style detail view. On the left are the editable fields, the description, subtasks, attachments and checklist groups. On the right is the activity and comments panel. Almost all data goes to the **external Taskroom API** (`NEXT_PUBLIC_TASKROOM_URL`, which falls back to `https://uatapi.garage.app/taskroomv2/v2/`), not to this repo's `/backend`. Some requests go directly from this file and others through the zustand stores in `store/athena/*`. One feature, "Write with AI", calls this repo's own Next.js route `/api/taskroom/generate-description`.

After every successful change the modal patches three copies of the card so other views stay in sync:
- its own `localCard`,
- the parent's `columns` state (through `setColumns`),
- the parent's own state, through an optional `onCardPatched` callback.

## How it works

### Module scope (L1-L134)
- `TASKROOM_API_URL` is `process.env.NEXT_PUBLIC_TASKROOM_URL` or the UAT fallback. Some calls in the file use `process.env.NEXT_PUBLIC_TASKROOM_URL` directly with no fallback, so those break if the variable is unset.
- Local types: `JwtPayload` (claims decoded from the `garage_tok` token: `userId`, `orgId`, `name`, `email`, ...), `CommentItem` (unused here), `CardModalProps`, `ChecklistItem` (unused).
- `tagInputClass` and `searchTagInputClass` are Tailwind class strings for the tag popover inputs. `capitalizeLabel` capitalises a string's first letter.

### State, stores and context (L136-L260)
- Stores used:
  - `useMemberStore`: board members, card members, assigned members and their loaders.
  - `useCardStore`: `updateCard`, `deleteCard`, `toggleComplete`, `setSharedLongUrl`.
  - `useTaskStore`: the card's checklist groups, which the code calls "tasks", with paging and create/delete.
  - `useTagStore`: create, update and delete tags.
  - `useBoardStore`: `decrementCardCount`.
  - `useChecklistStore`: destructured but not used.
  - `useTaskroomWorkspacetore`: current workspace, room detail and space data.
- **Room context.** There are three ways to find which workspace, space and room the card belongs to:
  1. An explicit `roomContext` prop (used by Assigned To Me, where the card's room is not the one open in the store).
  2. URL search params (`workspaceId`, `spaceId`, `roomId`) when the page was opened from a share link (`?shareTask=`).
  3. The current workspace and room in the store.

  The result gives `Idspace`, `workspaceId`, `spaceName` and `roomName`. The space and room names appear as a breadcrumb in the toolbar.
- `patchColumnsForCard` finds the card by `_id` and merges a patch into it. It searches recursively through `cards`, `columns` and nested `subtasks`. `emitPatched(patch)` applies the patch to `localCard`, to the columns and to `onCardPatched`.
- On mount, and whenever the card id changes, the modal calls `fetchTasks(cardId, 1, false)` to load checklist groups. A second effect adds up every group's `childCount` and `completedChildCount` and writes the totals into the card's `TaskDataCount` in the columns. Card tiles use those totals for the "x/y" checklist badge.
- **Time-tracking socket (L263-L275).** The modal decodes `garage_tok` with `jwt-decode` and calls `timeSocketService.connect(payload.userId, card._id)`. That opens a Socket.IO connection to the external `https://uatapi.garage.app/tasks` namespace. The socket disconnects on unmount. The effect depends only on `[timeSocketService]`, so it runs once per mount, not each time the card changes. `timeSocketService.socketId` is later sent with checklist requests.
- The title textarea grows with its content. Attachments start from `card.attachments` and reset when the card id changes.

### Guards and helpers (L297-L461)
- `blockIfReadOnly()` shows the toast "Observers can only view cards" and returns true when `isReadOnly` is set. Almost every mutation calls it first.
- `checkToken()` base64-decodes the JWT payload in `garage_tok`. If `exp` has passed, it opens the **Session Expired** dialog, whose Login button goes to `/login`, and returns false. The signature is not checked; this is only a client-side expiry check.
- `parseDateValue`, `getMemberId` (`_id` ?? `id` ?? `userId`), and `assignedMemberIds` (a Set of the ids of currently assigned members).
- **Stage label (L319-L342).** The label starts from `card.stageData`. It is updated from the matching column in `columns` when one exists, and from `card.stageData` again when the page was opened from a share link.
- `fetchAssignForCards(card._id)` loads the assignees when the modal mounts.
- **Member search (L349-L387).** Typing in the assignee popover is debounced by 300 ms and then calls `GET {TASKROOM}tasks/{cardId}/members?size=50&search=`. Each result is normalised to `{_id, id, name, email, userId}`, whether or not it is wrapped in a `userData` object.
- **Tag list (L412-L429).** When the tag popover opens, the modal fetches `GET {NEXT_PUBLIC_TASKROOM_URL}tags?spaceId={Idspace}&size=100`.
- `handleCommentCountChange(diff)` changes the card's `commentCount` in the columns. `CardActivity` calls it.

### Field mutations (L463-L915)
Most edits call `useCardStore.updateCard(cardId, partial)`, which sends `PUT {NEXT_PUBLIC_TASKROOM_URL}tasks/{id}`, and then call `emitPatched`. `socketId` is always passed as `undefined`.

| Handler | What it sends | Notes |
|---|---|---|
| `handleToggleComplete` | `toggleComplete(id, newStatus)` | Updates the UI first and rolls back on failure. The completion toggle has no visible control in the current JSX. |
| `handlePriorityChange` | `{ priority }` | The value is `null` when the priority is cleared. |
| `toggleMember` | `{ assignedToIds, userAddAssignedToIds` + `userAssignedToIds }` or `{ userRemoveAssignedToIds }` | Adds or removes one assignee and updates the card's `members` in the columns. While one toggle is in progress, others are blocked. The old version is kept in a comment at L490-L524. |
| Avatar "x" (L1370-L1398) | `{ assignedToIds, userRemoveAssignedToIds }` | Asks for `confirm()` and then calls `removeAssignedMember`. |
| `handleDelete` | `deleteCard(id, stageId)` | Asks for `confirm()`, removes the card from its column, lowers `localCardCount` and the board card count, and closes the modal. |
| `handleSaveDesc` | `{ description }` | Sends nothing if the description is unchanged. |
| Title textarea `onBlur` | `{ title }` | Enter blurs the textarea. On error the title goes back to the old value. |
| Status `StatusPicker` | `{ stageId }` | Updates the stage label and `stageData`, and moves the card between columns in board view. |
| `TimeEstimate.onSave` | `{ timeEstimate }` | The estimate is in seconds. |
| `applyDateUpdate` / `handleSaveDates` / `handleRemoveDates` / `CustomDatePicker.onSelect` | `{ startDate, dueDate }` as epoch ms or `null` | The start date is set to the start of its day and the due date to the end of its day. The save path also checks that the due date is not before the start date. Only `CustomDatePicker` and `applyDateUpdate` are actually reached from the UI. |
| `handleToggleTag` | `{ tags }`, or `{ tags, tagItemIds }` when adding | Keeps `tagData` (`{_id,name,color}`) in sync for display. |

**Tag management (L749-L857).**
- `handleCreateLabel` either renames or recolours an existing tag with `updateTagApi`, then updates `tagData` on every card in the columns, or creates a new tag with `createTag({ boardId, spaceId, name, color })`.
- `startEditLabel` switches the popover to edit mode.
- `requestDeleteTag` and `confirmDeleteTag` open an AlertDialog. Deleting a tag with `deleteTagApi` removes it from every card in the columns and from `localCard`, because it is removed from the whole space.
- Colours come from `TAG_PRESET_HEX`, and `tag-colors.ts` supplies the styles.

**AI description (L616-L660).** `handleWriteWithAi` requires a task name. It posts `{ taskName, workspaceName, spaceName, roomName, taskType: "task" }` to the Next.js route `POST /api/taskroom/generate-description`, with `Authorization: Bearer <garage_tok>`. That route checks the user with `lib/taskroomServerAuth` and calls OpenAI. The returned `description` goes into the description editor but is not saved; the user still has to click Save.

**Attachments persistence (L859-L915).** `handleSaveAttachments` is passed to `CardAttachments` as `onSave`. It posts `{ roomId: boardId, taskId, attachments: [{_id?, link, name, fileType}] }` to `POST {TASKROOM}attachments/bulk`. It then merges the saved records the server returns into local state, the columns and `emitPatched`.

**Share link (L1037-L1117).** The share button builds `https://my.garage.app/taskroom/backOffice/athena?orgId&workspaceId&spaceId&roomId&shareTask={cardId}`. `orgId` comes from the decoded JWT. The button stores that URL with `setSharedLongUrl`. It then adds an `og` parameter: URL-encoded JSON with the title, description, assigned-by name (from the JWT) and assignee names. The full URL goes to `POST {NEXT_PUBLIC_TASKROOM_URL or https://my.garage.app/taskroomv2/v2/}short/urls` as `{ longurl, og }`. The short URL comes back as `shortUrl`, `shortURL`, `url` or `data.shortUrl` and is copied to the clipboard. Errors only go to the console (the error toast is commented out). The base URL `my.garage.app` is hardcoded.

### Rendering (L954-L2097)
- The modal returns `null` during SSR (when there is no `document`). Otherwise it is portalled into `document.body` at z-index 9999 over a 60% black backdrop that closes it when clicked. It fills the screen on phones and is up to 1600px wide by 92vh on `sm` screens and up.
- `handleModalClick` blurs any focused input when the user clicks empty space in the modal.
- **Toolbar:** a space › room breadcrumb, Delete, Share (with a spinner while it works), and Close.
- **Mobile tabs:** Details and Activity toggle `mobilePanel`. Both panes are visible side by side on `sm` and up.
- **Left pane:**
  - an auto-growing title,
  - a two-column field grid: Status (shown only when the card has a `stageId`), Priority (`PriorityPicker`), `TimeEstimate`, `TrackTime` (its `onEntriesChange` patches `timeEntries`), Assignees with a search popover, Dates (`CustomDatePicker`, which shows "(overdue)" in red), Tags (`TagChip` list plus the tag popover with search, create, edit and delete), and Created At (`format-created-at` helpers with the time-zone abbreviation),
  - Description: view mode, or edit mode with the "Write with AI" button,
  - `SubtaskManager`,
  - `CardAttachments`,
  - the "Checklist Group" section.
- **Checklist Group section (L1962-L2063).** It can be collapsed. Adding a group calls `createTask(cardId, name, timeSocketService.socketId)` from `useTaskStore`. The section lists `TaskItem` rows and has a "Load More" button that calls `fetchTasks(cardId, page + 1, true)`. When there are no groups it shows an empty state.
- **Right pane:** `CardActivity` with `cardId`, `boardId`, `userId`, `connected`, `isReadOnly`, `setColumns` and the comment-count callback.

### `TaskItem` sub-component (L2100-L2595)
`TaskItem` is not exported. It renders one checklist group, which the code calls a "task", with its items.
- Local state: the items (starting from `task.checklistData`), `localCounts {total, completed}`, title and item edit state, the id of the item being toggled, and paging state. When the task prop changes, the items and counts are synced from it again.
- `handleAddItem` sends `POST {NEXT_PUBLIC_TASKROOM_URL}checklist/groups/{groupId}/items` with `{ description }`. On success it adds the item and raises the card's `TaskDataCount.totalChildCount` by 1.
- `handleToggle` sends `PUT .../checklist/groups/items/{itemId}/complete` with `{ isCompleted, socketId }` and moves the completed counts up or down. Only one toggle can run at a time.
- `handleDeleteItem` sends `DELETE {TASKROOM_API_URL}checklist/groups/items/{itemId}` and lowers the totals. The completed total also drops if the item was completed.
- `handleLoadMoreChecklists` sends `GET .../checklist/groups/items?ChecklistGroupId=&size=10&page=` and reads `metadata.currentPage` and `metadata.totalPages`. The Load More button appears only when `taskchild.childCount > 10`.
- `handleSaveTitle` calls `useTaskStore.updateTask(groupId, { name })`. Deleting a group calls `deleteTask(groupId, socketId)` after `confirm()`.
- `saveEditingItem` updates the UI first and then sends `PUT .../checklist/groups/{itemId}/items` with `{ description, socketId: "" }`. It does not check the response status.
- A progress bar (red below 30%, yellow below 70%, green otherwise) appears once at least one item is complete.

## Exports
- `CardModal(props: CardModalProps)`: the modal. Props:
  - `card: Card`
  - `boardId: string` (the Taskroom room id)
  - `orgId: string` (declared but not destructured or used)
  - `onClose`
  - `userId: string | undefined`
  - `connected: boolean` (passed to `CardActivity`)
  - optional `columnId`, `setColumns`, `isReadOnly`, `updateTaskAndCardCounts` (declared and destructured but not used), `onCardPatched(patch)`, `roomContext`
- `interface RoomContext`: `{ workspaceId?, spaceId?, workspaceName?, spaceName?, roomName? }`. This is where a card lives when that room is not the one open in the store.

## Interfaces
- **External services:** Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/`). Calls made directly from this file:
  - `GET tasks/{id}/members?size=50&search=`: search for assignees.
  - `GET tags?spaceId=&size=100`: list the space's tags.
  - `POST attachments/bulk`: save attachments.
  - `POST short/urls`: create a share short link (the fallback base is `https://my.garage.app/taskroomv2/v2/`).
  - `POST checklist/groups/{id}/items`, `PUT checklist/groups/items/{id}/complete`, `DELETE checklist/groups/items/{id}`, `GET checklist/groups/items?ChecklistGroupId=...`, `PUT checklist/groups/{id}/items`: checklist items.

  Calls made through the stores: `PUT/DELETE tasks/{id}` (`cardStore`), and the tag, checklist-group and assignee endpoints in `tagStore`, `taskStore` and `memberStore`.
- **Endpoints called (this repo):** `POST /api/taskroom/generate-description`, a Next.js route handler that creates an AI task description.
- **Socket.IO events:** none directly. `timeSocketService` connects to the external `https://uatapi.garage.app/tasks` namespace, and its `socketId` is sent along with checklist requests.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` (Taskroom API base URL, ending in `/`).
- **Browser storage / cookies:** reads the `garage_tok` JWT from localStorage for every request, for the expiry check and for `userId`, `orgId` and `name`. `js-cookie` is imported but not used.
- **Other:** writes the share short link to the clipboard. Share links point to `https://my.garage.app/taskroom/backOffice/athena`.

## Dependencies
- **Internal:**
  - `./Dashbaord`: `Card` and `Column` types.
  - `./card-activity`: activity feed and comments.
  - `./card-attachments`: attachments panel and the `Attachment` type.
  - `./custom-date-picker`, `./status-picker`, `./priority-picker`, `./tag-picker` (`TagChip`), `./tag-colors`: the field pickers.
  - `./time-tracking`: `TimeEstimate`, `TrackTime`.
  - `./subtaskCompoent`: `SubtaskManager`.
  - `./format-created-at`: created-at formatting.
  - `../socket/timeTrack-socket-service`: `timeSocketService`.
  - `store/athena/{memberStore,cardStore,taskStore,tagStore,boardStore,checklistStore}`.
  - `store/taskroom/taskroomWorkspace`: workspace, room and space context. `store/taskroom/workspaceStore` is imported but not used.
  - `components/ui/{dialog,alert-dialog,popover,skeleton,button}`, `lib/utils` (`cn`).
- **Packages:** `react`, `react-dom` (`createPortal`), `next/navigation` (`useRouter`, `useSearchParams`), `date-fns` (`format`; `formatDistanceToNowStrict`, `isPast` and `enIN` are imported but not used), `jwt-decode`, `js-cookie` (not used), `lucide-react`, `sonner`.

## Used by
Imported by these Athena files:
- `components/athena/components/AssignedToMe.tsx`
- `CalendarView.tsx`
- `Dashbaord.tsx`
- `ListView.tsx`
- `kanban-card.tsx`
- `subtaskCompoent.tsx`

The modal opens from the Athena / Taskroom back-office boards. `subtaskCompoent.tsx` is also imported by this file, so the two import each other.

## Notes
- **Hosts are mixed.** Most calls use `NEXT_PUBLIC_TASKROOM_URL`, but the short-URL fallback is `https://my.garage.app/taskroomv2/v2/`, the time socket is hardcoded to UAT, and share links point to production `my.garage.app`.
- `searchMembers` builds its URL from `card._id` but its dependency list is `[localCard?._id]`.
- `toggleMember` calls `setColumns(...)` without optional chaining, so it throws if the parent did not pass `setColumns`.
- `checkToken` is skipped in `toggleMember`, `handleWriteWithAi` and the `TaskItem` handlers.
- `TaskItem` actions are not guarded by `blockIfReadOnly`. They rely on the controls being hidden or disabled when `isReadOnly` is set.
- `handleSaveTitle` in `TaskItem` resets `titleInput` to the old `task.name` straight after calling `updateTask`. The new title appears only if the store updates `task`.
- Several unused imports, unused state (`reminder`, `assignlistData`, `showAttachments` is never set to true, `isDatesPopoverOpen`, `newTaskName` reused for groups) and commented-out blocks remain from earlier versions.
- Deleting a card or an assignee uses the browser `confirm()`, while deleting a tag uses an AlertDialog.
