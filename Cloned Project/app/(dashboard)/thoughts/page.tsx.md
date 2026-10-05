# `app/(dashboard)/thoughts/page.tsx`

> The "Thoughts" (Notes) all-notes page: a Notion-style, BlockNote-based page editor with a page picker, breadcrumbs, sub-pages, sharing, favourites, page comments, covers/icons, a custom slash menu and debounced auto-save to the external notes API.

**Kind:** Next.js page · **Lines:** 2961 · **Route:** `/thoughts`

## Purpose
This is the main editor of the Thoughts notes app. It lists the current user's notes, opens one at a time in a rich block editor (BlockNote with ~27 custom block types from `./components/blocks`), and saves changes back to the notes service. It can be visited directly at `/thoughts`, but it is mostly rendered inside the dashboard as an "inline app": `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx` loads it with `next/dynamic`, and the two talk through `window` CustomEvents. Notes are **not** stored by this repo's Express server. Every notes call goes to the external Garage UAT API (`https://uatapi.garage.app/api`, hardcoded in `lib/api-config.ts` and reached through `buildExternalUrl`).

## How it works

### Module-level helpers (L145-L760)
- **`DEFAULT_FIGMA_CONTENT` / `SEED_NOTES` (L146-L313):** sample BlockNote documents ("Garage", "Workshop", "Storage Room" and so on) copied from a Figma mock-up. `SEED_NOTES` is never used. `DEFAULT_FIGMA_CONTENT` is only referenced by `SEED_NOTES`.
- **`CustomDragHandleMenu` (L315-L754):** replaces BlockNote's drag-handle menu with a dark, searchable menu.
  - The top-level actions are **Turn into** (paragraph, H1-H3, bulleted/numbered/to-do list, quote), **Color** (10 text colours and 10 background colours), **Duplicate** (deep-clones the block without its `id`s and inserts it after the original) and **Delete**.
  - Typing in the search box flattens the matching submenu items into the main list.
  - Turn into and Color work as hover flyouts on desktop and as click-through submenus (`activeSubmenu` state).
  - The colour handlers try to recolour the block under the text cursor and fall back to the block that owns the drag handle.
  - The footer shows "Last edited" with a relative time based on `note.updatedAt`. The author name in that footer is hardcoded (see Notes).
- **`getYouTubeVideoId(url)` (L756-L760):** pulls the 11-character video ID out of watch, `youtu.be`, embed and similar URL forms.

### Component state and access (L762-L811)
- **State:** the note list (`notes`), the open note (`activeNote`), the title being edited, picker/search state, loading and saving flags, `hasUnsavedChanges`, the YouTube dialog, side-menu popover state and `breadcrumbs`.
- **Refs:**
  - `notesRef` and `activeNoteRef` mirror state so that window event listeners registered only once still see current values.
  - `originalValuesRef` holds the last-saved title and content, used to detect unsaved changes.
  - `handleCreateSubPageRef` lets the memoised side menu call the latest sub-page handler.
- **Current user:** `currentUserId` comes from `getUserIdFromToken()`, which decodes the JWT.
- **`noteAccess`:**
  - Computed by `resolveNoteAccess(activeNote, currentUserId)`. The owner, or a note with no `userId`, gets full rights. A collaborator gets rights from their role: "Full access" and "Can edit" may edit; those two plus "Can comment" may comment; nobody but the owner may share.
  - If the server's note carries `canEdit` (and optionally `canComment` / `canShare`), those values override the computed ones.
  - `noteAccess.label` ("Can comment" / "View only") is shown as a pill in the header.

