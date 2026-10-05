# `app/(dashboard)/deals/leads/[id]/page.tsx`

> Client-side "Lead details" page of the Deals CRM: loads one lead from the external CRM API, normalises it, and wires every lead action (stage, funnel, tasks, follow-ups, products, contacts, company, tags, documents, status) into the `LeadDetailFigmaView` presentation component plus a set of dialogs.

**Kind:** Next.js page · **Lines:** 7696 · **Route:** `/deals/leads/[id]`

## Purpose
This is the detail screen for a single CRM lead ("deal"). It is reached two ways: as a normal App Router page at `/deals/leads/<leadId>`, and embedded inside the Deals inline app (`components/dashboard/inlineApps/deals/DealsApp.tsx`), which dynamically imports this module and renders it as an overlay section. The file is almost entirely controller logic: one giant `LeadDetailsPage` component holding ~120 pieces of state and ~70 handlers, while the visible layout is delegated to `components/deals/LeadDetailFigmaView.tsx` and a handful of `components/deals/*Dialog` components. Nearly all data lives in an **external CRM service** (`https://uatapi.garage.app/api`, via `buildExternalUrl`), not in this repo's Express backend; only the Cabinet file-sync and the team roster go to this repo's `/backend`.

## How it works

### Module-level helpers (L102-L160)
- `JwtPayload` - loose type for decoding the `garage_tok` JWT (`userId`, `orgId`, `name`, ...).
- `COMPANY_SIZE_OPTIONS` - the fixed size buckets (`1-10` ... `1000+`) used by the Edit Company dialog.
- `getDirectoryUserName(user)` - best display name from a roster user (name, first+last, username, email).
- `getCurrentActor()` - `{ userId, name }` of the signed-in user from `getUserDataFromToken()`; name falls back to the email local part.
- `isAutoFollowUpEnabled(value)` - treats `true`, `"on"`, `"true"` as enabled (the API is inconsistent about the type).
- `extractErrorMessage(error, fallback)` - digs a message out of the many error shapes the CRM API returns (`message`, `error`, `details[]`, `errors[]`, ...).

### Lead id, inline mode and theme (L162-L203)
- `leadId` = the `[id]` route param, else `sessionStorage["deals:inline-lead-id"]` (written by `DealsApp` when it opens a lead inline).
- `isInlineDealsMode` = `window.__garageDealsInline` (set by `DealsApp`). In inline mode, "back" and "after delete" dispatch the window event `deals:inline-back-to-leads` instead of `router.back()` / `router.push("/deals/leads")`.
- `resolvedTheme` comes from `next-themes` (`color` / `dark` / `light`; inline mode forces dark). It is only used to style the Delete Contact dialog. A local `DARK` palette object is declared but never referenced.

### State groups (L205-L1060)
State is declared in clusters, each feeding one feature: lead data (`lead` = transformed UI shape, `originalLeadData` = raw API object), activity tab + inline follow-up form, stage/funnel, note, activity log, task modal, file upload, image preview, lead-name editing, company edit/create, products (`productSelections`, `productToEdit`), contacts (pick existing, create new, edit), follow-up / auto follow-up / meeting dialogs, delete-lead, tags, and the Edit Lead profile form with its dropdown lists (`editLeadFunnels`, `editLeadFunnelStages`, `editLeadCategories`, `editLeadCompanies`, `editLeadContacts`, `editLeadProducts`, `editLeadUsers`). `editLeadSources` is a fixed list (Website, Referral, Cold Call, LinkedIn, Event, Email Campaign, Facebook, Facebook Lead Ads, Google Ads, WhatsApp).

Derived memos near the top: `hasCompanyForLead` (true only when the raw lead has a real company id), `hasFunnelStages`, and `hasAssignedFunnel` (a heavily `console.log`-instrumented check across a dozen possible funnel id/name fields; it is computed but not used anywhere).

