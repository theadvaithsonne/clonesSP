# `app/(dashboard)/deals/contacts/page.tsx`

> Client-side CRM "Contacts" page for the Deals module: lists, searches, filters by owner, sorts, paginates, creates, edits, deletes (single and bulk), exports to XLSX and bulk-imports CRM contacts stored in the external Garage CRM API.

**Kind:** Next.js page · **Lines:** 3336 · **Route:** `/deals/contacts`

## Purpose
This is the Contacts section of the Deals (CRM) app. It works in two places: as a normal dashboard route at `/deals/contacts`, and embedded inside the BackOffice "Deals" inline app (`components/dashboard/inlineApps/deals/DealsApp.tsx`), which loads it with `next/dynamic` and sets the global flag `window.__garageDealsInline = true`. All contact data lives in the **external** CRM service at `https://uatapi.garage.app/api` (built by `buildExternalUrl` in `lib/api-config.ts`). It is not part of this repo's Express backend, and no `/backend/crm/...` route exists in `server/`.

## How it works

### Rendering modes (L172-L178, L1472-L1490)
- `isInlineDealsMode` / `isFigma` is true when `window.__garageDealsInline` is set. In that mode the page uses a dark "Figma" design: a custom black header with icon buttons, the shared `ContactsDataTable` (BackOffice DataTable) and a two-pane filter dialog.
- Otherwise it renders `DealsPageToolbar` plus hand-built tables: a horizontally scrollable `<table>` on mobile (`md:hidden`) and a shadcn `Table` on desktop. Styling has three branches based on the `next-themes` theme: `light`, `dark` and a cyan "color" theme.
- `resolvedTheme` forces `"dark"` in inline mode. The filter dialog and the view-contact dialog use it.
- On the first load, a full-page spinner shows while `isInitialLoad && loading` is true.

### Data mapping helpers (L71-L170)
- `Contact` interface: `_id, firstName, lastName, email, phoneNumber, role?, companyName?, lastActivity?, ownerId?, ownerName?`.
- `mapContactFromApi` makes API records consistent across the different shapes the API returns. `resolveCompanyName` reads `companyDetails.companyName`, `companyDetails.name`, `company.name` or `companyName`. `extractContactOwner` takes the owner from `owner`, `owners[0]`, `ownerId`, `assignedTo` or `assignedUsers[0]`. `phone` falls back to `phoneNumber`, and `lastActivity` falls back to `updatedAt`, then `createdAt`.
- `extractErrorMessage` searches error payloads recursively (`message`, `error`, `description`, `details`, `errors`) to build a message for toasts.
- `DEFAULT_ROLE_OPTIONS` is the starting role list (CEO, CTO, ... , "Other").

