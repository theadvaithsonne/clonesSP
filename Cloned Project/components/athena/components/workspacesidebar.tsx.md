# `components/athena/components/workspacesidebar.tsx`

> The breadcrumb-style "Workspace > Space > Room" switcher for the Athena / taskroom project-management screen: dropdowns to switch workspaces, browse spaces and rooms, open a room's Kanban board, and manage spaces and rooms through dialogs.

**Kind:** React component (client) · **Lines:** 1694

## Purpose
Athena's project-management module (`components/athena/ProjectMangement.tsx`) organises work into a hierarchy: **Workspace > Space > Room**, where each room has a Kanban board. This component is the navigation bar for that hierarchy. It shows up to three trigger buttons (current workspace, current space, current room). Each trigger opens a dropdown panel rendered into `document.body` through a portal. The component also mounts the dialogs for creating and editing workspaces, spaces and rooms, managing members, deleting, and moving rooms.

It does not call any API itself. All data loading and mutations go through zustand stores that call the external taskroom v2 API (`NEXT_PUBLIC_TASKROOM_URL`, defaulting to `uatapi.garage.app`), which is not part of this repo.

## How it works

### Module-level helpers (L43-L303)
- `WorkspacesMetadata` and `hasMoreWorkspaces(metadata)` decide whether the workspace list has more pages: either `nextPage` is non-null, or `currentPage < totalPages`.
- **`Card` / `Column` interfaces and `transformCard` / `transformStage` (L63-L154).** The comment says these were "ported as-is from TaskroomSidebar.tsx" so that board data matches what the board store expects.
  - `transformStage` is never called in this file, so both transforms are dead code here.
  - The interfaces are exported but only describe types. The real conversion happens inside the store's `fetchBoardByRoomsDetails`.
- **`WorkspaceAvatar`** shows the workspace's `image_circle_url` or `image_square_url` if one exists. Otherwise it shows the first letter of the name on the workspace's `color`, defaulting to `#6b7280`.
- **`capitalize`** upper-cases the first character of a string.
- **`getSpaceImageUrl`** accepts a string or an object with `url`, `value` or `path`. It returns the value only if it looks like a URL (`http(s)://`, `data:` or a leading `/`); otherwise it returns `""`.
- **`SpaceIcon`** renders the space's `image` or `icon` when one is available, and falls back to a `FolderKanban` icon.
- **Dropdown positioning:**
  - Constants: `MOBILE_BREAKPOINT = 640`, panel z-index `10050`, backdrop z-index `10049`.
  - `getMenuPosition(trigger, minWidth)` places a fixed-position panel 4px below its trigger. On narrow viewports the panel is full width minus 12px padding on each side. On wider viewports it is at least `minWidth` wide and is clamped so it stays on screen.
  - `getAvailableDropdownHeight` limits the panel height to the space left below the trigger, with a minimum of 140px and a maximum of 75% of the viewport.
  - `getSpaceSectionMaxHeight` gives the space list inside the main panel about 42% (mobile) or 48% (desktop) of the panel's usable height. The "Switch Workspaces" list gets the rest.
  - All size calculations prefer `window.visualViewport`, so they stay correct when the mobile keyboard opens or the page is zoomed.

### Store wiring and local state (L305-L472)
- **From `useTaskroomWorkspacetore` (two destructurings of the same store):**
  - Workspaces: `workspaces`, `currentWorkspace`, `workspacesMetadata`, `isLoadingWorkspaces`, `workspacesListApiResult` (`"idle"`, `"empty"` or `"has_data"`), `fetchWorkspaces`, `setCurrentWorkspace`.
  - Spaces: `spaceData` (keyed by workspace ID), `spaceMetadata`, `loadingWorkspaceSpaces`, `isLoadingSpace`, `fetchspaces`, `showCreateSpace` / `setShowCreateSpace`, `activeSpaceId` / `toggleSpace`.
  - Rooms: `rooms` and `roomMetadata` (keyed by space ID), `loadingSpaces`, `fetchRooms`, `deleteRoom`, `currentRoomDetail` / `setCurrentRoomDetail`.
  - Board and view: `fetchBoardByRoomsDetails`, `setColumns`, `setProjectActiveItem`, `wsrKLoading`.
  - `setIsFetchingColumns` is pulled from the store but never used.
