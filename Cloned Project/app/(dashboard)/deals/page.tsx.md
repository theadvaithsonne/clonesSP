# `app/(dashboard)/deals/page.tsx`

> The Deals (CRM) dashboard page: KPI cards, a sales-funnel donut, a Today / Next 7 Days / Overdue follow-up board, and the dialogs used to edit follow-ups, edit lead profiles, start auto follow-ups and browse lead lists.

**Kind:** Next.js page · **Lines:** 3471 · **Route:** `/deals`

## Purpose
This is the landing screen of the Deals CRM module. It shows a sales rep or manager a summary of their pipeline (lead count, leads won, conversion rate, estimated revenue), how leads are spread across funnel stages, and which follow-up tasks are due today, in the next 7 days or overdue. Most edits a rep makes from here go through modal dialogs, so they never have to leave the dashboard.

The page renders in two ways. It is the `/deals` route, wrapped in `CRMPageLayout`. `components/dashboard/inlineApps/deals/DealsApp.tsx` also loads it with `next/dynamic` and shows it inside the dashboard's inline-app overlay. That component sets `window.__garageDealsInline = true`, and the page reads the flag to change theme and navigation behaviour (see "Inline mode" below).

**Important:** almost all of the CRM data comes from an **external service**, not from this repo's Express backend. `buildExternalUrl()` in `lib/api-config.ts` prefixes every path with the hardcoded `API_CONFIG.EXTERNAL_BASE_URL`, which is `https://uatapi.garage.app/api`. Only the team-member lookup (`getTeamMembers`) reaches this project's backend.

## How it works

### Module-level helpers and types (L106-L514)
- **Figma icons (L106-L129):** four inline SVG components (`IconTotalLeads`, `IconLeadsWon`, `IconConversionRate`, `IconEstimatedRevenue`) used on the KPI cards. `FIGMA_CARD_BORDER` and `FIGMA_PANEL_CLASS` hold the shared card styling.
- **Types (L134-L237):** `JwtPayload` (claims decoded from the `garage_tok` token), plus `Lead`, `Company`, `Activity`, `PipelineStage`, `FunnelStage`, `AssignedUserFilterOption`, `ActivityFollowUp` (a loose follow-up/task record with an index signature), `EditFunnelStageOption` and `FollowUpSchedulePreview`. Several of these (`Lead`, `Company`, `Activity`, `PipelineStage`) only type state that is never populated.
- **Stage normalisation (L239-L292):**
  - `normalizeLeadStageValue` turns a stage that may be a string or an object (`name`/`stageName`/`value`/`stage`) into a trimmed string.
  - `normalizeFunnelStagesFromApi` reads the stage list from `funnelStage`, `funnelStages` or `stages`, because the API is inconsistent about which field it uses. It always returns `{name, value}` pairs with a string `value`, because Radix `Select` needs string values.
  - `resolveInitialStageForSelect` picks the option that matches the lead's current stage. It tries an exact case-insensitive match first, then a substring match in either direction, and falls back to the first option.
- **Auto follow-up preview (L294-L355):** `buildFollowUpSchedulePreview(nextFollowUp, intervalDays, endDate)` works out the due dates an auto follow-up would create. The interval defaults to 2 days. With an end date it lists every date up to that day; without one it lists exactly 3. It returns an `error` string for invalid dates or when the end date comes before the start date.
- **Follow-up date and sort helpers (L357-L458):**
  - `isActivityFollowUpCompleted` treats `isCompleted === true/"true"` or a status of `completed`/`done` as completed.
  - `getActivityDueDayTimestamp` and `getActivityDueDayKey` reduce `dueDate || scheduledDate || createdAt` to a local calendar day, as a timestamp or a `YYYY-MM-DD` key.
  - `formatFollowUpDayChipLabel` gives "30th Jul" (for the day chips) and `formatDaySectionLabel` gives "30 JUL" (for the section dividers).
  - `getActivityLastUpdatedTimestamp` takes the newest of the task's and the lead's update or contact timestamps. If none are present it falls back to the creation time embedded in a 24-hex Mongo ObjectId.
  - `sortFollowUpActivities` sorts by due day ascending (or descending if asked), then by most recently updated within the same day.
