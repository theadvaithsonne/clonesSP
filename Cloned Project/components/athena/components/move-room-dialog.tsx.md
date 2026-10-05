# `components/athena/components/move-room-dialog.tsx`

> A two-step modal for moving a Taskroom room into a different space, possibly in another workspace, with infinite-scrolling pickers for workspaces and spaces.

**Kind:** React component · **Lines:** 479

## Purpose
Taskroom content is organised as Workspace → Space → Room. This dialog lets a user pick a destination workspace and space for an existing room, confirm the choice, and then calls the store's `moveRoom` action. The sidebar (`workspacesidebar.tsx`) opens it from a room's menu. All data comes from the zustand store `useTaskroomWorkspacetore` (`store/taskroom/taskroomWorkspace.tsx`). The dialog makes no HTTP calls itself.

## How it works
**Local helpers (L11-L68)**
- `hasMoreWorkspaces(metadata)` returns true when the workspace list metadata has a `nextPage` or `currentPage < totalPages`.
- `capitalize` upper-cases the first letter of a name.
- `WorkspaceAvatar` shows `image_circle_url` or `image_square_url`. Without an image it shows a coloured square with the first letter, using `workspace.color` or grey as the background.
- `SpaceIcon` uses `space.image` (a string, or `{url}`) or `space.icon`, but only if the value is an absolute `http(s)` URL or a root-relative path. Otherwise it falls back to a `FolderKanban` icon.

**State and opening (L82-L139)**
- Local state: `step` (`"select"` | `"confirm"`), `selectedWorkspaceId` and `selectedSpaceId`.
- From the store it reads `workspaces`, `workspacesMetadata`, `isLoadingWorkspaces`, `spaceData` (spaces keyed by workspace id), `spaceMetadata`, `loadingWorkspaceSpaces`, `isRoomLoading` and `currentWorkspace`. It also calls the actions `fetchWorkspaces`, `fetchspaces` and `moveRoom`.
- When `open` becomes true, it preselects the current workspace, fetches page 1 of workspaces if none are loaded yet, and fetches page 1 of that workspace's spaces. When the dialog closes, it resets all local state.

**Infinite scroll (L141-L222)**
Both lists load more in two ways:
- an `onScroll` handler that fires within 80px of the bottom;
- an IntersectionObserver on a sentinel `div` (root = the list, `rootMargin` 120px bottom).

Workspaces advance with `nextPage ?? currentPage + 1`. Spaces advance with `spaceMeta.currentPage + 1` while `totalPages > currentPage`. Picking a different workspace clears the selected space and fetches page 1 of the new workspace's spaces.

**Select step (L272-L430)**
- Two bordered, scrollable lists, each with skeleton rows while loading and an empty-state message.
- The room's current space is listed as "(current)" and is disabled, so a room cannot be "moved" to where it already is.
- "Continue" is enabled only when a workspace, a space and `room._id` are all present.

**Confirm step (L431-L473)**
- Shows "Do you want to move <room> to <space> in <workspace>?".
- `handleConfirm` calls `moveRoom(room._id, { spaceId, workspaceId }, room.spaceId)`.
- On success it calls `onMoved` with the new ids and a copy of the room whose `spaceId` is updated, then closes the dialog.
- While `isRoomLoading` is true, the dialog cannot be dismissed (its `onOpenChange` is ignored) and the buttons are disabled.

## Exports
- `MoveRoomDialog({ open, onOpenChange, room, onMoved? })` - the dialog. `room` is a `Room` from the taskroom store, or `null`. `onMoved({ workspaceId, spaceId, roomId, room })` is called after a successful move.

## Interfaces
- **Backend endpoints called:** none directly. The store actions it calls hit the external Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`. For example, `moveRoom` sends `PUT {TASKROOM}rooms/move/:roomId` with `{ spaceId, workspaceId }`, and `fetchspaces` loads `spaces/me?workspaceId=...`. This is not an Express route in this repo.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - workspace and space lists, pagination metadata, `moveRoom` and the `Room` type; `components/ui/dialog.tsx`, `components/ui/button.tsx`, `components/ui/skeleton.tsx` - UI primitives; `lib/utils.ts` - `cn`.
- **Packages:** `react`; `lucide-react` - icons.

## Used by
- `components/athena/components/workspacesidebar.tsx`

## Notes
- The store hook really is named `useTaskroomWorkspacetore` (the typo is in the store itself).
- The spinner in the "Loading more..." rows is a rotating `ChevronDown` icon, not a loader icon.
