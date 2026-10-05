# `app/(dashboard)/thoughts/components/NoteCard.tsx`

> Card that previews one Thoughts note (title, text preview, tags, date) with hover actions for pin, star, edit, version history, colour, archive/restore and delete.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 280

## Purpose
The grid views of the Thoughts app (Archive, Starred, Trash, Recovery) show notes as Google-Keep-style cards. This component draws one card and turns button clicks into calls on a `NoteActions` object supplied by the page. It holds no data and makes no network calls; the page decides what each action does.

## How it works
**Modes.** Two boolean props change the card's behaviour:
- default (neither flag) - regular note: pin, star, edit, history, colour, Archive, Delete.
- `showArchiveActions` - card at 80% opacity, no pin button, menu shows "Unarchive" (calls `actions.onRestore`), footer reads "Archived".
- `showTrashActions` - card at 60% opacity, no pin/star/edit/history/colour, menu shows "Restore" (`onRestore`) and "Delete forever" (`onDelete`), footer reads "Deleted <relative time>" from `note.deletedAt`.

**Content.** Background colour comes from `getColorClass(note.color)`. The title is clamped to 2 lines. The body uses `getNotePreview(note.content, 300)`, which extracts plain text from the stored BlockNote JSON and truncates it, clamped to 6 lines. Up to 3 tags are shown as `#tag` chips plus "+N more".

**Actions.** Every handler calls `e.stopPropagation()` so the card's own `onClick` (open the note) does not fire. The pin button shows only for regular notes. The star button is always visible when starred and otherwise appears on hover. The "more" dropdown (Radix `DropdownMenu`) holds Edit (`actions.onEdit(note)`), Version history (only when `onVersionHistory` is passed), Change color, Archive/Unarchive/Restore and Delete.

**Colour picker.** "Change color" toggles local `showColorPicker` state, which renders `ColorPicker` inline at the bottom of the card. A pick calls `actions.onColorChange(note.id, color)` and closes it.

**Footer.** Shows `formatDate(note.updatedAt)` (relative: "Just now", "5m ago", "Yesterday", ...) for regular notes, plus a small pin icon when the note is pinned.

## Exports
- `default NoteCard({ note, actions, onClick?, showArchiveActions = false, showTrashActions = false, onVersionHistory? })`
  - `note: Note`; `actions: NoteActions` (`onStar`, `onArchive`, `onDelete`, `onRestore`, `onPin`, `onColorChange`, `onEdit`); `onClick` makes the card clickable; `onVersionHistory(noteId)` enables the history menu item.

## Dependencies
- **Internal:** `../types` (`Note`, `NoteActions`, `getColorClass`, `formatDate`, `getNotePreview`); `./ColorPicker`; `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/dropdown-menu.tsx` (shadcn/Radix wrappers); `lib/utils.ts` (`cn`).
- **Packages:** `react`; `lucide-react` icons.

## Used by
- `app/(dashboard)/thoughts/archive/page.tsx`
- `app/(dashboard)/thoughts/recovery/page.tsx`
- `app/(dashboard)/thoughts/starred/page.tsx`
- `app/(dashboard)/thoughts/trash/page.tsx`

## Notes
- Cards use `break-inside-avoid` and `mb-4` because the parents lay them out with CSS columns (masonry), not CSS grid.
- Tag chips use the array index as React key.
