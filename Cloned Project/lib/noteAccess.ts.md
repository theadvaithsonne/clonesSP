# `lib/noteAccess.ts`

> A pure helper that works out what the current user may do with a note (edit, comment, share) from the note's owner and collaborator list.

**Kind:** frontend library · **Lines:** 64

## Purpose
The Thoughts / notes page lets an owner share a note with collaborators at four permission levels. This file holds the client-side rules that turn a note plus the current user id into a set of capability flags and a badge label. Keeping them here means the UI checks permissions the same way everywhere on the page. It is display logic only; the backend must still enforce access.

## How it works
`resolveNoteAccess(note, currentUserId)` decides in this order:
1. **No note:** everything is `false` and `accessRole` is `null`.
2. **Owner or unsaved note:** if `note.userId` is missing (a local note not saved yet) or equals `currentUserId`, the user gets full rights: `accessRole: "owner"`, and edit, comment and share are all `true`.
3. **Collaborator:** otherwise it looks in `note.collaborators` for an entry whose `userId` **or** `id` matches the current user. Its `role` is used, defaulting to `"Can view"` when there is no matching entry or no role.
   - `canEdit` is true for `"Full access"` and `"Can edit"` (the `EDIT_ROLES` set).
   - `canComment` is true for those two plus `"Can comment"` (the `COMMENT_ROLES` set).
   - `canShare` is always `false` for non-owners, even with `"Full access"`.
   - `label` is a badge string: `null` when the user can edit, `"Can comment"` when they can only comment, and `"View only"` otherwise.

## Exports
- `resolveNoteAccess(note?: { userId?; collaborators? } | null, currentUserId?: string | null): NoteAccess` - computes the access flags described above.
- `type NoteShareRole` - `"Full access" | "Can edit" | "Can comment" | "Can view"`.
- `interface NoteCollaborator` - `{ userId?, id?, role? }`. Both id spellings are accepted because note payloads vary.
- `interface NoteAccess` - `{ accessRole, canEdit, canComment, canShare, isOwner, label }`.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `app/(dashboard)/thoughts/page.tsx` - the Thoughts (notes) page, at route `/thoughts`.

## Notes
- Unknown role strings are cast to `NoteShareRole` but match neither set, so they act as view-only.
- If a user is anonymous (`currentUserId` is null or undefined) and the note has no `userId`, they are treated as the owner. This is by design for unsaved local notes.
