# `app/(dashboard)/deals/companies/page.tsx`

> Client-side Next.js page for the Deals CRM "Companies" list. It lists, searches, filters, sorts, exports, bulk-imports, creates, edits, views and deletes CRM companies, all stored in the external Garage CRM API.

**Kind:** Next.js page · **Lines:** 3960 · **Route:** `/deals/companies`

## Purpose
This is the Companies section of the Deals CRM module. It renders in two places:

1. As a normal dashboard route at `/deals/companies` (the `(dashboard)` route group does not appear in the URL).
2. Inside the inline Deals overlay (`components/dashboard/inlineApps/deals/DealsApp.tsx`), which loads this same default export through `next/dynamic` and sets `window.__garageDealsInline = true` while it is mounted.

The page has no backend of its own in this repo. Every data call goes through `buildExternalUrl()` from `lib/api-config.ts`, which builds URLs on the external CRM service `https://uatapi.garage.app/api` (hardcoded in `API_CONFIG.EXTERNAL_BASE_URL`). These calls do **not** go to `/backend/*`. A search of `server/` finds no matching routes.

## How it works

### Rendering modes (L70-L77, L1532-L2504)
- `isInlineDealsMode` / `isFigma` is true when `window.__garageDealsInline` is set, which happens only inside the inline Deals app. In this mode the page renders a dark "Figma" design: a black header with search, a Filters button (with a dot when a filter is active), Export, Bulk-upload and Add icons, plus a "Delete Selected (n)" button when rows are selected. The list uses `CompaniesDataTable`, which supports row selection, column sorting, footer totals and its own pagination with 25/50/100/200 records per page.
- Otherwise (the standalone route) it renders `DealsPageToolbar` with a search field and Filters / Export / Import CSV / Add Company buttons, a "N Companies" count strip, a horizontally scrolling mobile `<table>` (`md:hidden`), and a desktop shadcn `Table` (`hidden md:block`). Below them sit a "Found N results" filter summary with Clear Search / Clear Owner Filter buttons, and a numbered paginator that shows up to 5 page buttons. The paginator is hidden while a search term is present.
- `theme` from `next-themes` changes class names for `"color"` (cyan-on-navy), `"dark"` and light. `resolvedTheme` forces `"dark"` in inline mode, so dialogs are always dark there.
- During the first load (`isInitialLoad && loading`) only a centred "Loading companies..." spinner is shown.

### Data model
The local `Company` interface (L50-L68) is the normalised shape: `_id`, `companyName`, `industry`, `website`, `pinCode`, `address`, `country`, `city`, `state`, and the optional `size`, `revenue`, `ownerName`, `ownerId`, `openLeads`, `wonDeals`, `lastActivity` and `leads[]`. API responses are normalised defensively because the CRM returns several field names:
- name: `companyName` or `name`
- website: `website` or `websiteUrl`
- size: `size`, `employeeSize` or `numberOfTeamMembers`, bucketed into `1-10`, `10-50`, `50-100`, `100-500`, `500-1000` or `1000+` by a local `formatSize`. A non-numeric value passes through unchanged.
- owner: `owner`, `ownerDetails`, `ownerInfo` or `owners[0]`. The name comes from `name` or from `firstName lastName`.
- open leads: `activeLeadsCount`, `openLeads` or `activeLeads`
- won deals: `wonLeadsCount`, `wonDeals` or `successfulDeals`
- last activity: `lastActivity`, `updatedAt` or `createdAt`

### Loading the list: `fetchCompanies(page?, pageSize = limit)` (L309-L447)
- Sends `skip = (page-1) * pageSize` and `limit` to `GET crm/companies`. It adds `ownerName` when an owner filter is active and `industry` when an industry filter is not `"all"`.
- Reads the total from `data.total`, then `data.pagination.total`. If neither exists, the total is the row count and there is 1 page.
- Adds the owners it sees to the owner filter options (`mergeOwnerOptions`). Adds any new industries to `industryOptions` and keeps `"Other"` last.
- `currentPageRef` holds the current page so callbacks always fetch the right page. `pageSize` is passed explicitly by the records-per-page control so it does not read a stale `limit`.

