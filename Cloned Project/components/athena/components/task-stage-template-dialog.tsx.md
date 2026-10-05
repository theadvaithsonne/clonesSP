# `components/athena/components/task-stage-template-dialog.tsx`

> "Edit Project Statuses" dialog that lets a user pick, edit or create a stage template (the set of kanban columns grouped by stage type) and apply it to a Taskroom room or to a room being created.

**Kind:** React component · **Lines:** 725

## Purpose
Each Taskroom room (project) has stages (statuses) that fall into four types: Not started (`tostart`), Active (`active`), Done (`done`) and Closed (`closed`). Stage templates are reusable stage lists. This dialog is the editor for them: choose an existing template, add, rename, recolour, reorder or delete stages, save a new custom template, and apply the selected template either to the current room or to a pending "create room" request. All template state lives in the zustand `useTemplateStore`; the dialog is mostly UI over that store.

## How it works

### State sources (L63-L115)
From `useTemplateStore`: dialog open flag (`isOpenTempate`), `selectedTemplate` (a template id, or `'custom'` for a new one), the working `template` (`name`, `color`, `stagelist`, `userId`), `templates`, `fetchTemplates`, `addStageTemplate`, `setNewTemplate`, `currentRoom`, `isLoading`, and `pendingRoomCreationData`. From `useTaskroomWorkspacetore`: `createRoom`. Templates are fetched once on mount (`GET {TASKROOM}Template/stages` inside the store). Closing the dialog resets all local editing state and clears `pendingRoomCreationData`.

### Ownership (L118-L130)
The `garage_tok` JWT is read from `localStorage` and decoded with `jwt-decode` during render to get `userId`. The user may edit the template name and colour when the selection is `'custom'`, when the template has no `userId`, or when its `userId` matches theirs. Only those two fields are disabled for non-owners; the stage editing controls are not.

### Stage editing (L132-L238)
- `groupedStages` buckets `template.stagelist` by the four `STAGE_TYPES`, sorted by `orderId`.
- `addStage(type)` appends `{ name, color, stageType, orderId: count + 1 }`. The inline "Add Stage" panel offers 12 `PRESET_COLORS`, a native colour input and a live preview pill. Enter adds, Escape cancels.
- `startEdit` / `saveEdit` edit a stage's name and colour inline, with six quick swatches and a hidden colour input.
- Drag and drop (HTML5 `draggable`) reorders stages within the same stage type only, then renumbers `orderId` for that type.
- `deleteStage` removes a stage by index.
All changes go through `setTemplate(...)`; nothing is saved to the server until a footer button is pressed.

### Template selector (L88-L94, L327-L346)
A Select lists `templates` with an `_id`, plus "+ Add New Template", which calls `setNewTemplate()` (a blank `'custom'` template). Picking an id calls `setSelectedTemplate(id)`, which loads that template into the editor.

### Footer actions (L240-L288, L700-L718)
- When `selectedTemplate === 'custom'`: **Save as template** -> `addStageTemplate()` (store POSTs `{ name, color, stagelist, type }` to `{TASKROOM}Template/stages`).
- Otherwise: **Apply changes** -> `handleApplyChanges`:
  - If `pendingRoomCreationData` is set (the dialog was opened from the create-room flow), it calls `createRoom({ ...data, templateId }, workspaceId, router)`, which POSTs to `{TASKROOM}rooms`, and closes the dialog on success.
  - Otherwise it needs `currentRoom.id` and calls `PUT {TASKROOM}rooms/{id}` with `{ templateId }`. A response with `status` or `success` shows a success toast and closes the dialog; anything else shows an error toast.

### Layout
A shadcn `Dialog` with its own `DialogTrigger` button ("Edit Project Statuses"). The left column holds the status-type radios, the template select, the name/colour editors and a "Learn more" button. The right column holds the four stage groups and the footer.

## Exports
- `TaskStageTemplateDialog()` - no props; fully driven by `useTemplateStore`.

## Interfaces
- **Backend endpoints called (external Taskroom API, `NEXT_PUBLIC_TASKROOM_URL`):**
  - `PUT rooms/{roomId}` - apply a template to an existing room (called directly)
  - `GET Template/stages`, `POST Template/stages` - list and create templates (through `store/taskroom/templateStore.ts`)
  - `POST rooms` - create a room with the template (through `store/taskroom/taskroomWorkspace.tsx`)
- **External services:** Taskroom v2 API (uatapi.garage.app).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`.
- **Browser storage / cookies:** reads and decodes `garage_tok` from `localStorage`.

## Dependencies
- **Internal:** `store/taskroom/templateStore.ts` - template state and API calls (`StageTemplate` and `Stage` types are imported too); `store/taskroom/taskroomWorkspace.tsx` - `createRoom`; `components/ui/button.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx` - shadcn primitives.
- **Packages:** `axios` - the room PUT; `jwt-decode` - reads `userId` from the token; `next` - `useRouter` (passed to `createRoom`); `react`; `sonner`; `lucide-react`; `js-cookie` (imported but unused).

## Used by
Nothing imports this copy; it appears unused. `app/taskroom/Layout.tsx` imports a near-identical twin, `app/taskroom/components/task-stage-template-dialog.tsx`, and even that usage is commented out.

## Notes
- `jwtDecode(localStorage.getItem("garage_tok"))` runs on every render with no guard. With no token (or during server rendering, where `localStorage` does not exist) it throws and crashes the component.
- The "Inherit from Space / Use custom statuses" radios are not wired to anything, and neither is "Learn more about statuses".
- `saveEdit` copies the array but changes the stage object in place, so the stage in the store's `templates` array is edited before saving.
- A leftover debug line runs `console.log('selectedTemplate', handleTemplateChange)` on every render.
- The light-theme text classes (`text-gray-700`) are mixed with dark-theme stage panels, so it may look inconsistent in the dark UI.
