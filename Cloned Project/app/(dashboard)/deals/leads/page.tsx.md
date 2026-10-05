# `app/(dashboard)/deals/leads/page.tsx`

> The Deals CRM "Leads" screen: a client component that lists, filters, searches, exports, creates, edits and deletes CRM leads (stored in the external Garage CRM API) and hosts the Facebook Leads integration as a second tab.

**Kind:** Next.js page · **Lines:** 9557 · **Route:** `/deals/leads`

## Purpose
This is the main working screen of the Deals/CRM module. Sales users see a paginated table of leads with owner, stage, value, tags and next follow-up, and can open a lead's detail page, edit it in a large "Add / Edit Lead" modal, bulk-delete, export to Excel, bulk-upload from a spreadsheet, and review the CRM activity log.

The page runs in two modes:
- **Standalone route** `/deals/leads`: classic light/dark/"color" themed UI. Filters are mirrored into the URL query string.
- **Inline Deals overlay**: the same module is loaded by `components/dashboard/inlineApps/deals/DealsApp.tsx` (via `next/dynamic`), which sets `window.__garageDealsInline = true`. In that mode the page switches to a dark "Figma" design, renders the shared `LeadsDataTable`, keeps state out of the URL, and opens lead details inside the overlay instead of navigating.

Lead data does **not** live in this repo's Express backend. Nearly every call goes through `buildExternalUrl()` from `lib/api-config.ts`, which hard-codes the base URL `https://uatapi.garage.app/api` (the external Garage CRM / "Supernova CRM" service). The only in-repo backend call is the team-member lookup (`GET /backend/team/list`).

## How it works

### File layout
| Lines | Section |
|---|---|
| L1-L109 | Imports. `FacebookLeadsIntegration` is loaded with `next/dynamic` and `ssr: false` to avoid SSR problems. |
| L110-L288 | Types (`JwtPayload`, `CSVLead`, `ContactOption`, `CompanyOption`, `OwnerOption`, `ExternalSheetRow`), constants (`DEFAULT_ROLE_OPTIONS`, `LEADS_FILTER_STORAGE_KEY`) and pure helpers. |
| L290-L356 | `LeadTagsSeeAll`: a hover popover that shows every tag chip when a row has more than two. |
| L358-L398 | `getPersistedLeadsFilters()`: reads saved filters from `sessionStorage`. |
| L400-L1047 | `LeadsPageContent` state: filters, dialogs, form state, dropdown data, the debounced contact/company/owner searches. |
| L1048-L1616 | Fetching leads plus display helpers for names, owners, tags, dates, phone/WhatsApp/Gmail. |
| L1617-L2178 | Lead-form defaults, template constants, the XLSX template builder, and CSV/Excel parsing and validation. |
| L2180-L2855 | Row actions: view, change stage, follow-up, note, create company/contact, reassign, download the server template. |
| L2857-L3176 | Bulk-upload file parsing and the "external leads converter" (Privyr / Google Sheets to template). |
| L3178-L3454 | Export to Excel and manual refresh. |
| L3456-L3629 | Client-side filtering, the selection cache, select-all logic, and opening the Add Lead dialog. |
| L3631-L4097 | Edit-lead loader, single delete and bulk delete. |
| L4099-L4310 | URL sync, sessionStorage persistence, and the main and debounced fetch effects. |
| L4312-L4831 | Filter dialog data, filter toggles and apply/reset, the activity log, and the Figma filter widgets. |
| L4832-L5056 | Figma style constants, `fetchFunnelStages`, `fetchDropdownData`. |
| L5058-L5424 | Product line items, `handleSaveLead` (create/update), the auto follow-up config, and the mount effect. |
| L5426-L5632 | Stage/status colour helpers, sort keys for the BackOffice table, row action menu. |
| L5634-L6835 | JSX: header (Figma and classic variants), date-range row, tabs, `LeadsDataTable` or the classic table, pagination, Facebook tab. |
| L6837-L9546 | JSX dialogs: Add/Edit Lead, Auto Follow-up config, Add Company (twice), Reassign, Converter, Bulk Upload, Change Stage, Follow-up, Note, delete dialogs, Filters, Activity Log, Add Contact. |
| L9551-L9557 | Default export `LeadsPage` wraps the content in `<Suspense>` because the page uses `useSearchParams`. |

