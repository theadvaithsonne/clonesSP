# `components/athena/components/Notionview.tsx`

> The "Notion" (Documents) tab of an Athena/Taskroom room: lists the room's linked Notion pages from the external Taskroom API, lets users add/edit/delete links, and renders the selected page in-app.

**Kind:** React component · **Lines:** 323

## Purpose
Taskroom rooms can carry "integrations" - saved external links of a given type (Notion, Sheets, Figma, YouTube, ...). This component is the Notion flavour. It owns the data (fetching, pagination, CRUD against the external Taskroom integrations API) and hands all list/drawer/form UI to the shared `IntegrationViewShell`, supplying `NOTION_CONFIG` labels. The selected page is displayed by `NotionPageViewer`.

## How it works
- **Room resolution** (`resolvedRoomId`, L81-L85): uses the `roomId` prop if given; otherwise, when the URL has `?shareTask=...`, takes `?roomId=`; otherwise falls back to `currentRoomDetail._id` from the `useTaskroomWorkspacetore` zustand store. With no room ID it renders `IntegrationRoomNotFound`.
- **API base** (L16-L17): `TASKROOM_BASE_URL` comes from `NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/` (trailing slashes normalised); integrations live at `<base>external/integrations`.
- **Fetching** (`fetchIntegrations(page, append)`, L117-L144): `GET <integrations>?size=10&page=N&roomId=...&type=notion` with `Authorization: Bearer <localStorage garage_tok>`. Accepts either `{ data: [...] }` or a bare array. Appended pages are de-duplicated by `_id`. Pagination comes from `json.metadata.currentPage/totalPages`. On the first page the first item becomes active. An `isFetchingRef` guard prevents overlapping requests; failure sets "Could not load Notion integrations. Please refresh."
- **Reset on room change** (L146-L154): clears list and pagination and loads page 1.
- **Infinite scroll** (L156-L166): an `IntersectionObserver` (threshold 0.2) on `sentinelRef` (rendered by the shell) loads the next page while `hasMore`.
- **Search**: `filteredIntegrations` filters client-side by name or link (case-insensitive) on already-loaded items only.
- **Add / edit** (`handleSaveIntegration`, L184-L211): the input may be a plain URL or a pasted `<iframe src="...">` embed; `extractNotionUrlFromInput` pulls out the `src`. `isValidNotionUrl` requires a parseable URL whose host ends in `notion.so`, `notion.site` or `notion.com` with a non-root path. Edit sends `PUT <integrations>/:id` `{ name, link, type: "notion" }` and patches local state; create sends `POST <integrations>` `{ name, link, type: "notion", roomId }`, prepends and selects the created item (or refetches page 1 if no `_id` came back).
- **Delete** (`handleDeleteIntegration`, L213-L226): `DELETE <integrations>/:id`, removes locally and, if it was active, selects another item. Errors are only logged.
- **Rendering** (L238-L320): `IntegrationViewShell` with a header "Refresh" button that increments `refreshToken`. Content area: `NotionPageViewer` (keyed by link + refreshToken) for a valid link; an "Invalid URL" card for a stored bad link; a spinner while loading; otherwise an empty state with "Connect a page", which opens the sidebar and the form.
- **Sidebar** visibility comes from `useIntegrationSidebar()`, which opens it by default on screens 768px and wider.

## Exports
- `default NotionView({ roomId?: string })` - the Notion documents tab for a room.

## Interfaces
- **Backend endpoints called (external Taskroom service, not this repo):**
  - `GET {NEXT_PUBLIC_TASKROOM_URL}external/integrations?size&page&roomId&type=notion` - list
  - `POST {…}external/integrations` - create
  - `PUT {…}external/integrations/:id` - update
  - `DELETE {…}external/integrations/:id` - delete
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base (default `https://uatapi.garage.app/taskroomv2/v2/`).
- **Browser storage / cookies:** reads `localStorage.garage_tok` as the bearer token.

## Dependencies
- **Internal:** `components/athena/components/NotionPageViewer.tsx` - renders the selected page (dynamic, `ssr: false`); `components/athena/components/integration-view-shell.tsx` - `IntegrationViewShell`, `IntegrationRoomNotFound`, `useIntegrationSidebar`, `IntegrationItem`; `store/taskroom/taskroomWorkspace.tsx` - `useTaskroomWorkspacetore` for `currentRoomDetail`.
- **Packages:** `axios` - HTTP calls; `next` - `useSearchParams`, `dynamic`; `lucide-react` - icons; `react`.

## Used by
- `components/athena/ProjectMangement.tsx` - rendered as `<Notionview />` for the "Notion" view.

## Notes
- `handleSaveIntegration` always calls `closeForm()` in `finally`, so a save error message set in `catch` is wiped immediately and the user never sees "Unable to save".
- `isLoading` is only ever set to `true` initially; after the first load, refetching page 1 (e.g. after a room change) does not show the loading state again.
- `activeIntegration` falls back to the first item when `activeIntegrationId` is null or stale.
