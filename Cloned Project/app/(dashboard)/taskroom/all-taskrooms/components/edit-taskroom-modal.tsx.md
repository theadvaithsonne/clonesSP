# `app/(dashboard)/taskroom/all-taskrooms/components/edit-taskroom-modal.tsx`

> Modal form for editing an existing TaskRoom's name, description and colour theme.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 173

## Purpose
Lets the owner change a TaskRoom's basic details. Like the create modal, it only gathers input; the parent performs the update request.

## How it works
- **State:** `formData` (`UpdateTaskRoomRequest`: `name`, `description`, `color`).
- **Prefill:** a `useEffect` copies `name`, `description` and `color` from the `taskRoom` prop whenever it changes.
- **Colour picker:** five swatches from `colorOptions` (`blue`, `green`, `purple`, `orange`, `pink`); `handleColorSelect` updates the colour and the selected swatch is ringed and scaled up.
- **Submit:** `handleSubmit` calls `onSubmit(formData)` only when name and description are both non-blank. The modal does not close itself; the parent closes it on success.
- While `isLoading` is true every input and button is disabled and the submit label reads "Updating...".
- Returns `null` unless `isOpen` is true and `taskRoom` is set.

## Exports
- `EditTaskRoomModal({ isOpen, onClose, onSubmit, taskRoom, isLoading = false })` - `onSubmit` receives `{ name, description, color }`.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx` - shadcn form controls.
- **Packages:** `react` - state and effects; `lucide-react` - `X` close icon.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx` - passes `handleEditTaskRoom`, which calls `PUT https://uatapi.garage.app/taskroom/v1/rooms/{_id}`.

## Notes
- The local `TaskRoom` interface declares `id` while the parent's rooms are keyed by `_id`; only `name`, `description` and `color` are read here, so this mismatch is harmless.
