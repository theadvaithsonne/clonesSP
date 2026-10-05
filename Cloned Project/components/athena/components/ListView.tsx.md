# `components/athena/components/ListView.tsx`

> The "List" view of the Athena / Taskroom project-management board: a spreadsheet-like, stage-grouped task table with inline editing, nested subtasks, custom-field columns, infinite scroll and inline stage/task creation, all backed by the external Taskroom API.

**Kind:** React component · **Lines:** 2721

## Purpose

Athena is the in-app project-management module (rooms with stages, tasks, subtasks, tags, assignees). `components/athena/ProjectMangement.tsx` switches between several board views; when the user picks "List" it renders `<ListView />`. This file is that view. It renders the current room's stages (from the shared `useTaskroomWorkspacetore` zustand store) as collapsible sections, each listing its tasks as grid rows with Name / Assignee / Due date / Priority / Tags / custom fields / Comments / Subtasks columns. Most editing happens inline in the row; clicking a task's name opens the full `CardModal`.

The component takes no props. Everything comes from zustand stores and the URL query string, and almost all persistence goes straight to the **external Taskroom API** (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`). It does not call this repo's `/backend` Express server.

## How it works

### Module-level types and helpers (L1-L403)

- **Types (L41-L284):** `Card`, `Task`, `TaskGroup` (a stage holding `cards` and/or `columns` arrays of tasks), `Checklist`, `ChecklistItem`, plus the internal `CustomColumn`, `RoomCustomFieldDef`, `NewTaskDraft` and `NewSubtaskDraft`. Stages arrive with tasks in either `cards` or `columns`, so nearly every helper reads `g.columns ?? g.cards` and writes both.
- **Custom-field normalisation (L93-L156):**
  - `normalizeCustomFieldType` maps the room's field types onto six UI types: `select` becomes `dropdown`, `multiselect` becomes `labels`, and anything unknown becomes `text`.
  - `normalizeCustomFieldOptions` accepts options as strings or `{label|name|value, color}` objects and gives each a colour from `CUSTOM_FIELD_OPTION_COLORS` when it has none.
  - `mapRoomCustomFields` turns `currentRoomDetail.customFields` into column definitions.
  - `parseCardCustomFields` reads a task's values from a `customFields` object or from any of the `customFieldData` / `customFieldValues` / `fieldValues` arrays, because the API has used several shapes.
- **API-to-UI transforms:**
  - `transformCard` (L158) maps a raw task (`title` becomes `name`, `assigneeData` becomes `members`, and so on).
  - `transformStage` (L186) maps a raw stage plus its `cardData`.
  - `transformCardCustom` (L287) is a variant for the `createCard` response, where `tags` holds tag objects and `assignedToIds` holds the members.
- **Immutable tree helpers (L319-L394):** `getAllTaskIds`, `getExpandableTaskIds` (unused), `findTaskInTree` / `findTaskInGroups`, `updateTaskInTree` / `updateTaskInGroups`, `addTaskToGroup` (unused), `addSubtaskToParent` (prepends the subtask and bumps `subTaskCount`) and `getRootTaskId` (finds the top-level ancestor, used as `rootId` when a subtask is created). Tasks match on either `_id` or `id`.
- **Small utilities:** `parseCustomFieldValue` (an empty string becomes `null`; number fields go through `Number()`), `formatDateDisplay` (en-US `M/D/YY`), `formatPriorityLabel`, `getOptionColor`, and layout constants (`META_COL_WIDTH` = 100px, the 13px text class, sticky draft-row classes).

### `InlineDraftRow` (L406-L569)

This is a presentational row for typing a new task or subtask name. It has pickers for assignee (`AssigneePicker`, single selection), start/due date (`CustomDatePicker`, stored as ISO strings), priority (`PriorityPicker`) and tags (`TagPicker`, scoped by `roomId`/`spaceId`), plus Cancel and Save buttons. The parent passes the key handling in: Enter saves and Escape cancels. `STAGE_PRESET_COLORS` (L571) holds the 12 swatches used by the "New status" form.

### Component state and context (L577-L625, L759-L893)

- **Store data:** `columns` / `setColumns` (the room's stages and tasks), `currentRoomDetail`, `refreshCurrentRoomDetail`, `loadMoreStages` and `memberData` come from `useTaskroomWorkspacetore`. `createCard`, `updateCard` and `fetchCardsForStage` come from `useCardStore`. `createStage` comes from `useStageStore`. `incrementListCount` and `memberData` come from `useBoardStore`. `cardMembers` and `fetchMembersForCards` come from `useMemberStore`. `currentWorkspace` comes from `useWorkspaceStore`.
- **Room identity (L590-L596):** normally `roomId`, `spaceId` and `workspaceId` come from the stores. When the URL has `?shareTask=...`, they are read from the `roomId`, `spaceId` and `workspaceId` query parameters instead, which supports shared-task links. `?sort=old-to-new` gives `asc` and anything else `desc`. That value is used only as an effect dependency here.
- **Read-only mode:** `isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData)`. It is true when the user's room role is `observer`. Most mutating handlers return early when it is true, and several buttons are hidden or disabled.
- **Local UI state:** checked task IDs, collapsed stages, expanded tasks, new task and subtask drafts, inline name edit, the "Add status" form, a legacy create-stage modal, the member-search popover, `activeCard` / `showModal` for `CardModal`, and pagination maps for stages and subtasks.
- **Reset effect (L943-L968):** when `roomId`, `spaceId` or the sort changes, expansion, selection, drafts and every pagination map are cleared and the subtask observer is disconnected. The effect deliberately does not clear `columns`, because the store owns them and they keep rendering while the new room loads.

### Pagination and infinite scroll

There are three independent mechanisms:

1. **More stages (L1041-L1054):** the main scroll container's `onScroll` calls the store's `loadMoreStages()` when the user is within 300px of the bottom. The store pages `rooms/detail/:roomId` and ignores calls while a page is loading or when no pages are left.
2. **More cards in a stage (L723-L757, L1057-L1125):** when a stage's `taskCount` exceeds the number of tasks it has loaded, a sentinel `<div>` is rendered at the bottom of that stage. An `IntersectionObserver` rooted at the list (300px bottom margin) calls `handleFetchPage(stageId, page+1)`. That calls `fetchCardsForStage` (Taskroom `stages/detail/:stageId`), removes cards already present, transforms the rest and appends them. The total page count is the API's `totalPages`, or `ceil(taskCount/10)` as a fallback. A 250ms in-flight flag per stage plus the single `loadingStageId` stop duplicate fetches.
3. **Subtasks (L631-L720, L973-L1039, L1183-L1216):** expanding a task (`toggleTaskSubtasksVisible`) fetches page 1 with `fetchSubtaskPage` (`tasks/detail/sub/:taskId?size=30&page=N`), showing a skeleton meanwhile. Page 1 replaces the task's `subtasks`; later pages are appended and de-duplicated. If page 1 is empty and the user can edit, the inline subtask form opens automatically. When more pages remain, a per-task sentinel is rendered under the subtask list, and a second observer (200px margin) fetches the next page. `subtaskFetchInFlightRef` blocks concurrent fetches for the same task.

### Horizontal scroll sync (L892-L934)

On desktop the grid can be wider than the viewport: the minimum width is 1200px plus 160px per custom column. The column header strip and every task row are separate `overflow-x-auto` containers with hidden scrollbars. `handleHeaderHorizontalScroll` and `handleBodyHorizontalScroll` copy `scrollLeft` between the header and all rows tagged `data-stage-scroll`, and an `isSyncingHorizontalScroll` ref plus `requestAnimationFrame` prevent feedback loops. The Name column is `position: sticky; left: 0`.

### Grid template (L1128-L1146)

The columns are: Name `3fr`, Assignee / Due date / Priority / Tags `1fr` each, one 160px column per custom field, then Comments and Subtasks at 100px each. On mobile each row collapses to a single column and the metadata wraps below the name.

### Creating stages, tasks and subtasks

- **"New status" inline form (L1234-L1261, L2566-L2699):** the user enters a name and picks a preset or custom colour (a hidden `<input type="color">` with id `listview-add-status-color-picker`). `submitNewStage` calls `createStage({ name, color, stageType: "active", orderId: 0, roomId })`, which POSTs to Taskroom `stages/add`. On success it appends `transformStage(newStage)` to `columns` and calls `incrementListCount(roomId)`.
- **Legacy `submitCreateStage` (L1563-L1594):** POSTs with axios to Taskroom `stages` and then calls `window.location.reload()`. Nothing in the JSX opens its modal (`isCreateStageModalOpen` is never rendered), so this is dead code.
- **New task (L1224-L1308):** "Add Task" at the bottom of a stage opens `InlineDraftRow`. `submitNewTask` converts the dates to epoch milliseconds and calls `createCard({ stageId, title, roomId, startDate, dueDate, description: "", priority (default "normal"), tags, assignedToIds })`, which POSTs to Taskroom `tasks`. It then prepends `transformCardCustom(newCard)` to the stage's `cards` and bumps `localCardCount`. An empty name cancels the draft. A `targetGroupId` of `"quick-add"` resolves to the first stage, but nothing in this file sets that value.
- **New subtask (L1312-L1394):** the row's "+" button (always visible on mobile, shown on hover on desktop) opens a sticky draft row above the parent. `submitNewSubtask` POSTs directly to Taskroom `tasks` with `parentId` and `rootId` (from `getRootTaskId`), then inserts the result with `addSubtaskToParent`.

### Inline editing (L1398-L1559)

Each handler calls the API, then patches `columns` with `updateTaskInGroups`:

- **Assignees:**
  - `toggleMemberInline` (L806) adds or removes one member. It calls `updateCard(taskId, { assignedToIds, socketId: undefined, userAssignedToIds | userRemoveAssignedToIds: memberId })`, which PUTs to Taskroom `tasks/:id`, then updates `members` locally and shows a toast. A per-member `togglingMemberIds` set prevents double clicks.
  - The "+" popover calls `fetchMembersForCards(taskId)` (Taskroom `tasks/:taskId/members?size=50`) when it opens and lists `cardMembers`.
  - Typing in the popover search box triggers a 300ms debounced effect (L781-L804) that calls `tasks/:activeCard._id/members?searchData=...`.
  - The hover "x" on an avatar also calls `toggleMemberInline`.
  - `handleInlineUpdateAssignee` exists but nothing in the JSX calls it.
- **Dates:** `handleInlineUpdateDates` sends epoch milliseconds and recomputes `isOverDue` locally. The cell shows `MMM d` and an "Overdue" marker in red.
- **Priority:** `handleInlineUpdatePriority`. The flag is filled red for urgent, amber for high and blue for normal.
- **Tags:** `handleInlineUpdateTags` sends `tags` and, when a tag was just added, `tagItemIds`. A `TagChip` remove button sends the list without that tag.
- **Completion:** the round checkbox (L1698-L1752) toggles `isCompleted` optimistically, PUTs `{ isCompleted }` directly to Taskroom `tasks/:id`, and rolls back if the request fails. It does not check `isReadOnly`.
- **Custom fields (L1493-L1559, L2144-L2247):**
  - Dropdown and labels fields use a popover of coloured options (its search box is read-only). They save immediately through `updateDropdownFieldValue`.
  - Number and text fields update local state on every keystroke. They save after a 500ms debounce per `taskId:fieldId`, and immediately on blur.
  - Date fields save the `M/D/YY` string.
  - `persistCustomFieldValue` PUTs `{ fieldId, fieldValue }` to Taskroom `tasks/:taskId/update/custom/field`. If the response carries a room object, it is merged in with the store's `syncRoom`, and `refreshCurrentRoomDetail(roomId)` runs when that object has no `customFields`.
- **Delete task (L1811-L1848, L1863-L1900):** after `confirm()`, it sends `DELETE` to Taskroom `tasks/:id`, removes the task from its stage and decrements `localCardCount`. The mobile and desktop buttons duplicate this logic, and neither checks `isReadOnly`.

### Rows and sections (L1600-L2331, L2394-L2564)

- `sortedStatuses` orders the stages by `stageType`: `tostart`, then `active`, then `done`, then `closed`.
- Each stage has a sticky header with a collapse chevron, a coloured pill (`group.color`, defaulting to `#8b5cf6`) and a count (`localCardCount ?? taskCount`).
- `renderTaskRow(task, depth, groupId)` renders recursively. Subtasks are indented 24px per level (16px on mobile) and drawn with guide lines, and the expand chevron appears only when `subTaskCount` or the loaded subtasks are greater than 0. Comment and subtask counts come from `commentCount` and `subTaskCount`.
- Clicking a task's name or description sets `activeCard` and opens `CardModal`. `CardModal` receives `setColumns`, `isReadOnly`, `boardId={roomId}`, and the placeholder literals `userId="userId"` and `orgId="orgId"`.
- With no stages, the list shows an empty-state message.

