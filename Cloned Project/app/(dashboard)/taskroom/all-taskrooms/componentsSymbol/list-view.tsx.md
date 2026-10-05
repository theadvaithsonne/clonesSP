# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/list-view.tsx`

> The "List" tab of a Taskroom: an infinitely scrolling table of every task in the room, where each task's stage can be changed from an inline dropdown.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 229

## Purpose
This is an alternative to the kanban view. It shows all tasks in one flat table (Task Name, Owner, Status, Priority, Due Date, Tags). The data is the board-wide paged task list that the Taskroom page keeps in `stagecolumns`. The component makes no network calls itself: it asks the parent for more rows (`fetchListView`) and reports stage changes (`onTaskMove`).

## How it works
- **Infinite scroll:** an IntersectionObserver is rooted on the table's scroll container (200px margin) and watches a 1px hidden sentinel after the table. When the sentinel becomes visible, `hasMore` is true and nothing is in flight (`isFetching`), it calls `fetchListView(nextPageToFetch)`. The observer is rebuilt whenever those values change, and a spinner shows while `isFetching`.
- **Rows:** title and description; the owner as an avatar initial plus a name resolved from `employees` by `assignedToId` ("Unassigned" otherwise); a priority badge (high is red, medium yellow, low green); the due date formatted with `toLocaleDateString()`; and up to 2 tag badges plus a `+N` chip.
- **Status column:** a Radix `Select` whose value is `task.stageId`. The trigger's background is the stage's colour (looked up in `columns`), or slate when no stage is set. Choosing a stage calls `onTaskMove(task._id ?? task.id, newStageId, 0)`, and the parent performs the API move.
- If `stagecolumns` is empty, a single "No tasks available" row is shown.

## Exports
- `ListView(props: ListViewProps)` - the list table. Props:
  - `columns` - stages, used for the dropdown and colours.
  - `stagecolumns` - the tasks to show.
  - `employees` - name lookup.
  - `onTaskMove(taskId, newColumnId, newIndex)` - stage change.
  - `fetchListView(page)`, `hasMore`, `isFetching`, `nextPageToFetch` - paging.
  - `users`, `setStagecolumns`, `onTaskUpdate` - accepted but unused.

## Dependencies
- **Internal:** `../types/kanban` (`Column`, `Task`, `User`, `Employee`); `@/components/ui/avatar`, `badge`, `select`.
- **Packages:** `react`; `lucide-react` (`Calendar` icon).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx` renders it when `activeTab === "list"`. The board is reached through the route `/taskroom/all-taskrooms`.

## Notes
- Rows are keyed by array index, not by task id.
- The `sortBy` and `filterStatus` state and the `getStatusColor` helper are unused. No sorting or filtering UI is rendered.
- The spinner uses `border-gray-900`, which is nearly invisible on the dark background.
