# `app/(dashboard)/deals/funnel/page.tsx`

> Client page for the Deals CRM "Funnels" list: it loads, searches, filters, sorts, exports, views, creates, edits and deletes sales funnels stored on the external Garage CRM API.

**Kind:** Next.js page · **Lines:** 1601 · **Route:** `/deals/funnel`

## Purpose
A funnel is a named, ordered set of stages (products) that leads move through. This page is the funnel management screen of the Deals CRM. It runs in two places:

1. **Standalone** at `/deals/funnel`, inside `app/(dashboard)/deals/layout.tsx`, with the `DealsNavbar` on top and a themed table (light / dark / "color").
2. **Inline**, inside the dashboard's Deals app overlay (`components/dashboard/inlineApps/deals/DealsApp.tsx`). That component imports this page with `next/dynamic` and sets `window.__garageDealsInline = true` before it mounts. The page calls this inline mode "Figma" mode (`isFigma`). It drops the navbar, always renders dark and uses the shared BackOffice `FunnelsDataTable`.

All data lives on the **external** CRM API (`https://uatapi.garage.app/api`, through `buildExternalUrl`). Nothing on this page reaches this repo's `/backend` Express server.

## How it works

### Mode and theme (L95-L101)
- `isInlineDealsMode` is true when `window.__garageDealsInline` is set. `isFigma` is just an alias for it.
- `resolvedTheme` is `"color"` when the next-themes theme is `"color"`. It is `"dark"` when the theme is dark or the page is inline. Otherwise it is `"light"`. Most class names branch on `isFigma` first, then on `resolvedTheme`.

### Local data shape (L79-L93)
The page maps API records to a local `Funnel` type: `id`, `_id`, `funnelId`, `funnelName`, `funnelDesc`, `products` (`FunnelProduct[]`), `numberOfStages`, `ownerName`, `activeLeads`, `status`, `createdAt`, `updatedAt`.

### State (L102-L135)
- Form toggles: `isAdd`, `isEdit`, `editingFunnel`.
- List state: `funnels`, `loading`, `error`, `searchTerm`, `refreshing`.
- Status filter: `statusFilter`, plus `draftStatusFilter` for the inline filter dialog. Values are `"all" | "active" | "inactive"`.
- Single delete: `deletingFunnel`, `isDeleteModalOpen`, `isDeleting`. Bulk delete: `selectedFunnelIds`, `isBulkDeleteOpen`, `isBulkDeleting`.
- View dialog: `isViewFunnelOpen`, `viewingFunnel`, `isLoadingFunnelDetails`.
- Pagination: `currentPage`, `totalFunnels`, `totalPages`, `limit` (default 50).
- `funnelsSort` (`SortState | null`): column sort for the inline DataTable.

### Loading the list (`fetchFunnels`, L139-L202)
- Turns `page` and `pageSize` into `skip` and calls `GET crm/funnels?skip=&limit=` through `authenticatedFetch`. `pageSize` is passed in explicitly so a records-per-page change does not use a stale `limit`.
- Normalises each record so it tolerates several backend shapes:
  - `_id` and `id` fall back to each other, then to the row index.
  - `funnelId` defaults to `F001`, `F002`, and so on.
  - The name comes from `funnelName`, then `name`, then `Funnel N`.
  - `products` comes from `products`, then `funnelStage`.
  - `numberOfStages` falls back to `funnelStage.length`.
- Owner: the first of `createdby`, `owner.name` or `ownerName`. It is shown **only if it contains `@`**, so it must be an email; anything else becomes `"--"`.
- Active leads come from `leadsCount`, then `activeLeads`, then `active_leads`, else 0.
- Status comes from `status`, or `isActive ? "Active" : "Inactive"`.
- The total comes from `data.total`, then `data.pagination.total`, then the length of the loaded page. `totalPages` is computed from that total.
- On error it sets `error` and empties the list. It never shows placeholder data.

### Search (L236-L302)
- `handleSearch(term)` resets the page to 1. A non-empty term calls `searchFunnels`; an empty term reloads page 1.
- `searchFunnels` calls `GET crm/searchfunnel?q=<term>` and normalises the results the same way. The results are shown as a single page. If the request fails or throws, it falls back to `fetchFunnels(1)`.
- Search runs on every keystroke. There is no debounce.
- The client-side `filteredFunnels` (L454-L464) also filters the loaded rows by `funnelId` or `funnelName` substring and by status. So the status filter only applies to the rows currently loaded.

