# `components/athena/components/remove-member-confirm-dialog.tsx`

> A reusable "Remove <name>?" confirmation dialog for taking a member out of a Taskroom room, space or workspace.

**Kind:** React component · **Lines:** 66

## Purpose
Several Athena/Taskroom member-management screens need the same destructive confirmation before they call a "remove member" API. This component is that confirmation step and nothing more. It calls no API itself; the caller's `onConfirm` does the actual removal.

## How it works
- It renders the shared `Dialog` / `DialogContent` with a rose warning icon.
- The title is "Remove {memberName}?". If no name is given, it says "this member".
- The body is "They will be removed from this {scope} and lose access.", where `scope` is `"room"`, `"space"` or `"workspace"`.
- **Cancel** calls `onOpenChange(false)`. **Remove** calls `onConfirm`.
- While `loading` is true, both buttons are disabled and Remove shows a spinning `Loader2`.

## Exports
- `type RemoveMemberScope = "room" | "space" | "workspace"` - the word shown in the message.
- `RemoveMemberConfirmDialog({ open, onOpenChange, onConfirm, loading?, memberName?, scope })` - the dialog.

## Dependencies
- **Internal:** `components/ui/dialog.tsx`, `components/ui/button.tsx`.
- **Packages:** `lucide-react` - `AlertTriangle` and `Loader2` icons.

## Used by
- `components/athena/components/WorkspacePeopleDashboard.tsx`
- `components/athena/components/room-members-dialog.tsx` (with `scope="room"`)
- `components/athena/components/space-members-dialog.tsx`
