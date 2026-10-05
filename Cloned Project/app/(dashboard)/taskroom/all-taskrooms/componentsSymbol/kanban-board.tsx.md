# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`

> The main Taskroom board shell: view tabs (Kanban, List, Timeline, Files), the drag-and-drop kanban of stages and task cards, the right-side project panel, and the create, edit and manage-stages dialogs plus the AI copilot.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 973

## Purpose
A Taskroom is a project board whose stages and tasks live in the external Taskroom API (`https://uatapi.garage.app/taskroom`). `components/TaskroomSubPage.tsx` owns the data: it fetches stages, tasks, members and employees and passes them in, together with their setters and loaders, as a large props object. This component is the presentational and orchestration layer. It switches between views, handles drag-and-drop (moving tasks between stages and reordering the stages themselves), and opens the dialogs that create or edit tasks. Its only own network call is stage repositioning.

## How it works

### Tabs (L327-L333, L635-L695, L696-L873)
`activeTab` starts at `"kanban"`, and the tab bar renders `kanban`, `list`, `timeline` and `files`. A `chat` entry is commented out of the tab list, so the `TaskroomGroupChat` branch (L850-L857) is unreachable from the UI.
- `kanban`: `DndContext` plus a `KanbanColumn` per stage (below).
- `list`: `ListView` with the board-wide paged task list (`stagecolumns`, `fetchListView`, `hasMore`, `isFetching`, `nextPageToFetch`) and `onTaskMove` for changing a stage inline.
- `timeline`: `TimelineView`, using the same paged list, with `onTaskClick` opening the editor.
- `files`: `FilesView` for the room.
- Any other id falls back to a "Coming Soon" placeholder.

The `RightSidePanel` (members, stages and so on) is shown when `panelOpen` and the tab is not `chat`. A floating button opens it.

### Kanban rendering (L698-L795)
The outer `SortableContext` (horizontal strategy) holds the stage ids, so stages can be reordered. Each column's tasks are **deduplicated by `_id`**, because paged loading can return overlaps. They are wrapped in a per-column vertical `SortableContext`. `KanbanColumn` receives `isSortable`, `isLastColumn` (the last stage is pinned and cannot be dragged or dropped onto), and highlight flags derived from `overColumnId` and `activeColumnId`. A `DragOverlay` renders a tilted `TaskCard` while a task is dragged. `PointerSensor` needs 8px of movement before a drag starts, so plain clicks still open tasks.