- **`normalizeActivitiesFollowUpsList` (L460-L514):** this function runs on every activities response, both the first load and every refetch. It:
  - works out a display `contactName` from `leadDetails.contacts[0]`, then `contacts[0]`, then `contactName`/`assignedTo`. It rejects names of 50 characters or more and strings that look like hex IDs.
  - builds the `title` from `title`, then the lead's name or company, then `entityName` or `subject`, and finally the literal "Follow-up".
  - copies `leadDetails.stage` into `stage` and resolves `leadId` from `leadId || lead || _id`.
  - sets `isCompleted` and `status` (`"completed"`, or the existing status, defaulting to `"open"`).
  A comment warns that skipping this step breaks card titles and lead links.

### Component setup and theming (L516-L556)
`CRMDashboardPage` is the default export.
- It calls `useLeadNotifications()` but discards the result. The call is only there for its side effects: the hook loads notification preferences from localStorage and can poll `/api/notifications/lead-email` on a timer.
- **Theme:** `dashboardTheme` is `"color"` when the next-themes theme is `color`. Otherwise it is `"dark"` if the theme or resolved theme is dark **or** the page is in inline mode, and `"light"` in every other case. `isDealsDarkTheme` is true for every theme except `"color"`, so the dashboard is dark by design. Many Tailwind class strings switch between the "color" (cyan/neon) styling and the dark Figma styling.
- `openLeadFromActivity(leadId)` first tries `openDealsLeadInline()`. That only works in inline mode: it stores the ID in sessionStorage and dispatches `deals:open-lead-inline`. If it fails, the page calls `router.push('/deals/leads/<id>')`.

### Lead list popup (L558-L622, L722-L809, L3256-L3467)
- `openLeadsListPopup("active" | "won", page)` fetches `GET crm/leads?leadStatus=<active|won>&skip&limit=20`. `openStageLeadsPopup(stageName, page)` fetches `GET crm/leads?stage=<name>&skip&limit=20`. Both accept a response that is a plain array, `{leads}` or `{data}`, and read the total from `total` or `pagination.total`. Pagination uses `LEADS_LIST_PAGE_SIZE = 20`.
- The popup is opened by clicking the Total Leads card (active), the Leads Won card (won), or a legend entry in the funnel chart (stage).
- Helpers prepare each row for display:
  - `getLeadName` gives the lead name.
  - `getOwnerDetails` gives the owner name from `assignedUsers`, `owner` or `assignedTo`.
  - `getTags` gives the tag list, and `getTagColor` cycles through 8 tag colours.
  - `getStageColorForPopup` maps known stage names to badge colours, and `getStageStringForPopup` gives the stage label.
  - `getNextFollowUpForPopup` formats the next follow-up date as dd/mm/yyyy.
- The dialog shows a table with Lead Name, Tags (priority, stage and tag chips), Owner, Stage, Value (₹), Next Follow-up and Contact (`LeadContactQuickActions`). The search box filters only the rows already loaded (by lead name, owner and tags); it does not query the server. Clicking a row closes the dialog and opens the lead. Previous and next buttons re-fetch the neighbouring page.

### State (L624-L891)
- **Dashboard data:** `stats`, `funnelData`, `activitiesFollowUps` and `assignedUsersFilter`.
- **Filters:** `selectedAssignedUserId`, the activities search (`activitiesSearchInput`, debounced into `activitiesSearchQuery`) and the selected day chips for Next 7 Days and Overdue.
- **Dialogs:** the Edit Follow-up form, the Edit Lead form (`initialEditLeadForm` plus tags, status and custom source), the auto follow-up dialog config and the lead list popup.
- **Edit Lead dropdowns:** contacts, companies, owners, funnels and stages, each with a loading flag. `editSources` is a fixed list (Website, Referral, Cold Call, LinkedIn, Event, Email Campaign, Facebook, Facebook Lead Ads, Google Ads, WhatsApp).
- **Declared but never set or rendered:** `deals`, `stages`, `activities`, `companies`, `selectedDateRange`, the custom date fields, and several combobox open/search states.
- `toContactOption`, `toCompanyOption` and `toOwnerOption` turn raw API records into option objects. `formatDateForInput` produces a `YYYY-MM-DD` string. `splitPhoneNumbers` and `isValidPhoneNumberEntry` (10 digits, or 12 starting with 91) are defined here but not used.
- **Org ID (L893-L911):** an effect decodes `localStorage.garage_tok` with `jwtDecode` and stores `payload.orgId` in `editOrganizationId`. It logs the whole payload with `console.log`.

