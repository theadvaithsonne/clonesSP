# `app/(dashboard)/taskroom/all-taskrooms/components/TaskroomSubPage.tsx`

> The single-TaskRoom view: loads one room's details, stages, tasks and members from the external Taskroom API and renders them through the shared `KanbanBoard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1147

## Purpose
When `/taskroom/all-taskrooms` is opened with `?taskroomId=<id>`, the route page renders this component instead of the room grid. It acts as the data container for a room: it fetches the room header data, kanban stages with their first page of tasks, a flat list of tasks for list view, room members and the organisation's employees, holds all of that in state, and passes data plus setters and callbacks down to `KanbanBoard` (in `../componentsSymbol/kanban-board.tsx`), which does the actual board, list, task dialogs and stage management UI.

## How it works

### Module-level constants (L45-L116)
- `initialColumns` (Backlog / In Progress / Review / Done) and the empty `initialTasks` and `sampleUsers` arrays are leftovers; columns actually start empty and come from the API.
- `baseurl = "https://uatapi.garage.app/taskroom"` - the external Taskroom service.
- `currentUser` is a random fake user generated at module load (random id, name, avatar initials and a colour from `generateAccessibleColor`). It is passed to `KanbanBoard` as `currentUser` for the unused collaboration feature.
- Local interfaces `Workspace` (the room record: `name`, `description`, `color`, `userId` owner, `finalStageId`, `taskCount`, `conversationId`, `roomUsers`, ...), `PaginationMeta` and `ApiResponse`.

### State (L117-L183)
Notable pieces: `columns` (stages, each with a `tasks` array and `taskCount`), `stagePages` / `stageMeta` / `stageExhausted` (per-stage pagination), `stagecolumns` plus `nextPageToFetch` / `hasMore` / `isFetching` (flat list view), `members` plus `observerPage` / `observerHasMore` / `observerLoading` / `newCountMenmbers` (room members), `employees`, `workspace`, `subtasks`, dialog flags (`createTaskOpen`, `manageStagesOpen`), and `mounted` (set true when the employee fetch reports an expired token). `taskRoomId` is read from the `taskroomId` search parameter.

### Bootstrap and authorisation (L218-L293)
- On mount it decodes `localStorage["garage_tok"]` with `jwtDecode`. With `orgId` and `userId` present it calls `fetchEmployees()`, stores `userId`, and calls `fetchWorkspace(orgId, userId)`; `role` goes into `userRole`.
- `fetchWorkspace` requests `GET {baseurl}/v1/rooms/detail?orgId=&roomId=` (no auth header) and stores `data[0]` as `workspace`. Access is allowed when the user appears in `roomUsers` (by `userId`) or owns the room; otherwise it toasts "Unauthorized access" and pushes to `/all-taskrooms`.

### Stages and per-stage task paging (L315-L415)
- `fetchStagesAndTasks` (run once on mount) calls `GET {baseurl}/v1/stages/task?roomId=&size=30`. Each stage's embedded `paginatedTaskRecords` becomes its initial `tasks`, and every stage's page counter starts at 1.
- `fetchTasksForStage(stageId)` (passed to the board for infinite scroll inside a column) loads the next page with `GET {baseurl}/v1/tasks?roomId=&stageId=&status=active&size=30&page=`. It skips stages already marked exhausted, uses the cached `stageMeta` to stop early when `nextPage` is null or the next page exceeds `totalPages`, appends the new tasks to that column, and marks the stage exhausted when a page comes back empty or without a next page.
- `loadingStages` walks `GET {baseurl}/v1/stages?roomId=&status=active&size=15&page=` page by page with a 100 ms pause, but its column updates are commented out, so it currently fetches and discards the data.

### List view and members (L418-L511)
- `fetchListView(page)` runs once on mount with page 1: `GET {baseurl}/v1/tasks?roomId=&size=50&page=`, appending to `stagecolumns` and advancing `nextPageToFetch` until `nextPage` runs out. The board calls it again for more pages.
- `fetchMembers(page, append)` calls `GET {baseurl}/v1/users/roles?roomId=&size=50&page=`, replacing or appending `members` and setting `newCountMenmbers` to the length of the returned page. It re-runs from page 1 whenever `taskRoomId`, `columns` or `subtasks` change, so every task move or subtask change triggers a member refetch.

### Employees (L575-L625)
`fetchEmployees` reads `localStorage["garage_org_id"]` and calls `GET /backend/public/organizations/{orgId}/users` (`${NEXT_PUBLIC_API_URL}/public/...`, served by `server/routes/public.ts` with no authentication). User `_id` is renamed to `id`. If the response lacks `success`, it toasts "Expired token" and sets `mounted`, which switches the whole component to the "Session Expired" screen (L859-L913) with a "Sign In Again" button that pushes `/login`.