### Sorting (L469-L505)
`sortedFunnels` sorts `filteredFunnels` in the browser. The list API takes no sort parameter, so only the loaded page is sorted. Sort keys are `name`, `stages`, `owner`, `activeLeads`, `status` and `updatedAt`. Funnels with no `updatedAt` always go to the bottom. Only the inline `FunnelsDataTable` uses this sorted list; the standalone tables render `filteredFunnels`.

### Stage badge (`renderStagesColumn`, L205-L227)
Shows "N stage(s)". The colour is chosen by `numberOfStages` modulo the palette: `FIGMA_STAGE_COLORS` (solid pills, inline mode) or `SOFT_STAGE_COLORS` (tinted tags, standalone).

### Export (`handleExport`, L312-L342)
Builds an `.xlsx` workbook from the **currently filtered** rows with `xlsx`. The workbook has one sheet, "Funnels", with columns Funnel Name, Stages, Owner, Active Leads, Status and Last Updated (date in `en-CA` format). `file-saver` downloads it as `funnels_export_<YYYY-MM-DD>.xlsx`. The outcome is reported with a toast.

### View, create and edit
- `handleViewFunnel(id)` (L345-L376) opens `ViewFunnelDialog` straight away with a loading state, then loads `GET crm/funnels/:id`. If the request fails, it closes the dialog and shows a toast.
- Clicking a row opens the view dialog. Clicks on buttons, inputs, menu items, checkboxes and `role="button"` elements are ignored.
- Create and edit both use `FunnelFlow`. In standalone mode `FunnelFlow` replaces the list (`setIsAdd`, plus `editingFunnel` and `onCancel` for edit). In inline mode the list stays and `FunnelFlow` is rendered `asDialog` on top (L1459-L1466). This page does not save funnels; `FunnelFlow` does that.
- The list reloads whenever both `isAdd` and `isEdit` become false (L576-L580). That is how changes show up after `FunnelFlow` closes. It also means the list loads twice on mount: once from the mount effect and once from this effect.

### Delete
- Single delete (L391-L431): the row menu calls `handleDeleteFunnel(_id)`, which opens a `DeleteLeadsDialog` reused with funnel wording. `confirmDeleteFunnel` sends `DELETE crm/funnels/:id`, reloads the list and shows a toast. On failure it shows the API's `message`.
- Bulk delete (L529-L557), inline mode only: row and header checkboxes in the DataTable feed `selectedFunnelIds`. "Delete Selected" opens a second `DeleteLeadsDialog`. `confirmBulkDelete` sends one `DELETE crm/funnels/:id` per id in parallel (`Promise.all`), counts the failures, clears the selection and reloads.
- "Select all" covers only the rows currently shown (`displayedFunnelIds`). The selection survives page changes.

### Event wiring (L565-L590)
- On mount: `fetchFunnels()`.
- Listens for the window event `deals:open-add-funnel` and opens the create flow. The dashboard layout (`app/(dashboard)/layout.tsx`) fires this event when the global "add" action runs while the Deals section is `funnel`.
- `useDealsInlineRefresh("funnel", ...)` listens for the window event `deals:inline-refresh` with `detail.section === "funnel"`, and reloads the current page. This only happens in inline mode.

### Rendering
- **Full-screen spinner** (L684-L702): shown only in standalone mode on the first load. In inline mode the DataTable shows its own skeleton.
- **Inline toolbar** (L756-L830): search field, "Delete Selected (n)", a Filters button (a dot marks an active filter), Export and Create (+) icon buttons. Icons are SVGs under `/figma/deals/leads/`.
- **Standalone toolbar** (L831-L933): search field (a separate full-width input on mobile), All / Active / Inactive pill buttons that apply immediately, Export and "Create Funnel". Below it is a "N Funnels" count strip.
- **Inline table** (L957-L1015): `FunnelsDataTable` with accessor and render props, footer totals (Funnels, and Selected when there is a selection) and server-side pagination. Page sizes are 25, 50, 100 and 200; changing the size resets to page 1.
- **Standalone tables** (L1017-L1455): a horizontally scrolling mobile table and a desktop `Table`. Columns are Funnel Name, Stages, Owner, Active Leads, Status, Last Updated and a row action menu (View / Edit / Delete). Below them is a "Found N results ... Clear Search" bar when searching. Otherwise, when there is more than one page, Previous/Next with a five-page number window.
- **Filter dialog** (L1506-L1589, inline mode): a two-pane Figma-style dialog with a single "Status" facet. Changes go into the draft value; "Apply Filter" commits it, "Reset Filter" clears both values, and "Cancel" closes the dialog.