### Data loading (L944-L1291)
- **`refreshCrmDashboardData` (L944-L1194)** sends three requests in parallel with `Promise.allSettled`, so one failing does not block the others:
  1. `GET crm/leads/count[?assignedTo=<id>]` returns the KPI numbers. The response may wrap them in `data`.
     - `totalPricing` becomes Estimated Revenue, `count` becomes Total Leads, `leadswon`/`leadsWon` becomes Leads Won and `totalWonPricing` becomes `leadsWonValue`.
     - `periodGrowth`/`growthPercentage` is also read.
     - Conversion rate is computed on the client as `leadsWon / count × 100`, rounded to 2 decimals.
     - `stageBreakdown[]` becomes `funnelData`. Each entry maps `stage`, `leadsCount`/`leads` and `totalPricing`/`value` into `stage`, `leads` and `value`. Its colour comes from the API, or from a large stage-name to colour map (exact, then substring match), or from a palette by position.
  2. `crm/activities-followups` with `assignedTo` and `search` query parameters, built by `buildActivitiesFollowUpsUrl`. When the search looks like `YYYY-MM-DD`, that helper also adds `dueDate`. The response may be wrapped in `data`, `activities` or `followups`. It is normalised, and when a search is active the results are filtered again on the client with `activityMatchesFollowUpSearch`.
  3. `GET crm/leads/assigned-users` fills the assigned-user filter (deduped by ID). No control in the current markup lets the user change `selectedAssignedUserId`, so it stays `"all"`. Its only use is to resolve assignee names on follow-up cards.

  If the leads-count request is rejected, `error` is set and shown in red at the top of the page. `debugInfo` is collected into a hidden debug box.
- **`refetchActivitiesFollowUps` (L1196-L1227)** reloads only the activities list, using the same normalisation and filtering.
- **Effects:**
  - The search input is debounced by 350 ms. Each new query (or assignee change) refetches activities and shows a spinner while it loads.
  - The full refresh runs on mount and whenever its dependencies change.
  - On the `deals:crm-stats-refresh` window event, the page runs a full refresh and then, 1.2 s later, an activities refetch.
  - On the `deals:activity-followup-append` window event, the page normalises the activity in `event.detail.activity` and adds it to the list. It first removes any existing row for the same lead (or the same `_id`), so each lead keeps one open follow-up. This is how other parts of the Deals UI push new follow-ups in without a refetch.
  - `useDealsInlineRefresh("dashboard", refreshCrmDashboardData)` re-runs the full refresh when an inline refresh event targets the `dashboard` section. It only listens in inline mode.

### Follow-up board (L1300-L1758, L2608-L2777)
- `categorizeActivitiesByDate` skips completed items and anything without a date, then sorts the rest into three groups:
  - **Today:** due day equals today.
  - **Overdue:** due before today.
  - **Next 7 Days:** after today, up to 7 days ahead.
  Anything further out is not shown. Each group is sorted with `sortFollowUpActivities` (ascending).
