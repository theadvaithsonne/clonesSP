# `components/athena/components/import-export/PaginatedSelectColumn.tsx`

> A generic, titled, scrollable list of radio-style cards that loads more pages when the user scrolls near the bottom. The Import / Export wizard uses it to pick a workspace, space and room.

**Kind:** React component · **Lines:** 191

## Purpose
The destination step of `ImportExportDashboard` needs three selection lists side by side, one each for workspaces, spaces and rooms. Each list comes from a paginated Taskroom endpoint. This component draws one such column and decides when the parent should fetch the next page. The parent keeps the items, the pagination metadata and the fetch logic.

## How it works
- **Rendering states, in order of priority:**
  1. `showPlaceholder` shows `placeholderMessage`, for example "Select a workspace" while the parent level has no selection yet.
  2. `loading` with no items shows a centred spinner.
  3. No items shows `emptyMessage`.
  4. Otherwise it shows one `SelectCard` per item, then a 1px sentinel `<div>`, then a footer: a spinner while `loadingMore`, "Scroll for more" while more pages remain, or "All loaded" when there are none.
- **`SelectCard`** (internal) is a full-width button with a radio-dot indicator, a label, and an optional sub-label. The selected card is highlighted with the `--brand` colour.
- **Loading more pages.** `hasMorePages(metadata)` from `importExportApi.ts` is true when `nextPage` is set or `currentPage < totalPages`. `tryLoadMore` calls `onLoadMore()` only when nothing is loading and more pages remain. Three mechanisms can trigger it:
  1. An `IntersectionObserver` on the sentinel, scoped to the scroll container with an 80px bottom `rootMargin`.
  2. An effect that runs when the item count or `metadata.currentPage` changes. It loads more straight away if the list does not yet overflow its container, or if the user is already within 80px of the bottom. This stops short pages from getting stuck.
  3. An `onScroll` handler that applies the same 80px threshold.
- The list area is capped at `max-h-52` and scrolls internally (`overscroll-contain`).

## Exports
- `PaginatedSelectColumn<T extends { _id: string }>(props)`, where the props are:
  - `title`: the column heading. It is highlighted when `selectedId` is set.
  - `items`, `selectedId`, `onSelect(item)`, `getLabel(item)`.
  - `emptyMessage`, `placeholderMessage?` (default "Select an option above"), `showPlaceholder?` (default `false`).
  - `loading`, `loadingMore`, `metadata: ListMetadata | null`, `onLoadMore()`.

## Dependencies
- **Internal:** `./importExportApi` (the `hasMorePages` helper and the `ListMetadata` type), `./importExportStyles` (the `ie` class tokens), `lib/utils.ts` (`cn`).
- **Packages:** `react`, `lucide-react` (the `Loader2` spinner).

## Used by
- `components/athena/components/import-export/ImportExportDashboard.tsx` renders it three times, for workspace, space and room.

## Notes
- `SelectCard` accepts a `sub` prop, but this component never passes one, so sub-labels are never shown.
- The parent also guards duplicate fetches with refs, so the overlapping triggers here cannot cause parallel requests for the same page.
