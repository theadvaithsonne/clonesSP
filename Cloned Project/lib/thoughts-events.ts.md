# `lib/thoughts-events.ts`

> Client helpers for the Thoughts (Notes) app: window `CustomEvent` names and dispatchers for inline navigation, breadcrumb de-duplication, a note re-parenting PATCH, and builders for member and public share links.

**Kind:** frontend library · **Lines:** 79

## Purpose
Notes can run as a full page (`/thoughts`) or embedded "inline" inside the workspace. Components that are not in each other's React tree (the drawer, the share popover, the page itself) talk through window-level custom events instead of props. This file holds the event names and the shared helpers so every producer and consumer agrees on them.

## How it works
- **Events:** `THOUGHTS_INLINE_NAVIGATE_EVENT` (`"thoughts:inline-navigate"`, detail `{ section, noteId? }`) and `THOUGHTS_OPEN_NOTE_EVENT` (`"thoughts:open-note"`, detail `{ noteId }`).
- `dispatchThoughtsInlineNavigate(section)` fires the navigate event. `dispatchThoughtsOpenNote(noteId)` fires *both* `open-note` and a navigate event with `section: "open-page"` plus the `noteId`. Both functions do nothing on the server, and `dispatchThoughtsOpenNote` also does nothing when `noteId` is empty.
- `isThoughtsInlineMode()` reads the global flag `window.__garageThoughtsInline`, which is set elsewhere when Notes is mounted inline.
- `dedupeNoteBreadcrumbs(items)` keeps the first occurrence of each `id` and drops items without an ID.
- `patchNoteParentId(childNoteId, parentId)` makes a note a sub-page of another note by sending a PATCH with `{ parentId }` to the external notes API via `authenticatedFetch`. It returns `false` when the IDs are missing or the same, and on any error.
- `buildNoteMemberUrl(noteId, origin?)` returns `<origin>/workspace?openApp=note&noteId=...`, a link for logged-in workspace members. `buildNotePublicUrl(shareToken, origin?)` returns `<origin>/shared/note/<token>`. In the browser, `origin` defaults to `window.location.origin`.

## Exports
- `type ThoughtsInlineSection` - `"all-notes" | "starred" | "templates" | "archive" | "trash" | "recovery" | "open-page"`.
- `THOUGHTS_INLINE_NAVIGATE_EVENT`, `THOUGHTS_OPEN_NOTE_EVENT` - event-name constants.
- `dispatchThoughtsInlineNavigate(section): void`
- `dispatchThoughtsOpenNote(noteId): void`
- `isThoughtsInlineMode(): boolean`
- `dedupeNoteBreadcrumbs(items: NoteBreadcrumbItem[]): NoteBreadcrumbItem[]`
- `patchNoteParentId(childNoteId, parentId): Promise<boolean>`
- `buildNoteMemberUrl(noteId, origin?): string`
- `buildNotePublicUrl(shareToken, origin?): string`

## Interfaces
- **External services:** `PATCH https://uatapi.garage.app/api/notes/:id` (built by `buildExternalUrl`). This is the external notes API, not this repo's backend.
- **Browser storage / cookies:** `authenticatedFetch` reads the `garage_tok` token from localStorage.
- **Window events:** dispatches `thoughts:inline-navigate` and `thoughts:open-note`. It reads the global `window.__garageThoughtsInline`.

## Dependencies
- **Internal:** `lib/api-config.ts` - `buildExternalUrl`. `utils/api.ts` - `authenticatedFetch` (auth header, retries, 401 handling). `app/(dashboard)/thoughts/types.ts` - `NoteBreadcrumbItem` type.

## Used by
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/components/NoteSharePopover.tsx`
- `app/(dashboard)/thoughts/page.tsx`
- `app/(dashboard)/thoughts/templates/page.tsx`