### Search: `handleSearch` / `searchCompanies` (L525-L651)
- Each keystroke in either search box calls `handleSearch`. There is no debounce. A non-empty term calls `GET crm/searchcompany?q=...` (plus `ownerName` if set). An empty term goes back to `fetchCompanies(1)`.
- Search results are normalised the same way. The total is set to the result count and pages to 1. If the search fails, the page falls back to `fetchCompanies(1)`.

### Client-side filtering and sorting (L1129-L1241)
- `filteredCompanies` filters the loaded rows again in the browser. Search matches name, industry, city or country. Owner matches by `ownerId` or by a substring of the owner name. Industry needs an exact case-insensitive match.
- `hasFilters` decides whether counts show `filteredCompanies.length` or the server `totalCompanies`.
- `sortedCompanies` (used only by the inline `CompaniesDataTable`) sorts the **current page only**, because the companies API takes no sort parameter. Sort keys are `name`, `industry`, `size`, `owner`, `openLeads`, `wonDeals` and `lastActivity`. Companies with no date always sort last.
- Selections that no longer appear in `companies` are pruned by an effect (L1160-L1166).

### Owner and industry filters
- On mount, `GET crm/companies/industries` loads the industry list (L203-L253). It accepts string items or `{name}` / `{label}` items, removes case-insensitive duplicates, sorts them, and appends `"Other"`.
- `fetchCompanyOwners` (L710-L771) calls `GET crm/companies/owners`, which may return `owners`, `data` or a bare array. It merges the result into `ownerFilterOptions` and resets the owner filter to `"all"` if the selected owner is gone.
- An effect (L279-L306) keeps `selectedOwnerName` in step with `selectedOwnerFilter` (an owner id). The API filters by owner **name**, not id.
- Filter dialog: `openCompaniesFilterDialog` (L1319-L1332) copies the applied filters into draft state. It builds the industry choices only from the companies on the currently loaded page. Inline mode shows a two-pane dialog (category list on the left, checkboxes on the right) with Reset Filter / Apply Filter. Standalone mode shows a single stacked list. The checkboxes allow several choices, but `handleApplyFilters` (L686-L700) applies **only the first** selected industry and owner, because the API accepts one of each.
- Refetch effects:
  - L1422-L1442 refetches page 1 when the effective owner name changes. `lastAppliedCompanyOwnerRef` prevents repeat fetches.
  - L1444-L1452 resets the industry filter if that value is no longer in `industryOptions`.
  - L1454-L1457 refetches page 1 whenever `selectedIndustryFilter` or the `fetchCompanies` identity changes, but only after the first load.

### Create (L1334-L1401, dialog L3154-L3409)
"Add New Company" requires only Company Name. It also takes Company Size (a fixed bucket list), Revenue, Industry and Website. The page sends `POST crm/companies` with `{companyName, industry?, website?, size?, revenue?}`, then resets the form, closes the dialog and refetches. Clicking outside the dialog or pressing Escape does not close it.

The dialog opens from the toolbar buttons and also from a window event `deals:open-add-company` (L1411-L1415). `app/(dashboard)/layout.tsx` dispatches that event when the shell's "add" action runs while the Deals section is `companies`.

### Custom industry (L777-L828, dialog L3411-L3457)
Choosing `"Other"` in either industry dropdown opens "Add Custom Industry". The value entered is matched case-insensitively against the existing options, added to the list locally if it is new, and written into the add or edit form (`pendingIndustryTarget`). The new industry is not saved on its own; it is stored only as the company's `industry` field.

