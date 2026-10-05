# `components/athena/components/search-result-item.tsx`

> One clickable row in the Flowboard global-search dropdown. It shows a board, stage or card result and navigates to it when clicked.

**Kind:** React component · **Lines:** 111

## Purpose
`search-list.tsx` shows global search results grouped into boards, stages and cards. Each result is rendered by this component. It shows the title, description, priority, tags and status, and handles what happens when the result is clicked.

## How it works
- `item` is a `SearchItem` with these fields:
  - `id`, `title`, `description`
  - `category`: `"stages"`, `"boards"` or `"cards"`
  - optional `priority`, `tags`, `isOverDue`, `isCompleted`, `roomId`, `taskId`
- **Click routing (`approute`)**:
  - `boards` → `router.push("/flowboard/<id>")`
  - `stages` → calls the parent's `stageFunction(id)`, which loads that stage in place
  - `cards` → `router.push("/flowboard/<roomId>?cardId=<id>")`; for cards, `search-list.tsx` passes the card's `boardId` as `roomId`
- **Visuals**:
  - The coloured dot comes from `categoryColors`. Its keys are `rooms`, `tasks` and `subTasks`, which never match the actual categories, so the dot always falls back to the `tasks` orange.
  - The priority chip uses `priorityColors` (high, medium, low), falling back to medium.
  - Tags are coloured through a lookup table in `getTagVariant`, falling back to grey.
  - "Completed" and "Overdue" labels appear when the matching flags are set.
- `useBoardStore()` is called to read `fetchBoardDetailsStageId`, but that value is never used.

## Exports
- `default SearchResultItem({ item, setIsFetchingColumns, sortOrder, stageFunction })` - the result row. `setIsFetchingColumns` and `sortOrder` are accepted but unused.

## Dependencies
- **Internal:** imports `useBoardStore` from `@/store/boardStore`. No such file exists in this project: the board stores live at `store/athena/boardStore.tsx` and `store/flowboard/boardStore.tsx`. See Notes.
- **Packages:** `next/navigation` - `useRouter`, `useParams` (imported; only `useRouter` is used).

## Used by
- `components/athena/components/search-list.tsx`

That file is itself not mounted anywhere (its only listed importer has the import commented out), so this component is effectively unreachable at runtime.

## Notes
- **Broken import:** `@/store/boardStore` does not resolve (`@/*` maps to the project root, and there is no `store/boardStore.*`). The bundler does not fail today only because nothing live imports this file. If you re-enable it, point the import at `store/athena/boardStore.tsx` (which defines `fetchBoardDetailsStageId`) or remove the unused hook call.
- `approute` contains a leftover `console.log`.
