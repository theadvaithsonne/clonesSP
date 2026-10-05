# `app/(dashboard)/thoughts/archive/page.tsx`

> Client page for the Thoughts (notes) app's "Archived Notes" view: lists the user's archived notes, lets them search, filter by tag, unarchive, star, pin, recolour, edit, view version history or trash a note.

**Kind:** Next.js page · **Lines:** 402 · **Route:** `/thoughts/archive`

## Purpose
Thoughts is Garage's Notion/Keep-style notes app. Each section of it (All Notes, Starred, Templates, Archive, Trash, Recovery) is a separate App Router page, and the same page components are also rendered "inline" inside the dashboard by `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx`. This file is the Archive section. It does not talk to this repo's Express backend: all note data lives in the external Garage notes API at `https://uatapi.garage.app/api` (see `lib/api-config.ts`).

## How it works
**State.** Holds the fetched `notes`, the search box text, the selected tag filter, drawer state (`isDrawerOpen`, `editingNoteId`, `openInEditMode`) and version-history state (`showVersionHistory`, `versionHistoryNoteId`).

**Loading (`fetchArchivedNotes`).** Calls `GET notes?isArchived=true[&search=...]` on the external API through `authenticatedFetch` (adds the Bearer token, sends cookies). On success it stores `data.notes`; on failure it shows a sonner toast. It runs:
- once on mount;
- when a `thoughts:inline-refresh` window event arrives with `detail.section === "archive"` (fired by the refresh button in `ThoughtsApp`);
- 700 ms after the search text stops changing (debounced; the first render is skipped with an `isFirstRender` ref so mount does not fetch twice).

**Tag integration with the sidebar.** Whenever `notes` changes, the page collects every unique tag, sorts them and dispatches a `thoughts_tags_updated` window event with the list. It listens for `thoughts_tag_filter` (dispatched by `components/dashboard/backOfficeAppSideBar.tsx` when a tag is clicked; `null` clears it) and stores the tag as `selectedTag`.

**Actions** (each calls the external API, then updates local state optimistically from the response and toasts):
- `restoreNote` - `PUT notes/:id/archive` (a toggle on the API); removes the note from the list ("Note restored to All Notes").
- `toggleStar` - `PUT notes/:id/star`; copies `result.isStarred` into the note.
- `deleteNote` - `DELETE notes/:id`; the note is soft-deleted ("moved to trash") and removed from the list.
- `handleUpdateNote` - `PATCH notes/:id` with a JSON body; replaces the note with `result.note`. Used for colour changes.
- pin (inline in `noteActions.onPin`) - `PUT notes/:id/pin`; copies `result.isPinned`.

These are bundled into a `NoteActions` object for `NoteCard`. In this view both `onArchive` and `onRestore` map to `restoreNote`, so the card's archive button unarchives.

**Rendering.** Client-side filtering is applied on top of the server result: only `isArchived` notes, title/content containing the search text (case-insensitive), and the selected tag. Notes are split into "Pinned" and "Others" sections in a CSS-columns masonry grid of `NoteCard`s with `showArchiveActions`. Loading shows `LoadingSpinner`; an empty list shows a context-aware empty state. Clicking a card opens `NoteDrawer` in view mode; "Edit" opens it in edit mode. The drawer's `onSave` replaces the matching note in place, while `onDelete`/`onArchive` remove it. `VersionHistory` is mounted only when a note is chosen and triggers a full refetch after a version is restored.

## Exports
- `default ArchiveNotesPage()` - the page component; takes no props.

## Interfaces
- **Backend endpoints called** (external service `https://uatapi.garage.app/api`, not this repo's `/backend`):
  - `GET /api/notes?isArchived=true&search=...` - list archived notes
  - `PUT /api/notes/:id/archive` - toggle archive (used to unarchive)
  - `PUT /api/notes/:id/star` - toggle star
  - `PUT /api/notes/:id/pin` - toggle pin
  - `PATCH /api/notes/:id` - update fields (colour)
  - `DELETE /api/notes/:id` - move to trash
- **Browser events:** listens for `thoughts:inline-refresh` and `thoughts_tag_filter`; dispatches `thoughts_tags_updated`.
- **Browser storage / cookies:** indirectly, via `authenticatedFetch` (`auth-token` / `garage_tok` in localStorage, `auth-token` cookie).
- **Background work:** 700 ms debounce timer for search.

## Dependencies
- **Internal:** `lib/api-config.ts` (`buildExternalUrl`) - builds external notes-API URLs; `utils/api.ts` (`authenticatedFetch`) - authenticated fetch; `../types` (`Note`, `NoteActions`, `UpdateNoteData`); `../components/NoteCard`, `NoteDrawer`, `VersionHistory`, `LoadingSpinner`; `components/ui/input.tsx` (search box). `components/ui/button.tsx`, `components/ui/card.tsx` and `lib/utils.ts` are imported but unused.
- **Packages:** `react`; `next/navigation` (`useRouter`, unused); `lucide-react` icons; `sonner` toasts.

## Used by
- Next.js route `/thoughts/archive`.
- `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx` - loads it with `next/dynamic` (SSR off) for the inline "Archive" section.

## Notes
- Several imports are dead (`useRouter`/`router`, `Button`, `Card`, `CardContent`, `ArchiveRestore`, `Star`, `Trash2`, `cn`, `NotesGridSkeleton`).
- Action handlers update state with the `notes` value captured at render (`setNotes(notes.filter(...))`) rather than a functional update, so two quick actions can overwrite each other.
- The client filter calls `note.content.toLowerCase()`; a note with no `content` would throw.
- The notes API base URL is hardcoded in `lib/api-config.ts` (UAT host), not taken from an env var.
- The archive, starred, trash and recovery pages share almost identical event/tag/fetch code.