### Edit (L830-L1000, dialog L2594-L3025)
- `handleEditClick` fills `editForm` from the row and pre-selects the country from `useLocationStore`. It then loads states and cities and tries to pre-select them after 100 ms `setTimeout`s.
- Required fields are company name, industry, pin code, country, state and city. Each has its own error message.
- `handleEditSave` sends `PUT crm/companies/:id` with the form fields. Country, state and city are taken from the selected dropdown objects where present. After saving it refetches companies and owners.

### View, view leads and delete
- `handleViewCompany` (L458-L489): `GET crm/companies/:id` fills the read-only "Company Details" dialog (L3772-L3956). The dialog shows the raw API object, so fields such as `ownerName` appear only if the detail endpoint returns them. Clicking a row (outside buttons, inputs, checkboxes and menu items) also opens this dialog.
- `handleViewLeadsClick` (L1008-L1013) lists the `leads` array that is already on the row, in the "Leads - <company>" dialog (L3027-L3152). Each lead shows a display name (`getLeadDisplayName`), its stage and its value (`pricing` / `negotiatedPricing` / `estimatedValue`). Clicking a lead calls `openDealsLeadInline(id)`. If that returns false (not in inline mode), the page calls `router.push('/deals/leads/<id>')`. The "View Leads" menu item exists only in the standalone tables; the inline row menu (`renderCompanyRowActions`) has View / Edit / Delete only.
- Single delete (L1031-L1060): `DELETE crm/companies/:id`. Inline mode confirms with `DeleteLeadsDialog`, reworded for companies. Standalone mode uses a plain confirm `Dialog`.
- Bulk delete (L1284-L1314): sends one `DELETE crm/companies/:id` after another for each selected id, counts failures, shows a toast with the result, clears the selection and refetches. It is confirmed through `DeleteLeadsDialog`. Selecting rows is possible only in inline mode.

### Export and bulk import
- `handleExportCompanies` (L1459-L1530) uses `xlsx` to build `Companies_Export_<YYYY-MM-DD>.xlsx` (sheet "Companies") with columns Company Name, Industry, Website, Phone Number, Email, Address, City, State, Country, Pincode, Owner and Last Activity. It downloads the file through a Blob object URL. It exports only the `companies` loaded right now (the current page or search results), not the whole database.
- `BulkUploadCompaniesFlow` (L3459-L3463) handles CSV/Excel import by itself. When it finishes, the page calls `fetchCompanies(currentPageRef.current)`.

### Refresh hooks
- `useDealsInlineRefresh("companies", ...)` (L1417-L1419) refetches the current page when the inline Deals shell sends a `deals:inline-refresh` event for the `companies` section. The hook only listens while in inline mode.
- `handleRefresh` (L703-L708) refetches companies and owners. No button in the current JSX calls it.

## Exports
- `default CompaniesPage()` - the client component for the Companies list. It takes no props.

## Interfaces
- **Endpoints called (external CRM service, `https://uatapi.garage.app/api/...` via `buildExternalUrl`, sent with `authenticatedFetch` bearer auth):**
  - `GET crm/companies?skip=&limit=[&ownerName=][&industry=]` - paginated list
  - `GET crm/searchcompany?q=[&ownerName=]` - search
  - `GET crm/companies/industries` - industry options
  - `GET crm/companies/owners` - owner filter options
  - `GET crm/companies/:id` - company detail
  - `POST crm/companies` - create
  - `PUT crm/companies/:id` - update
  - `DELETE crm/companies/:id` - delete (single and bulk)
  - `GET crm/funnels/:id` - funnel detail, used only by the unused `handleViewFunnel`
- **Browser events:** listens for `deals:open-add-company` (window CustomEvent) and `deals:inline-refresh` (via `useDealsInlineRefresh`). Through `openDealsLeadInline` it sends `deals:open-lead-inline` and writes `sessionStorage["deals:inline-pending-lead-id"]`.
- **Browser storage / cookies:** none directly. `authenticatedFetch` reads `localStorage` `auth-token` / `garage_tok` and the `auth-token` cookie to build the Authorization header.
- **Window globals:** reads `window.__garageDealsInline`, which `DealsApp.tsx` sets.

