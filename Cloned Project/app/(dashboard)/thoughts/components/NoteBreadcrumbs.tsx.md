# `app/(dashboard)/thoughts/components/NoteBreadcrumbs.tsx`

> Notion-style breadcrumb bar for nested Thoughts pages: shows the path to the open page, collapses long paths behind "…", and on hover opens a flyout listing the hovered page's siblings for quick navigation.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 387

## Purpose
Thoughts notes can be nested (a note has a `parentId`, and sub-pages are notes too). Both the full-page editor (`thoughts/page.tsx`) and the slide-over `NoteDrawer` show a top bar with the ancestor chain. This component renders that chain and its hover menus. Navigation itself is left to the parent through `onNavigate(noteId)`.

## How it works
**Path display (L205-L219, L226-L321).** `items` is the ancestor chain, root first, with the current page last. With 6 or fewer items all are shown. Longer chains show the first item, an ellipsis entry holding `items.slice(1, -3)`, and the last three. Segments are separated by `/`. Each segment shows the note's emoji `icon` or a `FileText` icon. Titles are truncated by `truncateTitle` (18 characters for the first segment, 12 for middle ones). The last segment is shown in full ("New page" if empty) and emphasised. Clicking any segment calls `onNavigate(id)`.

**Ellipsis menu.** Clicking or hovering "…" opens a portal dropdown (positioned under the button) listing the hidden ancestors. It closes on mouse-leave, on an outside `mousedown`, or after a selection.

**Sibling flyout (L113-L203, L323-L377).** Hovering a segment starts a 120 ms timer (`openHover`). When it fires, the component measures the segment button (refs kept in `crumbBtnRefs`), sets `flyoutPos`, and calls `loadFlyout(item)`:
1. It first looks in the `allNotes` prop for notes with the same `parentId` (siblings, not children, matching Notion), computing `hasChildren` from either the note's flag or any note whose `parentId` points at it.
2. If none are found locally it calls the notes API: `GET notes?parentId=<id>&limit=50`, or `parentId=null` for root pages. Deleted and archived notes are filtered out.
3. On an empty result or an error it falls back to showing just the hovered item.

The flyout is portalled to `document.body` (`data-notion-page-flyout`, `z-[100000]`). Its header is the parent's title (looked up in `items`, then `allNotes`) or "Pages" for root items. Rows are `NotionDropdownItem`s, which highlight the hovered and active notes and can expand sub-pages. Only 8 rows are shown (`FLYOUT_VISIBLE`) until "+ N more" is clicked. Leaving the segment or flyout schedules a close after 160 ms; re-entering cancels it, so the pointer can travel from segment to flyout. Both timers are cleared on unmount.

**Edited label.** If `editedLabel` is given (e.g. "Edited 3m ago"), it is shown right-aligned.

## Exports
- `default NoteBreadcrumbs({ items, onNavigate, allNotes = [], activeNoteId?, editedLabel?, className = "" })` - returns `null` when `items` is empty.
- `interface BreadcrumbItem { id; title; icon?; hasChildren?; parentId? }` - one path segment.

## Interfaces
- **Backend endpoints called** (external service `https://uatapi.garage.app/api`, via `buildExternalUrl`, not this repo's `/backend`): `GET /api/notes?parentId=<id|null>&limit=50` - load sibling pages when they are not already in `allNotes`.

## Dependencies
- **Internal:** `./NotionDropdownItem` (default component + `NoteItemData` type) - flyout rows; `lib/api-config.ts` (`buildExternalUrl`) - notes-API URL; `utils/api.ts` (`authenticatedFetch`) - authenticated request.
- **Packages:** `react`; `react-dom` (`createPortal`); `lucide-react` (`ChevronRight`, `FileText`, `Loader2`).

## Used by
- `app/(dashboard)/thoughts/page.tsx` (full-page note view)
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`

## Notes
- The portals are only created after the `mounted` flag is set in an effect, which avoids touching `document` during SSR.
- The ellipsis dropdown's position is read from `ellipsisRef` at render time, so it will not follow the button on scroll until the next render.
- `loadFlyout` sets `flyoutLoading` to true even when siblings come from `allNotes`; the `finally` block resets it, so the spinner may flash for one render.
- Every hover of a segment whose siblings are not in `allNotes` triggers a fresh API call; results are not cached.
