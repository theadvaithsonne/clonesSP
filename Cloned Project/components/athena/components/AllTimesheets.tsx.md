# `components/athena/components/AllTimesheets.tsx`

> Admin "All timesheets" view for the Athena/Taskroom project-management module: a people x weekday grid of tracked hours for a whole workspace, plus a per-member drill-down timesheet that is also reused, read-only, by the timesheet approvals screen.

**Kind:** React component · **Lines:** 2443

## Purpose
Athena (the project-management app embedded in Garage, backed by the external Taskroom API) lets members log time against tasks and submit weekly timesheets. This file gives workspace admins a team-wide view of that data. It has three parts: the default-exported `AllTimesheets` list (one row per member, one column per day of the selected week), `MemberTimesheetDetail` (one member's task-by-day timesheet for a week, with expandable time entries and add/remove-task actions), and a set of fetch and formatting helpers. `TimesheetApprovals.tsx` reuses `MemberTimesheetDetail` in a read-only "approval review" mode by passing an `approvalContext`.

All data comes from the external Taskroom service, not from this repo's Express backend.

## How it works

### Constants, types and helpers (L27-L393)
- Layout constants for the people grid (`PEOPLE_COL_STYLE`: 240px name column, 7 day columns of at least 88px, an 88px total column) and sticky left/header cell styles. The detail grid reuses the `TIMESHEET_*` style constants from `./timesheet`.
- Fixed capacities: `DEFAULT_WEEKLY_CAPACITY_H = 40` and `DEFAULT_DAILY_CAPACITY_MINS = 480`. They are hard-coded for every member; nothing per-user is read.
- `getWeekRange(offsetWeeks)` builds the seven `Date`s of a **Sunday-to-Saturday** week in the browser's local time, offset by N weeks from the current week, plus `weekStartMs` (Sunday 00:00) and `weekEndMs` (Saturday 23:59:59.999). These epoch milliseconds are what the API receives as `weekStart`/`weekEnd`.
- `taskroomBase()` returns `NEXT_PUBLIC_TASKROOM_URL` with a trailing slash, falling back to `https://uatapi.garage.app/taskroomv2/v2/`. `authHeaders()` sends `Authorization: Bearer <garage_tok>` taken from `localStorage`.
- Formatters: `fmtDate`/`fmtDateHeader` ("Mon, Jan 5"), `fmtWeekRangeLabel`, `fmtCellHours` ("2h 30m", "45m", "0h"), `fmtHmPill` ("02h 30m"), `fmtPopoverDate`, `initials`, and `formatLoggedInTimezone`, which uses `Intl.DateTimeFormat` to print e.g. "Logged in timezone: IST (UTC+5:30)".
- `entryMinsForDisplay` shows a live (still-running) entry as elapsed minutes since its `startTime`.
- **Admin row mapping:**
  - `normalizeDailyTotals` coerces a `{sunday..saturday: {billable, nonBillable|non_billable}}` object into non-negative integer minutes.
  - `pickDailySource` picks which totals to show: `dailyTotals` if present, otherwise `approvalDailyTotals` when `currentStatus` is `submitted`, `approved` or `pending`, otherwise `draftDailyTotals`.
  - `mapAdminRows` groups raw rows by user `_id`, since the API can return several rows per user. It keeps the last non-empty name, email and image, and the breakdown with the **highest weekly total**, then sorts members by name, case-insensitively.

### `DayCellHoverPopover` (L395-L587)
A hover tooltip for each day cell, rendered through `createPortal` into `document.body` with fixed positioning under the cell. Hiding is delayed by 120 ms so the pointer can move onto the popover. It shows total capacity (8h), tracked time split into billable and non-billable, remaining capacity, each as a percentage of capacity, and the member's timezone.

### Fetching (L589-L655)
- `fetchAdminWorkspaceTimesheets(workspaceId, weekStartMs, weekEndMs, page, size)` calls the workspace-level admin endpoint. Concurrent identical requests are de-duplicated through the module-level `adminWorkspaceInflight` map, keyed by workspace, week, page and size; an entry is removed once its promise settles. It accepts either `{data: [...]}` or a bare array and returns mapped members plus pagination metadata (from `extractSheetMetadata`) and `count`.
- `fetchAdminUserTimesheet(opts)` (exported) fetches one member's timesheet for a week and returns the raw payload.

### `MemberTimesheetDetail` (L675-L1885)
State: the week offset (starts at `initialWeekOffset`), task rows, `timesheetId`, task pagination, per-task expanded flags, per-task entry loading flags and entry pagination, and add/remove-task progress.

- **Loading (L725-L795):** when the week, member or `refreshKey` changes, a ref forces page 1. The effect then calls `fetchAdminUserTimesheet` and parses the response with `parseTimesheetApiPayload` (from `./timesheet`) into task rows (`time[7]` minutes per day, plus `entries`) and the sheet id. A stale response is dropped through a `cancelled` flag. Errors from the server message are shown inline and in a toast. A missing `workspaceId` shows "Missing workspace.".
- **Time entries (L797-L847):** `loadTaskEntries` runs when a row is expanded. It calls `fetchTaskTimeTracks` with `isPersonal: false` and the member's id (one page at a time) and caches which tasks already have page 1 loaded. A second effect auto-expands every task in approval mode when `detailView === "entries"`.
- **Add tasks (L854-L936):** "Add task" calls `fetchTimesheetAllTasklist(timesheetId, { workspaceId, assignedToMe: false })` and opens `AddTaskDialog`. Confirming sends a PUT to `tasks/time/sheets/:timesheetId/add/tasks` with `{ taskIds }` and then refreshes.
- **Remove a task (L938-L979):** after a `confirm()` that says tracked time stays on the task, it calls `removeTasksFromTimesheet`, drops the row locally and refreshes.
- **Render:**
  - **Approval mode** (`approvalContext` set; L983-L1186): member avatar, submission date, an `ApprovalStatusPill` (Pending / Changes needed / Approved), "Request changes" and "Approve" buttons when `showReviewActions` is true (they call `approvalContext.onReview("reject" | "approve")`), a summary with a tracked/capacity progress bar and billable vs non-billable, and a fixed week label with no week navigation.
  - **Normal mode** (L1188-L1307): a back button, the member header, previous/next week buttons, `TimesheetWeekPicker` and a "This week" badge.
  - **Grid** (L1335-L1867): day totals in the header, one row per task (name, space with a colour dot, minutes per day, row total), expandable entry rows (date, label, a `$` badge for billable, a `Live` badge, minutes on the entry's day), entry pagination, task pagination, and the "Add task" button.
  - Approval mode is read-only: it hides the remove and add controls and uses tighter row padding.

### `AllTimesheets` (default export; L1940-L2434)
- Props: `workspaceId` and an optional `onOpenMember(memberId)` callback.
- Loads members for the selected week and page with `fetchAdminWorkspaceTimesheets` (page size `TIMESHEET_PAGE_SIZE`). The page resets to 1 when the week, workspace or refresh changes.
- The toolbar has previous/next week buttons, `TimesheetWeekPicker`, a "This week" reset button and an "All members" `<select>`. The select filters only the members already loaded on the current page.
- The grid shows "People (count)", where count is the server `metadata.count` when the filter is "all". Each member row has an avatar or initials, the 40h capacity, an "Open →" button, seven day cells wrapped in `DayCellHoverPopover`, and the weekly total. Pagination appears when `totalPages > 1`.
- Clicking "Open →" stores the member, calls `onOpenMember`, and renders `MemberTimesheetDetail` for that member in place of the list, starting on the same week.
- A `<style>` tag defines the `allTimesheetSpin` keyframes used by `LoaderBlock`.

## Exports
- `default AllTimesheets({ workspaceId, onOpenMember? })` - workspace-wide timesheet grid with drill-down.
- `MemberTimesheetDetail({ member, workspaceId, initialWeekOffset, onBack, approvalContext? })` - one member's weekly timesheet; read-only approval review when `approvalContext` is given.
- `fetchAdminUserTimesheet({ workspaceId, weekStartMs, weekEndMs, timeSheetUserId, page?, size? })` - raw admin GET for one user's sheet.
- `type AllTimesheetsMember` - `{ id, name, email?, image?, dailyMins[7], dailyBreakdown[7], weekTotalMins, weeklyCapacityH, timeZone? }`.
- `type MemberTimesheetApprovalContext` - `{ submissionId, status: "pending" | "changes_needed" | "approved", submittedAt, billableMins, showReviewActions, reviewing, onReview(action) }`.

## Interfaces
- **External services (Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`):**
  - `GET tasks/time/sheets/admin/:workspaceId/workspace?weekStart&weekEnd&page&size` - every member's weekly totals.
  - `GET tasks/time/sheets/admin?weekStart&weekEnd&workspaceId&timeSheetUserId&size&page` - one member's sheet and its tasks.
  - `PUT tasks/time/sheets/:timesheetId/add/tasks` with `{ taskIds }` - add tasks to the sheet.
  - Through `./timesheet` helpers: `GET tasks/time/sheets/:id/all/tasklist`, `PUT tasks/time/sheets/:id/remove/tasks`, `GET tasks/time/tracks`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base URL.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` for the bearer token.

## Dependencies
- **Internal:**
  - `components/athena/components/timesheet.tsx` - `AddTaskDialog`, `TimesheetRemoveTaskButton`, payload parsers (`parseTimesheetApiPayload`, `extractSheetMetadata`), API helpers (`fetchTaskTimeTracks`, `fetchTimesheetAllTasklist`, `removeTasksFromTimesheet`), `fmtMins`, `TIMESHEET_PAGE_SIZE` (50) and the shared grid style constants.
  - `components/athena/components/TimesheetWeekPicker.tsx` - the week picker.
- **Packages:**
  - `axios` - HTTP requests.
  - `react` - hooks.
  - `react-dom` (`createPortal`) - the hover popover.
  - `sonner` - toasts.

## Used by
- `components/athena/components/timesheet.tsx` - loads the default export with `next/dynamic` (`ssr: false`) and renders `<AllTimesheets workspaceId={workspaceId} />` under the "all-timesheet" tab when the user may view all timesheets.
- `components/athena/components/TimesheetApprovals.tsx` - imports `MemberTimesheetDetail` and `AllTimesheetsMember` to review a submission.

## Notes
- **Circular import:** `timesheet.tsx` imports this file (dynamically) and this file imports `timesheet.tsx` statically. It works because of the dynamic import; turning it into a static import could break module initialisation.
- **Time entries tab is unreachable:** the approval-mode view toggle maps only `["timesheet"]`, so the "Time entries" option never renders and the auto-expand effect for `detailView === "entries"` never runs.
- **Hard-coded capacities:** weekly (40h) and daily (8h) capacities are fixed, so the percentages and the progress bar ignore real schedules.
- **Unused code:** the `filterPill` style is referenced only from commented-out filter UI. `weekStartMs`/`weekEndMs` sit in `loadAddTaskPicker`'s dependency list although the week-bound parameters they fed are commented out.
- **Name shadowing:** inside `MemberTimesheetDetail`, the local `capacityPct` number shadows the module-level `capacityPct()` function.
- **Week boundaries:** they are computed in the viewer's local timezone, not the member's. The member's timezone is only displayed.