- `next7DaysDayOptions` and `overdueDayOptions` count items per day and become clickable day chips. If the selected day disappears from the list, the selection resets to "all".
- `scrollToDaySection` highlights the chip, scrolls it into view, and smoothly scrolls the list container to the element with `[data-followup-day=<key>]`. Choosing "all" scrolls back to the top.
- `getAssignedUserNameForActivity` finds the assignee's name. It tries `assignedToDetails[0]` and several fallback name fields, then looks up the `assignedTo` ID in `assignedUsersFilter`, then uses a plain-text `assignedTo` value as long as it does not look like a hex ID.
- **`renderFollowUpActivities(items, label, {groupByDate})`:**
  - shows skeleton placeholders while loading, and an empty message (which mentions the search term if there is one) when the list is empty.
  - renders one `DashboardFollowUpCard` per item. The card gets the lead's display name, phone and email (from `resolveLeadPhone`/`resolveLeadEmail` on `leadDetails`) and these callbacks:
    - click: open the lead
    - WhatsApp: `openLeadWhatsApp`, which refetches activities on success
    - Email: `openLeadEmail`
    - Edit Lead: `handleOpenEditLead`
    - Edit Follow-up: `handleOpenEditFollowUp`
    - Start Auto Follow-up: opens the auto follow-up dialog
  - when `groupByDate` is set (Next 7 Days and Overdue), it groups consecutive items by day under dividers such as "30 JUL".
- The card markup contains a search input and a Radix `Tabs` with three tabs, each showing a red count badge. The Next 7 Days and Overdue tabs show horizontally scrolling day chips above a list capped at 450 px.

### Edit Follow-up (L1760-L1844, L2782-L2949)
- `handleOpenEditFollowUp` fills the form with the title, description (or notes), a `datetime-local` due date, priority and status.
- `handleSaveFollowUp` sends `PUT crm/tasks/<id>` with `{title, description, dueDate (ISO), priority, status, isCompleted}`.
  - On success, an item marked completed is removed from the list straight away. Otherwise the item is patched in place, and the list is then refetched.
  - On failure, the toast shows the server's `message`.
- The dialog uses the `FIGMA` colour tokens from `LeadDetailFigmaView`. Priority can be low, medium or high; status can be open or completed.

