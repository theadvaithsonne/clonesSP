# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-column.tsx`

> One stage column on the Taskroom kanban board: a droppable and sortable dnd-kit container that renders its task cards and lazy-loads more tasks as the user scrolls.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 274

## Purpose
`kanban-board.tsx` renders one `KanbanColumn` per stage. The column is two things at once. It is a **drop target** for task cards, and it is a **sortable item**, so the whole stage can be dragged to reorder stages, except the last stage, which is pinned. Each stage's tasks are paged from the external Taskroom API, and this component decides when to request the next page through the parent-supplied `fetchTasksForStage(stageId)`.

## How it works
- **dnd-kit wiring:** `useDroppable({ id: column._id })` makes the column a drop zone, and `isOver` switches the empty-state text to "Drop here". `useSortable({ id: column._id, disabled: !isSortable || isLastColumn, data: { type: "column", column } })` makes it draggable. The board uses `data.type === "column"` to tell stage drags from task drags. Both refs are merged into one `setNodeRef`, and the drag listeners are attached **only to the coloured header**, so the cards underneath remain individually draggable. A dragged column is shown at 50% opacity, and `isDragOver` adds a dashed outline.
- **When more tasks can be fetched:** `canFetchMore()` requires the stage not to be marked exhausted in `stageExhausted[column._id]`, no fetch to be in flight (`isFetchingRef`), and **at least 30 tasks already loaded**. The 30-task threshold assumes the first page had 30 items. A column with fewer tasks is treated as complete.
- **Fetch triggers** (all go through `triggerFetch`, which sets the loading spinner and the in-flight ref):
  1. On mount, if the column has no tasks. Because of the 30-task rule, this never fires for an empty column in practice.
  2. On scroll within 150px of the bottom. Scroll events are throttled: the handler runs at most once per 300 ms.
  3. Through a `ResizeObserver` on the content: if the cards fill less than 80% of the visible height, it fetches again so the column fills up.
- **Header:** the stage name, a count badge showing `column.taskCount` (the server-side total, not the number loaded), and a + button that calls `onAddTask(column._id)`.
- **Body:** a `TaskCard` per task, given the matching entry from `activeDrags` (live collaboration drag indicator), `employees` and `stageList`. Clicking a card calls `onTaskClick(task)`. The footer shows a spinner, then "All tasks loaded" when the stage is exhausted, or "No tasks yet" or "Drop here" when the column is empty.

## Exports
- `KanbanColumn(props: KanbanColumnProps)` - the column component. Props:
  - `column` - the stage, with its `tasks` and `taskCount`.
  - `activeDrags` - live drag indicators.
  - `onAddTask(columnId)` - opens task creation for this stage.
  - `onTaskClick(task)` - optional; opens a task.
  - `employees`, `stageList` - passed through to the cards.
  - `fetchTasksForStage(stageId)` - loads the next page of the stage.
  - `stageExhausted` - per-stage "no more tasks" flags.
  - `isSortable`, `isLastColumn`, `isDragOver`, `isDragging` - drag behaviour and highlight flags.

## Dependencies
- **Internal:** `./task-card` (`TaskCard`); `../types/kanban` (`Column`, `Task`, `DragEvent`, `Employee`); `@/components/ui/card`, `@/components/ui/button`.
- **Packages:** `@dnd-kit/core` (`useDroppable`); `@dnd-kit/sortable` (`useSortable`); `@dnd-kit/utilities` (`CSS.Transform`); `react`; `lucide-react` (`Plus`).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`, which is reached through the route `/taskroom/all-taskrooms`.

## Notes
- The mount effect has an empty dependency list on purpose, and the hooks linter would flag it.
- The count badge and the number of loaded cards can differ until the stage is fully paged.
