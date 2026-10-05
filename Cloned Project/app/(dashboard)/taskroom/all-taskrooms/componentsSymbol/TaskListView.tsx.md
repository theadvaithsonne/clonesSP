# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/TaskListView.tsx`

> A responsive, grouped "list" rendering of a taskroom's Kanban stages, with collapsible stage sections, client-side search filtering, per-stage "Load More" paging and expandable subtask rows.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 619

## Purpose
Taskroom (the Kanban-style project tool under `/taskroom/all-taskrooms`) offers several views of the same stage/task data: Kanban, Timeline, List, Chat and Files. This component was written as a table-like alternative to the Kanban columns: every stage becomes a collapsible section listing its tasks as rows. It is imported by `kanban-board.tsx`, but the JSX that renders it is currently commented out there (the "list" tab renders `ListView` from `list-view.tsx` instead), so this file is effectively dormant.

## How it works

### Local types (L9-L52)
The file declares its own minimal `Subtask`, `Task`, `Column` and `Employee` interfaces rather than importing `../types/kanban`. A `Column` is a stage (`_id`, `name`, `color`, `tasks`, optional `taskCount`).

### `TaskRow` (L54-L363, not exported)
Renders one task three different ways depending on breakpoint:
- **Desktop (`lg`)**: a 12-column grid with title + description, stage pill (coloured with the stage colour), priority badge, assignee avatar/name, due date and up to two tags (`+N` for the rest).
- **Tablet (`md`)**: an 8-column grid without due date or tags; priority shows only its first letter.
- **Mobile**: a fixed five-column grid meant to scroll horizontally, with tags on a second line.

Helpers inside the row:
- `getPriorityColor` maps `high`/`medium`/`low` to Tailwind colour classes (used in the tablet and mobile layouts only).
- `getEmployeeName` looks the assignee up in the `employees` prop, falling back to "Unassigned".
- `checkIfOverdue` parses `dueDate` (string or epoch number), compares it at day granularity with today, and returns a localised "Mon D, YYYY" string plus an `isOverdue` flag (red when overdue, green otherwise). Missing dates show "N/A"; unparseable ones show "Invalid Date".

Clicking any of the row layouts calls `onSubtaskToggle`, not `onClick`. When the row is the expanded one, a subtask panel appears below it with a spinner while loading, then a table of subtasks (completion checkbox, struck-through title when completed, assignee), or "No subtasks available".

### `TaskListView` (L366-L619)
State:
- `expandedColumns` (Set of stage ids). A mount-only effect expands every stage present in the first render.
- `searchTerm`. Filters each stage's tasks by title, description or tag (case-insensitive). There is no search input in this file, and `setSearchTerm` is never called, so filtering is inert.
- `expandedTaskId`, `subtasksMap` (taskId to subtasks) and `isLoadingSubtasks` for the subtask drawer.
- `isFetchingRef` (per-stage) and `isFetchingSubtaskRef` stop the same request being sent twice.

Data flow:
- `toggleTaskSubtasks(taskId)` collapses the open task, or expands a new one and calls `fetchSubtasks` once per task (results are cached in `subtasksMap`).
- `fetchSubtasks` calls `fetchTaskDetail(taskId)` from `useListViewDetailStore`, then accepts subtasks from any of `detail.subtasks`, `detail.subTasks`, `detail.sub_tasks` or `detail.data.subtasks`, so it copes with different response shapes.
- `loadMoreTasks(columnId)` calls the parent's `fetchTasksForStage` unless the stage is already exhausted or being fetched.

Rendering per stage: tasks are de-duplicated by `_id` (a `Map`), and the header shows the stage dot, name, `taskCount` (or the de-duplicated length) and an "Add Task" button that calls `onAddTask(column._id)`. "Load More Tasks" appears only when the stage is not exhausted **and** already shows at least 30 tasks; "All tasks loaded" appears once the stage is exhausted; an empty-state illustration appears for stages with no tasks.

## Exports
- `TaskListView(props: TaskListViewProps)` - the list view component. Props: `columns`, `employees`, `onTaskClick?`, `onAddTask(columnId)`, `fetchTasksForStage(stageId): Promise<void>`, `stageExhausted: Record<string, boolean>`, `baseurl`, `authToken`.

## Interfaces
- **External services:** indirectly, through `useListViewDetailStore`: `GET <taskroom base>tasks/detail/:taskId` and `GET <taskroom base>subtask/detail/:subtaskId` on the external Taskroom API (default `https://uatapi.garage.app/taskroom/v1/`, overridable with `NEXT_PUBLIC_TASKROOM_API_BASE_URL` / `NEXT_PUBLIC_TASKROOM_BASE_URL`). Both send `Authorization: Bearer <localStorage garage_tok>`.

## Dependencies
- **Internal:** `components/ui/card`, `button`, `badge`, `avatar` - shadcn UI primitives; `store/taskroom/listViewDetailStore.ts` - zustand store that fetches and caches task and subtask detail.
- **Packages:** `react` - state, refs, effects; `lucide-react` - Plus, Calendar, ChevronRight, ChevronDown, Check icons.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx` imports it, but its `<TaskListView ... />` usage is commented out, so it is not rendered on `/taskroom/all-taskrooms`.

## Notes
- **Runtime bug:** the subtask row click handler inside `TaskRow` (L316-L323) calls `fetchSubtaskDetail`, but that name is only defined inside `TaskListView` (L386), not in `TaskRow`'s scope. Clicking a subtask would throw a `ReferenceError`, and the `onClick?.()` that follows (the only route to `onTaskClick`) would never run.
- `baseurl` and `authToken` props are accepted but never used. The commented-out call site in `kanban-board.tsx` passes `activeDrags` and `stageList` instead, which this component does not declare, so reviving it needs prop changes.
- The expand-all effect has an empty dependency list, so stages that arrive after the first render start collapsed.
- `isLoading` is shared by all stages, so a fetch on one stage disables every "Load More" button.
- `isLoadingSubtasks` is a single flag; it is only shown for the expanded task.