## Dependencies
- **Internal:**
  - `components/crm/CRMPageLayout.tsx` - page frame (`fill` in inline mode)
  - `components/crm/DealsPageToolbar.tsx` - `DealsPageToolbar`, `DealsSearchField`, `dealsToolbarActionBtn` for the standalone header
  - `components/deals/companies/CompaniesDataTable.tsx` - inline-mode data table
  - `components/ui/data-table/types.ts` - `SortState`
  - `components/crm/ViewFunnelDialog.tsx` - funnel detail dialog (rendered, but nothing opens it)
  - `components/crm/leads/DeleteLeadsDialog.tsx` - delete confirmation, reused for companies
  - `components/crm/companies/BulkUploadCompaniesFlow.tsx` - bulk import flow
  - `components/ui/*` (button, checkbox, dialog, dropdown-menu, input, label, select, table) - shadcn primitives
  - `lib/api-config.ts` - `buildExternalUrl` (external CRM base URL)
  - `lib/deals-events.ts` - `openDealsLeadInline`, `useDealsInlineRefresh`
  - `store/locationStore.tsx` - `useLocationStore` country/state/city lists and selection for the edit form
  - `utils/api.ts` - `authenticatedFetch`
- **Packages:** `react` (state/effects/memo), `next` (`useRouter` from `next/navigation`), `next-themes` (`useTheme`), `lucide-react` (icons), `sonner` (toasts), `xlsx` (Excel export)

## Used by
- `components/dashboard/inlineApps/deals/DealsApp.tsx` - loads it dynamically as `DealsCompaniesPage` for the inline Deals "companies" section.
- Also reachable directly as the Next.js route `/deals/companies`.

## Notes
- **External dependency:** the whole page depends on `uatapi.garage.app` (a UAT host hardcoded in `lib/api-config.ts`), not on this repo's Express backend. Changing environments means editing `API_CONFIG.EXTERNAL_BASE_URL`.
- **Dead code:** `handleViewFunnel`, the funnel state and `ViewFunnelDialog` are wired up, but nothing calls `handleViewFunnel`. `handleRefresh` is unused. Many imported icons (e.g. `Building`, `User`, `X` in standalone mode) and `TableHead`-only paths go unused. In the standalone branch, every `isFigma ? ... : ...` check inside the mobile and desktop tables is dead code, because those tables render only when `isFigma` is false; this is why checkboxes never appear there.
- **Duplication:** the size-bucketing `formatSize` is defined three times (inside `fetchCompanies`, inside `searchCompanies`, and at component level). The response normalisation is copied between list and search.
- **Edit prefill race:** `handleEditClick` looks up `states` / `cities` inside `setTimeout` callbacks that captured the arrays from the render when the click happened. The newly loaded state and city lists may therefore not be found, which leaves State/City empty. Validation then blocks saving until the user picks them again.
- **Multi-select is cosmetic:** the filter dialogs let you tick several industries or owners, but only the first of each is applied.
- **Industry filter choices come from the current page:** `availableFilterIndustries` is built from the loaded rows only, not from the industries endpoint.
- **Search hits the API on every keystroke** with no debounce or request cancellation, so a slow earlier response can overwrite a newer one.
- **Double fetches:** because `fetchCompanies` changes identity whenever `limit`, `selectedOwnerName` or `selectedIndustryFilter` changes, the effect at L1454 can refetch page 1 in addition to the explicit fetch. This happens for example after changing records-per-page, or with the owner effect at L1422.
- **Pagination with client filters:** when an owner/industry filter is active, the count shows the filtered length of the current page, while server pagination still reflects the server total.
- **Bulk delete is sequential and not atomic:** one request per company, so some deletions can succeed while others fail. The toast reports the failure count.
- **Export:** the Phone Number and Email columns read `phoneNumber` / `phone` / `email` through `any` casts. Normalisation drops these fields, so the columns are usually empty.