- **Other stores:**
  - `useSpaceStore().deleteSpace`.
  - `useUIStore()` for `showAddWorkspace` / `setShowAddWorkspace`.
  - `useMobileSidebar().closeMobileSidebar`, which closes the mobile drawer after a navigation.
  - `useTemplateStore()` for `setIsOpenTempate` / `setCurrentRoom`. These are only referenced by a commented-out "Template" menu item.
- **Derived values:**
  - `workspaceId` is `currentWorkspace._id`, falling back to the `?workspaceId=` query parameter.
  - `currentSpaceId` is the store's `activeSpaceId`, falling back to `currentRoomDetail.spaceId`.
  - `currentSpace` is looked up from `spaceData[workspaceId]`; `currentSpaceRooms` and room pagination metadata come from `rooms` and `roomMetadata`.
- **Local state:**
  - Open flags for the three dropdowns, plus refs to their triggers and panels and their computed positions.
  - `expandedSpaces`, which spaces are expanded in the tree view.
  - Dialog flags and targets: create/edit room, add people to a space or a room, the move-room target, and `deleteTarget` (`{type, id, name}`).

### Effects (L363-L644)
- **Positioning.** While any dropdown is open, panel positions are recalculated on `visualViewport` resize and scroll. Each dropdown also has its own `window` resize listener and a scroll listener in capture phase.
- **Initial load.** If `workspaces` is empty, it calls `fetchWorkspaces(1)`.
- **First-run prompt.** When `workspacesListApiResult === "empty"`, it opens the Add Workspace dialog once. A ref stops it from re-opening, and the ref resets when the result becomes `"has_data"`.
- **Infinite scroll in "Switch Workspaces"** works three ways:
  1. An `onScroll` handler loads the next page when the list is within 80px of the bottom.
  2. An `IntersectionObserver` watches a sentinel element, using the list as its root with a 120px bottom margin.
  3. An effect auto-loads the next page when the list is too short to scroll or is already near the bottom.

  Each path runs only while the workspace dropdown is open, no load is in progress, and `hasMoreWorkspaces` is true. The next page is `nextPage`, falling back to `currentPage + 1`.
- **Spaces on demand.** Opening the space dropdown fetches page 1 of spaces for the workspace if none are cached and none are loading.
- **Rooms on demand.** Opening the workspace or room dropdown calls `fetchRooms(currentSpaceId, 1)`. Opening the workspace dropdown also auto-expands the current space.
- **Click outside.** A `mousedown` listener closes every dropdown when the click lands outside the triggers and panels, and outside Radix dropdown-menu nodes (`[data-slot="dropdown-menu-content|portal|trigger"]`). It does nothing while any dialog is open, so typing in a dialog cannot collapse the menus behind it.

### Navigation handlers (L646-L799)
- **Selecting a space** (`handleSelectSpace`, used in the compact space dropdown):
  1. Sets the store's active space and expands the space in the tree.
  2. Force-refetches its rooms with `fetchRooms(id, 1, true)`.
  3. If the open room belongs to a different space, clears `currentRoomDetail` and the board columns.
  4. Closes the space and room dropdowns and the mobile sidebar.
- **Clicking a space in the tree** (`handleSpaceTreeClick`, used in the main panel): sets the active space, toggles expansion, force-fetches rooms when expanding, and clears the room and board if they belong to another space.
- **Opening a room** (`toggleRoom`):
  1. Closes all menus and the mobile sidebar.
  2. Marks the room's space as active and expanded.
  3. Clears the board columns and sets `currentRoomDetail`.
  4. Calls `fetchBoardByRoomsDetails(roomId, 1, 30, "ascs")`. The store requests `rooms/detail/:roomId` from the taskroom API.
  5. Calls `setProjectActiveItem("DashMangement")`, which switches the main area to the board view.
