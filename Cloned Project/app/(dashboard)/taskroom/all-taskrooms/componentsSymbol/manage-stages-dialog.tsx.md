# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/manage-stages-dialog.tsx`

> Modal dialog for viewing, adding, renaming, deleting and drag-reordering the workflow stages (kanban columns) of a Taskroom, persisted to the external Taskroom API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 626

## Purpose
Each Taskroom board is a set of stages (columns) that tasks move through. The kanban board opens this "Manage Workflow Stages" dialog so the user can customise those stages. The column list is owned by the parent (`kanban-board.tsx`) and passed in together with its `setColumns` setter; this dialog mutates that state optimistically and calls the Taskroom service at `https://uatapi.garage.app/taskroom` (hardcoded as `baseurl`, L33), which is an external service, not part of this repo's backend.

## How it works

### The "last stage" rule
`isLastStage(column)` (L87) is true for the final column in the array. The last stage is treated as a fixed terminal stage (a "Done" column): it cannot be dragged, cannot be a drop target, and its delete button is disabled. New stages are always inserted just before it.

### Adding a stage (L117-L181)
`handleAddStage` rejects an empty name, then calls `createStage` with `{ name, color, roomId: taskRoomId, userId }`. The colour is picked round-robin from the local `stageColors` palette (seven semi-transparent hex colours) using `(columns.length - 1) % stageColors.length`. `createStage` sends `POST {baseurl}/v1/stages`; when the response has a truthy `status`, it builds a column from `response.data.data` (name, color, type, orderId, roomId, userId, status, `_id`, timestamps, empty `tasks`) and splices it in before the last column. The Add button is disabled while `addStageloading` is true.

### Renaming a stage (L199-L262)
The pencil button calls `handleEditStage`, which puts that row into edit mode (`editingId`, `editingName`) and shows an input plus X / check buttons. The check button calls `handleEditTaskRoom(id)`, which sends `PUT {baseurl}/v1/stages/{id}` with `{ name }` and, on success, updates the column name locally and exits edit mode. X just clears `editingId`. The input's `onBlur` calls `handleSaveEdit`, which is an empty stub.

### Deleting a stage (L88-L116)
The trash button calls `handleDeleteTaskRoom(id)`: `DELETE {baseurl}/v1/stages/{id}`, then removes the column from local state on success. On failure it shows the server message via `toast.success` (the success style). While the request runs, the list shows three skeleton rows (`stageloading`).

### Drag-to-reorder (L281-L446)
Rows use native HTML5 drag events (not dnd-kit):
- `handleDragStart` records `draggedIndex` (skipped for the last stage).
- `handleDragOver` allows the drop and auto-scrolls the list container (`optionsListRef`) when the pointer is within 50px of its top or bottom edge, using a 50ms `setInterval` stored in `scrollIntervalRef`.
- `handleDrop` moves the dragged column to the drop position within the array (never past the last stage) and calls `setColumns`.
- `handleDragEnd` clears the scroll interval, builds a position map `{ [stageId]: index + 1 }` from the current `columns`, and sends `PUT {baseurl}/v1/stages/reposition/{taskRoomId}` with `{ positionData }`. On a non-OK or `status: false` response it restores the copy of `columns` taken at the start of the handler.

### Closing
"Done" calls `onUpdateColumns(columns)` and closes the dialog. A help text explains the rules shown to the user.

## Exports
- `ManageStagesDialog(props: ManageStagesDialogProps)` - the dialog component. Props: `open`, `onOpenChange`, `columns`, `onUpdateColumns`, `setColumns`, `currentPage`, `hasMore`, `isStageLoading` (shows "Loading more stages..."), `userId`, `setHasMore`, `setCurrentPage`, `taskRoomId`.

## Interfaces
- **External services:** Taskroom API at `https://uatapi.garage.app/taskroom` -
  - `POST /v1/stages` - create a stage
  - `PUT /v1/stages/{id}` - rename a stage
  - `DELETE /v1/stages/{id}` - delete a stage
  - `PUT /v1/stages/reposition/{taskRoomId}` - save stage order
  
  None of these requests send an auth header or cookie token.

## Dependencies
- **Internal:** `../types/kanban` (`Column`); `@/components/ui/button`, `dialog`, `input`, `label` - shadcn UI primitives.
- **Packages:** `react` (state, refs); `lucide-react` (icons); `sonner` (toasts); `react-intersection-observer` (`useInView` attached to the list, currently unused because the infinite-load effect is commented out).

## Used by
`componentsSymbol/kanban-board.tsx` renders it. `components/TaskroomSubPage.tsx` also imports it. Reached via the `/taskroom/all-taskrooms` page.

## Notes
- **Dead code:** `handleDeleteStage` (a local-only delete that moved tasks to the first stage), `handleSaveEdit` (empty), `handleDragEndas` (an older reposition call that sends a misspelled `postitionData` key), the commented-out keypress handler and infinite-scroll effect. `currentPage`, `hasMore`, `setHasMore`, `setCurrentPage` are accepted but not used.
- The help text says tasks from deleted stages move to the first remaining stage; the live delete path (`handleDeleteTaskRoom`) does not do that on the client, so it depends on the server.
- `handleDragEnd` fires on every drag end, even if nothing moved, so a reposition request goes out each time.
- Several leftover `console.log` calls print columns and the room id on every render.
- Errors in the edit, delete and reposition handlers are rethrown after logging, which surfaces as unhandled promise rejections in the browser.
