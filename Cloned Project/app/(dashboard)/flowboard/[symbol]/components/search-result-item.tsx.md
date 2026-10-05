# `app/(dashboard)/flowboard/[symbol]/components/search-result-item.tsx`

> One clickable row in the Flowboard search dropdown; depending on the result type it opens a board, narrows the current board to a stage, or deep-links to a card.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 111

## Purpose

`SearchList` renders a `SearchResultItem` for every board, stage and card hit returned by the external Flowboard global search. The row shows the hit and turns a click into navigation that fits its type.

## How it works

- **Click handling (`approute`):**
  - `category === "boards"`: `router.push("/flowboard/<id>")`.
  - `category === "stages"`: calls the board's `stageFunction(id)`. The board then refetches its details narrowed to that stage (`fetchBoardDetailsStageId` in the board store).
  - `category === "cards"`: `router.push("/flowboard/<roomId>?cardId=<id>")`. Here `roomId` is the card's board id. `KanbanBoard` reads the `cardId` query parameter and opens that card in `CardModal`.
- **Display:**
  - a coloured dot from `categoryColors`
  - the title, plus a green "Completed" label when `isCompleted` is true
  - an optional description
  - an optional row with a priority pill (`priorityColors` for high, medium or low), tag pills coloured by `getTagVariant(tag)` (a fixed lookup table of known tag names, grey otherwise), and an "Overdue" label

## Exports
- `default SearchResultItem({ item, setIsFetchingColumns, sortOrder, stageFunction })`.
  - `item` is a `SearchItem`: `{ id, title, description, category: "stages" | "boards" | "cards", priority?, tags?, isOverDue?, isCompleted?, roomId?, taskId? }`.
  - `stageFunction(id)` is the board's narrow-to-stage callback.

## Dependencies
- **Internal:** `store/flowboard/boardStore` (`useBoardStore`).
- **Packages:** `next/navigation` (`useRouter`, `useParams`).

## Used by
`search-list.tsx` only, on the route `/flowboard/<boardId>`.

## Notes
- The keys of `categoryColors` (`rooms`, `tasks`, `subTasks`) do not match the categories actually passed in (`boards`, `stages`, `cards`). Every result therefore falls back to the orange `tasks` dot.
- `fetchBoardDetailsStageId`, `useParams`, `setIsFetchingColumns` and `sortOrder` are taken but never used.
- A debug `console.log` runs on every click.