### Assignee roster (L408-L469, L5009-L5086)
When the task modal opens or the Tasks/Follow-ups tab is active and `editLeadUsers` is empty, the page loads workspace members: first `getTeamMembers(orgId)` (this repo's `GET /backend/team/list?orgId=...`), falling back to the external `GET /crm/organization-users?organizationId=...&limit=1000`. Users are normalised to `{ id, name, ... }`. The same roster is used to resolve "added by / completed by" names on timeline items and to populate the owner dropdown in Edit Lead.

### Normalising the API lead: `transformLeadData` (L1062-L1703)
The CRM API returns loosely shaped data, so `transformLeadData(apiData)` builds a stable UI object:
- **Name / owner:** `getLeadName` (`leadName` or `"--"`), `getOwnerName` / `getOwnerEmail` (checks `assignedUsers`, `owner`, `assignedTo[]`, `assignedToUser`; default `"Unassigned"`).
- **Value:** `pricing` (string values are stripped to digits), not the product totals.
- **Stage:** string or `{name|stage|stageName}`, default `"Lead"`.
- **Company:** name/industry/size/revenue/location/website with `"N/A"` placeholders; a `"No Company"` placeholder when absent.
- **Contacts:** merges `contacts[]` (first is primary) and singular `contact`, de-duplicating by id or by `email-phone`. Email/phone stay empty strings (never `"N/A"`) so edit forms do not treat placeholders as data. A `"No Contact"` placeholder is used when there are none.
- **Products:** `quantity * pricing` per product (the `price` field is ignored), keeping `unit`.
- **Funnel stages and probability:** from `funnel.stages` (strings or objects with `probability`). Current probability is the stage's own value or its position ratio; `stageCompletionPercent` is always position-based. With no funnel, a default 5-stage funnel (Prospects 10 ... Closed Won 100) is used.
- **Activities:** `activities[]` plus `notes` (array or single object) converted into note-type activities.
- **Description:** API description unless it is the backend placeholder "No description available", else the first note text.
- **lastActivity:** max of activity timestamps, `lastActivity` and `updatedAt`.
- **Tasks:** normalised (`isCompleted` from boolean, `"true"` or status completed/done), keeping raw `assignedTo`, `createdBy`, `completedBy`, `updatedBy` and their `*Name` fields; sorted by due date then created date, newest first.
- **Documents:** `docName`, `docLink`, `notes`, `uploadedBy`, `uploadedAt`.
- Also carries `tags`, `autoFollowUp`, `leadStatus`, and the raw `funnel` / `salesFunnel` / `salesFunnelId` / `funnelId`.

`formatFacebookLeadDescription` (L1158-L1235) parses Facebook Lead Ads descriptions (`snake_case?: value` pairs after "Additional Information:") into labelled items; it is defined but never called.

### Loading and refresh (L1705-L1840)
- `fetchLeadDetails` - `GET /crm/leads/:id`; accepts `data.lead`, `data.data` or `data`; rejects payloads without `_id`/`id` (renders "Lead not found"). Sets `lead`, `originalLeadData`, `selectedStage`, `tags`.
- On mount (and when `leadId` changes) it fetches the lead and the product catalogue (`fetchProducts`, `GET /crm/products`).
- `useDealsInlineRefresh("leads-detail", fetchLeadDetails)` re-fetches when the Deals header refresh button fires `deals:inline-refresh` in inline mode.
- Effects keep the auto-follow-up checkbox in sync with `lead.autoFollowUp`, back-fill product names that show "Loading...", and load funnels (`GET /crm/funnels?skip=0&limit=100`) for the pipeline selector.
- After almost every mutation the page repeats the same pattern: `PUT/POST/DELETE`, then `GET /crm/leads/:id`, `transformLeadData`, `setLead` (and usually `setOriginalLeadData`), and `router.refresh()`.

### Stage, funnel and status (L1842-L2012, L3848-L3960)
- `handlePipelineFunnelChange` - `PUT /crm/leads/:id { salesFunnel }` then reloads stages (not wired to the current UI).
- `handleStageChange` - ignores same-stage (case-insensitive) changes; `PUT { stage }`. **Business rule:** moving to the **last** funnel stage auto-sends `PUT { leadStatus: "won" }`; moving off the last stage while the lead is `won` sends `PUT { leadStatus: "active" }`. Reverts the selection on failure.
- `handleUpdateLeadStatus(status)` - `PUT { leadStatus }` for `archived | lost | won | active` (wired to the Edit Lead dialog's Archive / Close Lost / Mark Won / Make Active buttons). `handleRestoreLead` does the same with `active` but is unused. Both reuse the `isSubmittingProduct` flag as their busy state.

### Notes and activity log (L2014-L2199)
- `handleAddNote` - creates (`POST /crm/notes { leadId, notes, organizationId, createdBy }`) or, if the lead already has a first note, updates it (`PUT /crm/notes/:noteId`). The dialog pre-fills from the first existing note.
- `handleLogActivity` - `POST /crm/activities` with title/description/type (`call | email | meeting | note | stage`).
- User id and org id are taken by decoding `localStorage.garage_tok` with `jwt-decode`.

### Tasks (L2201-L2669)
- `getFollowUpDate` / `handleFollowUpSelect` - quick-pick due dates (today, tomorrow, next weekday) that pre-fill the task modal (not wired to the UI).
- `handleEditTask` - converts the due date to local `YYYY-MM-DDTHH:mm`, resolves a single assignee id from `assignedToDetails` / `assignedTo`, and opens the task modal in edit mode.
- `handleDeleteTask` - `DELETE /crm/tasks/:id` (called straight from the view, without the confirmation dialog).
- `handleToggleTaskStatus` - `PUT /crm/tasks/:id { status, isCompleted, completedBy, completedByName }`; updates the UI optimistically and keeps the actor name if the refetched API data leaves it out.
- `handleCreateTask` - requires title, description and due date; the due date defaults to 23:59:59 when no time is given. `POST /crm/tasks` or `PUT /crm/tasks/:id`, with `assignedTo` defaulting to the current user and `createdByName` from the roster. After the refetch it patches `createdByName` onto the new task if the API did not return it. Errors containing "expired token" / "jwt expired" are shown as a generic retry message because some legacy task endpoints report expiry incorrectly.

### Documents and Cabinet sync (L2671-L3232)
- **Upload:** `handleFileUpload` posts a single file to `POST /s3upload/single` (folder `leads`), first with form field `single` and, if multer replies "Unexpected field", again with `file`. It then records it with `POST /crm/leads/:id/documents { docName, docLink, notes, uploadedBy }`. `handleMultipleFileUpload` uses `POST /s3upload/multiple` (field `files`) and creates one document record per returned file. Both run from the `AddDocumentDialog`.
- **Cabinet mirror:** every uploaded file is also copied into this repo's Cabinet: `ensureDealsDocumentsCabinet` finds or creates a root cabinet named "Deals Documents" (`GET/POST /backend/cabinet?organizationId=...`), `ensureLeadCabinet` finds or creates a sub-cabinet `"<lead name> Files"` (`GET /backend/cabinet/:id`), and `uploadFilesToLeadCabinet` posts to `POST /backend/cabinet/files/upload?organizationId=...`. Cabinet ids are cached in refs. These calls use `authenticatedFetchWithCabinetFallback`, which builds URLs from `NEXT_PUBLIC_API_URL` (fallback `https://uatapi.garage.app`) and adds `garage_tok` / `auth-token` as a Bearer token.
- **Back-fill:** an effect runs `syncExistingLeadDocumentsToCabinet` whenever the lead changes. It downloads each existing CRM document by its `docLink`, skips names already in the lead's cabinet, and uploads the rest. A signature ref stops it repeating for the same document set.
- `handleDeleteDocument` - `DELETE /crm/leads/:id/documents/:docId` (Cabinet copies are not removed).
- `handleViewFile` (image preview vs new tab) and `handleFileInputChange` exist but are not wired. `fileInputRef` is never attached to an input.

### Lead name and company (L3234-L3533, L582-L756)
- Inline lead-name edit (`handleEditLeadName` / `handleSaveLeadName` / `handleCancelEditLeadName`) strips a trailing " Deal" and sends `PUT { leadName }`. It is not wired to the current view.
- `handleOpenEditCompany` pre-fills the Edit Company dialog and normalises free-form sizes into `COMPANY_SIZE_OPTIONS` buckets. `handleSaveCompany` sends `PUT /crm/companies/:companyId` with only the non-empty fields.
- `handleCreateCompanyForLead` - `POST /crm/companies`, then `PUT /crm/leads/:id { companyId }` to link it.
- `handleCreateCompanyForContact` - `POST /crm/companies`, then selects the new company in the New Contact form.
- `handleRemoveCompany` - `PUT { removeCompanyId }` (unused).

### Products (L3535-L3846, L3962-L4019)
- The catalogue comes from `GET /crm/products`. `parseProductPricing` reads a leading number from `pricing` (strings like "500/month") or falls back to `price`.
- `handleAddProduct` rebuilds the lead's whole `products` array (`{ productId, quantity, pricing, unit }`) and sends `PUT /crm/leads/:id { products }`. In add mode, selecting a product the lead already has **adds to its quantity** instead of creating a duplicate. In edit mode only one product can be selected and it replaces the edited row. Products with no pricing are rejected.
- `handleDeleteProduct` - `PUT { removeProductId }` (only reachable through the unused confirmation dialog).

### Contacts (L4021-L4275, L5423-L5892)
- `handleOpenAddContact` loads `GET /crm/contacts?skip=0&limit=1000`. `handleAddSelectedContacts` sends `PUT { addContactId }` (a string for one contact, an array for several).
- `handleAddNewContact` / `handleSaveEditedContact` split the full name into first and last, then `POST /crm/contacts` / `PUT /crm/contacts/:id` (name and a valid email are required).
- `handleSetPrimaryContact` reorders `contactIds` so the chosen contact is first. `handleConfirmDeleteContact` sends `PUT { removeContactId }`, which detaches the contact without deleting it.
- Phone resolution (`extractFirstPhoneFromEntity`, `resolveLeadPhoneNumber`) prefers the primary contact, then the lead, and prefers a "mobile"/"cell" entry in `phoneNumbers[]`.
- `handleOpenGmail` opens a Gmail compose URL. `handleOpenWhatsApp` opens `https://wa.me/<digits>` and calls `createWhatsAppContactTask` (logs a "Contacted on WhatsApp" task, then refreshes the lead).

### Follow-ups and meetings (L4296-L4632, L4922-L5006)
- `handleConfirmAutoFollowUp` creates a follow-up task (`POST /crm/tasks` with `FOLLOW_UP_TASK_DEFAULTS`, i.e. `type: "follow-up", isFollowUp: true`, due at 23:59:59 on the start date) and then `PUT /crm/leads/:id { autoFollowUp: true, followUpIntervalDays?, autoFollowUpEndDate? }`. It dispatches `DEALS_CRM_STATS_REFRESH_EVENT` so the CRM dashboard re-counts. The responses of these two calls are not checked.
- `handleScheduleFollowUp` - one manual follow-up task (time optional, default end of day) with the creator name patched in after the refetch.
- `handleInlineAddFollowup` (the view's inline form) needs a title and a description. With a start date, an end date and a positive frequency it starts **auto** follow-up; otherwise it schedules a single follow-up for the start date or today.
- `handleScheduleMeeting` creates a plain task titled "Meeting with Lead" (not wired to the UI).

### View-model memos and timeline (L4634-L4920)
`primaryContact`, `displayLeadName`, `displayEmail`, `displayPhone`, `funnelDisplayName`, `dateAddedLabel` / `lastActivityLabel` (en-GB dates), `companyDisplay`. `resolveUserDisplayName` maps ids or objects to roster names, treats non-ObjectId strings as names already, and falls back to the JWT name for the current user. `timelineItems` turns tasks into `TimelineItem`s (`kind` is `followup` when `isFollowUpTask(task)`), with actor name/action (`added` / `completed`) and `formatDueLabel(dueDate)`, de-duplicated and sorted newest first. The date/time helpers (`getTodayDate`, `isDateToday`, `isTimePast`, `setTaskDatePart`, `setTaskTimePart`, label formatters) power the date-time popovers and block past dates and times.

### Edit Lead profile (L5088-L5374)
`handleOpenEditLead` pre-fills `editLeadForm` from the raw lead (funnel id from several shapes, stage, source, owner id, description, tags, ...) and opens the dialog. `fetchEditLeadDropdowns` then loads funnels, categories, companies, contacts, products (100 each from `/crm/*`) and the roster in parallel. The funnel id is matched by id or by name, the stages for that funnel are loaded (`GET /crm/funnels/:id`, `funnelStage` or `stages`), and the lead's current contact, company and owner are added to their dropdowns if missing. `handleEditLeadProfile` sends only `salesFunnel`, `stage`, `source`, `assignedTo`, `description`. Custom-source text (`customSourceValue`) is collected by the dialog but never sent.

### Rendering (L5975-L7695)
- Loading spinner, then "Lead not found" with a Go Back button.
- Main layout: `DealsNavbar` + `LeadDetailFigmaView` with all display props and callbacks (stage change, edit lead, add/edit products, create/edit/toggle/delete task, inline follow-up, add contact, WhatsApp, Gmail, edit/add company, attach file, delete document, remove tag).
- Dialogs **reachable** from the current UI: Create/Edit Task, `AddContactDialog`, `AddProductDialog`, Edit Company, `AddCompanyDialog` for the lead, `AddDocumentDialog`, `EditLeadProfileDialog` (also tags and status actions).
- Dialogs rendered but **never opened** by any wired control: Add Note, Log Activity, Image Preview, the Delete Task/Document/Product confirmations, Add New Contact (and the `AddCompanyDialog` for a contact inside it), Edit Contact, Delete Contact, Auto Follow-up, Schedule Follow-up, Schedule Meeting, `DeleteLeadsDialog`, `AddTagDialog`.

## Exports
- `default LeadDetailsPage()` - the client page component. It takes no props; the lead id comes from `useParams()` or sessionStorage.

## Interfaces
- **Backend endpoints called (this repo):**
  - `GET /backend/team/list?orgId=...` - workspace roster for assignees/owners (through `getTeamMembers`).
  - `GET /backend/cabinet?organizationId=...` and `POST /backend/cabinet?organizationId=...` - find or create the "Deals Documents" cabinet and the per-lead "`<name>` Files" sub-cabinet.
  - `GET /backend/cabinet/:id?organizationId=...` - list sub-cabinets and files.
  - `POST /backend/cabinet/files/upload?organizationId=...` - mirror lead files into Cabinet (multipart `file` + `cabinetId`).
- **External services:** the CRM API at `https://uatapi.garage.app/api` (hardcoded `API_CONFIG.EXTERNAL_BASE_URL`, used through `buildExternalUrl`). Endpoints used:
  - Leads: `GET/PUT/DELETE /crm/leads/:id`, plus PUT bodies with `stage`, `salesFunnel`, `leadStatus`, `leadName`, `companyId`, `removeCompanyId`, `products`, `removeProductId`, `addContactId`, `removeContactId`, `contactIds`, `addTags`/`removeTags`, `autoFollowUp`.
  - Lead documents: `POST /crm/leads/:id/documents`, `DELETE /crm/leads/:id/documents/:docId`.
  - Notes, activities, tasks: `POST/PUT /crm/notes[/:id]`, `POST /crm/activities`, `POST /crm/tasks`, `PUT/DELETE /crm/tasks/:id`.
  - Catalogue: `GET /crm/products`, `GET /crm/funnels`, `GET /crm/funnels/:id`, `GET /crm/categories`.
  - Companies and contacts: `GET/POST /crm/companies`, `PUT /crm/companies/:id`, `GET/POST /crm/contacts`, `PUT /crm/contacts/:id`, `GET /crm/organization-users`.
  - Uploads: `POST /s3upload/single`, `POST /s3upload/multiple`.
  - Also opens Gmail compose (`mail.google.com`) and WhatsApp (`wa.me`) in new tabs, and fetches existing document URLs directly for the Cabinet back-fill.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base for Cabinet calls (fallback `https://uatapi.garage.app`).
- **Browser storage / cookies:**
  - localStorage: `garage_tok` (JWT decoded for user and org id; Bearer fallback), `auth-token` (Bearer for Cabinet calls), `garage_org_id` (org id for Cabinet, through `getOrgId` and directly).
  - sessionStorage: `deals:inline-lead-id` (lead id in inline mode).
  - `authenticatedFetch` also reads the `auth-token` cookie.
- **Window events:**
  - dispatches `deals:inline-back-to-leads` and `DEALS_CRM_STATS_REFRESH_EVENT` (`deals:crm-stats-refresh`);
  - listens for `deals:inline-refresh` (section `leads-detail`) through `useDealsInlineRefresh`;
  - reads the global `window.__garageDealsInline`.

## Dependencies
- **Internal:**
  - `lib/api-config.ts` - `buildExternalUrl` (external CRM base URL).
  - `utils/api.ts` - `authenticatedFetch` (Bearer token, impersonation-aware, `credentials: "include"`).
  - `lib/deals-events.ts` - `DEALS_CRM_STATS_REFRESH_EVENT`, `useDealsInlineRefresh`.
  - `lib/crm/leadContactActions.ts` - `createWhatsAppContactTask`.
  - `lib/crm/isFollowUpTask.ts` - `isFollowUpTask`, `FOLLOW_UP_TASK_DEFAULTS`.
  - `lib/crm/resolveLeadContactInfo.ts` - `hasLeadEmailOrPhone`, `buildLeadContactFieldsForApi`. Tag updates require an email or phone and send those fields along.
  - `lib/auth.ts` - `getOrgId`, `getUserDataFromToken`.
  - `lib/feed-api.ts` - `getTeamMembers`.
  - `components/deals/LeadDetailFigmaView.tsx` - the main view, plus `formatDueLabel` and the `ActivityTab` / `InlineFollowupForm` / `TimelineItem` types.
  - `components/deals/EditLeadProfileDialog.tsx`, `AddContactDialog.tsx`, `AddCompanyDialog.tsx`, `AddProductDialog.tsx` (and `ProductSelection` type), `AddDocumentDialog.tsx`, `AddTagDialog.tsx` - dialogs.
  - `components/crm/DealsNavbar.tsx` - header.
  - `components/crm/leads/DeleteLeadsDialog.tsx` - delete confirmation.
  - `components/ui/*` - button, dialog, select, popover, calendar, input, label, textarea (used); badge, card, tabs, checkbox and dropdown-menu are imported but unused.
  - `components/crm/CRMSidebar.tsx`, `components/icons/WhatsAppIcon.tsx` - imported but unused.
- **Packages:**
  - `react` - state, effects, memos.
  - `next` - `next/navigation` (`useRouter`, `useParams`).
  - `next-themes` - theme detection.
  - `sonner` - toasts.
  - `jwt-decode` - reading the `garage_tok` claims.
  - `js-cookie` - imported, unused.
  - `lucide-react` - icon imports (only `X` is rendered).

## Used by
- `components/dashboard/inlineApps/deals/DealsApp.tsx` - loads this page with `next/dynamic` and shows it for the `leads-detail` inline section.
- Directly as the Next.js route `/deals/leads/[id]` (the `(dashboard)` group does not appear in the URL).

## Notes
- **Mostly external data:** the lead, its tasks, contacts, products, companies and documents live in the external CRM API (`uatapi.garage.app`), whose base URL is hardcoded in `lib/api-config.ts` with no environment variable. Only the Cabinet mirror and the team roster use this repo's backend.
- **Dead code:** a large share of the file is unreachable: the `DARK` palette, `hasFunnelStages`, `hasAssignedFunnel` (which also logs on every lead change), `formatFacebookLeadDescription`, `getPriorityColor`, `getStageColor`, `handlePipelineFunnelChange`, `handleRestoreLead`, `handleRemoveCompany`, `handleSetPrimaryContact`, `handleFollowUpSelect`, `handleOpenEditProduct`, lead-name editing, `handleViewFile`, `handleFileInputChange`, `handleDeleteLead`, `handleOpenAutoFollowUp`, `handleOpenAddNewContact`, `handleOpenEditContact`, `handleDeleteContact`, `handleScheduleMeeting`, and the dialogs listed under Rendering. Many imports are unused as well.
- **No confirmation:** tasks and documents are deleted straight from the view; their confirmation dialogs are never opened.
- **Partial deletes:** deleting a CRM document does not remove its Cabinet copy. The back-fill de-duplicates by file name only.
- **Back-fill fetches outside URLs:** the Cabinet back-fill `fetch`es every existing `docLink` from the browser each time a lead with new documents is opened. It fails silently when the remote host blocks CORS.
- **Unchecked responses:** auto follow-up does not check either response; it always shows "Auto follow-up started!" unless the request throws.
- **Logging:** verbose `console.log` calls (API payloads, assignee ids) remain in production code.
- **Repeated refetch code:** the "refetch lead after mutation" block is copied in about 25 places. A change to the response shape (`data.lead || data.data || data`) has to be made in all of them.
