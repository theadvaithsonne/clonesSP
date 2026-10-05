# `components/athena/components/create-room-dialog.tsx`

> A multi-step Taskroom dialog that creates or edits a room (a project inside a space), uploads its icon, and can attach an existing or newly built stage template.

**Kind:** React component · **Lines:** 1095

## Purpose
In the Taskroom / Athena project-management module, a workspace holds spaces and a space holds rooms. Each room has a workflow of stages grouped into four types: Not started, Active, Done and Closed. `CreateRoomDialog` is the single UI for creating a new room in a space or editing an existing one. It can also walk the user through choosing or building a stage template before the room is created. It is opened from the Taskroom sidebars and from the workspace view.

## How it works

### State and stores (L72-L141)
- Local form state covers `step` (1 or 2 on the room form), name, description, `bgImage`, icon file and preview, `isPrivate` (defaults to `false`, so rooms are public), `isDefault`, the `createCustomTemplate` toggle, and `templateMode` (`null` = choice screen, `"existing"` or `"custom"`). There is also stage-editor state for editing, adding and dragging stages.
- `useTaskroomWorkspacetore` supplies `currentWorkspace`, `createRoom`, `updateRoom` and `isRoomLoading`.
- `useTemplateStore` holds the template editor's shared state: `isOpenTempate`, `selectedTemplate`, `template`, `templates`, `fetchTemplates`, `addStageTemplate`, `setNewTemplate`, `currentRoom` and `pendingRoomCreationData`. Templates are fetched on mount.
- The workspace id comes from the `workspaceId` query param when a `shareTask` query param is present. Otherwise it comes from `currentWorkspace._id`.
- The derived values control the editor:
  - `filledGroups` counts stage types that have at least one stage, and `allFilled` is true when all 4 do.
  - `hasSavedTemplate` is true when `selectedTemplate` is a real id, not `""` or `"custom"`.
  - `canEdit` is `isCustomMode && !hasSavedTemplate`.
  - `canCreateWithTemplate` requires a saved template with all four groups filled.

### Room form, steps 1 and 2 (L466-L613)
- **Step 1:** an icon picker (hidden file input, images only), name (required), optional description, and a "Public Room" switch, which is the inverse of `isPrivate`. In edit mode, step 1 is the whole form and its button says "Save".
- **Step 2 (create only):** the "Configure workflow" switch (`createCustomTemplate`). The button reads "Next: Stages" or "Create room".
- `handleNextStep` (L342-L367) moves from step 1 to step 2. On the final submit, it first uploads the icon if a new file was chosen (`uploadIconToS3`). It then calls `executeSubmit`.
- `executeSubmit` (L287-L308) behaves as follows:
  - **Edit:** calls `updateRoom(room._id, {...})`, keeping `room.color`.
  - **Create without a template:** calls `createRoom({...}, workspaceId, router)`.
  - **Create with "Configure workflow" on:** stores the form in `pendingRoomCreationData`, resets the template to a new blank one, and opens the template editor (`setIsOpenTempate(true)`) without creating anything yet.
  - On success it calls `onSuccess?.(spaceId)`, closes the dialog and resets to step 1.

### Icon upload (L144-L176)
The image is previewed through `FileReader`. On submit it is sent as multipart form data (`files`, plus `folder=room-icons`) to `https://uatapi.garage.app/api/s3upload/multiple` with the `garage_tok` bearer token. The first `data[0].url` in the response becomes `bgImage`.

### Template editor (L615-L1092)
This view replaces the room form while `isOpenTempate` is true. Both views live inside one `<Dialog>` whose `open` prop is `open || isOpenTempate`.
- **Choice screen (`templateMode === null`).** The user picks "Use existing template" (`chooseExistingTemplate` clears `selectedTemplate` to `""` and blanks the template) or "Create custom template" (`chooseCustomTemplate` calls `setNewTemplate()`).
- **Left sidebar.** Shows a progress bar of filled groups (n/4) with a checklist. In existing mode it has a template `<Select>`, listing only templates with an `_id`. In custom mode it has a template name input, which turns into a read-only label after the template is saved.
- **Stage groups.** The editor is view-only unless `canEdit`. When editing is allowed, the user can:
  - add a stage (name, a preset or custom colour, Enter/Escape shortcuts);
  - edit a stage inline;
  - delete a stage;
  - drag a stage within its group or into another group. `moveStageToGroup` (L214-L258) changes the moved stage's `stageType`, inserts it before the drop target or at the end, and renumbers `orderId` from 1 within each type.
- **Footer.** "Save template" calls `addStageTemplate()`. It is enabled only when all four groups are filled and the template has a name. Saving switches `selectedTemplate` to the new id, which locks the editor. "Create Room" / "Apply Changes" calls `handleApplyChanges` (L310-L340):
  - If `pendingRoomCreationData` exists, it calls `createRoom({...pending.data, stageTemplateId: selectedTemplate}, …)`.
  - Otherwise it sends `PUT ${NEXT_PUBLIC_TASKROOM_URL}rooms/${currentRoom.id}` with `{ stageTemplateId }` to change an existing room's template.
- **Back button (`handleTemplateBack`).** Returns to the choice screen first. Then, when a room creation is pending, it returns to step 2 of the room form. Otherwise it closes the dialog.

### Reset behaviour
- Opening for creation resets every field.
- Opening for editing pre-fills name, description, icon, privacy and default flag from `room`. This needs both `spaceId` and `room`.
- Closing the template editor clears the stage-editor state, `pendingRoomCreationData` and `templateMode`.

## Exports
- `CreateRoomDialog({ open, onOpenChange, spaceId?, room?, onSuccess? })` creates a room when `room` is absent and `spaceId` is given, and edits a room when `room` is passed. `onSuccess(spaceId)` fires after a room is created or updated.

The internal `Steps` dot indicator is defined but its usage is commented out.

## Interfaces
- **External services:** the Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`. This component calls `PUT rooms/:id` directly, and its stores call `POST rooms`, `PUT rooms/:id`, `GET Template/stages` and `POST Template/stages`. It also uses the S3 upload endpoint `https://uatapi.garage.app/api/s3upload/multiple`. Neither service is part of this repo.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`, the Taskroom API base URL, which ends with `/`.
- **Browser storage / cookies:** reads `localStorage.garage_tok` as the bearer token. `js-cookie` is imported but not used in the current code.

## Dependencies
- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx`: room create/update and the current workspace.
  - `store/taskroom/templateStore.ts`: stage templates and the shared editor state.
  - `components/ui/*` (`button`, `dialog`, `input`, `label`, `select`, `switch`, `textarea`): shadcn UI pieces.
  - `lib/utils.ts`: `cn`.
- **Packages:** `axios` (PUT apply), `sonner` (toasts), `lucide-react` (icons), `next/navigation` (`useRouter`, `useSearchParams`, `useParams`), `react`, `js-cookie` (imported but unused).

## Used by
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `components/dashboard/taskroomSiderBar.tsx`

## Notes
- `selectedUsers` is a read-only empty array, so rooms are always created and updated with `members: []`. `roomMembers` is reset but otherwise unused, and `useParams` and `Cookies` are leftovers.
- The S3 host is hardcoded to the UAT API (`https://uatapi.garage.app`), even in production.
- The template editor's open state lives in the global `useTemplateStore`, so another component can open this dialog's template view (via `currentRoom` and `isOpenTempate`) to change an existing room's template.
- `cccc.txt` in the same folder is an older, single-step copy of this component.