- **Switching workspace** (`handleSwitchWorkspace`):
  1. Does nothing if `ws` has no `_id` or is already the current workspace.
  2. Resets the expanded spaces and the local active space.
  3. Calls `setCurrentWorkspace(ws)`. The store also clears the active space, the room and the columns.
  4. Calls `fetchspaces(ws._id)` and closes all menus.

  An in-code note says this behaviour is new compared with the old `TaskroomSidebar`.
- **Dialog openers:** `handleCreateRoom`, `handleCreateSpace`, `handleEditRoom`, `handleEditSpace`, `handleAddPeople` (space members), `handleAddPeopleToRoom`, `requestDeleteSpace`, `requestDeleteRoom`. Each first closes all dropdowns.
- **Moving a room** (`handleMoveRoom`) refuses to move the room that is open and shows the toast "You can't move the currently selected room". The menu item for that room is also disabled.
- **Confirming a delete** (`confirmDelete`):
  - For a space, calls `deleteSpace(id)` and closes the dialog only if it succeeds.
  - For a room, calls `deleteRoom(id)` and always closes the dialog.
  - `deleteLoading` stops the dialog from being dismissed while a delete is running.

### Panels (L801-L1435)
- **List builders.** `renderSpaceListItems` and `renderRoomListItems` build the flat lists used in the compact space and room dropdowns. Each room row has a `DropdownMenu` (`modal={false}`, z-index `10050`) with **Edit**, **Add people**, **Move** (disabled for the selected room) and **Delete**.
- **`spaceDropdownPanel`** contains a "Spaces" header with a + (create space) button, skeleton rows while loading, the list of spaces, a "Load more" button when `spaceMetadata[workspaceId].totalPages > currentPage`, and "No spaces found" when empty.
- **`roomDropdownPanel`** appears only when a space is active. It shows a "Rooms" header with a + button, skeleton rows, the room list, "Load more" based on `roomMetadata`, and "No rooms found" when empty.
- **`dropdownPanel`** (the main workspace panel) has two parts:
  - **Space tree.** Each space row has a menu with **Edit**, **Add People** and **Delete**. Under an expanded space, rooms hang from a connector line, each with its own menu (Edit, Add people, Move, Delete). The expanded space also shows "No projects found" when it has no rooms, "Load More" for room pagination and a "New Room" button. Below the tree is "Load More Spaces". Commented-out "Views" (List/Calendar) and "Channels" sections are left in the code.
  - **"Switch Workspaces" list.** It shows workspace avatars, loading indicators, the infinite-scroll sentinel, or a "Create workspace" button when the list is empty, followed by a "Create new workspace" footer button.

### Render (L1437-L1694)
- **Mobile backdrop.** While any dropdown is open, a portal renders a semi-transparent full-screen button (hidden at the `sm` breakpoint and up, z-index `10049`). Tapping it closes all menus.
- **Workspace trigger** has three states:
  1. "Loading workspaces..." while the first fetch runs (`workspacesListApiResult === "idle"` and loading).
  2. A "Create Workspace" button when the API returned no workspaces.
  3. Otherwise, the current workspace avatar and name.
- **Space trigger** shows only when `workspaceId` is known. **Room trigger** shows only when `currentSpaceId` is known. Both are separated by `ChevronRight` icons on desktop. Opening one dropdown closes the other two.
- All three panels are rendered with `createPortal` into `document.body`, guarded by `typeof document !== "undefined"`.
- **Dialogs mounted at the end:**
  - `CreateSpaceDialog` (with `space={editingSpace}` when editing).
  - `CreateRoomDialog`, whose `onSuccess(spaceId)` expands that space and makes it active. Its `spaceId` is the local `activeSpaceId`, falling back to `currentSpaceId`.
  - `SpaceMembersDialog` and `RoomMembersDialog`, mounted only while open.
  - `AddWorkspaceDialog`, whose `onCreated` closes the menus and resets expansion.
  - `DeleteConfirmDialog`, with `scope` set to `"space"` or `"room"`.
  - `MoveRoomDialog`.

