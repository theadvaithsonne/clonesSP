# `components/athena/ProjectMangement.tsx`

> The Taskroom (project management) shell: it switches between workspace-level pages (people, settings, timesheets, assigned tasks, import/export) and the per-room board views, and hosts the "Ask AI", "Members" and "Create task" overlays.

**Kind:** React component · **Lines:** 1001

## Purpose
Taskroom is Garage's Trello/ClickUp-style task board, backed by an external service (the "taskroom v2" API at `uatapi.garage.app`). This file is the top-level container the dashboard layout renders when the user opens the "Taskroom" page. It does not hold board data itself. It reads which section is active from the zustand store `useTaskroomWorkspacetore` (`projectActiveItem`), renders the matching child page from `components/athena/components/`, and adds the room header toolbar (Refresh, Ask AI, Members). The file name is misspelled ("Mangement") and the import paths depend on that spelling.

## How it works

### Module-level helpers (L50-L75)
- `ChatMessage`: `{ role: "user" | "assistant"; content: string }`, the shape of the Ask AI conversation.
- `ANCHORED_PANEL_Z = 10060`: the z-index for the right-hand drawers, so they sit above the dashboard chrome.
- `MEMBERS_PAGE_SIZE = 25`: the page size for the members list.
- `TASKROOM_BASE`: `NEXT_PUBLIC_TASKROOM_URL`, or `https://uatapi.garage.app/taskroomv2/v2/` if that is unset. Trailing slashes are normalised to exactly one.
- `hasMoreMembers(meta, currentPage)`: returns true when the API metadata has a `nextPage`, or when `currentPage < totalPages`.

### `RightSideDrawerPortal` (L77-L137)
A generic drawer portalled to `document.body`. It measures `headerRef.current.getBoundingClientRect().bottom` and starts the panel just below the Taskroom header. It re-measures on window `resize` and on `scroll` in the capture phase, so the header stays visible. A semi-transparent backdrop closes the drawer when clicked. Wheel and touch-move events are stopped inside the panel so the page behind does not scroll. It renders nothing on the server (no `document`) or while closed.

### `AskAIDrawer` (L139-L344)
A chat panel, 380 px wide, about the current room.
- The conversation and input are cleared whenever `roomId` changes.
- The chat container (not the page) auto-scrolls to the bottom as messages arrive.
- The "Project Update" card sends the fixed prompt `"Give me a full project update"`.
- `handleSend` appends the user message and POSTs `{ roomId, messages }` to the Next.js route `/api/taskroom/ask-ai`, sending `Authorization: Bearer <localStorage garage_tok>`. It then appends `data.reply`, or `data.error` when the response is not OK. A network failure adds a fixed error message to the chat.
- Enter sends and Shift+Enter adds a newline. The textarea grows to at most 120 px.
- The server route holds the OpenAI key. It loads the board through the taskroom API using the caller's token, which also checks that the caller can see the room, and builds the system prompt. The browser never sees the board-context prompt or the key.

### `AssigneesDrawer` (L345-L575)
A paginated, searchable list of the room's members.
- Each open resets the search. Typing is debounced by 300 ms.
- `fetchMembers(page, search, append)` calls `GET ${TASKROOM_BASE}room/members?roomId=&page=&size=25[&search=]` with the `garage_tok` bearer token. Rows come from `json.data.data` and pagination from `json.metadata` (`count`, `totalPages`, `currentPage`, `nextPage`).
- Refs (`loadingRef`, `pageRef`, `debouncedSearchRef`, `metadataRef`) mirror state so the IntersectionObserver callback never reads stale values. `loadingRef` also stops two fetches from running at once.
- Infinite scroll: an IntersectionObserver, rooted on the scroll container, watches a 1 px sentinel at the bottom and loads `page + 1` while `hasMoreMembers` is true. Appended rows are de-duplicated by `_id`.
- Each row shows `userData.image` or coloured initials, plus the name, email and `role` badge. "All members loaded" appears once nothing more is left to fetch. A failed first-page fetch clears the list.

