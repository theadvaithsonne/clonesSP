# `components/athena/components/kanban-columnbacvkup.txt`

> An old backup copy of the Athena `KanbanColumn` component, saved as a `.txt` file so it is never compiled or imported. It is dead reference code.

**Kind:** backup source file (plain text holding TSX) · **Lines:** 919

## Purpose
This is an earlier version of `components/athena/components/kanban-column.tsx`, kept by hand as a backup. The file name is a misspelling of "backup". Because of the `.txt` extension, Next.js, TypeScript and the bundler all ignore it, and nothing imports it. Use it only to see how the column used to behave. The live component is `kanban-column.tsx`.

## How it works (what the old version did)
It defines a `KanbanColumn` with mostly the same props as the live file, plus a few differences.

- **Sortable as well as droppable:** the column was both a `useSortable` item and a `useDroppable` target, joined through `combinedRef`. Its header got the drag listeners, so stages could be reordered by dragging. The live version is droppable only.
- **Rename instead of an edit popover:** the "More" menu had **Rename**, which edited the name inline. `handleUpdateTitle` calls `onUpdate(id, newTitle)` after the same client-side JWT `exp` check on the `auth-token` cookie. The live version has an "Edit Stage" popover with colour presets and calls `onUpdate(id, { name, color })`.
- **Delete through `confirm()`:** a browser `confirm("Are you sure you want to delete this list?")` instead of the live Radix confirmation dialog.
- **Pagination:**
  - it used `column.cardCount` and only fetched when more than 10 cards existed (the live version uses `taskCount > 30`);
  - it auto-fetched on mount when the column was empty but the metadata reported cards;
  - it called `fetchCardsForStage(boardId, column._id, nextPage)` with three arguments, a different signature from the current store;
  - the scroll threshold (150px), the 300ms throttle and the `ResizeObserver` refill match the live file.
- **Quick-add forms:** top and bottom copies, as in the live file. Differences:
  - the start date defaulted to `Date.now()`;
  - a `position: 'top' | 'bottom'` field was sent to `onAddCard`;
  - `TagPicker` received `boardId={workspaceId}` straight from the URL search parameters;
  - `addCardContainerRef` was attached, so clicking outside closed the form.
- A "Session Expired" dialog routes to `/login`.

## Exports
- `KanbanColumn` - would be exported if this were a `.ts`/`.tsx` module. As a `.txt` file it exports nothing at runtime.

## Dependencies
Its source text imports the same modules the live column uses: `@dnd-kit/sortable`, `@dnd-kit/core`, `@dnd-kit/utilities`, `./kanban-card`, `./Dashbaord`, `store/athena/cardStore`, `./stage-summary-dialog`, the four pickers, `components/ui/dialog`, `components/ui/button`, `js-cookie`, `next/navigation`, `sonner` and `lucide-react`. None of these imports is resolved, because the file is never compiled.

## Used by
Nothing. It appears unused, and a `.txt` file cannot be imported as a component.

## Notes
- **Do not revive it as is.**
  - `triggerFetch` begins with a stray `alert()` (L195), which would pop a browser alert on every load-more.
  - It logs `column?.cardCount` and `showExpiredDialog` on every render.
  - The `onAddCard` payload includes `position`, which the declared type does not allow.
  - The `fetchCardsForStage` call no longer matches the store's signature.
- Safe to delete once nobody needs it for reference. It is kept only because it was copied into the merged project.
