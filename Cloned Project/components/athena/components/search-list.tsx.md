# `components/athena/components/search-list.tsx`

> A Flowboard global-search box with a results dropdown, grouped into boards, stages and cards, each section loading more results as you scroll.

**Kind:** React component · **Lines:** 506

## Purpose
This provides a single search field that searches every board, stage and card the user can see, through the external Flowboard API's global search endpoint. Results open in a popover beneath the input. Each result is rendered by `search-result-item.tsx`, which navigates to the board or card, or asks the parent to load a stage. The import graph lists `Dashbaord.tsx` as its importer, but that import is commented out, so in this tree the Athena copy is not mounted (see Used by).

## How it works
**State (L87-L107)**
- `results` holds three sections (`boards`, `stages`, `cards`), each `{ items, metadata, isLoading }`. `metadata` is `{ count, totalPages, currentPage, nextPage }`.
- `isSearching` covers the initial query. `isOpen` controls the dropdown.
- There is a ref for the scroll container and three sentinel refs.

**Initial search (L109-L168, L263-L269)**
- `query` is controlled by the parent through the `query` and `setQuery` props.
- A 300ms debounce calls `fetchResults(query)`:
  - an empty query clears every section;
  - otherwise it requests `GET https://uatapi.garage.app/flowboard/v1/boards/global/search?searchData=<query>` with `Authorization: Bearer <auth-token cookie>`, scrolls the list back to the top, and fills all three sections from `data.boards`, `data.stages` and `data.cards`.

**Load more (L170-L261, L272-L321)**
- `loadMore(collection)` requests the next page for one section, adding `collection=board|stage|card&page=N` to the same endpoint, and appends the items.
- **Rule:** cards do not paginate until every stage page has loaded. This keeps the visual order stable.
- A section stops loading once `currentPage >= totalPages`.
- One effect rebuilds three IntersectionObservers (root = the scroll container, threshold 0.1, `rootMargin` 50px) whenever `results` changes. Each observer watches the sentinel at the bottom of its section.

**Open and close (L323-L340)**
- A `mousedown` on the document outside the container closes the dropdown.
- Focusing the input, or any non-empty query, reopens it.

**Rendering (L348-L505)**
- The input has a clear (X) button.
- The dropdown shows one of: a spinner with "Searching...", "No results found for <query>", or the three sections. Each section has a count badge (`metadata.count`, or the item count) and its sentinel.
- Items are mapped into the `SearchResultItem` shape:
  - boards: `name` and `description`
  - stages: `name`, `description`, `priority`, `tags`, `isOverDue`, `isCompleted`, `roomId`
  - cards: `name`, with `roomId` taken from `boardId`, and `taskId`

## Exports
- `default SearchList({ query, setQuery, setIsFetchingColumns, sortOrder, stageFunction })` - the search box. `stageFunction(stageId)` is called when a stage result is clicked. `setIsFetchingColumns` and `sortOrder` are passed through to each result unchanged.

## Interfaces
- **External services:** `https://uatapi.garage.app/flowboard/v1/boards/global/search` (Flowboard API, not part of this repo).
- **Browser storage / cookies:** reads the `auth-token` cookie through `js-cookie` and sends it as the Bearer token.

## Dependencies
- **Internal:** `components/athena/components/search-result-item.tsx` - renders each result.
- **Packages:** `react`; `lucide-react` - `Search`, `X` and `Loader2` icons; `js-cookie` - reads the auth cookie.

## Used by
The import graph lists `components/athena/components/Dashbaord.tsx`, but the import there is commented out (`// import SearchList from "./search-list"`). No other file imports this Athena copy, so it appears unused. Separate copies with the same name exist under `app/(dashboard)/flowboard/[symbol]/components/` and `app/(dashboard)/taskroom/all-taskrooms/components/`.

## Notes
- Re-enabling this file would also pull in `search-result-item.tsx`, whose `@/store/boardStore` import does not resolve in this project.
- The search endpoint is hard-coded to the UAT host.
- `loadMore` depends on the whole `results` object, so the observers are torn down and rebuilt after every state change. This works but is wasteful.
