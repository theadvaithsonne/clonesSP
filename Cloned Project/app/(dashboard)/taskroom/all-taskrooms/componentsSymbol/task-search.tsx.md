# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/task-search.tsx`

> Debounced search box for a Taskroom's tasks that queries the external Taskroom API and shows matching tasks in a dropdown.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 185

## Purpose
Sits in the kanban board toolbar so a user can find a task by text across all stages of the current room. Selecting a result hands the task back to the board (which typically opens it), so the search does not need to know how tasks are displayed.

## How it works
- **Debounce** - every change to `query` starts a 500ms timer; when it fires with a non-empty query, `handleSearch` runs, otherwise results are cleared and the dropdown closes.
- **Search request** - `GET https://uatapi.garage.app/taskroom/v1/stages/task?roomId={roomId}&search={term}` with `Authorization: Bearer <localStorage garage_tok>`. If the response has a truthy `status` and an array `data`, it becomes the result list and the dropdown opens. Errors are only logged.
- **Dropdown** - shows "TASKS (n)" and, per task, the title, up to two tags and "Due MM/dd/yyyy" (via `date-fns` `format`), plus a coloured initial circle for the creator (`task.userId`) resolved from `employees` by `_id` (using `avatar` text or the first letter of `name`, and `color`, defaulting to grey). Clicking a result calls `onTaskClick(task)` and closes the dropdown.
- **Click outside** - a document `mousedown` listener closes the dropdown when clicking outside the component.
- A spinner shows in the input while a request is in flight.

## Exports
- `TaskSearch({ roomId, onTaskClick, employees }: TaskSearchProps)` - the search component.

## Interfaces
- **External services:** Taskroom API `GET https://uatapi.garage.app/taskroom/v1/stages/task` (task search by room).
- **Browser storage / cookies:** reads `localStorage` `garage_tok`.

## Dependencies
- **Internal:** `../types/kanban` (`Task`, `Employee`); shadcn `input`, `avatar`, `badge`; `@/lib/utils` (`cn`, imported but only used by commented-out code).
- **Packages:** `react`, `lucide-react` (`Search`, `Loader2`), `date-fns` (`format`), `js-cookie` (imported, unused).

## Used by
`componentsSymbol/kanban-board.tsx` on `/taskroom/all-taskrooms`.

## Notes
- No request cancellation: if an older search resolves after a newer one, its results overwrite the newer ones.
- Results that fail to parse as a date in `format(new Date(task.dueDate))` would throw during render.
- `getPriorityColor` is defined but its only use is commented out.
- Employee lookup here uses `_id`, whereas `task-card.tsx` uses `id`.