### Editor setup (L813-L938)
- **Schema:** `notesSchema` is BlockNote's `defaultBlockSpecs` plus the custom blocks: coverPhoto, documentList, calendar/timeline/chart/linked/table/board/gallery views, nestedPage, pageLinkPill, mentionPerson/mentionPage, datePicker, reminder, tableOfContents, comment, button, template, syncedBlock, embed, webBookmark, math, and replacements for image/video/audio/file.
- **Uploads:** `uploadFile` picks an endpoint name (`postImages`, `postVideos`, `postDocuments`) from the MIME type and calls `uploadFiles` from `utils/uploadthing`. That helper ignores the endpoint name and POSTs each file as multipart to the backend's `/upload` S3 route with the bearer token, then returns `ufsUrl || url`.
- **Side menu:** `renderSideMenu` builds BlockNote's side menu with two controls.
  - A "+" button opens a Popover holding `CommandsMenu`, which inserts blocks and can open the YouTube dialog or create a sub-page. The side menu is frozen while the popover is open.
  - A `DragHandleButton` that uses `CustomDragHandleMenu`.

### Loading and selecting notes (L939-L1150)
- **`fetchNotes`:**
  - GETs `notes`, drops deleted and archived notes, sorts the rest by `updatedAt` (newest first) and selects the first one.
  - If there are no notes, `createInitialBlankNote` POSTs a blank note.
  - If the request fails, a client-only note with ID `local-<timestamp>` is created instead.
- **`selectNote`:**
  - Parses `note.content` (a JSON string of BlockNote blocks) into the editor with `editor.replaceBlocks`. Plain-text content that is not valid JSON is wrapped in a paragraph.
  - Records the original values, clears the dirty flag, loads breadcrumbs, and makes sure the last breadcrumb carries the page icon.
- **`loadBreadcrumbs`:**
  - Root notes have no breadcrumbs.
  - For a `local-` note, the ancestor chain is built from the in-memory list, with protection against cycles.
  - Otherwise it GETs `notes/:id/breadcrumb` and removes duplicates with `dedupeNoteBreadcrumbs`. If that fails, it falls back to "parent > self" from the in-memory list.
- **`openNoteById`:** uses the in-memory note if present; otherwise GETs `notes/:id`, adds the result to the list and selects it. If that fails it shows the toast "Page not found".
- **`renderNoteRow` (L1151-L1241):** a list row with Edit/Delete actions. It is never rendered, because the picker uses `NotionDropdownItem`.

### Mount effects and cross-component events (L1243-L1383)
- **On mount:** reads the `?noteId=` query parameter, or the one-shot `sessionStorage` key `thoughts:inline-pending-note-id` (written by `app/(dashboard)/layout.tsx` and removed once read). If either is present, it loads the list and opens that note; otherwise it calls `fetchNotes`.
- **Window events it listens for:**
  - `thoughts:open-note` `{noteId}`: opens the note.
  - `thoughts:inline-refresh` `{section: "all-notes"}`: reloads the list.
  - `thoughts:inline-navigate`, depending on `section`:
    - `add-page`: creates a new note.
    - `open-page` `{noteId, reparentAsSubpage?}`: first PATCHes the target's `parentId` to the active note if asked to, then opens it.
    - `import`: shows a "not supported" toast.
  - `thoughts:link-subpage` `{childNoteId}`: sent by `NestedPageBlock` when a nested-page block is linked. It PATCHes the child's `parentId` to the active note through `patchNoteParentId` and updates local state.

### Change detection and saving (L1385-L1512)
- **Dirty tracking:** `editor.onChange` compares `JSON.stringify(editor.document)` and the title against `originalValuesRef`.
- **Auto-save:** 1.5 s after the last change, if the note is dirty and the user can edit, `saveActiveNote` runs.
  - It PATCHes `notes/:id` with title, content, icon, coverUrl, coverPosition (default 50), comments and commentsOpen, then adopts the server's returned note.
  - `local-` notes are only updated in state.
- **`persistPageMeta(patch)`:**
  - Saves the page icon, cover, cover position or page comments right away: it updates state optimistically, then PATCHes only the fields that changed.
  - A user who can comment but not edit may still save a patch that touches only `comments` / `commentsOpen`.
  - Changing the icon also updates the last breadcrumb.
- **`handleAddPageComment`:** opens the page comment panel.

