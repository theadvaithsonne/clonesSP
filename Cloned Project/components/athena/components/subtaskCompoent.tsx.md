# `components/athena/components/subtaskCompoent.tsx`

> The "SubTasks" section of the Athena/Taskroom card modal: a nested, lazily loaded, infinitely scrolling tree of a task's subtasks with inline create, complete, delete and open-in-modal actions.

**Kind:** React component · **Lines:** 1141

## Purpose
A Taskroom task (card) can have child tasks, which can have children of their own. This file renders that tree as a table (Name, Assignee, Priority, Due Date, Tags, Actions) inside `CardModal`. It talks directly to the external Taskroom API for loading and changing subtasks, and keeps the shared `useDashboardStore().columns` up to date so the list view and board outside the modal show the right subtask counts without refetching. Clicking a subtask's name opens another `CardModal` for that subtask, so the two components import each other.

## How it works

### Module constants and helpers (L1-L217)
- **Indentation (L18-L30):** nesting depth is shown in 22 px steps, capped at 10 levels. `clampIndentStep` turns pixels into a step index; `INDENT_WIDTH_CLASS` and `EDIT_INDENT_CLASS` hold matching static Tailwind classes (static strings so Tailwind's scanner can see them).
- **`TASKROOM_API_URL` (L33):** `NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/`.
- **Inline SVG icons (L35-L132):** `IconCircle` (completion toggle), `IconChevron`, `IconFlag`, `IconTag`, `IconCalendar`, `IconUsers`, `IconSubtask`, `IconTrash`, plus `IconPlus`, `IconEdit`, `IconSort` and `IconSuggest`, which are defined but not used.
- **`PRIORITIES` (L135-L141):** colour per priority value (`urgent`, `high`, `normal`, `medium`, `low`).
- **`fmtDate`:** epoch ms -> "dd Mon" (en-GB).
- **`normalizeTask` (L147-L161):** converts an API task into the shape the rows use. `title` falls back to `name`. `assignedToIds` is taken from **`assigneeData`** (so it holds user objects, not ids), `tags` from `tagData`, and `subTaskCount` from `subTaskCount` or `TaskDataCount.totalChildCount`. Nested `subtasks` are normalised recursively.
- **`normalizeForDashboard` (L164-L195):** converts a newly created task into the shape `ListView.tsx` expects in the dashboard store (`id` and `_id`, `name` and `title`, `members`, real `assignedToIds`, `tagData`, `type: "subtask"`, `parentId`, `subTaskCount`).
- **`updateTaskInTreeAny` / `updateTaskInDashboardColumns` (L198-L217):** apply an updater to the task with a given id anywhere in a nested `subtasks` tree, across every dashboard column (whether the column keeps its tasks under `cards` or `columns`).

### `EditRow` (L220-L285)
A shared inline editor: a title input (Enter saves, Escape cancels) and icon buttons that open `AssigneePicker`, `CustomDatePicker` (start and due dates stored as epoch ms), `PriorityPicker` and `TagPicker`. Badges show how many assignees and tags are chosen. Save is disabled while saving or when the title is empty. The editor is sticky to the left edge so it stays visible when the table scrolls sideways.

### `NewTaskRow` (L288-L355)
Holds its own form state and on save calls `POST {TASKROOM}tasks` with `{ title, roomId, stageId, assignedToIds, priority, tags, startDate, dueDate, parentId: parentId || cardId, rootId: rootId || cardId }`. So a top-level subtask gets the card as both its parent and its root. On success (`status` and `data`) it calls `onTaskAdded(data)`, resets the form and calls `onSave(data)`. Errors are only logged to the console.

### `TaskRowSkeleton` (L357-L385)
Pulsing placeholder row in the same six-column grid, indented to the given depth.

### `TaskRow` (L388-L854) - one node of the tree, recursive
- **State:** a local copy of the task (`localTask`), its loaded `subtasks`, expand state, subtask pagination (`subtaskPage`, `subtaskTotalPages`, an in-flight ref), add/edit/modal flags, and edit-form fields. It resyncs when the `task` prop changes.
- **Lazy children (L427-L486, L636-L644):** the chevron is enabled when `subTaskCount > 0` or children are already loaded. The first expand fetches `GET {TASKROOM}tasks/detail/sub/{taskId}?size=30&page=1`. Page 1 shows a skeleton row; later pages show "Loading subtasks...". New results are de-duplicated by `_id`.
- **Infinite scroll (L488-L514):** when expanded and more pages exist, an `IntersectionObserver` (with `root` set to the modal's scroll container passed in as `scrollRoot`, `rootMargin` 220 px) loads the next page from a 1 px sentinel, and stops watching once the last page has loaded.
- **Complete toggle (L516-L544):** `PUT {TASKROOM}tasks/{id}` with `{ isCompleted: !current }`. If the response includes data the row is updated from it, otherwise the flag is flipped locally.
- **Delete (L546-L563):** after a native `confirm()`, `DELETE {TASKROOM}tasks/{id}`. On success the row hides itself (`isDeleted`) and calls `onDelete(id)`. The parent row's handler removes the child, decrements its own `subTaskCount`, and calls `setColumns(updateTaskInDashboardColumns(...))` so the parent task in the dashboard store loses the child and its count drops (L738-L756).
- **Add subtask (L715-L718, L777-L810):** the Actions column button expands the row and shows a `NewTaskRow` indented one level deeper, with `parentId` set to this task. The new child is added at the top of the local list, the local count goes up, and the same change is mirrored into the dashboard store for this task's id.
- **Open details (L653-L655, L812-L850):** clicking the title opens a nested `CardModal` with the task (with `name` copied from `title`), `boardId=roomId`, the store's `setColumns`, placeholder strings for `userId` and `orgId`, and `connected={false}`. Its `onCardPatched` callback merges the patch into this row or any loaded descendant, keeping `title` and `name` in step.
- **Cells:** up to three assignee initials plus a "+N" bubble, a priority pill coloured from `PRIORITIES`, a date range, and tag chips. In the Tags cell, `t.color` is used as a CSS class name, which only works for legacy Tailwind colour values (it does not use `tag-colors.ts`). Action buttons appear on hover. "Add subtask" is hidden when `isReadOnly`; Delete is always shown.
- **Edit mode (L565-L616):** `handleEditSave` would PUT the edited fields, and an `editing` branch renders an `EditRow`. Nothing ever sets `editing` to true (the Edit button is commented out at L713), so this path is dead code.

### `SubtaskManager` (default export, L857-L1141)
- **Inputs:** `roomId`, `stageId`, `cardId`, `isReadOnly`. `boardId` is set to `roomId`. The space id for tag lookups (`Idspace`) comes from the `spaceId` query parameter when the page was opened through a `shareTask` link, otherwise from `useTaskroomWorkspacetore().currentRoomDetail.spaceId`.
- **Loading (L879-L942):** `fetchTasksPage(cardId, page)` uses the same `tasks/detail/sub/{id}` endpoint (30 per page) for the card's direct children and runs whenever `cardId` changes. On failure, page 1 resets to an empty list.
- **Infinite scroll (L944-L967):** a sentinel at the end of the top-level list, observed with `root` set to this component's own container (`scrollRootRef`, `rootMargin` 260 px).
- **Header:** a collapsible "SubTasks" title, a "+" button (hidden when read-only) that opens a top-level `NewTaskRow`, and a fullscreen toggle. Fullscreen turns the wrapper into a fixed `z-[100]` overlay.
- **Body:** column headers and three skeleton rows while loading; an empty state with an "Add Subtask" button; otherwise one `TaskRow` per child, each given `rootId={null}` and `scrollRoot={scrollRootRef.current}`.
- **Top-level create (L1097-L1124):** the new task is put at the top of the list and the card (`cardId`) in the dashboard store gets the child and a count of +1.
- `openCount` (number of incomplete tasks) is computed but never shown.

## Exports
- `default SubtaskManager({ roomId, stageId, cardId, isReadOnly? })` - the subtask section for one card.

## Interfaces
- **Backend endpoints called (external Taskroom API, `NEXT_PUBLIC_TASKROOM_URL`):**
  - `GET tasks/detail/sub/{taskId}?size=30&page=N` - a task's direct children, paginated
  - `POST tasks` - create a subtask (`parentId`, `rootId`, `roomId`, `stageId`, ...)
  - `PUT tasks/{id}` - toggle `isCompleted` (and, in the unreachable edit path, other fields)
  - `DELETE tasks/{id}` - delete a subtask
  - The pickers (`TagPicker` and others) make their own calls.
- **External services:** Taskroom v2 API (default `https://uatapi.garage.app/taskroomv2/v2/`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`.
- **Browser storage / cookies:** reads `garage_tok` from `localStorage` for the bearer token.

## Dependencies
- **Internal:** `components/athena/components/assignee-picker.tsx`, `custom-date-picker.tsx`, `priority-picker.tsx`, `tag-picker.tsx` - the field pickers in `EditRow`; `components/athena/components/card-modal.tsx` - opens a subtask's full detail (circular import); `store/athena/dashboardStore.ts` - `columns` / `setColumns` (accepts a value or an updater function) to keep board and list counts in step; `store/taskroom/taskroomWorkspace.tsx` - `currentRoomDetail.spaceId`.
- **Packages:** `next` (`useSearchParams`); `react`; `lucide-react` icons (many imported but unused); `sonner` toasts.

## Used by
`components/athena/components/card-modal.tsx`, which renders it with the card's `_id`, the room id (`boardId`) and the card's `stageId`. A stale `cardmodelnewbackup.txt` also references it.

## Notes
- **Unauthenticated PUT:** `handleEditSave` (L568-L574) sends no `Authorization` header. It cannot be reached today, but it would fail if editing is turned back on.
- **Odd import:** L17 imports `tree` from `next/dist/build/templates/app-page`, a Next.js build internal. It is unused and could break on a Next upgrade or pull build code into the client bundle; it should be removed.
- There is no `"use client"` directive; it is client-only because `card-modal.tsx` is a client component.
- `normalizeTask` puts user objects into `assignedToIds`, but `normalizeForDashboard` puts real ids there. Rows created in this session and rows loaded from the API therefore hold different shapes, and the assignee cell shows "?" for id-only entries.
- Leftover `console.log` calls: in `NewTaskRow` (L320) and on every `TaskRow` render (L394).
- `updateTaskAndCardCounts` is an empty stub passed to `CardModal`. `userId="userId"` and `orgId="orgId"` are literal placeholder strings.
- The file name is misspelt ("Compoent"); imports depend on that exact spelling.
