# `components/athena/components/integration-view-shell.tsx`

> Shared layout for Athena room integration views (Figma, Google Calendar, Notion, Sheets, YouTube): a sidebar of saved links (a drawer from the bottom on mobile), an add/edit link form, and a header plus content area. Also exports the `IntegrationItem` type, a room-not-found screen and a hook that opens the sidebar on desktop.

**Kind:** React component module (client) · **Lines:** 556

## Purpose
An Athena room can attach external tool links ("integrations") by type, for example a Figma file or a Google Sheet. Every integration view has the same layout: a list of saved items on the left, the selected item embedded on the right, and a form to add, edit or remove links. This file is that layout. It only renders and keeps no data state: the list, the selection, the form values and the CRUD callbacks all come in as props, normally from the `useIntegrationList` hook in `use-integration-list.ts`. That hook calls the external Taskroom `external/integrations` API. Each view passes its own wording in an `IntegrationShellConfig` (letter badge, titles, labels, placeholders).

## How it works

### Types (L26-L93)
- `IntegrationItem` - `{ _id, name, link, type, roomId }`, one saved link.
- `IntegrationShellConfig` - every piece of wording the shell shows: brand badge and title, drawer label, search placeholder, empty-state copy and icon, form titles and labels, save/update button labels, loading labels, a `connectedCountLabel(n)` function, and the "select an item" / room-not-found text.
- `IntegrationViewShellProps` (not exported) - the config, the room id, the list and filtered list, the active item, loading/saving/error flags, the form state and its setters, the sidebar state and search, pagination (`hasMore`, `sentinelRef`), the callbacks `onOpenForm`, `onCloseForm`, `onSave`, `onDelete` and `onSelectIntegration`, an optional `headerExtra` node, and `children`.

### `SidebarList` (internal, L95-L253)
The list is rendered twice, in the desktop sidebar and in the mobile drawer.
- While the first load is running and there are no items, it shows a spinner with `loadingListLabel`. When `loadError` is set, it shows a red error box.
- Each item in `filteredIntegrations` is a row with an active dot. Clicking a row selects the item and closes the sidebar.
- Each row has a "more" dropdown (`DropdownMenu`). It appears on hover on desktop and is always visible on touch screens. Its actions are:
  - **Edit** - calls `onOpenForm(item)`;
  - **Copy link** - writes `link` with `navigator.clipboard.writeText`;
  - **Remove** - calls `onDelete(id, e)`.
  Every action calls `stopPropagation`, so it does not also select the row.
- When a search matches nothing it shows `noSearchResultsLabel` (default "No results").
- When `hasMore` is true it renders the `sentinelRef` div with `loadingMoreLabel`. The parent hook watches that element (an infinite-scroll sentinel) to load the next page.
- When loading has finished and there are no items, it shows an empty state with a CTA that opens the add form.

### `IntegrationViewShell` (L255-L519)
- **Sidebar header:** brand letter badge, title and subtitle, an Add (`+`) button and a Close button. A search input is shown only when at least one item exists.
- **Desktop (md and up):** an `<aside>` that animates between 260px and 0px wide according to `sidebarOpen`. When items exist, a footer shows `connectedCountLabel(count)`.
- **Mobile (below md):** a backdrop that closes the drawer when tapped, plus a drawer that slides up from the bottom, capped at `maxHeight: 75vh`, with a grab handle.
- **Form overlay:** when `isFormOpen` is true, a modal covers the main area. Its title is `formEditTitle` when `editingIntegration` is set, otherwise `formNewTitle`.
  - It has Name and Link inputs; the font size is 16px on mobile, which keeps iOS from zooming in, and 13px from `sm` up.
  - `formError` is shown under the Link input.
  - The Save button is disabled while saving or while either field is blank. Its label is "Saving...", `updateLabel` or `saveLabel`.
- **Header:**
  - a button that opens the sidebar; on desktop it only appears while the sidebar is closed;
  - the active item's name with a "Synced" dot, or `selectItemLabel` and `chooseSidebarLabel` when nothing is selected;
  - the caller's `headerExtra`;
  - on mobile only, a drawer button and an Add button.
- **Content:** `children` fill the rest of the space. Views pass components from `integration-iframe-content.tsx`.

### Other exports
- `IntegrationRoomNotFound({ icon, title, description })` (L521-L541) - a centred full-height screen that views show when no room id can be resolved.
- `useIntegrationSidebar(defaultOpen = false)` (L543-L555):
  - keeps `sidebarOpen` in sync with the media query `(min-width: 768px)`, open on desktop and closed on mobile;
  - re-syncs whenever the breakpoint changes, overriding manual toggles at that moment;
  - returns `[sidebarOpen, setSidebarOpen]` as a tuple.

## Exports
- `IntegrationItem` (interface) - a saved integration link.
- `IntegrationShellConfig` (interface) - wording and icons for each view.
- `IntegrationViewShell(props: IntegrationViewShellProps)` - the layout component.
- `IntegrationRoomNotFound({ icon, title, description })` - fallback screen when no room is found.
- `useIntegrationSidebar(defaultOpen?: boolean): readonly [boolean, (open: boolean) => void]` - sidebar open state that follows the screen size.

## Interfaces
- **Browser storage / cookies:** none directly. It uses the Clipboard API (`navigator.clipboard.writeText`) and `window.matchMedia`.

## Dependencies
- **Internal:**
  - `components/ui/dropdown-menu.tsx` - the Radix dropdown for row actions.
  - `lib/utils.ts` - `cn` for conditional classes.
- **Packages:**
  - `react` - components, state and effects.
  - `lucide-react` - icons (Loader2, Plus, Trash2, PanelLeftClose, PanelLeft, Search, X, MoreHorizontal, Pencil, Link2, ChevronUp).

## Used by
- `components/athena/components/Figmaview.tsx`
- `components/athena/components/GoogleCalendarview.tsx`
- `components/athena/components/Notionview.tsx`
- `components/athena/components/SheetsView.tsx`
- `components/athena/components/Youtubeview.tsx`
- `components/athena/components/integration-iframe-content.tsx` - imports the `IntegrationItem` type only.
- `components/athena/components/use-integration-list.ts` - imports `IntegrationItem` and `useIntegrationSidebar`.

## Notes
- `resolvedRoomId` is accepted as a prop but never used in the render.
- "Copy link" gives no success or failure feedback, and the clipboard promise is deliberately not awaited (`void`).
- `SidebarList` is mounted twice (desktop aside and mobile drawer), and both copies receive the same `sentinelRef`. The ref ends up on whichever sentinel React attaches last; the parent hook's IntersectionObserver must cope with that.