### Note actions (L1514-L1842)
- **`handleYouTubeEmbed`:** inserts a paragraph containing a YouTube watch link. It is a link, not a real video embed.
- **`handleCreateNewNote`:** POSTs a blank note, or falls back to a local one, puts it at the top of the list and opens it.
- **`handleCreateSubPage`** (used by the `/Page` slash item and `CommandsMenu`):
  1. POSTs a child note with `parentId`. If the parent is local, `parentId` is only set on the client.
  2. Inserts a `nestedPage` block with `linkedNoteId` into the parent.
  3. Immediately PATCHes the parent's title and content.
  4. Opens the child.
- **`handleStarActiveNote`:** PUTs `notes/:id/star` and uses the server's `isStarred`. `handleToggleStar` does the same for any row but is unused.
- **`handleCopyNoteLink`:** copies `buildNoteMemberUrl(id)` (`<origin>/workspace?openApp=note&noteId=...`) with the Clipboard API, falling back to a hidden textarea and `execCommand("copy")`.
- **`handleShareNote`:** POSTs `notes/:id/share` and copies `<origin>/shared/note/<shareToken>`. It is unused, because the header uses `NoteSharePopover` instead.
- **`handleRefresh`:** dispatches `thoughts:inline-refresh` with `{section:"all-notes"}`. The listener above then refetches. The spinner shows for 600 ms.
- **`handleDeleteActiveNote`:** DELETEs `notes/:id` (the toast says "moved to trash") and selects the next note, or creates a local blank note.

### Slash menu (L1859-L2488)
`getCustomSlashMenuItems(query)` replaces BlockNote's default slash menu (`slashMenu={false}`). Results are filtered with `filterSuggestionItems`. The groups are:
- **Basic Text:** paragraph, H1-H3, quote, and a "Callout", which is a grey-background italic paragraph.
- **Lists:** bulleted, numbered, to-do, toggle list, and toggle headings 1-3.
- **Text Colors and Background Colors:** red, blue, green, yellow, purple and gray, plus a background reset.
- **Turn Into:** converts the block under the cursor.
- **Media & Embeds:** image, video, audio, YouTube (opens the dialog), code block, file, "PDF Embed" (which is just a file block), and web bookmark.
- **Database Views:** cover photo, document list, calendar, timeline, chart, linked view, table, board and gallery.
- **Links & References:** Page (sub-page), link to page, mention person/page, date, reminder, and table of contents.
- **AI Blocks:** Summarize, Action Items and Improve Writing. These are **simulated**: each waits 1.2-1.5 s behind a `toast.promise`, then inserts canned text. No AI service is called.

### Render (L2490-L2960)
- **Wrapper:** everything is wrapped in `UserProvider`. `NotesReminderListener` opens a note when one of its reminders fires.
- **Header:**
  - A page-picker Popover with search, a Favourites section (starred notes, hidden while searching), "Main Pages" (root notes only unless searching) drawn with `NotionDropdownItem` (which can show sub-pages inline), and a "New Note" button.
  - The picker's outside-click handlers ignore clicks inside `[data-notion-page-flyout]` and Radix menus, so nested flyouts do not close it.
  - `NoteBreadcrumbs`, with an "Edited Xm/h/d ago" label.
  - The access pill, `NoteSharePopover` (only when `canShare`), and buttons for copy link, star, a more menu (Delete) and refresh.
- **Body:**
  - A spinner while loading.
  - `NotePageHeader` for the cover and icon.
  - An auto-growing title textarea (read-only without edit rights) that keeps the last breadcrumb in sync while typing.
  - A "Saving changes..." indicator.
  - `NotePageComments` when comments are open or exist.
  - `BlockNoteView` (dark theme, `editable={noteAccess.canEdit}`) with the custom `SuggestionMenuController` (trigger `/`) and `SideMenuController`.
  - With no note open, an empty state with a "Create first note" button.
- **Styles:** a global `<style jsx>` block forces a dark Notion look on BlockNote: CSS variables, upload-label colours and media sizing. It also hides the side menu while the page picker is open.
- **Dialog:** an `AlertDialog` for pasting a YouTube URL (Enter submits).

## Exports
- `default ThoughtsPage()` - the client page component. It takes no props and handles its own data loading.

