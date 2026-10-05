# `app/(dashboard)/flowboard/[symbol]/components/search-list.tsx`

> The Flowboard header search box: a debounced global search across boards, stages and cards on the external Flowboard API, with a grouped results dropdown that loads more results as you scroll.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 506

## Purpose

The board page's header lets users type a query ("Search boards, lists, cards, checklists...") and jump to a result. This component holds the search input and the results dropdown and does the HTTP calls itself, using `fetch` against the external Flowboard global-search endpoint. The parent `KanbanBoard` owns the `query` string. Clicking a result is handled by `SearchResultItem`, which navigates or narrows the board.

## How it works

- **Endpoint:** the constant `API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/boards/global/search"`. Every request sends `Authorization: Bearer <localStorage.garage_tok>`.
- **Initial search** (`fetchResults`): runs 300ms after `query` stops changing (`setTimeout` debounce). An empty query clears all sections. Otherwise it calls `GET ...?searchData=<query>`, expects `{ status, data: { boards, stages, cards } }` where each section is `{ data: [...], metadata: { count, totalPages, currentPage, nextPage } }`, and stores each section with an `isLoading` flag. A spinner ("Searching...") shows meanwhile, and the results pane scrolls back to the top.
- **Load more** (`loadMore(collection)`): asks for the next page of one section with `GET ...?searchData=<query>&collection=board|stage|card&page=<n>` and appends the results. It does nothing if the section is already loading or on its last page. Cards wait until every stage page has loaded, so the order is boards, then stages, then cards.
- **Infinite scroll:** each section ends with a sentinel `<div>`. An `IntersectionObserver` (rooted at the results pane, `threshold: 0.1`, `rootMargin: "50px"`) calls `loadMore` when a sentinel becomes visible. Observers are recreated whenever results change.
- **Dropdown visibility:** opens on focus or when the query becomes non-empty, closes on a `mousedown` outside the container, and has a clear (X) button. It shows "No results found for <query>" when every section is empty.
- **Rendering:** three groups (Boards, stages, cards), each with a count badge (`metadata.count`, or the number of items). Items are normalised into `SearchResultItem`'s shape:
  - boards: `category "boards"`
  - stages: `category "stages"`, plus priority, tags, overdue and completed flags and `roomId`
  - cards: `category "cards"`, with `roomId` taken from the card's `boardId`, plus `taskId`

## Exports
- `default SearchList({ query, setQuery, setIsFetchingColumns, sortOrder, stageFunction })`
  - `query` / `setQuery`: the controlled search text.
  - `setIsFetchingColumns` and `sortOrder`: passed through to each result item.
  - `stageFunction(stageId)`: the board callback that reloads the board narrowed to a stage.

## Interfaces
- **External services:** Flowboard API `GET https://uatapi.garage.app/flowboard/v1/boards/global/search?searchData=...[&collection=...&page=...]`.
- **Browser storage / cookies:** reads `localStorage.garage_tok` as the bearer token.

## Dependencies
- **Internal:** `./search-result-item` (renders and handles clicks on one result).
- **Packages:** `react`, `lucide-react` (Search, X and Loader2 icons). `js-cookie` is imported but unused.

## Used by
`kanban-board.tsx`, in the header of the route `/flowboard/<boardId>`.

## Notes
- The internal names still reflect an earlier "taskroom" design: the refs are `roomsSentinelRef`, `tasksSentinelRef` and `subTasksSentinelRef`, and the item interfaces are `RoomItem`, `TaskItem` and `SubTaskItem`, but they hold boards, stages and cards.
- Errors are only logged to the console; the user sees "No results found" instead.
- `fetchResults` has no request cancellation, so a slow earlier response can overwrite the results of a newer query.