### Listing, pagination and owners (L395-L548, L1265-L1307)
- `fetchOwners` loads `crm/contact/owners` once on mount. It accepts `owners`, `data` or a bare array, and maps each entry to `{id, name, email}`. If the previously selected owner no longer exists, the selection resets to `"all"`.
- `fetchContacts(page?, pageSize = limit)` turns the page number into `skip`/`limit` query parameters. When an owner is selected, it adds `ownerName` (the owner's **name**, not the id). It reads totals from `data.total` or `data.pagination.total`; if neither exists, it uses the length of the returned page. `currentPageRef` keeps the page number so callbacks do not read a stale value.
- `hasFetchedInitialContacts` limits the mount fetch to one run. A separate effect refetches page 1 when the selected owner's normalised name changes. `lastAppliedOwnerRef` stops it from fetching twice for the same owner.
- Records per page: 50 by default. The DataTable footer offers 25/50/100/200, and choosing one calls `fetchContacts(1, next)` with the new size passed explicitly. The non-inline view shows numbered pagination with a window of up to 5 pages.
- `useDealsInlineRefresh("contacts", ...)` refetches the current page when the BackOffice header's refresh button fires `deals:inline-refresh` for this section. This only works in inline mode.
- A `window` listener for `deals:open-add-contact` opens the Add dialog. `app/(dashboard)/layout.tsx` dispatches that event from the global "add" action while the Contacts section is active.

### Search, filter and sort (L550-L630, L884-L977, L1033-L1060)
- Each keystroke calls `handleSearch`. A non-empty term calls `crm/searchcontact?q=...` (plus `ownerName`); an empty term reloads page 1. Search results are not paginated: total = number of results and `totalPages = 1`. If the search request fails, the page falls back to the normal list.
- `filteredContacts` also filters on the client: the search term must match first name, last name, email or phone. When an owner is selected, the contact must match `ownerId`, or its `ownerName` must contain the owner's name (case-insensitive substring).
- The filter dialog lets the user tick several owners (`filterSelectedOwners`), but `handleApplyFilters` applies only the **first** one, because the API supports a single owner. "Reset Filter" (inline mode) goes back to `"all"`.
- `sortedContacts` sorts only the rows already loaded, because the API has no sort parameter. Sort keys are name, role, email, phone, company and lastActivity. Contacts without a date go to the bottom (`+Infinity`). Only the inline `ContactsDataTable` uses `sortedContacts`; the non-inline tables render `filteredContacts`.
- Role options grow as data loads: every role seen in fetched contacts is added before "Other". Choosing "Other" in the Add or Edit form opens the "Add Custom Role" dialog (`handleCustomRoleSubmit`), which adds the role to the list without duplicates (case-insensitive) and fills in the target form.

### Create / edit / view / delete (L327-L359, L639-L882, L1108-L1263)
- **Add** (`handleAddContact`): name and email are required, and email is checked with a simple regex. The full name is split into `firstName` (first word) and `lastName` (the rest). The page POSTs `{firstName, lastName, email, phoneNumber, role, companyId}`, then resets the form and refetches. The Add dialog does not close on an outside click or Escape. Companies for the select are loaded from `crm/companies` each time the dialog opens.
- **Edit** (`handleEditClick` / `handleEditSave`): pre-fills the form (company from `(contact as any).companyId`, which `mapContactFromApi` does not set, so the company select usually starts empty), validates it the same way and PUTs to `crm/contacts/:id`. Companies are reloaded when the edit dialog opens.
- **View** (`handleViewContact`): GETs `crm/contacts/:id` and shows the raw response in a read-only "Contact Details" dialog. Clicking a row or the contact name opens it, unless the click lands on an interactive element.
- **Delete**: one contact through `DeleteLeadsDialog` with DELETE `crm/contacts/:id`. **Bulk delete** (inline mode only, from row checkboxes) POSTs `{contactIds, confirmDelete: true}` to `crm/contacts/bulk-delete`. The dialog previews 5 names plus a "remaining" count and cannot be closed while the delete is running. When the contact list changes, any selected ID that is no longer loaded is dropped (L911-L920).
- `handleViewFunnel` and `ViewFunnelDialog` (GET `crm/funnels/:id`) are wired up, but nothing on this page calls `handleViewFunnel`.

### Export and import (L1309-L1470, L2963-L2967)
- `handleExportContacts` calls `fetchAllContactsForExport`. That uses `searchcontact` when a search term is set; otherwise it loops over `crm/contacts` in pages of 2000 until a short page or the total is reached, and respects the owner filter. The result is written with `xlsx` to a "Contacts" sheet with 8 columns (First Name ... Last Activity) and downloaded as `Contacts_Export_<YYYY-MM-DD>.xlsx`.
- "Import CSV" / bulk-upload opens `BulkUploadContactsFlow`, which refetches the current page when the upload finishes.

## Exports
- `default ContactsPage()` - the page component. It takes no props and reads all state internally.

## Interfaces
- **Backend endpoints called** (all on the external CRM API `https://uatapi.garage.app/api`, through `authenticatedFetch`, which attaches the user's bearer token and retries 429/5xx responses):
  - `GET /crm/contacts?skip=&limit=&ownerName=` - paginated list (also used in a loop for export)
  - `GET /crm/searchcontact?q=&ownerName=` - search
  - `GET /crm/contact/owners` - owner list for the filter
  - `GET /crm/companies` - company options for the Add/Edit forms
  - `GET /crm/contacts/:id` - contact details
  - `POST /crm/contacts` - create
  - `PUT /crm/contacts/:id` - update
  - `DELETE /crm/contacts/:id` - delete one
  - `POST /crm/contacts/bulk-delete` - delete many
  - `GET /crm/funnels/:id` - funnel details (unused path, see above)
- **External services:** Garage CRM API at `uatapi.garage.app` (hardcoded in `lib/api-config.ts`, not part of this repo).
- **Browser storage / cookies:** none directly. `authenticatedFetch` reads `auth-token` / `garage_tok` from localStorage and cookies.
- **Window events:** listens for `deals:open-add-contact` and (via `useDealsInlineRefresh`) `deals:inline-refresh`; reads the global `window.__garageDealsInline`.

## Dependencies
- **Internal:**
  - `components/crm/CRMPageLayout.tsx` - page shell (`fill` in inline mode)
  - `components/crm/DealsPageToolbar.tsx` - toolbar, search field wrapper, action button class (non-inline)
  - `components/deals/contacts/ContactsDataTable.tsx` - BackOffice DataTable used in inline mode
  - `components/ui/data-table/types.ts` - `SortState` type
  - `components/crm/ViewFunnelDialog.tsx` - funnel details dialog
  - `components/crm/leads/DeleteLeadsDialog.tsx` - reused as the delete confirmation for contacts
  - `components/crm/contacts/BulkUploadContactsFlow.tsx` - CSV import flow
  - `components/ui/*` (button, table, checkbox, input, dialog, label, select, dropdown-menu) - UI parts; `badge` appears in the import graph's import list but its import is commented out
  - `lib/api-config.ts` - `buildExternalUrl`
  - `lib/deals-events.ts` - `useDealsInlineRefresh`
  - `utils/api.ts` - `authenticatedFetch`
- **Packages:** `react` (hooks), `next-themes` (theme), `lucide-react` (icons), `sonner` (toasts), `xlsx` (Excel export).

## Used by
- `components/dashboard/inlineApps/deals/DealsApp.tsx` - dynamically imports it as the "contacts" section of the inline Deals app.
- Also reachable directly as the Next.js route `/deals/contacts` (the `(dashboard)` group is not part of the URL).

## Notes
- The export filename and "Contacts" sheet name are fixed. Export dates use `toLocaleString()`; the table shows `YYYY-MM-DD` (UTC through `toISOString`).
- The owner filter is sent to the API as `ownerName` (a display name). Two owners with the same name cannot be told apart, and the client-side match is a substring match.
- The "Showing X to Y" footer and the client-side filter can disagree: the server count includes contacts that the client-side owner or search filter hides.
- Many `console.log` calls stay in the code (for example, the full contacts payload at L487).
- `handleViewFunnel`, `isViewFunnelOpen` and the `Badge` import are dead code left from the Leads page this page was copied from.
