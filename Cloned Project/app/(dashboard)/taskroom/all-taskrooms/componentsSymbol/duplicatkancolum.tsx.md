# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/duplicatkancolum.tsx`

> An older, unused copy of the Taskroom `KanbanColumn` component: a droppable stage column that lists task cards and loads more tasks automatically as the column fills or scrolls.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 221

## Purpose
The file name is short for "duplicate kanban column". It is a backup of an earlier version of `kanban-column.tsx`, the live column component used by `kanban-board.tsx`. The live version has since gained column re-ordering (`useSortable` from `@dnd-kit/sortable`, plus `isSortable`, `isLastColumn`, `isDragOver` and `isDragging` props). This copy has none of that. Nothing imports it, and because it exports a component with the same name as the live one, any import of it would be a mistake.

## How it works
- **Drop target:** `useDroppable({ id: column._id })` from `@dnd-kit/core` registers the card as a drop zone for dragged tasks. `isOver` changes the empty-state text from "No tasks yet" to "Drop here".
- **Header:** sticky, with the stage colour as its background, the stage name, the `taskCount` badge and a `+` button that calls `onAddTask(column._id)`.
- **Task list:** renders a `TaskCard` (from `./task-card`) for each task in `column.tasks`, passing the matching entry from `activeDrags` (live drags by other collaborators), `employees` and `stageList`.
- **Paging, three ways** (all go through the parent's `fetchTasksForStage(column._id)` and are blocked when `stageExhausted[column._id]` is true or `isFetchingRef` is set):
  1. *Auto-fill* (`checkAndAutoFetch`, L42-L73): after each render, and whenever the task count changes, if the content is shorter than 80% of the visible column height it fetches another page. This repeats until the column is full or the stage runs out.
  2. *Scroll-to-load* (L78-L117): a passive scroll listener throttled with `requestAnimationFrame` fetches when the user is within 120 px of the bottom.
  3. *Manual* `handleLoadMore` (L122-L132): kept, but its "Load more" button is commented out in the JSX, so it is never called.
- A spinner shows while `isLoading` is true. The "All tasks loaded" block renders an empty div (its text is commented out).

## Exports
- `KanbanColumn(props: KanbanColumnProps)` - column component. Props: `column`, `activeDrags`, `onAddTask(columnId)`, `onTaskClick?(task)`, `employees`, `stageList`, `fetchTasksForStage(stageId): Promise<void>`, `stageExhausted`.

## Dependencies
- **Internal:** `./task-card` - `TaskCard` for each task; `../types/kanban` - `Column`, `Task`, `DragEvent`, `Employee` types; `components/ui/card`, `components/ui/button`.
- **Packages:** `@dnd-kit/core` - `useDroppable`; `lucide-react` - `Plus` icon; `react`.

## Used by
Nothing imports this file, so it is dead code. The live equivalent is `componentsSymbol/kanban-column.tsx`.

## Notes
- It logs every render with `console.log("123123123column", column)`.
- Safe to delete once nobody needs it for reference; keep `kanban-column.tsx` as the single source.
