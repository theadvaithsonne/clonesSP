# `components/athena/components/RoomStageSettingsPanel.tsx`

> Drag-and-drop editor for a Taskroom room's "stage template": the room's Kanban stages grouped into four fixed stage types, which can be reordered, moved between types, added, and saved back to the external Taskroom API.

**Kind:** React component · **Lines:** 788

## Purpose
Every Athena/Taskroom room has a set of stages (the columns of its Kanban board). Each stage belongs to one of four lifecycle **stage types** - Not started, Active, Done, Closed - and has an order within that type. This panel, shown as the "Stage Template" tab of `RoomSettingsPanel`, lets an admin rearrange that template in a board-like layout and then pushes the changes to the server and into the live board columns held in `useTaskroomWorkspacetore`.

## How it works

### Constants and data model (L30-L65)
- `STAGE_TYPES`: `tostart` "Not started" (#64748b), `active` "Active" (#3b82f6), `done` "Done" (#10b981), `closed` "Closed" (#ef4444). `STAGE_TYPE_ORDER` maps them to 0-3 for sorting.
- `PRESET_COLORS`: 12 swatches offered when adding a stage.
- `ApiRoomStage` is the server shape (`_id`, `name`, `color`, `stageType`, `orderId`, optional `type`, `taskCount`, `status`). The exported `RoomStage` adds `updatedOrderId` (the local 1-based position within its type) and `isupdated` (dirty flag).

### Pure helpers (L67-L214)
- `groupDroppableId` / `parseGroupId` - droppable IDs for the type columns are `group-<stageType>`, so a drop target can be told apart from a stage row.
- `hexToRgb`, `stageColumnColors` - derive a dark translucent column background and border from the type colour.
- `mapApiStages` - sorts server stages by type then `orderId` and renumbers `updatedOrderId` 1..n per type, so gaps or duplicates in server `orderId` are normalised.
- `markChangedStages` - compares each stage with the snapshot taken at load time (`initialStagesRef`: type, order, name, colour) and sets `isupdated`.
- `getGroupStages`, `rebuildStagesWithGroups`, `sortStages` - rebuild the flat list after a move, renumbering affected groups.
- `syncColumnsFromStages` - after a successful save, rewrites the store's board `columns` so the Kanban view reflects the new names/colours/types/orders immediately, creating empty `Column` entries for stages not yet present and keeping cards for existing ones.

### Sub-components (L216-L452)
- `SortableStageRow` - a draggable row (grip handle via `useSortable`) showing the stage chip and task count; dirty rows get a brand-coloured border.
- `StageRowOverlay` - the floating preview while dragging (`DragOverlay`).
- `StageGroupSection` - one droppable column per stage type with a count badge, a "+" toggle, a "Drop stages here" placeholder when empty, and an inline add form (name input with Enter/Escape, native colour picker, preset swatches, Cancel/Add).

### Main component `RoomStageSettingsPanel` (L454-L787)
- **Load** (`fetchRoomStages`): `GET {base}stages/room/:roomId` with the `garage_tok` bearer; on success maps stages, stores the snapshot and state. Errors toast. Runs on mount and when `roomId` changes.
- **Drag and drop**: `DndContext` with a `PointerSensor` (6px activation distance) and `closestCorners`. `handleDragOver` highlights the target column. `handleDragEnd` reorders within a group with `arrayMove`, or calls `moveStageInGroup` to move a stage into another type (dropped on a stage -> inserted at that position; dropped on the column -> appended). All updates go through `applyStageUpdate`, which recomputes dirty flags.
- **Add stage** (`addStage`): `POST {base}stages` with `{ name, color, stageType, type: "custom", orderId: <count in group>+1, roomId }`, then reloads. Creation is immediate and does not wait for "Save stage changes".
- **Save** (`handleSaveChanges`): sends only dirty stages as `PUT {base}stages/room/:roomId` with `{ updatedStages: [{ _id, name, color, updatedStageType, updatedOrderId }] }`. On success it syncs board columns via `setColumns` and reloads (which resets the snapshot). The button is disabled with no pending changes.

`{base}` is `NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/`.

## Exports
- `RoomStageSettingsPanel({ roomId: string })` - named export; the stage template editor.
- `RoomStage` (interface) - local stage model with `updatedOrderId` and `isupdated`.

## Interfaces
- **Backend endpoints called (external Taskroom service, not this repo):**
  - `GET {NEXT_PUBLIC_TASKROOM_URL}stages/room/:roomId` - list room stages
  - `POST {NEXT_PUBLIC_TASKROOM_URL}stages` - create a custom stage
  - `PUT {NEXT_PUBLIC_TASKROOM_URL}stages/room/:roomId` - bulk update order/type
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - `Column` type and `setColumns` to update the live board; `components/ui/button.tsx`; `lib/utils.ts` - `cn`.
- **Packages:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` - drag and drop; `axios` - HTTP; `lucide-react` - icons; `sonner` - toasts; `react`.

## Used by
- `components/athena/components/RoomSettingsPanel.tsx` - "Stage Template" tab (remounted per room via `key={room._id}`).

## Notes
- There is no UI to rename, recolour or delete an existing stage here, although the dirty check and save payload include `name` and `color`.
- Unsaved reorders are lost when the panel unmounts or after adding a stage, because `addStage` reloads the list from the server.
- Stage types are fixed to the four keys above; server stages with any other `stageType` sort last and are not shown in any column.
