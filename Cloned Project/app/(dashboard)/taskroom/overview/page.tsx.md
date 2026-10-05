# `app/(dashboard)/taskroom/overview/page.tsx`

> Client-side Taskroom "Overview" dashboard: stat cards, a per-taskroom stage breakdown and a "Tasks Assigned to Me" list, all loaded from the external Taskroom API.

**Kind:** Next.js page · **Lines:** 761 · **Route:** `/taskroom/overview`

## Purpose
Taskroom is Garage's kanban-style task manager. Its data does not live in this repo's backend: it comes from the external service at `https://uatapi.garage.app/taskroom`. This page is the landing dashboard for the Taskroom section. It shows task totals for one selected taskroom, how many tasks sit in each stage, and the tasks assigned to the current user that are due today, in two days or next week. It also embeds the shared Taskroom search box.

## How it works

### Identity (L84-L127)
The page has no auth context. It reads the JWT from `localStorage["garage_tok"]` and decodes it with `jwtDecode`, without verifying it. It needs two claims, `orgId` and `userId`. When both are present it stores them in state, calls `fetchTasks(userId, "today")` and then `fetchTaskRooms(orgId, userId)`.

There are **two near-identical mount effects**. The first checks `payload.organizationId` before it loads rooms. That claim is probably never present, so the first effect usually loads tasks only. The second checks `payload.orgId`, so it loads both tasks and rooms. As a result, `fetchTasks(..., "today")` normally runs twice on mount. `jwtDecode` is called outside the `try`, so a malformed token throws during the effect.

### Data loading
- **`fetchTaskRooms(orgid, userId)`** (L168-L211): makes one `GET .../v1/rooms?orgId=&page=1&size=200&userId=` and puts the result in `taskRooms`. If no room is selected yet (`stageId` is empty), it selects the first room and calls `fetchStagesRoom` for it. On failure it shows the toast "Invalid task room response".
- **`fetchStagesRoom(roomId)`** (L131-L165): makes one `GET .../v1/stages?roomId=&status=active&size=200&page=1`. It saves the stages (`Column[]`, each with a `taskCount`) to `stagesByRoom` and saves the response's `overDueCount` to `taskOverDue`.
- **`fetchTasks(id, filter)`** (L215-L252): calls `GET .../v1/tasks/assigned/{id}?size=500&page=1&dueIn={filter}&currentDate={local midnight ms}`. `filter` is one of `today`, `next-two-days` or `next-week`. The result is stored in `columns`, which holds tasks despite its name. On a non-OK response it shows a toast but still tries to parse the body. If the new response is empty, the previous list stays on screen because state is not reset.

All three functions keep page counters (`stagePage`, `totalPages`, and so on) but never loop, so they load only the first page of 200 or 500 items.

### Derived numbers (L261-L310)
- **Total Tasks** = sum of `taskCount` over every stage of the selected room.
- **Completed** = `taskCount` of the **last** stage. The code assumes the final column is "Done".
- **In Progress** = total − completed.
- The progress bar percentage (`incompletePercentage`) is actually the completed share: `completed / total`.
- **Overdue** card shows `taskOverDue` from the stages response. A local `overdueCount` is also computed from assigned tasks (due before local midnight and not completed), but it is never rendered.
- `filtered` (tasks whose `startDate` is after today) is computed and logged but never used.

### UI
- A header, then `SearchList` with the decoded `userId`/`orgId`. SearchList searches the external `.../taskroom/v1/rooms/search` endpoint.
- Four stat cards. Each shows a grey placeholder block while `isLoading` is true.
- **Task Status Overview** card: a Radix `Select` of taskrooms. It has a search input inside the dropdown that filters rooms by name through `stageSearch`, even though the placeholder says "Search stages...". Picking a room calls `fetchStagesRoom`. Below it, each stage is listed with its colour dot and task count, with skeleton rows while loading.
- **Tasks Assigned to Me** card: a count badge and three tab buttons. `handleTabChange` refetches with the chosen `dueIn`. Each task row shows a stage-colour dot, title, priority pill, start date and due date. The due date turns red when it is before today. Rows look clickable but have no click handler.
- The "Recent Activity" section (L710-L757) is commented out and refers to a `mockData` object that does not exist.

## Exports
- `default TaskroomOverviewPage()` - the page component. Takes no props.

## Interfaces
- **Backend endpoints called:** none in this repo. All calls go to an external service (below).
- **External services:** Taskroom API at `https://uatapi.garage.app/taskroom` (hardcoded `baseurl`, L54):
  - `GET /v1/rooms?orgId&page&size&userId` - the user's taskrooms
  - `GET /v1/stages?roomId&status=active&size&page` - stages with `taskCount`, plus `overDueCount`
  - `GET /v1/tasks/assigned/{userId}?size&page&dueIn&currentDate` - tasks assigned to the user

  None of these requests sends an Authorization header.
- **Browser storage / cookies:** reads `localStorage.garage_tok` (the Garage session JWT) and decodes the `orgId` and `userId` claims.

## Dependencies
- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/components/search-list.tsx` - global taskroom/task/subtask search box
  - `app/(dashboard)/taskroom/overview/types/kanban.ts` - `Task` and `Column` types. `User`, `DragEvent`, `Employee`, `Department` and `Member` are imported but unused.
  - `components/ui/card.tsx`, `button.tsx`, `select.tsx`, `input.tsx`, `avatar.tsx` - shadcn UI primitives. `Button` and `Avatar` are imported but not rendered.
- **Packages:**
  - `react` - state and effects
  - `jwt-decode` - reads the token claims
  - `sonner` - toasts
  - `lucide-react` - icons
  - `js-cookie` - imported but unused

## Used by
- Reached at the URL `/taskroom/overview`. It is linked from `app/(dashboard)/taskroom/components/sidebar.tsx`, `components/dashboard/backOfficeAppSideBar.tsx`, `lib/taskroomApps.ts` and the docs chapter `app/docs/content/chapters/07-work.ts`.
- `app/(dashboard)/layout.tsx` imports it as `Overview` (L81), but the only use is inside a commented-out `case "Overview"`, so that import is effectively dead.

## Notes
- The external API base URL is hardcoded to the UAT host (`uatapi.garage.app`). There is no environment variable for it.
- Many leftover `console.log` calls with random labels run on every render and log the decoded JWT payload.
- The local `JwtPayload` interface is declared twice (module level and inside the component). Many imports and helpers are unused: `getPriorityColor`, `overdueCount`, `filtered`, `hasMore`, `useCallback` and `useRef`.
- Stage "completed" counting depends on stage order, so a room whose last stage is not "Done" shows wrong numbers.
