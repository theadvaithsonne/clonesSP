# `store/taskroom/taskroomWorkspace.tsx`

> Module exporting `isRoomObserver`.

**Kind:** client state store · **Lines:** 1527

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Workspace` | interface |  | 12 |
| `space` | interface |  | 33 |
| `Room` | interface |  | 50 |
| `isRoomObserver` | function | `isRoomObserver(room?: (Pick<Room, "_id" \| "MemberDetail"> & { role?: strin…, memberData?: { role?: string } \| null)` | 75 |
| `Card` | interface |  | 84 |
| `Column` | interface |  | 124 |
| `useTaskroomWorkspacetore` | const | `= create<WorkspaceState>((set, get) => ({ workspaces: [], spaceData: {}, isLoadingSpace: false, roo…` | 315 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${roomId}?page=${currentPage + 1}&size=${size}&cardSize=30` (L356)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/me?workspaceId=${workspaceId}&page=${page}&size=50` (L411)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms` (L501)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${roomId}` (L536)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${roomId}` (L564)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/move/${roomId}` (L602)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L683)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${roomId}` (L726)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/me?spaceId=${spaceId}&page=${page}&size=50` (L773)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/me?size=50` (L822)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/me?workspaceId=${firstWorkspaceId}&page=1&size=50` (L866)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/me?spaceId=${firstSpaceId}&page=1&size=50` (L909)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L969)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L1004)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces` (L1053)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces` (L1081)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${boardId}?page=${page}&size=${size}&cardSize=30` (L1224)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/me?size=${WORKSPACES_PAGE_SIZE}&page=${page}` (L1294)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `store/taskroom/uiStore.tsx` — `useUIStore`
  - `store/taskroom/templateStore.ts` — `useTemplateStore`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
- **Packages:**
  - `zustand` — `create`
  - `axios`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `app/taskroom/components/create-room-dialog.tsx`
- `app/taskroom/components/taskroom-sidebar.tsx`
- `components/athena/ProjectMangement.tsx`
- `components/athena/components/AssignedToMe.tsx`
- `components/athena/components/CalendarView.tsx`
- `components/athena/components/CreateTaskDialog.tsx`
- `components/athena/components/CustomizeViewDrawer.tsx`
- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/Figmaview.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/GoogleCalendarview.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/Notionview.tsx`
- `components/athena/components/RoomSettingsPanel.tsx`
- `components/athena/components/RoomStageSettingsPanel.tsx`
- `components/athena/components/SheetsView.tsx`
- `components/athena/components/SpaceSettingsPanel.tsx`
- `components/athena/components/TimesheetApprovals.tsx`
- `components/athena/components/WorkspacePeopleDashboard.tsx`
- `components/athena/components/WorkspaceSettingsDashboard.tsx`
- `components/athena/components/Youtubeview.tsx`
- `components/athena/components/add-workspace-dialog.tsx`
- `components/athena/components/assignee-picker.tsx`
- `components/athena/components/card-modal.tsx`
- _…and 15 more_

## Notes

- Large file (1527 lines) — read it by section; line numbers above point into it.
