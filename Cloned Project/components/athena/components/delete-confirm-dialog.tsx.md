# `components/athena/components/delete-confirm-dialog.tsx`

> A styled confirmation modal for permanently deleting a Taskroom space or room.

**Kind:** React component · **Lines:** 73

## Purpose
Deleting a space or a room in the Taskroom / Athena sidebar cannot be undone. Deleting a space removes all of its rooms, and deleting a room removes all of its tasks. This component asks the user to confirm before the caller performs the deletion. It only presents the choice. The caller does the actual API call in `onConfirm` and passes back a `loading` flag.

## How it works
- The title reads "Delete {itemName}?". Without an `itemName` it falls back to "this space" or "this room", depending on `scope`.
- The description depends on `scope`:
  - `space`: "This space and all its rooms will be permanently deleted…"
  - `room`: "This room and all its tasks will be permanently deleted…"
- The dialog renders `DialogContent` with `showCloseButton={false}`, a prop of the project's `components/ui/dialog.tsx`, so the only ways out are Cancel, clicking outside the dialog, or pressing Escape.
- Cancel calls `onOpenChange(false)`. Delete calls `onConfirm`. While `loading` is true, both buttons are disabled and Delete shows a spinner.

## Exports
- `DeleteConfirmDialog({ open, onOpenChange, onConfirm, loading = false, itemName?, scope })` is the modal.
- `type DeleteConfirmScope = "space" | "room"` is the type of the `scope` prop.

## Dependencies
- **Internal:** `components/ui/dialog.tsx` (`Dialog`, `DialogContent`), `components/ui/button.tsx`.
- **Packages:** `lucide-react` (the `AlertTriangle` and `Loader2` icons).

## Used by
- `components/athena/components/workspacesidebar.tsx` uses it for deleting spaces and rooms.

## Notes
`components/dashboard/DMPage.tsx`, `GlobalDMPage.tsx` and `GroupChatPage.tsx` also render a `<DeleteConfirmDialog>`, but the import graph does not list them as importers of this file. They most likely use a different component with the same name; check their imports before changing this one.