### Identity and organisation
The user's id and org come from decoding the JWT stored in `localStorage["garage_tok"]` with `jwt-decode` (L668-L681, and again inside each submit handler). `orgId` becomes `organizationId`. `userId` (or `id`) is sent as `createdBy` and as the default `assignedTo`. The owner list prefers `localStorage["garage_org_id"]` and falls back to the JWT org (L686-L689, L4355-L4358). `authenticatedFetch` (`utils/api.ts`) adds the Bearer token, retries on 429/5xx, and redirects to login on 401.

### Filter state and persistence (L417-L464, L4104-L4233)
Applied filters are `searchTerm`, `selectedStage`, `selectedOwner` (owner **names**), `selectedLeadStatus`, `selectedFunnel` (funnel ids), `selectedTags`, `dateFrom`/`dateTo` (`yyyy-MM-dd`) and `currentPage`. Stage, owner and funnel can hold several values joined by commas. `"all"` means no filter.
- Initial values: on the standalone route, query params win, then `sessionStorage["deals-leads-filters-v1"]`. In inline mode, only sessionStorage is used.
- Standalone route: an effect writes state back to the URL with `router.replace` (params `search`, `stage`, `ownerName`, `leadStatus`, `salesFunnel`, `tags`, `dateFrom`, `dateTo`, `page`). A second effect reads the URL only on first mount, for deep links. After that, state drives the URL so a background `router.refresh()` cannot overwrite it.
- The tab (`?tab=facebook-leads`) is set only by `setActiveTab`. In inline mode the tab is plain local state.
- Every filter change is saved to sessionStorage. The key is removed when nothing is active.

### Fetching leads (L1049-L1161, L4241-L4310)
`fetchLeads(page)` calls `GET /crm/leads?skip&limit` plus the active filters on the external CRM. If a search term is set, it is sent and `ownerName` is left out. Dates are sent only when both are set. An `AbortController` cancels any earlier request still in flight, so stale responses are ignored, and only the current controller clears the loading flag. The total comes from `data.total` or `data.pagination.total`. If neither exists, the page assumes a single page.

Triggers:
- With no search term, any change to filters, page or `limit` fetches immediately.
- A non-empty search term is debounced by 400 ms. The very first search, from the URL, fires at once.
- A half-filled date range never fetches.
- The window event `DEALS_LEADS_REFRESH_EVENT` (sent when Facebook imports leads) resets to page 1 and refetches.
- `useDealsInlineRefresh("leads", ...)` refetches when the inline shell asks.
- A 30-second auto-refresh exists but is commented out (L4295-L4306).

Fetching only runs while the active tab is `"leads"`.

### Client-side filtering, sorting and selection (L3456-L3579, L5522-L5589)
`filteredLeads` re-applies the multi-value stage and owner filters to the current page, because the server receives them as comma strings. When a search term is present, every row the server returned is kept. Note that the non-search branch tests `includes("")`, which is always true.

`sortedLeadsForTable` sorts only the rows already loaded, by name, owner, stage, value, contact email or next follow-up. Undated rows sink to the bottom. The CRM API accepts no sort parameter.

Selection is held as `selectedLeadIds`. A `selectedLeadsCache` keeps the selected lead objects so selection survives paging and export can skip a refetch. Select-all applies only to the rows currently displayed.

### Display helpers (L1163-L1616, L5426-L5520)
These helpers normalise the CRM's inconsistent lead shapes:
- **Owner** comes from `assignedUsers`, `assignedUser`, `assignedToUsers` or `assigned`, then `owner`, then an `assignedTo` object.
- **Stage** can be a string or an object. It is reduced to a string by `normalizeLeadStageValue` or `getStageString`, and an empty stage shows as `-`.
- **Tags** can be strings or `{name,label,value}` objects.
- **Next follow-up** uses the API's `nextFollowUp`, or falls back to `updatedAt + duration` days. It shows as `DD-MM-YYYY`, or as "Mon D" in Figma mode.
- **Value** is `negotiatedPricing || pricing || estimatedValue`, shown in rupees.

The Tags column combines priority, stage and tags. It shows at most two chips (`MAX_VISIBLE_LEAD_TAGS`) and puts the rest in the `LeadTagsSeeAll` popover. Figma mode colours tags by name through `FIGMA_TAG_COLOR_BY_NAME`.

