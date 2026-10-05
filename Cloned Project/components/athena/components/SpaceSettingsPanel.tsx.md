# `components/athena/components/SpaceSettingsPanel.tsx`

> Settings panel for one Athena/Taskroom space: edit its icon, name, description and privacy, or delete it.

**Kind:** React component · **Lines:** 299

## Purpose
Taskroom organises work as Workspace -> Space -> Room. When a space is selected in `WorkspaceSettingsDashboard`, this panel lets the user edit it. Persistence goes through `useSpaceStore` (`store/taskroom/spaceStore.ts`), which calls the external Taskroom API; the space list is refreshed through `useTaskroomWorkspacetore().fetchspaces`.

## How it works
- **Tolerant field readers**: `getIconUrl(image)` accepts a string or an object with `url`/`value`/`path`; `getBooleanValue(value)` accepts a boolean or an object with `value`/`isPrivate`/`enabled`. This copes with inconsistent shapes from the API.
- **Form sync** (L70-L78): on `space` change, state is reset from the prop. The icon preview is only kept if the stored image is an `http(s)` URL (spaces created with a named icon such as `"Layout"` show the placeholder).
- **Icon picking/upload**: same pattern as `RoomSettingsPanel` - images only, data-URL preview, upload on save as multipart (`files`, `folder=space-icons`) to `https://uatapi.garage.app/api/s3upload/multiple` with the `garage_tok` bearer; `data[0].url` is used.
- **Save** (`handleSave`, L116-L149): requires `space._id` and a non-empty name, then `updateSpace(space._id, { name, description, color: space.color || "#6366f1", image: <uploaded/preview URL> || existing image || "Layout", spaceCode: first 3 letters of name uppercased, isPrivate, workspaceId, members: [] })`. The store does `PUT {NEXT_PUBLIC_TASKROOM_URL}spaces/:spaceId`, toasts, and refetches the workspace's spaces. Enter in the name field also saves; the button is enabled only when there are changes.
- **Privacy**: the switch is "Make Private" and maps directly to `isPrivate`.
- **Delete** (L151-L162): after `AlertDialog` confirmation, `deleteSpace(space._id)` (`DELETE {NEXT_PUBLIC_TASKROOM_URL}spaces/:spaceId`); on success it calls `fetchspaces(workspaceId, 1, true)` to refresh the list.

## Exports
- `SpaceSettingsPanel({ space, workspaceId })` - named export. `space` is the store's `space` type extended with optional `description`, `color`, `image`, `isPrivate`.

## Interfaces
- **Backend endpoints called (external services, not this repo):**
  - `POST https://uatapi.garage.app/api/s3upload/multiple` - icon upload (hardcoded host)
  - `PUT {NEXT_PUBLIC_TASKROOM_URL}spaces/:spaceId` - via `updateSpace`
  - `DELETE {NEXT_PUBLIC_TASKROOM_URL}spaces/:spaceId` - via `deleteSpace`
  - `GET {NEXT_PUBLIC_TASKROOM_URL}spaces/me?workspaceId=...&page=1&size=50` - via `fetchspaces`
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `store/taskroom/spaceStore.ts` - `updateSpace`, `deleteSpace`, `isCreating`; `store/taskroom/taskroomWorkspace.tsx` - `space` type, `fetchspaces`; `components/ui/*` (`button`, `input`, `label`, `textarea`, `switch`, `alert-dialog`).
- **Packages:** `lucide-react` - icons; `sonner` - toasts; `react`.

## Used by
- `components/athena/components/WorkspaceSettingsDashboard.tsx`.

## Notes
- `fetchspaces` is declared with two parameters in the store; the third `true` argument passed here is ignored (and would be a TypeScript error, which the build ignores).
- `spaceCode` is regenerated from the name on every save, so renaming a space changes its code.
- `members: []` is always sent on update.
- Several `Label` elements are commented out and replaced by `h2` headings; purely presentational leftovers.
