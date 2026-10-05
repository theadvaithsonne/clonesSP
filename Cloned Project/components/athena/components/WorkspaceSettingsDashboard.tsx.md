# `components/athena/components/WorkspaceSettingsDashboard.tsx`

> The Athena/Taskroom "Settings" screen: a three-tab panel (Workspace, Space, Room) where the workspace tab edits name, logo and colour or deletes the workspace, and the other tabs delegate to dedicated settings panels.

**Kind:** React component · **Lines:** 498

## Purpose
Athena is Garage's project-management module; its workspaces, spaces and rooms are stored in the external Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`), reached through the `useTaskroomWorkspacetore` zustand store. This component is the settings view shown inside the project-management shell for whatever workspace/space/room is currently selected in the sidebar.

## How it works

### Selection and tabs (`WorkspaceSettingsPage`, L352-L497)
- Workspace ID comes from `currentWorkspace._id`, or from the `workspaceId` query parameter when the URL contains `shareTask`.
- Space ID is resolved in order from the `spaceId` query parameter, `currentRoomDetail.spaceId`, then the store's `activeSpaceId`; the space object is looked up in `spaceData[workspaceId]`.
- Three tab buttons show a label and the selected entity's name ("No space selected" etc.). A tab is disabled when its entity is missing. Content:
  - **Workspace** - `WorkspaceSettingsTab` (or an empty-state prompt when no workspace).
  - **Space** - `SpaceSettingsPanel` (keyed by workspace+space so it remounts on change).
  - **Room** - `RoomSettingsPanel` (keyed by room ID).

### Workspace tab (`WorkspaceSettingsTab`, L48-L350)
- **General / Name:** local input synced from `currentWorkspace.name`; Save (or Enter) calls `updateWorkspace(id, { name })`. The button is disabled while saving, when empty, or when unchanged.
- **Custom branding (labelled "Enterprise"):**
  - Round logo upload: the file is POSTed as multipart (`file`, `folder: "Uploads"`) to `https://uatapi.garage.app/api/s3upload/single`; the returned `data.url` is saved with `updateWorkspace(id, { image_circle_url })`. `handleLogoUpload` also supports a `"rectangle"` type writing `image_square_url`, but no UI triggers it.
  - Colour scheme: nine preset swatches; clicking one optimistically sets the colour and calls `updateWorkspace(id, { color })`, reverting on error.
- **Danger zone:** an `AlertDialog` confirms deletion; `deleteWorkspace(id)` is called, and on success it clears the parent popover via `setActivePopover("")` and dispatches a `sidebar:set-active-item` window event with empty detail so the back-office sidebar deselects the item.
- The store methods (`updateWorkspace` -> `PUT {TASKROOM}workspaces/:id`, `deleteWorkspace` -> `DELETE {TASKROOM}workspaces/:id`) show their own success/error toasts; this component only adds toasts for local validation and upload errors.

## Exports
- `default WorkspaceSettingsPage({ setActivePopover?, setActiveItem? })` - the settings screen. `setActivePopover` is called with `""` after a workspace is deleted; `setActiveItem` is accepted but unused.

## Interfaces
- **External services:** `POST https://uatapi.garage.app/api/s3upload/single` - image upload (hardcoded UAT host, no auth header); Taskroom API via the store (`PUT`/`DELETE workspaces/:id`).
- **Window events:** dispatches `sidebar:set-active-item` (listened to in `components/dashboard/backOfficeAppSideBar.tsx`).

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` (current selection, `updateWorkspace`, `deleteWorkspace`, loading flags), `./SpaceSettingsPanel`, `./RoomSettingsPanel`, `components/ui/{button,input,switch,badge,alert-dialog}`, `lib/utils.ts` (`cn`).
- **Packages:** `next/navigation` (`useSearchParams`), `lucide-react`, `sonner`, `react`.

## Used by
- `components/athena/ProjectMangement.tsx`
- `components/athena/projectmangerbacku.tsx`

## Notes
- The upload endpoint is hardcoded to the UAT API regardless of environment.
- `Switch` is imported but unused; the rectangle-logo path is implemented but has no UI.
- Workspace ID resolution differs slightly from `WorkspacePeopleDashboard` (here the `spaceId` query param always wins, not only for `shareTask` links).
