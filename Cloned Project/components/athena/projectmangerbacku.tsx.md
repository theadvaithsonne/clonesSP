# `components/athena/projectmangerbacku.tsx`

> A backup copy of the Athena "Project Management" shell component: it switches between the workspace People, Settings, Timesheets and project-board views, and shows a project header with Board/List/Calendar/Gantt tabs and an Assignees drawer.

**Kind:** React component · **Lines:** 442

## Purpose
Athena is the in-app project/task management module (built on the external Taskroom v2 API). This file is an older or backup snapshot (the name is a misspelling of "project manager backup") of the component that renders the main panel of that module. The live version is `components/athena/ProjectMangement.tsx`; nothing imports this file, so it is not rendered anywhere. It is useful mainly as a reference for how the Athena panel is composed.

## How it works

### `ProjectManagement` (default export, L215-L294)
- Reads `projectActiveItem` / `setProjectActiveItem` from the Athena UI store (`useUIStoreAthena`). On mount, if no item is selected, it sets `"WorkspacePeople"` (the store's own default is the same value).
- Keeps local `activeTab` state: `"Board" | "Calendar" | "List" | "Gantt" | "Sheets"` (default `"Board"`).
- `renderContent()` switches on `projectActiveItem`:
  - `"WorkspacePeople"` (and the default case) - `PeoplePage` (`WorkspacePeopleDashboard`).
  - `"WorkspaceSettings"` - `SettingPage` (`WorkspaceSettingsDashboard`), forwarding the `setActivePopover` and `setActiveItem` props it received.
  - `"TimeSheets"` - the `timesheet` component.
  - `"DashMangement"` - `ProjectHeader` plus the view chosen by `mode()`: `DahboardMangement` (Board), `Gantt`, `CalendarView`, `ListView` or `SheetsView`.
- The outer container is fixed to `calc(100vh - 62px)` high on a near-black background, leaving room for the app's top bar.

### `ProjectHeader` (internal, L297-L442)
- Shows the current Taskroom room (`currentRoomDetail` from `useTaskroomWorkspacetore`): a coloured initial square, the capitalised room name (fallback "Project") and its description.
- Has a decorative "Ask AI" label with no click handler.
- Renders the Board, List, Calendar and Gantt tabs; the Sheets tab is commented out, so `SheetsView` can only appear if `activeTab` is set some other way.
- Works out `roomId`: when the URL has a `shareTask` query parameter it uses the `roomId` query parameter (shared-task links), otherwise `currentRoomDetail._id`.
- An "Assignees" button opens `AssigneesDrawer` for that room.

### `AssigneesDrawer` (internal, L26-L212)
- A dropdown panel (320x400 px) with a full-screen transparent backdrop that closes it on click.
- When opened with a `roomId`, it resets and fetches page 1 of room members from the external Taskroom API, 20 per page, sending the `garage_tok` token from localStorage as a Bearer token.
- Infinite scroll: when the list is scrolled to within 60 px of the bottom and `page < totalPages`, it loads the next page and appends. A `loadingRef` guard stops overlapping requests.
- Filters the loaded members on the client by `userData.name` or `userData.email` (case-insensitive). The search only covers pages already loaded.
- Each row shows an avatar (the image, or initials on a colour picked from a fixed palette), name, email and an optional role badge.

## Exports
- `default ProjectManagement({ setActivePopover, setActiveItem }: any)` - the Athena main panel switcher described above.

## Interfaces
- **External services:** `GET https://uatapi.garage.app/taskroomv2/v2/room/members?roomId=&page=&size=20` (Taskroom v2 API, not part of this repo; the URL is hardcoded) - list room members. Reads `json.data.data` and `json.metadata.totalPages`.
- **Browser storage / cookies:** reads localStorage `garage_tok` (the auth token).
- **URL parameters:** reads `shareTask` and `roomId` through `useSearchParams`.

## Dependencies
- **Internal:**
  - `components/athena/components/WorkspacePeopleDashboard.tsx`, `WorkspaceSettingsDashboard.tsx`, `timesheet.tsx`, `Dashbaord.tsx` (`DahboardMangement`), `CalendarView.tsx`, `ListView.tsx`, `Gantt.tsx`, `SheetsView.tsx` - the views it switches between.
  - `store/athena/uiStore.tsx` - `useUIStoreAthena` (`projectActiveItem`).
  - `store/taskroom/taskroomWorkspace.tsx` - `useTaskroomWorkspacetore` (`currentRoomDetail`).
  - `store/taskroom/workspaceStore.ts` - `useWorkspaceStore` (`currentWorkspace` is read but never used).
  - `lib/utils.ts` - `cn` class merging.
- **Packages:** `react` (state, effects, refs); `next/navigation` (`useSearchParams`); `lucide-react` (icons).

## Used by
Nothing imports it, so it appears unused. The live equivalent is `components/athena/ProjectMangement.tsx`.

## Notes
- This is dead or backup code. Changes belong in `ProjectMangement.tsx`.
- `timesheet` is imported twice, as `TimeSheets` and `TimesheetPage`. `TimesheetPage`, `FileSpreadsheet` and `currentWorkspace` are never used.
- The Taskroom URL is hardcoded to the UAT host instead of an env var such as `NEXT_PUBLIC_TASKROOM_URL`, which other Athena code uses.
- `handleScroll` reads `page` from the render closure. Rapid scrolling is guarded by `loadingRef`, but page state and fetches could drift if a fetch fails, because `page` has already been incremented.