## Interfaces
- **Backend endpoints called:** `POST /backend/upload` (multipart file upload to S3, through `lib/uploadthing.ts`), used for editor image, video, audio and file uploads.
- **External services:** the Garage UAT notes API at `https://uatapi.garage.app/api` (via `buildExternalUrl`, with auth headers from `authenticatedFetch`):
  - `GET notes` - list notes.
  - `POST notes` - create a note; body `{title, content, color, parentId?}`.
  - `GET notes/:id` - fetch one note.
  - `PATCH notes/:id` - save title, content and page metadata, or `parentId`.
  - `DELETE notes/:id` - delete a note.
  - `PUT notes/:id/star` - toggle the star.
  - `GET notes/:id/breadcrumb` - ancestor chain.
  - `POST notes/:id/share` - share token (only in the unused `handleShareNote`).
- **Window events:**
  - Listens for `thoughts:open-note`, `thoughts:inline-refresh`, `thoughts:inline-navigate` and `thoughts:link-subpage`.
  - Dispatches `thoughts:inline-refresh`.
- **Browser storage:** `sessionStorage["thoughts:inline-pending-note-id"]` is read once and removed. The JWT is read indirectly through `getUserIdFromToken` and `authenticatedFetch`.
- **Background work:** a 1.5 s debounced auto-save timer.

## Dependencies
- **Internal:**
  - `./components/CommandsMenu` - the "+" side-menu block inserter.
  - `NoteBreadcrumbs`, `NotionDropdownItem`, `NotePageHeader`, `NotePageComments`, `NoteSharePopover`, `NotesReminderListener` - page chrome.
  - `./components/blocks` - custom BlockNote block specs.
  - `./types` - `Note`, `NoteBreadcrumbItem`, `NotePageComment`.
  - `lib/api-config` - `buildExternalUrl`.
  - `utils/api` - `authenticatedFetch`.
  - `lib/thoughts-events` - member/public URL builders, breadcrumb de-duplication, `patchNoteParentId`.
  - `lib/noteAccess` - `resolveNoteAccess`.
  - `lib/auth` - `getUserIdFromToken`.
  - `utils/uploadthing` - `uploadFiles`.
  - `context/UserContext` - `UserProvider`.
  - `components/ui/*` - button, input, dropdown-menu, popover, alert-dialog.
- **Packages:**
  - `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` - the editor, schema, side and suggestion menus, and styles.
  - `lucide-react` - icons.
  - `sonner` - toasts.
  - `next` - `useRouter`, imported but unused.
  - `react`.

## Used by
- `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx` loads it with `next/dynamic` as the "all notes" section of the inline Thoughts app.
- It is also served directly at the Next.js route `/thoughts`, under the `(dashboard)` layout.
- Workspace links such as `/workspace?openApp=note&noteId=...` reach it through the dashboard layout, which stores the pending note ID in `sessionStorage`.

## Notes
- **Data does not stay in this app.** Notes are stored by the external `uatapi.garage.app` service, which is hardcoded rather than taken from an environment variable. If that service is unreachable, the page silently falls back to `local-` notes that are never saved.
- **Dead code:**
  - `SEED_NOTES` / `DEFAULT_FIGMA_CONTENT`, `renderNoteRow`, `handleToggleStar`, `handleShareNote` and `router`.
  - The imports `Input`, `getDefaultReactSlashMenuItems`, `AddBlockButton`, `RemoveBlockItem` and `BlockColorsItem`, along with several unused icons.
  - The types `CreateNoteData` / `UpdateNoteData`.
- **Hardcoded name:** the drag-handle footer always says "Last edited by Ram Mahender", whoever actually edited the note.
- **AI blocks are placeholders:** the "AI Summarize", "AI Action Items" and "AI Improve Writing" slash items produce fixed text and call no AI service.
- **Auto-save can drop edits.** `saveActiveNote` returns early while a save is already in flight (`isSaving`). If a save fails, it only logs to the console and the note stays marked as unsaved.
- **Permissions are client-side only.** The access checks here only hide or disable controls; the notes API must enforce the real permissions.
- **Leftover comment:** the "Import" toast still refers to an "offline notes version".
