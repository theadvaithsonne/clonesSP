# `components/athena/components/use-integration-list.ts`

> A React hook that lists, paginates, searches, creates, edits and deletes a taskroom room's link-based integrations (Figma, Google Calendar, Sheets, YouTube and so on) through the external taskroom API.

**Kind:** React hook (client module) · **Lines:** 197

## Purpose
Each Athena integration view (`Figmaview`, `GoogleCalendarview`, `SheetsView`, `Youtubeview`) shows the same thing: a sidebar of saved links for one room, a viewer for the selected link, and a small add/edit form. This hook holds all of that shared data and CRUD logic. Each view supplies only its integration `type` and its own link validation. The UI chrome lives in `integration-view-shell.tsx`.

## How it works

### Configuration
- `TASKROOM_BASE_URL` is `NEXT_PUBLIC_TASKROOM_URL` with trailing slashes removed and one `/` added back. If the variable is unset, it falls back to the hard-coded `https://uatapi.garage.app/taskroomv2/v2/`.
- `INTEGRATIONS_URL` is `<base>external/integrations`.
- `PAGE_SIZE = 10`.
- Every request sends `Authorization: Bearer <garage_tok>`, where the token is read from `localStorage`.

### Loading and pagination
- `fetchIntegrations(page, append)` does a GET with `size`, `page`, `roomId` and `type` query parameters.
  - It accepts several response shapes: `json.data` as an array, a bare array, or `json.data`.
  - When `append` is true, it adds items whose `_id` is not already in the list. Otherwise it replaces the list and selects the first item.
  - It reads `metadata.currentPage` and `metadata.totalPages` to set `hasMore`.
  - `isFetchingRef` stops overlapping requests.
  - On failure it sets `loadError` to "Could not load integrations. Please refresh."
- One effect resets all list state and loads page 1 whenever `resolvedRoomId` or `integrationType` changes. If `resolvedRoomId` is empty, loading ends without a request.
- A second effect attaches an `IntersectionObserver` (threshold 0.2) to `sentinelRef`. When the sentinel scrolls into view and more pages exist, it loads the next page in append mode. This gives the sidebar infinite scroll.

### Selection and search
- `activeIntegration` is the item whose `_id` matches `activeIntegrationId`. If there is no match, it falls back to the first item, or `null`.
- `filteredIntegrations` filters the loaded items by `sidebarSearch`, matching case-insensitively against `name` or `link`. It filters on the client only, so it never finds items on pages that have not loaded yet.
- `sidebarOpen` comes from `useIntegrationSidebar()` in `integration-view-shell.tsx`. That hook keeps the sidebar open on viewports at least 768px wide and follows changes to that media query.

### Form and mutations
- `openForm(item?)` opens the form, pre-filled from `item` when editing. `closeForm()` closes it and clears all form state.
- `saveIntegration(validateLink, normalizeLink?)`:
  1. Does nothing if the name, link or room ID is empty.
  2. Applies the view's optional `normalizeLink`, then runs `validateLink`. A non-null result becomes `formError` and the save stops.
  3. When editing: sends a PUT to `INTEGRATIONS_URL/<id>` with `{ name, link, type }`, then patches the local list.
  4. When creating: sends a POST to `INTEGRATIONS_URL` with `{ name, link, type, roomId }`. If the response contains the created item's `_id`, the item is added to the front of the list and selected. Otherwise page 1 is reloaded.
- `deleteIntegration(id, event?)` stops event propagation, sends a DELETE to `INTEGRATIONS_URL/<id>`, removes the item, and moves the selection to the first remaining item if the deleted one was active. Errors are only written to the console.

## Exports
- `useIntegrationList(resolvedRoomId: string, integrationType: string)` - returns:
  - Data: `integrations`, `filteredIntegrations`, `activeIntegration`, `activeIntegrationId`, `setActiveIntegrationId`.
  - Status: `isLoading`, `isSaving`, `loadError`, `hasMore`.
  - Form: `isFormOpen`, `formName`, `formLink`, `formError`, `editingIntegration`, `setFormName`, `setFormLink`, `openForm`, `closeForm`.
  - Sidebar: `sidebarOpen`, `setSidebarOpen`, `sidebarSearch`, `setSidebarSearch`, and `sentinelRef` (attach it to the element that triggers infinite scroll).
  - Actions: `saveIntegration`, `deleteIntegration`.

## Interfaces
- **External services:** the taskroom v2 API (by default `https://uatapi.garage.app/taskroomv2/v2/`), which is not part of this repo:
  - `GET external/integrations?size&page&roomId&type` - list a room's integrations of one type.
  - `POST external/integrations` - create an integration.
  - `PUT external/integrations/:id` - rename it or change its link.
  - `DELETE external/integrations/:id` - remove it.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - base URL of the taskroom API.
- **Browser storage / cookies:** reads `localStorage.garage_tok` as the bearer token.

## Dependencies
- **Internal:** `components/athena/components/integration-view-shell.tsx` - provides the `IntegrationItem` type (`_id`, `name`, `link`, `type`, `roomId`) and the `useIntegrationSidebar` hook.
- **Packages:**
  - `react` - state, effects, memo, refs.
  - `axios` - HTTP requests.

## Used by
- `components/athena/components/Figmaview.tsx`
- `components/athena/components/GoogleCalendarview.tsx`
- `components/athena/components/SheetsView.tsx`
- `components/athena/components/Youtubeview.tsx`

## Notes
- **Save errors are never shown.** In `saveIntegration`, the `catch` block sets `formError` to "Unable to save. Please try again." and returns. The `finally` block still runs `closeForm()`, which closes the form and clears `formError`. A failed save therefore just closes the form, and the user sees no message.
- If `garage_tok` is missing, the header is sent as `Bearer null`.
- The fallback URL points at the UAT host. A deployment that does not set `NEXT_PUBLIC_TASKROOM_URL` will talk to UAT.