### Add / Edit lead (L3591-L3977, L4864-L5369)
- `handleOpenAddLead` resets the form, picks the first funnel and owner as defaults, loads products, opens the dialog, then calls `fetchDropdownData`. That function loads contacts, companies and funnels (50 each), lead stages, and owners. The same handler runs when the window event `deals:open-add-lead` fires; the dashboard layout and DealsApp send it from their "+" buttons.
- The Contact, Company and Owner fields are searchable comboboxes. Contact and company searches are debounced by 300 ms and call `/crm/searchcontact?q=` and `crm/searchcompany?q=`. An empty term reloads the first 50. Owner search filters `getTeamMembers` results on the client and falls back to `/crm/organization-users`. Each combobox has an "Add New ..." item that opens the Add Contact or Add Company dialog, prefilled from the search text.
- Choosing a sales funnel loads `GET /crm/funnels/:id` and fills the stage select from `funnelStage` or `stages`. The first stage is selected by default.
- `handleEditLead` loads `GET /crm/leads/:id`. If the lead record carries only an id for its contact or company, it also loads `GET /crm/contacts/:id` and `GET /crm/companies/:id`. It then makes sure those records, and the owner, appear in the dropdowns, rebuilds the form (phones are merged from `phoneNumbers`, `phone`, `mobile`; notes from the first note entry), and adds the lead's current stage to the funnel stages if it is missing.
- `handleSaveLead` checks that lead name, contact and funnel are set, that any email looks valid, and that each phone (split on `,` `;` or newline) has 10 digits or `91` plus 10 digits. It then sends `POST /crm/leads` (create) or `PUT /crm/leads/:id` (edit). The payload sets `pricing`, `negotiatedPricing` and `MaxDiscPrice` all to the estimated value. It also carries `salesFunnel`, `stage`, `phone`/`phoneNumbers`, `tags[]`, `products[]`, `contactId`, `companyId`, `organizationId`, `createdBy`, the auto follow-up fields and `leadStatus`. A trailing " Deal" is stripped from `leadName`.
- **Business rule:** if the chosen stage is the funnel's **last** stage, the lead gets `leadStatus: "won"` and the table is updated straight away.
- If notes were entered, the note is synced afterwards: `PUT /crm/notes/:id` when the lead already has a note, otherwise `POST /crm/notes`. After saving, the page sends `DEALS_CRM_STATS_REFRESH_EVENT`, calls `router.refresh()` and refetches.
- The Auto Follow-up checkbox opens a config dialog for interval days and end date, with a live preview from `buildFollowUpSchedule`. The defaults are 3 follow-ups, every 2 days. Cancelling clears the fields.

### Delete (L3979-L4097)
Single delete uses `DELETE /crm/leads/:id`. Bulk delete uses `POST /crm/leads/bulk-delete` with `{ leadIds, confirmDelete: true }`. Both use `DeleteLeadsDialog`, which previews up to 5 names. If the current page comes back empty, the page steps back one page.

### Export (L3178-L3438)
If rows are selected, the export uses the cached objects, or fetches everything when the cache is incomplete. Otherwise `fetchAllLeadsForExport` pages through `GET /crm/leads` in batches of 2000 with the current filters. That function sends search, owner, stage, status and dates, but **not** funnel or tags. The result is written with `xlsx` as `Leads_Export_<date>.xlsx` in 20 columns: lead, contact, owner, location, tags, funnel, stage, value, priority, source, status, follow-up, close and created date. City can also be parsed from a "City:" line in the description or notes.

### Bulk upload and spreadsheet helpers (L1687-L2178, L2808-L3176)
The live upload UI is `BulkUploadLeadsFlow` (`mode="dialog"`). When it finishes, the page refetches. The page also keeps a set of helpers:
- `generateLeadTemplateWorkbook` builds a workbook with Instructions, Lookups (industries, funnels, every country from `country-state-city`, products) and Lead Data sheets.
- `parseExcelFile` and `parseCSV` read uploads; `parseCSVLine` handles quoted fields. They require `firstName`, `lastName`, and `email` or `phoneNumber`.
- `validateLead` checks a parsed row.
- `handleDownloadBulkUploadTemplate` downloads `GET /crm/leads/bulk-upload/template`.
- `handleBulkUploadFile` parses a file, then pushes `/deals/leads/bulk-upload` outside inline mode.
- The "external converter" maps a Privyr-style sheet (client name, phone, lead stage, Facebook form, opportunity size, notes) into template rows. It can read a public Google Sheet, fetched from `https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx`, or an uploaded file, and it downloads the converted workbook. Rows without a valid email are skipped.