### Edit Lead Profile (L1846-L2187, L2951-L3010)
- **`handleOpenEditLead(activity)` (L1885-L2142)** resolves the lead ID from `leadId`, `lead` or `leadDetails._id` (each may be a string or an object). It resets the form, then:
  - fetches `GET crm/leads/<id>`. This request is required: if it fails, the dialog closes.
  - fetches the dropdown data best-effort: `crm/contacts?skip=0&limit=50`, `crm/companies?skip=0&limit=50` and `crm/funnels`. Owners come from `getTeamMembers(orgId)`, which calls this project's backend at `GET /backend/team/list?orgId=...`. If that call throws, it falls back to `crm/organization-users?organizationId=<orgId>&limit=1000`. The org ID comes from `getOrgId()`, then `getUserDataFromToken().orgId`, then the ID decoded from the JWT.
  - picks the current contact, company and owner from the lead record and adds each to its option list if missing.
  - resolves the funnel ID. Only strings that look like a 24-hex ObjectId count as IDs, checked across `salesFunnelId`, `funnelId`, `funnel._id/id` and `salesFunnel`. A comment explains why: the API often puts the funnel *name* in `salesFunnel`. If no ID is found, the name is matched against the loaded funnels. Stages come from the embedded `funnel.stages` and/or `GET crm/funnels/<id>` (`fetchEditFunnelStages`).
  - fills `editLeadForm` with: phone (unique values from `phoneNumbers`, `phone`, `mobile` and the contact's phone fields, joined with commas), notes and description, tags, status, the resolved stage, value (`negotiatedPricing`/`pricing`/`estimatedValue`), priority, `nextFollowUp`, the follow-up interval and end date, `estimatedClose`, and `autoFollowUp`.
- **`handleEditFunnelChange`** reloads stages for the newly chosen funnel and sets the stage to the first one (or clears it).
- **`handleSaveLead`** sends `PUT crm/leads/<id>` with only `{salesFunnel, stage, source, assignedTo, description, leadStatus, tags}`. The other prefilled fields (phone, value, follow-up dates and so on) are not sent. On success it refetches activities, runs the full dashboard refresh and calls `router.refresh()`.
- The form is rendered by `EditLeadProfileDialog`. The page passes it a narrowed form view (funnel, stage, source, assignee, description), the dropdown lists, custom-source state, tag add/remove handlers (tags are de-duplicated case-insensitively) and status buttons. Archive, Close Lost, Mark Won and Make Active only set local `editLeadStatus`; nothing is saved until Save is pressed.

### Auto follow-up (L1519-L1612, L2189-L2236, L3012-L3254)
- **From a dashboard card (`handleAutoFollowUpDialogSave`):** requires the "Enable auto follow-up" checkbox. It:
  1. decodes `garage_tok` to get the user ID and org ID.
  2. sends `POST crm/tasks` to create a follow-up task due today at 23:59:59. The body includes the title and description (defaulting to "Follow-up with Lead" and "Follow-up scheduled"), priority medium, status open, the current user as both assignee and creator, and `FOLLOW_UP_TASK_DEFAULTS` (`type: "follow-up"`, `isFollowUp: true`).
  3. sends `PUT crm/leads/<id>` with `{autoFollowUp: true, followUpIntervalDays?, autoFollowUpEndDate?}`.
  On success, every activity for that lead is marked `isAutoFollowUp: true`. The response of the task POST is not checked.
- **Edit-lead variant ("Configure Auto Follow-up" dialog):** `handleEditAutoFollowUpToggle`, `...ConfigCancel` and `...ConfigSave` edit `editLeadForm.followUpIntervalDays` and `autoFollowUpEndDate`, and show the `editLeadFollowUpPreview` dates. Save only checks that the end date is not before the next follow-up date. This dialog opens only through `isEditAutoFollowUpConfigOpen`, and nothing in the current markup calls `handleEditAutoFollowUpToggle`, so it is effectively unreachable. Even if opened, `handleSaveLead` does not send these fields.

### Main layout (L2238-L2780)
Inside `CRMPageLayout`, the page shows:
- a header block that is empty apart from the error and debug boxes.
- **Four KPI cards:** Total Leads (opens the active-leads list), Leads Won (opens the won list), Conversion Rate and Estimated Revenue (₹, no decimals).
- **Sales Funnel card:**
  - a searchable `Popover` + `Command` filter whose options are the *stages* in `funnelData`, despite the "All Funnels" label.
  - a Recharts `PieChart` donut (inner radius 110, outer radius 124) with the total lead count in the centre.
  - a clickable legend that opens the stage-leads popup. It shows the first 5 stages, with a "View All (n)" toggle that switches to a grid of all of them.
- **Activities & Followup card:** the search box and tabs described above.

The stage filter logic is repeated inline four times (pie data, cells, centre total, legend).

## Exports
- `default CRMDashboardPage()`: the client-side React page component for `/deals`. It takes no props. Everything else in the file is module-private.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/team/list?orgId=...` (via `getTeamMembers` in `lib/feed-api.ts`): loads team members as owner options in the Edit Lead dialog.
- **External services** (UAT CRM API `https://uatapi.garage.app/api`, via `buildExternalUrl` + `authenticatedFetch`):
  - `GET crm/leads/count[?assignedTo=]`: KPI totals and `stageBreakdown`.
  - `GET crm/activities-followups?assignedTo=&search=[&dueDate=]`: the follow-up board.
  - `GET crm/leads/assigned-users`: assignee names.
  - `GET crm/leads?leadStatus=active|won&skip&limit` and `GET crm/leads?stage=&skip&limit`: the lead list popup.
  - `GET crm/leads/:id` and `PUT crm/leads/:id`: load and save the lead profile, and enable auto follow-up.
  - `GET crm/contacts?skip=0&limit=50`, `GET crm/companies?skip=0&limit=50`, `GET crm/funnels`, `GET crm/funnels/:id`: Edit Lead dropdowns and stages.
  - `GET crm/organization-users?organizationId=&limit=1000`: owner fallback.
  - `PUT crm/tasks/:id` and `POST crm/tasks`: edit a follow-up and create the first auto follow-up task.
- **Window events:**
  - listens for `deals:crm-stats-refresh` (`DEALS_CRM_STATS_REFRESH_EVENT`), `deals:activity-followup-append` (`DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT`), and the inline refresh event via `useDealsInlineRefresh`.
  - dispatches `deals:open-lead-inline` indirectly through `openDealsLeadInline`.
- **Browser storage / cookies:**
  - reads `localStorage.garage_tok` (JWT) for `orgId`/`userId`. `authenticatedFetch` attaches the token, or the `auth-token` cookie while impersonating.
  - `openDealsLeadInline` writes `sessionStorage["deals:inline-pending-lead-id"]`.
  - `useLeadNotifications` uses `leadNotificationPreferences` and `lastCheckedLeadId` in localStorage.
- **Background work:** a 350 ms search debounce, a 1.2 s delayed activities refetch after a stats-refresh event, and the polling interval run by `useLeadNotifications`.

## Dependencies
- **Internal:**
  - `components/crm/CRMPageLayout.tsx`: the page shell.
  - `components/crm/LeadContactQuickActions.tsx`: contact buttons in the lead table.
  - `components/deals/DashboardFollowUpCard.tsx`: follow-up cards, plus `toDisplayText`.
  - `components/deals/EditLeadProfileDialog.tsx`: the lead edit form.
  - `components/deals/LeadDetailFigmaView.tsx`: the `FIGMA` colour tokens.
  - `components/crm/LeadNotificationSettings.tsx`: imported but not rendered.
  - `hooks/useLeadNotifications.ts`: new-lead notification polling.
  - `lib/deals-events.ts`: window event names, `openDealsLeadInline`, `useDealsInlineRefresh`.
  - `lib/crm/activitiesFollowUpsApi.ts`: builds the activities URL and provides the client-side search match.
  - `lib/crm/isFollowUpTask.ts`: `FOLLOW_UP_TASK_DEFAULTS`.
  - `lib/crm/leadContactActions.ts`: WhatsApp and email openers. `resolveLeadId` is imported but unused.
  - `lib/crm/resolveLeadContactInfo.ts`: resolves a lead's phone and email.
  - `lib/api-config.ts`: `buildExternalUrl`.
  - `utils/api.ts`: `authenticatedFetch`, `getUserData`.
  - `lib/auth.ts`: `getOrgId`, `getUserDataFromToken`.
  - `lib/feed-api.ts`: `getTeamMembers`.
  - `lib/utils.ts`: `cn`.
  - `components/ui/*`: card, tabs, button, input, dialog, select, popover, command, dropdown-menu, textarea, label, checkbox and badge primitives. Dropdown-menu and checkbox are imported but unused.
- **Packages:**
  - `react`: state, effects and memos.
  - `next/navigation`: router push and refresh.
  - `next-themes`: the current theme.
  - `recharts`: the funnel donut.
  - `react-hot-toast`: toasts.
  - `jwt-decode`: reads the JWT claims.
  - `lucide-react`: icons.
  - `js-cookie`: imported but unused here.

## Used by
- Next.js route `/deals` (inside the `(dashboard)` route group, with `app/(dashboard)/deals/layout.tsx`).
- `components/dashboard/inlineApps/deals/DealsApp.tsx`: imports it with `next/dynamic` as `DealsDashboardPage` and renders it in the inline Deals overlay, after setting `window.__garageDealsInline`.

## Notes
- **External dependency:** the CRM API base URL is hardcoded to the UAT host `uatapi.garage.app` in `lib/api-config.ts`, not configured through an env var. This page does not work without that external service.
- **Dead code and leftovers:**
  - unused state, helpers and imports (`Cookies`, `resolveLeadId`, `LeadNotificationSettings`, `DropdownMenu*`, `Checkbox`, many lucide icons, `formatActivityTime`/`formatActivityDate`, the phone validators, the date-range state).
  - a commented-out auth check and org-ID loader.
  - `console.log` calls that dump the decoded JWT payload, user data and API responses.
- **Duplicated logic:** the stage-filter closure for the funnel is copied four times. The status and colour helpers here repeat logic from the leads list page.
- **Edit Lead gaps:** `handleSaveLead` sends only a subset of the prefilled fields, so changes to phone, value or follow-up dates made elsewhere in the form state are not saved from this page. The auto follow-up config dialog cannot be opened from the current UI.
- **Assignee filter:** the assigned-user filter data is fetched and used in requests, but no control lets the user choose an assignee.
- **Date math:** the Today / Next 7 Days / Overdue split uses the browser's local timezone.