### Drag handlers
- `handleDragStart` (L337-L363): if the dragged item has `data.type === "column"`, it records `activeColumnId`. Otherwise it finds the task, sets `activeTask` and calls the parent's `onDragStart(taskId)`, which drives collaboration and drag indicators.
- `handleDragOver` (L365-L405): highlights a valid target column (any column but the last) for column drags. For task drags it only computes a target and does not mutate state.
- `handleDragEnd` (L486-L553): column drags go to `handleColumnDragEnd`. For task drags it resolves the target stage, either from the column dropped on (appending at the end) or from the stage of the task dropped on (taking that task's index), and calls `onTaskMove(taskId, stageId, index)`. The parent performs the API update. Permission checks for non-admins are present but fully commented out, so any member can move any task.
- `handleColumnDragEnd` (L407-L484): reorders `columns` optimistically, refusing moves that involve the last column. It builds a 1-based `{ stageId: position }` map and sends `PUT https://uatapi.garage.app/taskroom/v1/stages/reposition/<taskRoomId>` with `{ positionData }` and no auth header. On an HTTP error, a falsy `status` or a network error, it rolls back to the original order and shows a toast.

### Horizontal drag-to-scroll (L205-L263)
Raw mouse and touch listeners on the board container implement "grab and pan" scrolling. They set the cursor between `grab` and `grabbing` and make `touchmove` non-passive so it can `preventDefault`. These are separate from dnd-kit's own handlers.

### Scroll preservation (L265-L325)
The board's `scrollLeft` is saved 150 ms after scrolling stops. When `columns` changes (for example after a page of tasks loads), a double `requestAnimationFrame` restores the saved position if the board was reset to 0 or drifted by more than 50px.

### Opening tasks and share links (L193-L204, L555-L601)
- `handleTaskClick` stores `selectedTask` and opens `EditTaskRoom`.
- If the URL has a `card` query param (a share link copied from the task dialog), an effect opens `EditTaskRoom` automatically. That dialog loads the task by id.
- `closeEditTaskRoom` closes the dialog and, when a `card` param exists, strips the `card` and `task` params with `router.replace(..., { scroll: false })`.
- Add-task buttons call `handleColumnAddTask(columnId)`, which sets `initialStageId` and opens `CreateTaskDialog`. `handleGlobalAddTask` opens it without a preselected stage, but its button is commented out.

### Dialogs always mounted (L897-L969)
`ManageStagesDialog` (stage CRUD and paging), `CreateTaskDialog`, `EditTaskRoom` (receives `subtasks` and `setSubtasks` lifted from the parent) and `AICopilot` (fed the board and list state).

## Exports
- `KanbanBoard(props: KanbanBoardProps)` - the board. Its key props are listed below; see the `KanbanBoardProps` interface at L49-L118 for the full list.
  - Data: `columns`, `setColumns`, `stagecolumns`, `setStagecolumns`, `employees`, `members`, `setMembers`, `subtasks`, `setSubtasks`, `taskRoomId`, `userId`, `userRole`, `workspaceUserId`, `conversationId`.
  - Callbacks: `onTaskMove`, `onDragStart`, `onDragEnd`, `onCreateTask`, `onUpdateColumns`, `onUpdateTask`.
  - Loaders: `fetchTasksForStage`, `fetchListView`, `fetchMembers`, `loadingStages`.
  - Paging and flags: `stageExhausted`, `hasMore`, `isFetching`, `nextPageToFetch`, `currentPage`, `observer*`.
  - Dialog toggles: `manageStagesOpen`, `createTaskOpen` and their setters.
  - `collaboration.activeDrags` - the live drag indicators passed to columns.

## Interfaces
- **External services:** the Taskroom API `PUT https://uatapi.garage.app/taskroom/v1/stages/reposition/:roomId` for stage reorder. All other Taskroom calls happen in the children and the parent page.
- **Browser storage / cookies:** reads the `card` and `task` URL query params and rewrites the URL to remove them.

## Dependencies
- **Internal:**
  - `./kanban-column` - a stage column.
  - `./task-card` - the card used in the drag overlay.
  - `./create-task-dialog` - creates tasks.
  - `./edit-task-dialog` - edits tasks (`EditTaskRoom`).
  - `./manage-stages-dialog` - stage management.
  - `./right-side-panel` - the project panel.
  - `./timeline-view` - the timeline tab.
  - `./list-view` - the list tab.
  - `./files-view` - the files tab.
  - `./taskroom-chat/taskroom-group-chat` - the chat branch, currently unreachable.
  - `./ai-copilot` - the AI copilot (`AICopilot`).
  - `./chat-view`, `./DocumentManager`, `./TaskListView`, `./task-search` - imported but not rendered.
  - `../types/kanban` - shared types.
  - `@/components/ui/avatar`, `button`, `input`, `label`.
- **Packages:** `@dnd-kit/core` (DndContext, sensors, overlay); `@dnd-kit/sortable` (sortable contexts); `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`); `next/link` (imported, unused); `react`; `sonner`; `lucide-react`.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/TaskroomSubPage.tsx`, rendered by `app/(dashboard)/taskroom/all-taskrooms/page.tsx` at the route `/taskroom/all-taskrooms`.

## Notes
- The file has no `"use client"` directive. It works only because its importer `TaskroomSubPage.tsx` is a client component.
- `users1`, `currentUsesr` and `onlineUsers` are hardcoded demo users (Sarah Chen and others) and are unused. `tasks` and `handleTaskUpdate`, `handleTaskSave`, `handleUpdateTask`, `getTextColor` (with a broken `hsl$$` regex), `defaultColumnId` and `taskDetailsOpen` are also dead.
- `handleDragEnd` compares `activeTask.columnId` (not `stageId`) with the target. Tasks typically carry `stageId`, so dropping a task back into its own stage still calls `onTaskMove`.
- The stage reposition call is unauthenticated from the client.
- Many debug `console.log` calls run on every render (L169, L183, L364, L610, L615).
