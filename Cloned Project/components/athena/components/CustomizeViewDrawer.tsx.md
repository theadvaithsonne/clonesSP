# `components/athena/components/CustomizeViewDrawer.tsx`

> Right-hand slide-out drawer for "customising" a Taskroom room view, whose only working feature is creating a new custom field on the room through the external Taskroom API.

**Kind:** React component · **Lines:** 618

## Purpose
Part of the Athena / Taskroom project-management module. It imitates a ClickUp-style "Customize view" panel: view toggles, Fields / Filter / Group / Subtasks / Templates rows, and a field-type catalogue. Apart from the "Fields > Create new" flow, the controls are visual placeholders. The real action is adding a custom field (dropdown, text, date, long text, number or multi-select labels) to the room, after which the room data in the Taskroom workspace store is refreshed so other views can show the new field.

## How it works

### Config and API helper (L26-L96)
- `TASKROOM_BASE` is `NEXT_PUBLIC_TASKROOM_URL` (default `https://uatapi.garage.app/taskroomv2/v2/`) normalised to a single trailing slash.
- `DRAWER_Z = 10060` keeps the drawer above most app chrome; `OPTION_COLORS` cycles colours for option chips (display only, not sent to the API).
- `FIELD_TYPES` lists the six supported types; `dropdown` and `labels` have `hasOptions`.
- `addRoomCustomField(roomId, { fieldName, fieldType, fieldOptions, currencySymbol })` sends `PUT {TASKROOM_BASE}rooms/:roomId/add/custom/field` with the `garage_tok` bearer token (if present). On a non-OK response it throws with the server's `message` / `error` when available.

### Layout primitives (L98-L209)
- `DrawerShell` portals a backdrop (click closes) and a fixed right-side panel into `document.body`. The panel's `top` tracks the bottom edge of the element in `headerRef`, recalculated on window resize and any scroll, so the drawer sits under the page header. Wheel events are stopped from bubbling.
- `DrawerHeader` (optional back button, title, trailing slot, close button), `ToggleRow` (label with a static, non-interactive switch graphic) and `MenuRow` (icon, label, value, chevron).

### `CreateFieldForm` (L211-L437)
- Title is a dropdown that lets the user switch field type in place.
- Inputs: required field name; for option types, a list of options (seeded with "Option 1" / "Option 2", new ones added with Enter or the wand button); for `number`, an optional currency symbol; for `text` / `textarea`, a "Manual fill / Fill with AI" toggle that is UI only and not sent anywhere. "More settings and permissions" does nothing.
- `canSubmit` needs a name and, for option types, at least one non-blank option.
- `handleCreate` calls `addRoomCustomField`; it takes the updated room from `result.data.data`, `result.data` or `result`, writes it into the store with `syncRoom(roomId, updatedRoom)`, then calls `refreshCurrentRoomDetail(roomId)` to refetch and merge the room. Shows a toast, calls `onCreated` and closes.

### `CustomizeViewDrawer` (L439-L601)
Three screens held in state: `main`, `fields`, `create`. Closing (or the `open` prop going false) resets to `main`.
- **main:** read-only "List" view name, toggles (Show empty statuses, Wrap text, ...), menu rows with hard-coded values ("7 shown", "None", "Status", "Collapsed"); only "Fields" navigates.
- **fields:** search box filtering `FIELD_TYPES` by label, "Create new" / "Add existing" tabs ("Add existing" always shows "No existing fields to add"); picking a type opens `create`.
- **create:** renders `CreateFieldForm` for the chosen type.

### `CustomizeViewButton` (L603-L617)
A small "Customize" button with a settings icon that calls `onClick`.

## Exports
- `CustomizeViewDrawer({ open, onClose, roomId, headerRef })` - the drawer; `headerRef` positions its top edge.
- `CustomizeViewButton({ onClick, className? })` - trigger button.
- `CustomFieldType` (type) - `"dropdown" | "text" | "date" | "textarea" | "number" | "labels"`.

## Interfaces
- **External services:** Taskroom API - `PUT {NEXT_PUBLIC_TASKROOM_URL}rooms/:roomId/add/custom/field` with `{ fieldName, fieldType, fieldOptions, currencySymbol }`; indirectly the room fetch behind `refreshCurrentRoomDetail`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - `syncRoom` and `refreshCurrentRoomDetail`; `lib/utils.ts` (`cn`).
- **Packages:** `react`, `react-dom` (`createPortal`), `lucide-react` (icons), `sonner` (toasts).

## Used by
`components/athena/ProjectMangement.tsx` renders `CustomizeViewDrawer` in its board area with `roomId` and its header ref.

## Notes
- In `ProjectMangement.tsx` the only call that opens the drawer (`setCustomizeDrawerOpen(true)` on a `CustomizeViewButton`) is commented out, so the drawer is currently mounted but cannot be opened from the UI.
- Most rows and toggles are non-functional mock-ups; do not assume view settings are persisted.
- Option colours shown in the form are not sent to the API, so they will not match what other views display.