### Filters dialog (L4312-L4831, L8654-L9184)
Opening the dialog loads its options:
- funnels from `GET /crm/funnels?limit=1000`. Stage options are the union of every funnel's stages.
- owners from `getTeamMembers`, with `/crm/organization-users` as the fallback.
- tags from `GET /crm/leads/tags`.

Selections are held in draft `filterSelected*` state. "Apply" turns owner ids into owner names and writes the applied filters. "Reset" clears everything. Figma mode shows a two-pane layout with categories (Lead Stage, Lead Owner, Sales Funnel, Date, Tags), a range calendar for dates, and a "Goal" badge on "closed won". Classic mode shows stacked lists.

### Activity log (L4537-L4611, L9186-L9411)
The log uses `GET /crm/user-activity?startDate&endDate`. It defaults to today and has a date-range filter. Each item renders `actor`, `action`, `entityType`, `message`, `timestamp`, and `changes`/`entityId` in a details block, and the raw JSON is viewable too. The button exists only in the classic header.

### Layout details
In classic mode the desktop table supports mouse drag-to-scroll horizontally (L527-L603, L6367-L6405). Clicks on buttons, inputs and checkboxes do not start a drag. Mobile gets a horizontally scrollable table. Classic pagination shows up to 5 page buttons. In Figma mode, `LeadsDataTable` does its own pagination with page sizes 25/50/100/200 and footer totals (lead count, page value, selected count). Contact quick actions (call/WhatsApp/email) come from `LeadContactQuickActions`.

## Exports
- `default LeadsPage()` - the page component. It renders `LeadsPageContent` inside `<Suspense>` with a spinner fallback.

Everything else (`LeadsPageContent`, `LeadTagsSeeAll`, the helpers) is module-private.

## Interfaces
- **Backend endpoints called (in-repo):** `GET /backend/team/list?orgId=...` (through `getTeamMembers` in `lib/feed-api.ts`) - org members for the owner pickers and filters.
- **External services:** Garage CRM API at `https://uatapi.garage.app/api` (hard-coded in `lib/api-config.ts`, called with `authenticatedFetch`):
  - `GET /crm/leads` (list, export), `GET|PUT|DELETE /crm/leads/:id`, `POST /crm/leads`, `POST /crm/leads/bulk-delete`, `GET /crm/leads/tags`, `GET /crm/leads/stages`, `GET /crm/leads/bulk-upload/template`
  - `GET /crm/contacts`, `GET /crm/contacts/:id`, `POST /crm/contacts`, `GET /crm/searchcontact?q=`
  - `GET /crm/companies`, `GET /crm/companies/:id`, `POST /crm/companies`, `GET /crm/searchcompany?q=`
  - `GET /crm/funnels`, `GET /crm/funnels/:id`, `GET /crm/products`, `GET /crm/organization-users`
  - `POST /crm/notes`, `PUT /crm/notes/:id`, `POST /crm/tasks`, `GET /crm/user-activity`
  - Google Sheets public export URL (converter only); `https://mail.google.com` and `https://wa.me` links (helpers).
- **Browser storage / cookies:**
  - `localStorage["garage_tok"]` (JWT, decoded for `orgId`/`userId`)
  - `localStorage["garage_org_id"]`
  - `sessionStorage["deals-leads-filters-v1"]` (saved filters)
  - `authenticatedFetch` also reads the `auth-token` token from localStorage and cookies.
- **Window events:**
  - Listens for `deals:open-add-lead`, `DEALS_LEADS_REFRESH_EVENT` (`deals:leads-refresh`) and `DEALS_INLINE_REFRESH_EVENT` (via `useDealsInlineRefresh`).
  - Sends `DEALS_CRM_STATS_REFRESH_EVENT` (`deals:crm-stats-refresh`) after saves, stage changes and refreshes.
  - `openDealsLeadInline` sends `deals:open-lead-inline`.
  - Reads the global `window.__garageDealsInline`.
- **Background work:** debounce timers only (contacts/companies/owners 300 ms, search 400 ms, tag popover close 150 ms). No polling.

