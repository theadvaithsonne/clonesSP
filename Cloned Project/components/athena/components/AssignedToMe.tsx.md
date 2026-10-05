# `components/athena/components/AssignedToMe.tsx`

> Cross-workspace "Assigned To Me" and "All Tasks" lists for the Athena/Taskroom module: a paginated, filterable task table with inline stage changes that opens each task in the shared Kanban `CardModal`.

**Kind:** React component · **Lines:** 1211

## Purpose
Athena boards are organised as workspace → space → room → stage, and normally you browse one room's Kanban at a time. This file gives a single list of the current user's tasks across every workspace. It drives two sidebar entries in `ProjectMangement.tsx`:
- **Assigned To Me** (default export): tasks assigned to the user.
- **All Tasks** (`AllTasks`): tasks assigned to the user or created by them.

Both are thin wrappers around one internal `MyTaskList` component, configured through the `SCOPES` table. All data comes from the external Taskroom API.

## How it works

### Configuration (L29-L89)
- `TASKROOM_BASE` is `NEXT_PUBLIC_TASKROOM_URL` with exactly one trailing slash, falling back to `https://uatapi.garage.app/taskroomv2/v2/`.
- Page sizes: 30 rows per list page, 10 per dropdown page. Workspace-name lookup fetches up to 5 pages of 100. The search box is debounced by 400 ms.
- `SCOPES` sets each tab's title, subtitle, empty-state text, icon and endpoint:
  - `assigned`: `tasks/user/:userId/assigned`.
  - `all`: `tasks/me` with a fixed `type=all`.
- `PRIORITY_COLORS` maps urgent/high/medium/normal/low to dot colours. `STATUS_OPTIONS` is a static Active/Inactive list.

### API and mapping helpers (L118-L258)
- `authHeaders()` returns a bearer header from `localStorage["garage_tok"]`.
- `asObject`/`refId` normalise Mongo-style references, which can arrive as a bare id, a populated object, or a one-element `$lookup` array.
- `extractRows` finds the row array in the various response shapes (`[]`, `data`, `data.data`, `data.tasks`).
- `extractMetadata` reads `count`/`totalPages`/`currentPage`. When metadata is missing it offers a "next" page only if a full page came back.
- `hasMorePages` drives dropdown infinite scroll from `nextPage`, `totalPages`, or a full page.
- `mapAssignedTask` flattens a raw row into `AssignedTask`:
  - Fields: id, title, workspace/space/room/stage ids and names, stage colour, priority, due date in ms, and `isCompleted`.
  - Several alternate field names are accepted (`task`, `taskDetails`, `*Data`, populated `*Id`).
  - The list endpoints populate stage, room and space but send `workspaceId` as a bare id, so workspace names are resolved separately.
- `fetchPickerPage(path, params, page, search)` loads one page of dropdown options (search goes in `searchData`) and throws when the payload has `status: false`.
- `fetchWorkspaceNames()` pages through `workspaces/me` to build an id → name map.
- `toBoardTaskShape` converts the `GET tasks/:id` response to the shape `CardModal` expects: `tags` and `assignedToIds` become id arrays, and the populated objects move into `tagData`/`assigneeData`.
- `fetchRoomStages(roomId, page)` lists the active stages of a room.
- Formatting helpers:
  - `fmtDueDate` shows "Jan 5"; the year is added only when it differs from the current year.
  - `capitalize`.
  - `pageWindow` builds compact page numbers such as `1 … 4 5 6 … 12`.

### `PaginatedPicker` (L290-L543)
A Radix `Popover` dropdown that loads options page by page:
- Loads page 1 when it opens and appends more pages through an `IntersectionObserver` sentinel inside the scroll area. Duplicate options are removed by `_id`.
- Changing `resetKey` (for example, a new parent workspace) discards loaded options.
- Searches on the server with `serverSearch` (debounced 300 ms); otherwise it filters loaded options locally.
- A `requestIdRef` counter drops stale responses. On error it shows a Retry button and arranges for the next open to retry.
- Optional "All …" entry (`allLabel`) to clear the selection, and colour dots for options that have a colour.

`filterButton(label, selected, disabled)` renders the trigger chip, highlighted in yellow when a value is set.

