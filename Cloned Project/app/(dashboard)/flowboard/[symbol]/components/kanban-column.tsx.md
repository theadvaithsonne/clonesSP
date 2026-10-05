# `app/(dashboard)/flowboard/[symbol]/components/kanban-column.tsx`

> One stage (list) column on the Flowboard Kanban board: a droppable target with paginated card loading, inline add-card, rename/delete menu and a stage-summary dialog.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 585

## Purpose

`KanbanBoard` renders one `KanbanColumn` per stage. The column shows the stage name and card count, lists its `KanbanCard`s in a vertical sortable list, loads more cards from the external Flowboard API as the user scrolls, and exposes the stage-level actions (add card, rename, delete, open a summary). It owns no persistent data itself: card creation, rename and delete are passed up to the board through callbacks, and fetched cards are written into the board's state with `setColumns`.

## How it works

### Drag and drop (L76-L99, L342-L359)
- The column is both a `useSortable` item (`data.type = "Column"`) and a `useDroppable` target with the same id (`column._id`). The two refs are merged in `combinedRef`.
- When a card hovers over the column, `isOver` adds a blue ring. Dropping a card on the column is handled by `KanbanBoard.handleDragEnd`.
- Sorting is disabled while the title is being edited or for read-only viewers. The header carries the sortable listeners, but the board does not handle column drops, so columns cannot actually be reordered.

### Paginated card loading (L111-L279)
- The board's first fetch includes the first page of cards. `pageRef` (starting at 1) and `totalPagesRef` track this column's paging, and `stageExhausted` stops further requests.
- `canFetchMore()` returns false when the stage is exhausted, a fetch is already running, or the last page has been reached. **It also only allows fetching when `column.cardCount > 10`**, meaning the stage has more than one page.
- `triggerFetch()` calls `useCardStore().fetchCardsForStage(boardId, column._id, nextPage)` (which does `GET https://uatapi.garage.app/flowboard/v1/cards/list?boardId&stageId&size&page`), appends cards not already present, and maps them to the `Card` shape.
- Fetching starts in three ways:
  1. Once on mount, if the column arrived empty but `cardCount > 0`.
  2. When the cards container is scrolled within 150px of the bottom. The scroll handler is throttled to one call per 300ms.
  3. From a `ResizeObserver`, when the content is shorter than 80% of the visible height (for example after cards were dragged away).
- A "Loading more cards..." spinner shows while a fetch is in progress.

### Actions (L281-L340, L418-L563)
- **Add card:** the "Add a card" button opens a textarea. Enter (without Shift) or the button calls `onAddCard(column._id, title)`; Escape cancels.
- **Rename:** the kebab menu's "Rename" option switches the title to an input. Blur or Enter calls `onUpdate(id, newTitle)` when the title changed; Escape reverts.
- **Delete:** the kebab menu's "Delete" option asks `confirm("Are you sure you want to delete this list?")` and then calls `onDelete(id)`.
- Before each of these actions, a client-side check decodes the `garage_tok` JWT and, if `exp` has passed, opens a "Session Expired" dialog that routes to `/login`. Observers get the toast "Observers can only view this board", and the kebab menu is hidden for them.
- **Stage summary:** the share icon in the header opens `StageSummaryDialog` for this stage (`stageId`, `stageName`).
- Clicking outside the kebab menu closes it (a document `mousedown` listener).
- The header shows the stage name with each word capitalised and a black badge with `localCardCount`, which the board keeps in step with creates, moves and deletes.

## Exports
- `KanbanColumn(props: KanbanColumnProps)` - props: `column: Column`, `onAddCard(columnId, title)`, `onUpdate?(id, newTitle)`, `onDelete?(id)`, `isOverlay?`, `boardId`, `orgId`, `userId`, `setColumns` (board state setter), `isReadOnly?`, `connected` (board socket flag), `updateTaskAndCardCounts(...)`. The last three are passed down to each `KanbanCard`.

## Interfaces
- **External services:** Flowboard API `GET https://uatapi.garage.app/flowboard/v1/cards/list`, called through `cardStore.fetchCardsForStage`.
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the expiry check.

## Dependencies
- **Internal:** `./kanban-board` (`Column` type), `./kanban-card`, `./stage-summary-dialog`, `store/flowboard/cardStore` (`fetchCardsForStage`), `components/ui/{button,dialog}`.
- **Packages:** `@dnd-kit/core` (`useDroppable`), `@dnd-kit/sortable`, `@dnd-kit/utilities`, `sonner`, `lucide-react`, `next/navigation`, `react`. `js-cookie` is imported but unused.

## Used by
`kanban-board.tsx` only, on the route `/flowboard/<boardId>`.

## Notes
- Cards loaded by pagination are mapped without `isCompleted`, `isOverDue`, `commentCount`, `startDate` or `TaskDataCount`. Those cards therefore show no overdue badge, 0 comments and an empty checklist count until a socket update fills them in.
- The `handleAddCard` expiry check logs the raw token and its decoded payload to the console (`console.log("vcxvxvxcv2", token)`), which leaks the JWT into browser logs.
- The `totalCardCount > 10` rule is hardcoded to match the page size of 10 that the board uses.
- `CommentItem` and several imported icons are unused.
