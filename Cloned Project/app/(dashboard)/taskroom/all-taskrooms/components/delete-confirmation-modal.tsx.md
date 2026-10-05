# `app/(dashboard)/taskroom/all-taskrooms/components/delete-confirmation-modal.tsx`

> Confirmation dialog shown before a TaskRoom is permanently deleted.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 91

## Purpose
Separates the "are you sure" step from the delete logic. The parent dashboard owns the actual API call; this component only displays the room name and reports Cancel or Confirm.

## How it works
- Returns `null` unless `isOpen` is true and a `taskRoom` is provided.
- Renders a fixed full-screen overlay with a card: red warning icon, "Delete TaskRoom" title, the room's name in bold, and a note that the action cannot be undone.
- **Cancel** and the header X call `onClose`; **Delete TaskRoom** calls `onConfirm`.
- While `isLoading` is true all buttons are disabled and the confirm label changes to "Deleting...".
- A local `TaskRoom` interface (with `_id`, `name`, `description`, `color`, `progress`, `members`, `dueDate`, `createdAt`, `conversationId`) types the prop; only `name` is actually displayed.

## Exports
- `DeleteConfirmationModal({ isOpen, onClose, onConfirm, taskRoom, isLoading = false })` - the dialog component.

## Dependencies
- **Internal:** `components/ui/button.tsx` - shadcn `Button`.
- **Packages:** `lucide-react` - `AlertTriangle` and `X` icons.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx` - wires `onConfirm` to its `handleDeleteTaskRoom`, which calls the external Taskroom API.

## Notes
- The overlay has no click-outside or Escape handling; only the buttons close it.