### Bulk actions toolbar (L1483-L1489, L2350-L2390)

When tasks are checked, a floating toolbar appears with Status / Assignee / Due date / Priority actions. These only rewrite local `columns` through `applyUpdaterToCheckedTasks`; nothing is sent to the API. The Tags / Move to list / Convert to subtask / Archive / Delete / More buttons have no handlers. No checkbox in the rendered rows calls `toggleCheckOneTask` or `toggleCheckAllTasks`, so the toolbar is effectively unreachable at present.

## Exports

- `ListView: React.FC` - the list view component. It takes no props and reads everything from stores and the URL.
- `interface Card` - task shape used by the Kanban-style card APIs (`tagData`, `members`, `checklist`, `TaskDataCount`, `attachments`, and so on).
- `type TaskStatus = any` - task status (untyped).
- `type TaskPriority = PriorityLevel` - re-alias of the priority picker's level type.
- `type TaskType = "task" | "subtask"`.
- `interface ChecklistItem`, `interface Checklist` - checklist shapes. They are not used inside this file.
- `interface Task` - row model: id fields, name, dates, priority, tags/tagData, members, `subtasks`, `subTaskCount`, `commentCount`, `customFields`, `parentId`, `isCompleted`.
- `interface TaskGroup` - a stage: `id` / `_id`, `status`, `name`, `color`, `stageType`, `cards` / `columns`, `taskCount`, `localCardCount`.