### `ProjectManagement`, the default export (L577-L891)
**Store state used:** `projectActiveItem`, `setProjectActiveItem`, `loadShareTaskDeepLink`, `currentRoomDetail`, `wsrKLoading`, `activeSpaceId`, `currentWorkspace`, `memberData` and `fetchBoardByRoomsDetails` from `useTaskroomWorkspacetore`, plus `fetchUserProfile` from `useUserStore`.

**Derived values:**
- `currentSpaceId` comes from the store's `activeSpaceId`, then the `?spaceId` query param, then `currentRoomDetail.spaceId`.
- `roomId` comes from `?roomId` when a `?shareTask` link is open, otherwise from `currentRoomDetail._id`.
- `canManageWorkspaceSettings` is true when the workspace member role is `admin` or `owner`, or when `MemberDetail.isOwner` is set.
- `isRoomReadOnly` comes from `isRoomObserver(currentRoomDetail, memberData)`. It is true when the room role is `observer`.

**Effects:**
- `useLinkedService(currentRoomDetail?._id)` checks whether the room belongs to a service engagement. Ordinary rooms resolve to `null`. If the user is on the "Service" tab when the room stops being linked, the view falls back to "Board".
- Switching rooms always resets the view tab to "Board".
- **Share-task deep link:** when `?shareTask` is present together with `workspaceId`, `spaceId` and `roomId`, the component calls `fetchUserProfile()` once. It confirms `useUserStore.getState().isUserProfileFetched`, then calls `loadShareTaskDeepLink({ shareTaskId, workspaceId, spaceId, roomId })`. `shareTaskLoadedRef` stops repeat runs and is reset on failure, so a later render can try again.
- When `projectActiveItem` is empty it defaults to `"WorkspacePeople"`. `"WorkspaceSettings"` is forced back to `"WorkspacePeople"` for users who are not admins.
- It listens for the window CustomEvent `taskroom:open-create-task`, whose detail is `{ dueDateMs?, hideSubtask?, defaultToCurrentRoom? }`. The event opens `CreateTaskDialog` with those presets, but only when a space is known and the room is not read-only. `CalendarView` dispatches this event.

**`handleRefreshBoard`** calls `fetchBoardByRoomsDetails(roomId, 1, 30, "ascs")` and keeps `isRefreshingBoard` set while the call runs. It is shown only on the Board tab.

**Section routing (`renderContent`, by `projectActiveItem`):**
| Value | Renders |
|---|---|
| `WorkspacePeople` (and the default) | `PeoplePage` (`WorkspacePeopleDashboard`) |
| `WorkspaceSettings` | `SettingPage` with `setActivePopover` and `setActiveItem` for admins and owners; `PeoplePage` for everyone else |
| `TimeSheets` | `TimeSheets` |
| `AssignedToMe` / `AllTasks` | `AssignedToMe` / `AllTasks` (the header breadcrumb is hidden, because these lists cover every room) |
| `ImportExport` | `ImportExportDashboard` |
| `DashMangement` | `ProjectHeader` tabs, the active room view and `CustomizeViewDrawer`. Nothing renders while no room is selected |

**View routing (`mode`, by `activeTab`):** Board -> `DahboardMangement`, Gantt -> `Gantt`, Calendar -> `CalendarView`, List -> `ListView`, Sheets -> `SheetsView`, Figma -> `Figmaview`, Notion -> `Notionview`, Youtube -> `Youtubeview`, GoogleCalendar -> `GoogleCalendarview`, Service -> `ServiceRoomPanel linked={linkedService}`.

**Layout:** `WorkspaceLoading` covers the view while `wsrKLoading` is true. The header (`headerRef`) holds `WorkspaceSidebar`, a workspace/space/room breadcrumb picker. In `DashMangement` mode with a room selected, the header also shows the Refresh (Board tab only), Ask AI and Members buttons, and each button sits next to its drawer. `CreateTaskDialog` is mounted only when `currentSpaceId` is set and the room is not read-only. Closing the dialog resets its presets.