## Exports
- `default WorkspaceSidebar()` - takes no props and renders the workspace/space/room switcher plus all related dialogs.
- `Card` (interface) - a client-side Kanban card: `_id`, `name`, `description`, `tags`, `tagData`, `members`, dates, checklist, comments, priority, `stageId`, `assignedToIds`, `TaskDataCount`, `attachments` and so on.
- `Column` (interface) - a Kanban stage: `_id`, `name`, `roomId`, `userId`, `cards: Card[]`, `taskCount`, `localCardCount`, `stageType`, `orderId`, `color`.

## Interfaces
- **External services:** the taskroom v2 API (`NEXT_PUBLIC_TASKROOM_URL`), reached only through the stores. Endpoints used by the store actions this component triggers:
  - `GET workspaces/me?size=10&page=` - `fetchWorkspaces`.
  - `GET spaces/me?workspaceId=&page=&size=50` - `fetchspaces`.
  - `GET rooms/me?spaceId=&page=&size=50` - `fetchRooms`.
  - `GET rooms/detail/:roomId?page=&size=&cardSize=30` - `fetchBoardByRoomsDetails`.
  - `DELETE rooms/:roomId` - `deleteRoom`.
  - `DELETE spaces/:spaceId` - `useSpaceStore.deleteSpace`.

  The dialogs call further endpoints of their own.
- **Browser storage / cookies:** none used directly. The stores read `localStorage.garage_tok`.

## Dependencies
- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx` - workspace, space, room and board state and fetchers.
  - `store/taskroom/spaceStore.ts` - `deleteSpace`.
  - `store/taskroom/templateStore.ts` - template dialog setters (only used by commented-out code).
  - `store/taskroom/uiStore.tsx` - the Add Workspace dialog flag.
  - `lib/mobile-sidebar-context.tsx` - `closeMobileSidebar`.
  - `lib/utils.ts` - `cn` class merging.
  - `components/ui/dropdown-menu.tsx`, `components/ui/skeleton.tsx` - UI primitives.
  - `./add-workspace-dialog`, `./create-space-dialog`, `./create-room-dialog`, `./space-members-dialog`, `./room-members-dialog`, `./delete-confirm-dialog`, `./move-room-dialog` - the management dialogs.
- **Packages:**
  - `react` - hooks.
  - `react-dom` - `createPortal`.
  - `next` - `useSearchParams` from `next/navigation`.
  - `lucide-react` - icons.
  - `sonner` - toast.

## Used by
- `components/athena/ProjectMangement.tsx`, which renders `<WorkspaceSidebar />`.

That module is the Athena project-management view inside the dashboard. Because this component uses `useSearchParams`, any page that renders it needs a Suspense boundary when statically rendered.

## Notes
- **Crash risk in the space tree (L1119).** The tree row's `title` attribute calls `space.name.charAt(...)` without a null check, while the visible label next to it does check for a missing name. A space with no `name` will throw while the main panel renders.
- **Dead code:**
  - `transformCard` and `transformStage` are never called (`transformStage` is defined but unused, and `transformCard` is only called from it).
  - `setIsFetchingColumns` is never used.
  - `useTemplateStore` is used only by a commented-out "Template" menu item.
  - The ternaries `selected ? "text-white/50" : "text-white/50"` produce the same class either way, so selected items are not visually highlighted.
  - The local `color` in `renderRoomListItems` is always `#e11d48`.
- **Other quirks:**
  - The sort argument `"ascs"` passed to `fetchBoardByRoomsDetails` looks like a typo, but it is what the store receives.
  - The empty-room text in the tree says "No projects found", not "No rooms found".
  - Room deletes close the confirmation dialog even if the delete failed. Space deletes close it only on success.
