# `components/athena/components/RoomSettingsPanel.tsx`

> Settings panel for a single Athena/Taskroom room: edit its icon, name, description and visibility, delete it, or switch to the room's stage-template editor.

**Kind:** React component · **Lines:** 319

## Purpose
Inside the Athena project-management workspace settings (`WorkspaceSettingsDashboard`), selecting a room shows this panel. It is a thin UI over the Taskroom zustand store (`useTaskroomWorkspacetore`), which talks to the external Taskroom API. A second tab embeds `RoomStageSettingsPanel` for editing the room's task stages (columns).

## How it works
- **Tabs** (L154-L190): `"general"` (default) and `"stages"`. The stages tab renders `<RoomStageSettingsPanel key={room._id} roomId={room._id} />`, so switching rooms remounts it.
- **Form sync** (L54-L62): whenever the `room` prop changes, local state is reset from `room.name`, `room.description`, `room.bgImage` (used as the room icon) and `room.isPrivate`.
- **Icon picking** (L64-L75): only `image/*` files are accepted ("Images only" toast otherwise); a `FileReader` data-URL preview is shown immediately. The X button clears both the pending file and the stored `bgImage`.
- **Icon upload** (`uploadIconToS3`, L77-L92): on save, a pending file is posted as multipart (`files`, `folder=room-icons`) to `https://uatapi.garage.app/api/s3upload/multiple` with the `garage_tok` bearer token; the first returned `data[0].url` becomes the new `bgImage`. Upload errors toast and abort the save.
- **Save** (`handleSave`, L101-L133): requires a non-empty name, then calls the store's `updateRoom(room._id, { name, description, bgImage, isPrivate, members: [], setDefault, color })`. The store sends `PUT {NEXT_PUBLIC_TASKROOM_URL}rooms/:roomId`, toasts the result and syncs local room state. Enter in the name field also saves. The button is disabled unless something changed (`hasChanges`) and nothing is busy.
- **Visibility**: the switch is labelled "Public Room", so it is the inverse of `isPrivate`.
- **Delete** (L135-L145, L270-L313): an `AlertDialog` confirms, then `deleteRoom(room._id)` (store: `DELETE {NEXT_PUBLIC_TASKROOM_URL}rooms/:roomId`, then refetches that space's rooms). On success `setCurrentRoomDetail(null)` clears the selected room.

## Exports
- `RoomSettingsPanel({ room: Room })` - named export; settings UI for the given room.

## Interfaces
- **Backend endpoints called (external services, not this repo):**
  - `POST https://uatapi.garage.app/api/s3upload/multiple` - icon upload (hardcoded host)
  - `PUT {NEXT_PUBLIC_TASKROOM_URL}rooms/:roomId` - via `updateRoom`
  - `DELETE {NEXT_PUBLIC_TASKROOM_URL}rooms/:roomId` - via `deleteRoom`
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the upload bearer token.

## Dependencies
- **Internal:** `components/athena/components/RoomStageSettingsPanel.tsx` - stage template tab; `store/taskroom/taskroomWorkspace.tsx` - `Room` type, `updateRoom`, `deleteRoom`, `isRoomLoading`, `setCurrentRoomDetail`; `components/ui/*` (`button`, `input`, `label`, `textarea`, `switch`, `alert-dialog`) - shadcn primitives; `lib/utils.ts` - `cn`.
- **Packages:** `lucide-react` - icons; `sonner` - toasts; `react`.

## Used by
- `components/athena/components/WorkspaceSettingsDashboard.tsx`.

## Notes
- `updateRoom` is always sent `members: []`; whether the Taskroom API treats that as "clear members" or "no change" is decided by the external service.
- The room icon is stored in the room's `bgImage` field.
- The upload host is hardcoded to the UAT API, independent of `NEXT_PUBLIC_TASKROOM_URL`.