### `ProjectHeader` (L893-L1001)
The tab strip for a room: Board, List, Calendar and Gantt, plus Service when `hasLinkedService` is true. The active tab has a yellow (`#FACC15`) underline, and the strip scrolls sideways on small screens. The Sheets/Figma/Notion/YouTube/Google Calendar tabs and a room avatar/title breadcrumb block are commented out. `currentWorkspace` from `useWorkspaceStore`, plus `roomId` and `roomAvatarUrl`, are computed but used only by that commented-out code.

## Exports
- `default ProjectManagement({ setActivePopover, setActiveItem }: any)`: the Taskroom shell. Both props are passed through to `WorkspaceSettingsDashboard`.

Everything else (`RightSideDrawerPortal`, `AskAIDrawer`, `AssigneesDrawer`, `ProjectHeader`, `hasMoreMembers`) is module-private.

## Interfaces
- **Backend endpoints called:**
  - `POST /api/taskroom/ask-ai` (a Next.js route handler in this repo, `app/api/taskroom/ask-ai/route.ts`): Ask AI chat. It needs a bearer token and a 24-hex `roomId`, and calls OpenAI on the server.
  - `GET /backend/services/by-taskroom/:roomId?orgId=...` (indirectly, via `useLinkedService` -> `getServiceByTaskroom`). It is served by `server/routes/service.ts`, mounted at `/services`, and tells whether the room is a service engagement.
- **External services:** the Taskroom v2 API (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`), called directly at `GET room/members` and indirectly through store actions (`fetchBoardByRoomsDetails`, `loadShareTaskDeepLink`, user profile).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` sets the Taskroom API base URL.
- **Browser storage / cookies:** reads `localStorage.garage_tok` and sends it as the bearer token.
- **Window events:** listens for `taskroom:open-create-task` (CustomEvent).
- **URL query params:** `shareTask`, `workspaceId`, `spaceId`, `roomId`.

## Dependencies
- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx`: `useTaskroomWorkspacetore` (active section, current room, loading flag, board and deep-link actions) and `isRoomObserver`.
  - `store/taskroom/workspaceStore.ts`: `useWorkspaceStore`, used only for the unused `currentWorkspace` in `ProjectHeader`.
  - `store/athena/userStore.ts`: `useUserStore` (`fetchUserProfile`, `isUserProfileFetched`), loaded before deep links.
  - `components/athena/components/*`: the section pages and board views listed above, plus `workspacesidebar` (header picker), `CustomizeViewDrawer` and `CreateTaskDialog`. `CustomizeViewButton` is imported but its only use is commented out.
  - `components/athena/components/import-export/ImportExportDashboard.tsx`: the Import/Export section.
  - `components/dashboard/service-taskroom/ServiceRoomPanel.tsx` and `useLinkedService.ts`: the Service tab for service-engagement rooms.
  - `components/shared/WorkspaceLoading.tsx`: the loading overlay.
  - `lib/utils.ts`: the `cn` class-name helper.
- **Packages:** `react` (state, effects, refs), `react-dom` (`createPortal`), `next` (`useSearchParams` from `next/navigation`), `lucide-react` (icons).

## Used by
- `app/(dashboard)/layout.tsx` imports it as `ProjectMangement` and renders it when the active popover is `"Taskroom"`, passing only `setActivePopover`. `setActiveItem` is therefore `undefined` when it reaches `SettingPage`.
- It has no URL of its own. It is shown inside the dashboard shell, which wraps every `(dashboard)` route.

## Notes
- The lucide icons `Figma`, `FileSpreadsheet`, `Video` and `CalendarDays` are imported but used only by the commented-out tabs.
- The sort argument `"ascs"` passed to `fetchBoardByRoomsDetails` is passed as-is. Whether the API expects that spelling is decided by the store and the API, not by this file.
- Sheets/Figma/Notion/Youtube/GoogleCalendar views can still be rendered by `mode()`, but no tab selects them now.
- The members drawer builds `Authorization: Bearer ${token}` even when `garage_tok` is missing, which sends `Bearer null`. The Ask AI call falls back to an empty string instead.
- `RightSideDrawerPortal` positions itself from the header's bounding box. If the header is hidden (AssignedToMe/AllTasks), the drawer buttons are not rendered anyway.