### `MyTaskList` (L574-L1210)
- **Who the user is (L578-L598):** the Taskroom user id comes from `useUserStore().userProfile._id`, falling back to the `TaskRoomUserDetails` cookie. If neither exists, it calls `fetchUserProfile()` once. Rendering waits for the profile, and a failed lookup shows a Retry state.
- **Filters (L600-L741):** Status, Workspace, Space, Room and Stage, plus a debounced search box. Choosing a parent clears its children; for example, a new workspace resets space, room and stage. Space, Room and Stage stay disabled until their parent is chosen. Every filter change returns to page 1, and "Clear filters" resets everything.
- **Loading (L636-L670):** builds the query (`page`, `size`, plus `status`, `workspaceId`, `spaceId`, `roomId`, `stageId`, `searchData` when set) and calls the scope's endpoint. The request counter `requestSeqRef` discards out-of-order responses. `reloadKey` forces a refetch (Refresh button, retry, modal close). The list scrolls to the top on every page change.
- **Workspace names (L676-L695):** fetched once per user. Failure is ignored because the name is only cosmetic.
- **Inline stage change (L743-L768):** each row's stage pill is a `PaginatedPicker` over the room's active stages. Picking a stage updates the row optimistically and calls `useCardStore.getState().updateCard(taskId, { stageId })`, which sends `PUT tasks/:id`. If that fails, the row reverts; the store has already shown the error toast. A per-row spinner is tracked in `updatingIds`.
- **Edit modal (L770-L821):** clicking a row (or pressing Enter/Space on it) fetches `GET tasks/:id`, converts the response with `toBoardTaskShape` and `transformCard`, and opens `CardModal`. The modal gets the task's room as `boardId`, and its workspace, space and source names as `roomContext`. Opening is guarded so only one task loads at a time.
  - `handleCardPatched` copies modal edits (title, priority, completion, due date, stage) into the row immediately.
  - Closing the modal triggers a reload, so deletes and unassigns disappear from the list.
- **Render (L823-L1209):**
  - Header: icon, title, live task count, Refresh button.
  - Filter bar.
  - A sticky column header on desktop (Task | Source | Stage | Priority | Due date, through the `ROW_GRID` Tailwind grid). On mobile, rows stack.
  - Skeleton rows while loading; error and empty states with Retry or Clear filters.
  - Each row shows a completed check, the title, the Workspace › Space › Room breadcrumb, the stage pill (its clicks do not open the modal), the priority dot, and the due date (red when overdue and not completed).
  - Footer: "Showing a–b of N" with numbered pagination.

## Exports
- `default AssignedToMe()` - renders `MyTaskList` with scope `"assigned"`.
- `AllTasks()` - renders `MyTaskList` with scope `"all"`.

## Interfaces
- **External services (Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`):**
  - `GET tasks/user/:userId/assigned` - the assigned list.
  - `GET tasks/me?type=all` - the all-tasks list. Both lists accept the paging and filter parameters above.
  - `GET workspaces/me`, `GET spaces/me?workspaceId`, `GET rooms/me?spaceId`, `GET stages?roomId&status=active` - dropdown options and workspace names.
  - `GET tasks/:id` - full task for the modal.
  - `PUT tasks/:id` - stage change, sent through `cardStore.updateCard`.
  - `GET users/profile` - through `userStore.fetchUserProfile`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base URL.
- **Browser storage / cookies:**
  - Reads `localStorage["garage_tok"]` for the bearer token.
  - Reads the `TaskRoomUserDetails` cookie (JSON with `_id`) as a fallback user id. `fetchUserProfile` writes this cookie.

## Dependencies
- **Internal:**
  - `components/athena/components/card-modal.tsx` - `CardModal` and `RoomContext`, the task editor.
  - `components/athena/components/Dashbaord.tsx` - `transformCard` and the `Card` type.
  - `store/athena/userStore.ts` - the Taskroom profile.
  - `store/athena/cardStore.ts` - `updateCard`.
  - `store/taskroom/taskroomWorkspace.tsx` - `setColumns`, passed to `CardModal`.
  - `components/ui/popover.tsx`, `components/ui/skeleton.tsx` - UI primitives.
  - `lib/utils.ts` - `cn`.
- **Packages:**
  - `axios` - HTTP requests.
  - `js-cookie` - reads the user cookie.
  - `lucide-react` - icons.
  - `react` - hooks.
  - `sonner` - error toasts.

## Used by
- `components/athena/ProjectMangement.tsx` - imports `AssignedToMe` and `{ AllTasks }` and renders them when the active project item is `"AssignedToMe"` or `"AllTasks"`.

## Notes
- `CardModal` is opened with `orgId=""` and `connected={false}`, so whatever real-time or org-scoped behaviour the modal has on a board is not active here.
- `cardStore.updateCard` builds its URL from `NEXT_PUBLIC_TASKROOM_URL` with no fallback. If that variable is unset, the stage change fails, while this file's reads still work through the uatapi fallback.
- The Status filter is a static Active/Inactive list sent as `status`. Whether the backend filters task status or something else by it is decided by the external API.