## Exports
- `default FunnelsPage()` - the funnels list page component. It takes no props.

## Interfaces
- **Backend endpoints called:** all on the external CRM API base `https://uatapi.garage.app/api` (from `lib/api-config.ts`), not this repo's `/backend`:
  - `GET crm/funnels?skip=&limit=` - paginated funnel list.
  - `GET crm/searchfunnel?q=` - search funnels by text.
  - `GET crm/funnels/:id` - full funnel for the view dialog.
  - `DELETE crm/funnels/:id` - delete one funnel; also used once per id for bulk delete.
- **External services:** Garage CRM API (uatapi.garage.app). Requests go through `authenticatedFetch`, which sends `Authorization: Bearer <token>`. The token comes from localStorage `auth-token`, the `auth-token` cookie or `garage_tok`; while impersonating, the cookie is used. Requests send `credentials: "include"`.
- **Browser storage / cookies:** none directly. Theme comes from next-themes (`deals-theme` key, set by the layout). Auth tokens are read by `authenticatedFetch`.
- **Window globals and events:** reads `window.__garageDealsInline`; listens for `deals:open-add-funnel` and `deals:inline-refresh` (section `funnel`).

## Dependencies
- **Internal:**
  - `components/crm/DealsNavbar.tsx` - Deals top navigation (standalone mode only).
  - `components/deals/FunnelFlow.tsx` - create/edit funnel wizard; rendered as a full view or as a dialog (`asDialog`).
  - `components/deals/funnel/FunnelsDataTable.tsx` - BackOffice-style DataTable used in inline mode.
  - `components/crm/ViewFunnelDialog.tsx` - read-only funnel detail dialog.
  - `components/crm/leads/DeleteLeadsDialog.tsx` - delete confirmation dialog, reused for funnels.
  - `components/ui/data-table/types.ts` - `SortState` type.
  - `components/ui/{button,checkbox,dialog,dropdown-menu,input,table}.tsx` - shadcn/Radix UI primitives.
  - `lib/api-config.ts` - `buildExternalUrl` (external CRM base URL).
  - `lib/deals-events.ts` - `useDealsInlineRefresh`.
  - `types/crm.ts` - `FunnelApiResponse`, `FunnelsApiResponse`, `FunnelProduct`.
  - `utils/api.ts` - `authenticatedFetch`.
- **Packages:** `react` (state, effects, `useMemo`); `next-themes` (`useTheme`); `sonner` (toasts); `lucide-react` (icons); `xlsx` (workbook generation); `file-saver` (`saveAs` download).

## Used by
- `components/dashboard/inlineApps/deals/DealsApp.tsx` - dynamically imports it as `DealsFunnelPage` for the inline Deals overlay.
- Next.js route `/deals/funnel`, wrapped by `app/(dashboard)/deals/layout.tsx` and the dashboard layout.

## Notes
- The CRM base URL is hardcoded in `lib/api-config.ts` to the UAT host `uatapi.garage.app`. It is not set by an environment variable, and this page does not use `NEXT_PUBLIC_API_URL`.
- Status filtering and sorting run only on the rows currently loaded (one server page, or the search results). Neither is sent to the API. "Found N results" counts `funnels.length`, so it ignores the status filter.
- Several `console.log` calls (`data`, `transformedFunnels`, `filteredFunnels`) log on every load and render.
- Only the standalone desktop table shows the "No funnels found" message. The standalone mobile table renders an empty body.
- Search requests can come back out of order, because there is no debounce or cancellation. A slow, older response can overwrite a newer one.
- The mobile and desktop standalone tables still contain `isFigma` checkbox branches. That code never runs, because inline mode renders `FunnelsDataTable` instead.