## Dependencies
- **Internal:**
  - `lib/api-config.ts` (`buildExternalUrl`) - builds CRM URLs.
  - `utils/api.ts` (`authenticatedFetch`) - authenticated fetch with retry.
  - `lib/feed-api.ts` (`getTeamMembers`) - team list.
  - `lib/deals-events.ts` - event names, `openDealsLeadInline`, `useDealsInlineRefresh`.
  - `lib/crm/followUpSchedule.ts` (`buildFollowUpSchedule`) - follow-up date series.
  - `lib/crm/isFollowUpTask.ts` (`FOLLOW_UP_TASK_DEFAULTS`) - marks created tasks as follow-ups.
  - `components/deals/leads/LeadsDataTable.tsx` - inline (Figma) table.
  - `components/ui/data-table/types.ts` (`SortState`) - sort state type for that table.
  - `components/crm/DealsNavbar.tsx` - top bar.
  - `components/crm/LeadContactQuickActions.tsx` - row contact actions.
  - `components/crm/leads/BulkUploadLeadsFlow.tsx` - upload wizard.
  - `components/crm/leads/DeleteLeadsDialog.tsx` - delete confirmation.
  - `app/(dashboard)/deals/facebook/facebookintegration.jsx` - Facebook Leads tab.
  - `components/crm/CRMSidebar.tsx` - imported, but its render is commented out.
  - shadcn primitives in `components/ui/*` (button, table, checkbox, badge, calendar, command, dialog, dropdown-menu, input, label, popover, select, tabs, textarea).
- **Packages:**
  - `react` - state and effects.
  - `next` - `useRouter`/`useSearchParams`, `dynamic`.
  - `next-themes` - theme ("light"/"dark"/"color").
  - `xlsx` - export, templates and parsing.
  - `country-state-city` - country/state lists.
  - `date-fns` - `format`.
  - `react-day-picker` - `DateRange` type.
  - `jwt-decode` - reads the token.
  - `sonner` - toasts.
  - `lucide-react` - icons.
  - `js-cookie` - imported but not used directly here.

## Used by
- Next.js route `/deals/leads` (route group `(dashboard)`).
- `components/dashboard/inlineApps/deals/DealsApp.tsx` imports it with `next/dynamic` and renders it inside the inline Deals overlay.
- Related routes in the same folder: `/deals/leads/[id]` (detail, the target of row clicks) and `/deals/leads/bulk-upload`. `page-old.tsx` is an older copy.

## Notes
- **Dead / unreachable code.** Several handlers are defined but never called, so their dialogs can never open: `handleChangeStage` (Change Stage dialog), `handleAddFollowUp` (Schedule Follow-up dialog; `POST /crm/tasks`), `handleAddNote` (Add Note dialog), `handleReassignLead` (Reassign dialog). The same applies to `handleDownloadBulkUploadTemplate`, `handleBulkUploadFile`, `handleOpenGmail` and `handleOpenWhatsApp`. The converter dialog has no `setIsConverterOpen(true)` anywhere. `getStatusColor`, `getStatusText`, `canScrollLeft`/`canScrollRight`, `setSources` and the `leadStages` state (filled from `/crm/leads/stages` but never read) are unused.
- **Wasted requests on mount.** `fetchBulkUploadProducts` and `fetchBulkUploadFunnels` run on every mount, but only the unreachable converter uses their results.
- **Two Add Company dialogs (bug risk).** Two separate `<Dialog>`s are bound to `isAddCompanyDialogOpen` (L7812 and L8472), so both mount when "Add New Company" is chosen. The first takes free-text country/state. The second uses `country-state-city` selects and stores ISO codes.
- **Export ignores two filters.** Funnel and tag filters are not passed to `fetchAllLeadsForExport`, so an unfiltered-selection export can include leads outside the current view.
- **Debug logging.** The page logs to the console heavily (`!!! SMOKE TEST ...`, `[DEBUG-EDIT-LEAD]`), including whole lead objects that hold contact PII.
- **UAT base URL.** The CRM base URL is a hard-coded UAT host, not an environment variable. Switching environments means editing `lib/api-config.ts`.
- **Validation mismatch.** `validateLead` expects `DD-MM-YYYY` dates while the generated template tells users to use `YYYY-MM-DD`. `validateLead` itself is never called.
- **Misleading label.** The activity log title says "(Today)" even after a custom date range is applied.