## Interfaces

- **Backend endpoints called:** none in this repo. All calls go to the external Taskroom API. Paths below are relative to `NEXT_PUBLIC_TASKROOM_URL`, or to the `TASKROOM_API_URL` constant, which falls back to `https://uatapi.garage.app/taskroomv2/v2/`:
  - `GET tasks/detail/sub/:taskId?size=30&page=N` - subtask pages
  - `POST tasks` - create subtask (directly), and create task (through `cardStore.createCard`)
  - `PUT tasks/:id` - toggle completion (directly); assignee, priority, date and tag updates (through `cardStore.updateCard`)
  - `DELETE tasks/:id` - delete task
  - `PUT tasks/:taskId/update/custom/field` - save a custom-field value
  - `GET tasks/:taskId/members?searchData=...` - member search; `GET tasks/:taskId/members?size=50` through `memberStore.fetchMembersForCards`
  - `GET stages/detail/:stageId?size=&page=` through `cardStore.fetchCardsForStage`
  - `POST stages/add` through `stageStore.createStage`; `POST stages` (legacy, unused path)
  - `GET rooms/detail/:roomId?page=&size=&cardSize=30` through `taskroomWorkspace.loadMoreStages`
- **External services:** Taskroom API (uatapi.garage.app, `taskroomv2`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base. Some calls in this file use it raw, with no fallback.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` and sends it as a `Bearer` token on every Taskroom request.
- **Background work:** two `IntersectionObserver`s (stage cards and subtasks), debounce timers for member search (300ms) and custom-field saves (500ms), and a 250ms in-flight reset timer per stage.

## Dependencies

- **Internal:**
  - `./custom-date-picker`, `./priority-picker`, `./assignee-picker`, `./status-picker`, `./tag-picker` (`TagPicker`, `TagChip`) - inline pickers
  - `./card-modal` - full task editor opened on name click
  - `@/store/taskroom/taskroomWorkspace` - `useTaskroomWorkspacetore` (columns, room detail, `loadMoreStages`, `syncRoom`, `refreshCurrentRoomDetail`) and `isRoomObserver`
  - `@/store/taskroom/workspaceStore` - current workspace
  - `@/store/athena/cardStore` - create, update and page tasks
  - `@/store/athena/stageStore` - create stage
  - `@/store/athena/boardStore` - `incrementListCount`, member role data
  - `@/store/athena/memberStore` - task members for the assignee popover
  - `@/store/athena/taskStore`, `@/store/athena/userStore` - pulled in but not functionally used
  - `@/components/ui/*` - `Popover` and `Skeleton` are used; `Sheet`, `Tabs`, `Dialog`, `Label`, `Input`, `Button` and `Select` are imported but unused
  - `@/hooks/use-mobile` - `useIsMobile` switches between the mobile and desktop layouts
  - `@/lib/utils` - `cn`
- **Packages:** `react`; `next/navigation` (`useSearchParams`); `axios` (legacy stage create); `date-fns` (`format`, `isValid`); `lucide-react` (icons); `sonner` (toasts).

## Used by

- `components/athena/ProjectMangement.tsx` - renders `<ListView />` for the "List" view mode.
- `components/athena/projectmangerbacku.tsx` - an older backup copy of the project manager that also renders it.

There is a separate, unrelated component with the same name at `app/taskroom/components/ListView.tsx`.

## Notes

- **Read-only gaps:** observers can still toggle completion and delete tasks. Neither handler checks `isReadOnly`, so it depends on the Taskroom API rejecting the request.
- **Local-only edits:** inline name editing (`commitTaskNameEdit`) and every bulk action change only client state and are lost on reload. `startEditingTaskName` is never called, and `onOpenTask` is a no-op.
- **Member search targets the wrong task:** the debounced search uses `activeCard?._id`, which is the task last opened in `CardModal`, not the row whose popover is open. It can therefore search the wrong task's members, or request `tasks/undefined/members`.
- **Stale snapshots:** `submitNewSubtask`, `commitTaskNameEdit`, `updateCustomFieldValue` and `updateDropdownFieldValue` call `setColumns(...)` on the render-time `columns` value rather than a functional updater, so concurrent updates can overwrite each other. `submitNewTask` spreads `col.cards`, which will throw if a stage only has `columns`.
- **Unexpected `stageType` values:** `sortedStatuses` compares `order[stageType]`; any other value gives `NaN`, and those stages end up in an unpredictable order.
- **Stray URL line:** L779 is a bare `https://uatapi.garage.app/taskroomv2/v2/tasks/<id>/members?size=50` line. JavaScript parses it as a label followed by a `//` comment, so it does nothing, but it is leftover debugging text. It contains a task ID, not a secret.
- **Dead code:** `getExpandableTaskIds`, `addTaskToGroup`, `ensureTaskSubtasksVisible`, `handleInlineUpdateAssignee`, `submitCreateStage` and the create-stage modal state, `updateTaskAndCardCounts` (an empty function passed to `CardModal`), many unused imports, and the commented-out edit (pencil) button.
- **Hardcoded default:** the Taskroom default URL points at the UAT host (`uatapi.garage.app`), not production.
