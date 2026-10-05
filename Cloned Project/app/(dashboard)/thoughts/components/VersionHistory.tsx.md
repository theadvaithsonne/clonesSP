# `app/(dashboard)/thoughts/components/VersionHistory.tsx`

> Client component that shows a note's saved versions in a right-hand slide-over, lets the user preview any version read-only in a BlockNote editor, and restores a chosen version.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 421

## Purpose
The Thoughts module (the in-app Notion-like notes editor at `/thoughts`) keeps version backups of each note on the external notes API. This component is the UI for that history: a list of versions, a full-width read-only preview, and a "Restore" action. It is opened from the Thoughts archive and starred pages with the id of the note in question.

## How it works
**State.** `versions` (list from the API), `isLoading`, `isRestoring` (id of the version currently being restored, or `null`), `selectedVersion` and `previewMode`.

**Editor schema (L66-L92).** A memoised `BlockNoteSchema` is built from BlockNote's `defaultBlockSpecs` plus sixteen custom Thoughts blocks from `./blocks` (`coverPhoto`, `documentList`, `calendarView`, `timelineView`, `chartView`, `linkedView`, `tableView`, `boardView`, `galleryView`, `nestedPage`, `pageLinkPill`, `mentionPerson`, `mentionPage`, `datePicker`, `reminder`, `tableOfContents`). `useCreateBlockNote` creates one editor that is reused for every preview.

**Fetching versions (L95-L118).** Whenever the sheet is open and `noteId` is set, it calls `GET notes/{noteId}/versions` on the external notes API through `authenticatedFetch` and stores `data.versions`. Failures show a sonner toast ("Failed to load version history").

**Preview loading (L121-L144).** When `selectedVersion` changes, its `content` (a JSON string of BlockNote blocks, or already-parsed blocks) is parsed and pushed into the preview editor with `replaceBlocks`. If parsing (or `replaceBlocks`) throws, the content is treated as legacy plain text and shown as a single paragraph.

**Restore (L146-L185).** `handleRestoreVersion(versionId)` sends `POST notes/{noteId}/versions/restore/{versionId}`, toasts the server's `message`, calls the optional `onVersionRestored` callback so the parent can reload the note, re-fetches the version list, and closes the preview.

**Rendering.** Two Radix `Sheet`s:
- *Version list* (open when `isOpen && !previewMode`): loading spinner, an empty state ("Versions are created when you make changes to this note"), or one card per version with its number, a "Latest backup" badge on the first item, a "Before restore" badge when `metadata.updatedFrom === "before_restore"`, relative date via `formatDate`, title and up to three tags, plus Preview and Restore buttons.
- *Preview* (open when `previewMode`): title, version number, date, tags and a dark, non-editable `BlockNoteView`, with a "Restore This Version" button in the header.

Closing the list sheet calls the parent's `onClose`; closing the preview only returns to the list.

## Exports
- `default VersionHistory({ noteId, isOpen, onClose, onVersionRestored? })` - the version-history slide-over. `onVersionRestored` is called after a successful restore.

## Interfaces
- **External services:** the notes API at `https://uatapi.garage.app/api` (hard-coded in `lib/api-config.ts`, not part of this repo):
  - `GET /notes/{noteId}/versions` - list versions (`{ versions: NoteVersion[] }`)
  - `POST /notes/{noteId}/versions/restore/{versionId}` - restore a version (`{ message, ... }`)
- **Browser storage / cookies:** indirectly, through `authenticatedFetch` (reads `auth-token` / `garage_tok` from localStorage or cookies for the Bearer header).

## Dependencies
- **Internal:** `./blocks` (custom BlockNote block specs) · `../types` (`NoteVersion`, `formatDate`) · `@/components/ui/button`, `@/components/ui/sheet` (UI) · `@/lib/api-config` (`buildExternalUrl`) · `@/utils/api` (`authenticatedFetch`, with retries and 401 redirect to `/login`).
- **Packages:** `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` (editor and its CSS) · `lucide-react` (icons) · `sonner` (toasts) · `react`.

## Used by
- `app/(dashboard)/thoughts/archive/page.tsx` (route `/thoughts/archive`)
- `app/(dashboard)/thoughts/starred/page.tsx` (route `/thoughts/starred`)

## Notes
- The preview schema registers only the first sixteen custom blocks. Newer blocks that the main editor (`thoughts/page.tsx`, `NoteDrawer.tsx`) supports, such as `comment`, `button`, `template`, `syncedBlock`, `embed`, `webBookmark`, `math`, `image`, `video`, `audio` and `file`, are missing. If a version contains one of them, `replaceBlocks` will probably throw. The catch block would then show the raw JSON string as a single paragraph.
- `authenticatedFetch` already throws on non-2xx responses, so the `response.ok` checks never run. Errors go to the `catch` blocks instead.
- When the version list is empty because loading failed, the empty state still says no history exists.
