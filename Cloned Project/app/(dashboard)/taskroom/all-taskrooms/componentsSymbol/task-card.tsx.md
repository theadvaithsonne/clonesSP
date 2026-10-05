# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/task-card.tsx`

> Draggable kanban card for one Taskroom task, showing title, description, priority, tags, assignee, a due-status line and the creator.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 262

## Purpose
Every task inside a kanban column of the Taskroom board is rendered as a `TaskCard`. It plugs into the board's `@dnd-kit` sortable context so cards can be dragged between columns, and opens the task editor when clicked. It is purely presentational: it makes no network requests and owns no state beyond what `useSortable` provides.

## How it works
- **Drag support** - `useSortable({ id: task._id || "" })` supplies attributes, listeners, the node ref, transform and transition. The card spreads the listeners on itself, so the whole card is the drag handle. While dragging (either `useSortable`'s `isDragging` or the `isDragging` prop) it fades and scales up.
- **Click** - `handleClick` calls `onClick` (and stops propagation) only when the card is not being dragged.
- **Collaborative drag highlight** - if `activeDrag` is supplied (another user moving this card), the border and a translucent shadow use `activeDrag.userColor`. The "X is moving this" badge is commented out. `activeDrag` uses a local `DragEvent` type with `userName` and `userColor`.
- **Content** - priority badge (top-right, colour by `high`/`medium`/`low`), title, description, tag badges, assignee avatar initial and name, and "Created By" from `task.userId`. Names are resolved by `getEmployeeName`, which matches `Employee.id` and returns "Unassigned" when nothing matches.
- **Status line** - colour and text come from the server-computed `task.isOverDue` flag: red "Overdue" or green "On Time". If `task.stageId` equals a hardcoded stage id (L230), the green text reads "Completed" instead of "On Time".
- `checkIfOverdue(dueDate)` computes a formatted date and a local overdue flag, but its result is not rendered (the date block and the line that used it are commented out). `formatDate` and `getStageName` are also unused.

## Exports
- `TaskCard(props: TaskCardProps)` - props: `task: Task`, `index: number`, `isDragging?`, `activeDrag?: { userName, userColor }`, `onClick?`, `employees: Employee[]`, `stageList: Column[]`.

## Dependencies
- **Internal:** `../types/kanban` (`Employee`, `Task`, `Column`); shadcn `card`, `badge`, `avatar`.
- **Packages:** `@dnd-kit/sortable` (`useSortable`), `@dnd-kit/utilities` (`CSS.Transform`), `lucide-react` (icons imported, mostly unused), `date-fns` (`format` imported, unused), `react` (types).

## Used by
`componentsSymbol/kanban-board.tsx` (drag overlay), `componentsSymbol/kanban-column.tsx`, `componentsSymbol/duplicatkancolum.tsx`; all on `/taskroom/all-taskrooms`.

## Notes
- The "Completed" label depends on a hardcoded Mongo stage id (`690894bbc17656bc8b009fc4`) from one environment; on any other room the final stage will still say "On Time".
- Two `console.log` calls print the employee list and the task on every render, which is noisy with many cards.
- When `task._id` is missing, `useSortable` receives an empty string id, so several such cards would collide.