### Moving tasks (L631-L730)
`handleTaskMove(taskId, newColumnId, newIndex)` is optimistic:
1. Snapshots columns and the flat list, then moves the task in `columns`. A same-column move only reorders; a cross-column move removes it from the source (taskCount minus 1), inserts it at `newIndex` in the destination with the new `stageId` (taskCount plus 1).
2. Updates the task's `stageId` in `stagecolumns`.
3. For cross-column moves, calls `PUT {baseurl}/v1/tasks/move/{taskId}` with `{ stageId }`. A non-OK response or `status: false` rolls both state arrays back and toasts "Failed to move task".

### Other callbacks (L747-L833)
- `handleCreateTask(taskData)` - appends a newly created task to its stage (incrementing `taskCount`) and to the flat list.
- `handleUpdateColumns(newColumns)` - replaces columns after stage management and reassigns tasks whose column disappeared to the first column (applies to the unused `tasks` state).
- `handleUpdateTask`, `handleAddTask`, `handleDragStart`, `handleDragEnd` - no-ops or operate only on the unused `tasks` state.

### Header and derived values (L834-L1027)
- Progress: `totalTasks` sums every stage's `taskCount`; "done" is the **last** column's `taskCount` (not the stage named "Done"); the percentage drives a bar coloured by `workspace.color` via `colorStyles`.
- The header shows a back link to `/taskroom/all-taskrooms`, room name and description, member count (`newCountMenmbers`), task count and progress, plus **Add New Task** (opens the board's create dialog) and **Customize Stages** (opens stage management). A skeleton header shows while `loading`.
- A skeleton board (L1033-L1088) overlays while `isLoading`.

### KanbanBoard wiring (L1089-L1141)
Everything above is passed as props: columns and `setColumns`, the move/create/update callbacks, `fetchTasksForStage`, `stageExhausted`, list-view state and `fetchListView`, members and `fetchMembers` with its observer state, employees, `userId`, `userRole`, `workspaceUserId` (room owner), `conversationId`, `taskRoomId`, dialog open flags and setters, and `subtasks` / `setSubtasks`.

## Exports
- `default Home()` - the room view component (imported by the page as `TaskroomDashboardSunpage`).

## Interfaces
- **Backend endpoints called:** `GET /backend/public/organizations/{orgId}/users` - organisation employee list for assignee pickers.
- **External services:** Taskroom API at `https://uatapi.garage.app/taskroom/v1/` - `rooms/detail`, `stages/task`, `stages`, `tasks`, `tasks/move/{id}`, `users/roles`. None of these requests send an Authorization header.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base for the employee list.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` (decoded for `orgId`, `userId`, `role`) and `localStorage["garage_org_id"]`.

## Dependencies
- **Internal:** `../componentsSymbol/kanban-board.tsx` - board, list view and task dialogs; `../types/kanban.ts` - `Task`, `Column`, `User`, `DragEvent`, `Employee`, `Member`, `Subtask` types; `components/ui/button.tsx`, `components/ui/skeleton.tsx` - UI. Also imported but unused: `../componentsSymbol/manage-stages-dialog.tsx`, `lib/api-config.ts` (`buildExternalUrl`), `utils/api.ts` (`authenticatedFetch`).
- **Packages:** `jwt-decode` - token claims; `sonner` - toasts; `next` - `useRouter`, `useSearchParams`; `react-intersection-observer` - `useInView` ref on the root (its `inView` value is unused); `lucide-react` - icons; `react`; `js-cookie` (unused).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/page.tsx` - rendered at `/taskroom/all-taskrooms?taskroomId=<id>`.

## Notes
- **Authorisation is client-side only.** The membership check runs in the browser after an unauthenticated fetch of the room; the Taskroom API itself is called without a token, so the check is cosmetic.
- The unauthorised redirect and the search links go to `/all-taskrooms`, which is not a route in this project (see `search-result-item.tsx.md`).
- `/backend/public/organizations/{orgId}/users` is a public endpoint that returns organisation users without authentication.
- `fetchStagesAndTasks` and `fetchListView` use the `taskroomId` captured on first render; navigating to another room without remounting will not reload stages.
- Many leftovers: dozens of `console.log` calls with nonsense labels run on every render; `handleLogout` does not actually log out; `isConnected` is never set true; `ManageStagesDialog`, `useParams`, `Cookies`, `authenticatedFetch` and `buildExternalUrl` are imported but unused.
