# `components/athena/components/timesheet.tsx`

> The Athena (Taskroom project-management) weekly Timesheets screen: a ClickUp-style Sun-Sat grid of tasks and tracked time, with a live timer, manual time entry, add/remove tasks, submit-for-approval, and tabs for "All timesheets" and "Approvals". It also serves as the shared API and helper library for the sibling timesheet components.

**Kind:** React component · **Lines:** 3303

## Purpose

This file is the "TimeSheets" view of the Athena project-management module (`components/athena/ProjectMangement.tsx` renders it for the `"TimeSheets"` case). It lets a signed-in Taskroom user see one calendar week of their tracked time per task, start/stop a timer on a task, type in a manual duration for a given day, add tasks they are assigned to, remove tasks from the week, and submit the week for approval.

All data lives in the **external Taskroom v2 API** (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`), not in this repo's Express backend. Because the file already contains the response-normalising code for that API, it also exports a set of fetchers, parsers, layout constants and small UI pieces that `AllTimesheets.tsx`, `TimesheetApprovals.tsx` and `TimesheetSubmissionDrawer.tsx` import back. That makes the module both a page component and a mini SDK for the timesheet API.

## How it works

The file is organised in sections, top to bottom.

### Icons and layout constants (L16-L92)

- `Icon` is a local set of inline-SVG icons (chevrons, play, stop, clock, plus, X, trash, dot) so the grid needs no icon package.
- The grid layout is a CSS grid: a fixed 280px task column, seven day columns (`minmax(88px, 1fr)`) and a 100px total column (`TIMESHEET_COL_STYLE`). `TIMESHEET_GRID_MIN_WIDTH` (280 + 7*88 + 100) forces horizontal scroll on narrow screens.
- `TIMESHEET_STICKY_*` style objects keep the task column stuck to the left and the header row stuck to the top while the grid scrolls. The admin "All timesheets" view reuses these so both grids look the same.

### Formatting and date helpers (L94-L220)

- `DAYS`, `MONTHS` labels. `DAY_API_KEYS` maps grid column 0-6 (Sun-Sat) to the API's per-day keys (`sunday` ... `saturday`).
- `DEFAULT_DAILY_CAPACITY_MINS` is 8 hours. A comment notes the API does not supply capacity yet, so the day-header popover always uses 8h.
- `fmtMins` (minutes to `1h 30m`, or an em dash for zero), `fmtHmPill` (`01h 30m`), `fmtSeconds`, `fmtTimer` (`h:mm:ss`), `capacityPct`.
- `parseMins` parses user input such as `1h 30m`, `45m`, `2h`, or a bare decimal number of **hours** (`1.5` becomes 90 minutes).
- `epochRangeForManualEntryOnDay(dayIndex, dates, durationMins)` turns a manual duration into a start/end pair on the chosen day. For today the entry ends at "now"; for other days it ends at 23:59:59.999. If that would push the start before midnight, the entry is anchored at the start of the day instead. Returns `null` on invalid input.
- `dayIndexForTimestamp` finds which grid column holds a timestamp (local time), or -1.
- `getWeekRange(offsetWeeks)` builds the seven `Date`s of the Sun-Sat week offset from the current week, plus `weekStartMs` (Sunday 00:00) and `weekEndMs` (Saturday 23:59:59.999) in epoch ms for the API.
- `isTodayInWeekRange` decides whether the timer may be used (current week only).

### API plumbing (L222-L247)

- `taskroomBase()` reads `NEXT_PUBLIC_TASKROOM_URL` (with the UAT default) and guarantees a trailing slash.
- `tracksApi()` is `<base>tasks/time/tracks`.
- `authHeaders()` sends JSON plus `Authorization: Bearer <token>` taken from `localStorage["garage_tok"]`.
- `userTimeZone()` resolves the browser's IANA zone but is **not called anywhere** (see Notes).

### Response normalisers (L249-L395)

The Taskroom API returns several shapes, so a family of defensive extractors digs through `payload`, `payload.data` and `payload.data.*`:

- `extractSheetTasks` finds the task array (`paginatedTaskEntries`, `TaskData`, `data`, `tasks`, `content`).
- `getSheetDocument` locates the timesheet document (the object carrying `dailyTotals`, `currentStatus`, `paginatedTaskEntries`, and so on).
- `normalizeSheetCurrentStatus` accepts only `draft | submitted | pending | approved | rejected`; `sheetStatusLabel` maps those to UI text ("Changes needed", "Pending approval", "Approved", or `null` for draft).
- `normalizeDailyTotals` / `extractDailyTotals` produce `{ sunday: { billable, nonBillable }, ... }` in minutes, preferring `dailyTotals`, then `draftDailyTotals`, then `approvalDailyTotals`. They accept both `nonBillable` and `non_billable`.
- `extractSheetId`, `extractSheetStatus`, `extractSheetRejectionReason`, `extractTaskCount` and `extractSheetMetadata` (pagination: `totalPages`, `currentPage`, `nextPage`).

### Loading a week (L397-L444)

`loadWeekTimesheet(weekOffset, workspaceId, refreshKey, page, size)` calls `GET <base>tasks/time/sheets` with `weekStart`, `weekEnd`, `timeZone`, `page`, `size` (default `TIMESHEET_PAGE_SIZE` = 50) and an optional `workspaceId`. It returns `{ weekDates, sheetId, dailyTotals, metadata, currentStatus, rejectionReason, taskCount, tasks }`, where each task is mapped through `mapApiTaskToRow`.

A module-level `weekSheetInflight` map de-duplicates concurrent identical requests (for example React Strict Mode mounting twice). The key includes `refreshKey`, so a deliberate refresh always issues a new request. Entries are removed once the promise settles.

### Task picker, add/remove, submit, history, revoke (L446-L696)

- `fetchTimesheetAllTasklist(timesheetId, query)` calls `GET <base>tasks/time/sheets/:id/all/tasklist` (always sends `size`, `page`, `assignedToMe`; optionally `sBound`, `eBound`, `workspaceId`, `status`) and maps each row via `mapTasklistItemToPicker` to `{ id, name, dotColor, status, space, updatedAt }`. `spaceId` and `roomId` are accepted in the query type, but the lines that would send them are commented out, so they are ignored.
- `removeTasksFromTimesheet(id, taskIds)` calls `PUT .../sheets/:id/remove/tasks`.
- `submitTimesheetForApproval(id)` calls `PUT .../sheets/submit/:id`.
- `fetchTimesheetSubmissions(id, page, size)` calls `GET .../sheets/:id/submissions` and maps rows to `TimesheetSubmissionRecord`.
- `revokeTimesheetSubmission(id)` calls `PUT .../sheets/:id/revoke/submission`.
- These mutators treat a `200` whose body has `status === false` as a failure and throw with the server message.
- `TimesheetRemoveTaskButton` is a small trash-icon button that stops click propagation and turns red on hover.

### Time-log mapping (L699-L1130)

This part turns API time logs into grid "entries" (`{ id, trackId, day, mins, label, live, billable, startTime, comment, tags }`):

- `apiDayOfWeekToColumn` converts the API's `dayOfWeek` (1 = Sunday ... 7 = Saturday) to a 0-6 column. It also accepts values that are already 0-6.
- `mapTimeLogEntry` reads start and end under several possible field names. A log with no end is **live** (running). Minutes come from `timePeriod`, then `durationMinutes`, then elapsed-so-far for live logs, then end minus start (at least 1), then `duration`/60. The label is the comment, or a time range such as `9:00 am - 10:15 am` (or "- Now").
- `flattenWeekData`, `normalizeActiveLogs`, `flattenTimeLogsData` and `flattenTimeLogsFromApi` support the newer `timeLogsData.{activeLogs, completedLogs.weekData}` shape and older `weekData` and flat-array shapes. Active logs are added with `mins: 0` because the live duration comes from the timer tick.
- `fetchTaskTimeTracks(query, weekDates)` calls `GET <base>tasks/time/tracks` with `taskId`, `weekStart`, `weekEnd`, `size` (default 20), `page`, `isPersonal` (default `true`), and optional `timeSheetUserId` and `status`. It returns `{ entries, metadata }`.
- `mapActiveTimerFromPaginatedRow` handles the current `paginatedTaskEntries` shape: a running timer appears as `taskDetails.activeTimerDetails` and/or a per-day `isTimerRunning` flag. It returns both a live entry and an "active track" object.
- `mapApiTaskToRow` builds a grid row `{ id, name, dotColor, roomId, space: "<stage> · <space / room>", entries, time[7] }`. When the row carries its own per-day totals (the paginated shape), `time` comes from those totals (`dailyTotalsToTimeArray`, billable + non-billable). In that case `entries` holds only the live timer entry (if any), and the rest are fetched lazily when the row is expanded. Otherwise entries are flattened from whichever log field exists and `time` is derived by `deriveTime`.
- `parseTimesheetApiPayload` is the exported subset (`sheetId`, `dailyTotals`, `tasks`) that the admin "All timesheets" grid uses.
- `findRunningTrack` scans rows for a live entry with a `trackId` so a timer started elsewhere (or before a reload) resumes ticking.
- `uid()` is a module-level counter (`e1`, `e2`, ...) used for fallback ids.

### Presentational sub-components (L1153-L1873)

- `TimesheetEmptyState`: shown when the week has no tasks. Only the "All assigned tasks" button is live. "Last week's tasks", "Individual tasks" and "Track time" are commented out.
- `LoaderBlock`: a spinning brand-coloured ring.
- `AddTaskDialog` (exported): a full-screen modal with a search box and a checkable task list. It hides tasks already on the sheet (`existingTaskIds`), closes on Escape, and calls `onAdd(selectedRows)`.
- `TimeEntryModal`: a single input for a duration on a given day. It validates with `parseMins` (toast if zero or less), awaits `onSave(mins)` and closes on success. On error it stays open, because the parent shows the toast.
- `StartTimerModal`: a "Billable" checkbox plus a Start-timer button.
- `DayHeaderHoverPopover`: on hovering a day header, a portal tooltip (rendered into `document.body`, `position: fixed`) shows total capacity (8h), tracked time split into billable and non-billable, and remaining capacity, each with a % of capacity. It uses a 120ms hide delay so the pointer can move into the popover.

### Main component `Timesheet` (L1875-L3294)

**Context and permissions (L1878-L1945)**
- Reads `currentWorkspace`, `currentRoomDetail` and `memberData` from the zustand store `useTaskroomWorkspacetore`.
- `workspaceId`: when the URL has `?shareTask`, it is taken from the `workspaceId` query param; otherwise from `currentWorkspace._id`.
- `currentUserId` is parsed from the `TaskRoomUserDetails` cookie.
- `canViewAllTimesheets` is true only when the current user is the workspace owner (`currentWorkspace.userId`). If that stops being true while that tab is open, the view falls back to "My timesheet".
- `isReadOnly = isRoomObserver(currentRoomDetail, memberData)`. Observers can view but every mutating handler toasts "Observers can only view this timesheet". Play/stop, remove, add-task and cell clicks are hidden or disabled for them.

**State** includes `weekOffset`, `tasks`, `expanded` rows, `activeTrack` (the running timer), `timerElapsedMs`, modal state, `timesheetId`, `timesheetStatus`, `rejectionReason`, `dailyTotals`, sheet-level pagination (`tasksPage`, `tasksMetadata`), per-task entry pagination (`entriesMetadata`, `entriesLoading`), and `mainNav` (`"my-timesheet" | "all-timesheet" | "approvals"`).

**Loading (L1947-L2067)**
- `applyTimesheetData` writes a loaded week into state and either clears `activeTrack` or resumes it with `findRunningTrack`.
- A change of week, workspace or `refreshKey` resets to page 1 through `pendingTasksPageResetRef`, so the fetch effect does not first load the stale page.
- The main fetch effect clears all per-week state, shows the loader, calls `loadWeekTimesheet`, and shows the server message (or a generic one) with a Retry button on failure. A `cancelled` flag ignores late responses.
- `loadTaskEntries(task, { force, page })` fetches a task's time logs the first time its row is expanded. `loadedEntryTaskIdsRef` stops repeat fetches; `force` and page changes bypass it.
- `reloadCurrentTimesheet` re-fetches without the full-page spinner and re-loads entries for every currently expanded row.
- `refreshKey` is the general "reload everything" trigger used after most mutations.

**Submission (L2069-L2122)**
- `handleSubmitForApproval` calls `submitTimesheetForApproval`, toasts, then bumps `refreshKey`.
- `handleSubmissionsLoaded` lets `TimesheetSubmissionDrawer` push the newest submission status and rejection reason into the header.
- `handleSubmissionRevoked` bumps `refreshKey`.

**Add-task picker (L2124-L2187)**
`loadAddTaskPicker(assignedToMe)` requires a loaded `timesheetId`, a `workspaceId` and a `garage_tok` token, then calls `fetchTimesheetAllTasklist` and opens `AddTaskDialog`. The empty state calls it with `true` (assigned to me); the "Add task" link under the grid calls it with `false`. A guard ignores a React click event passed as the first argument and treats only a real boolean as `assignedToMe`.

**Timer (L2189-L2353)**
- A 1-second interval sets `timerElapsedMs = Date.now() - activeTrack.startTime`, so elapsed time is measured from the server start time.
- `startTimer(task, isBillable)` checks, in order: not an observer, current week only, no other timer running ("Stop the running timer before starting another."), and the task has a `roomId`. It then sends `POST <base>tasks/time/tracks` with `{ comment, tags, taskId, roomId, startTime, isBillable }`, stores the returned track as `activeTrack` and inserts a live entry into the row.
- `stopTimer()` sends `PUT <base>tasks/time/tracks/:trackId` with `{ comment, tags, endTime }`, reloads the sheet, and toasts "Tracked Xh Ym".

**Manual entry (L2355-L2409)**
`handleSave(mins)` turns the clicked cell's day and the duration into a start/end pair (`epochRangeForManualEntryOnDay`), then sends `POST <base>tasks/time/tracks` with `{ comment, tags, taskId, roomId, startTime, endTime }` and bumps `refreshKey`. It does **not** send `isBillable`. It re-throws on failure so `TimeEntryModal` stays open.

**Adding and removing tasks (L2411-L2527)**
- `addTasksFromDialog(picked)`: when the dialog came from the API picker (the normal path), it sends `PUT <base>tasks/time/sheets/:id/add/tasks` with `{ taskIds }` and reloads.
- If `pickerTasksForDialog` is null, the picked tasks are only appended to local state and never persisted. Every current entry point sets the picker list first, so this branch is effectively unreachable.
- `removeTaskFromSheet(taskId)` asks for a `confirm()` ("Tracked time stays on the task"), refuses if that task's timer is running, calls `removeTasksFromTimesheet`, removes the row locally and bumps `refreshKey`.

**Derived values and rendering (L2529-L3294)**
- `totalByDay` sums row times plus the live timer's whole minutes on the live day; `grandTotal` sums `totalByDay`. Day headers show the API `dailyTotals` for that day when present, otherwise `totalByDay`. Today's column gets a brand accent bar.
- "Submit for approval" shows only when the user is not an observer, a sheet is loaded, it has tasks, and the status is empty, `draft` or `rejected`. "Submission status" opens `TimesheetSubmissionDrawer` whenever a sheet id exists.
- A status pill shows Changes needed / Pending approval / Approved. For rejected sheets the rejection reason appears beside it, truncated, with the full text in a tooltip.
- Top tabs: "My timesheet", "All timesheets" (owner only; renders `AllTimesheets`, dynamically imported with `ssr: false`) and "Approvals" (renders `TimesheetApprovals`). The approvals badge is commented out, and `approvalsPendingCount` is hard-coded to 1 and unused.
- Week navigation: previous/next arrows plus `TimesheetWeekPicker`, which reports a new `weekOffset`.
- Grid rows: expand chevron, task name and `stage · space / room`, play/stop button (current week only, or while running), remove button, seven day cells (clicking opens `TimeEntryModal`, and the live cell shows a pulsing red `h:mm:ss`), and a row total.
- Expanded rows list individual entries with date, time-range label, a `$` badge for billable entries, and the duration in the matching day column. They have their own Previous/Next pagination when `totalPages > 1`.
- Sheet-level Previous/Next pagination appears under the grid when the API reports multiple pages.
- An inline `<style>` defines the row hover colour and the `pulse` / `timesheetSpin` keyframes.
- `navBtn` and `headerCell` (L3296-L3303) are shared inline-style objects.

## Exports

- `default Timesheet()`: the full Timesheets page (tabs, week grid, modals, drawer). Takes no props.
- `TIMESHEET_COL_STYLE`, `TIMESHEET_GRID_MIN_WIDTH`, `TIMESHEET_SCROLL_ROOT`, `TIMESHEET_STICKY_LEFT`, `TIMESHEET_STICKY_LEFT_NESTED`, `TIMESHEET_STICKY_HEADER_CORNER`, `TIMESHEET_STICKY_HEADER_CELL`: grid layout and sticky-positioning style objects.
- `DAY_API_KEYS`: `['sunday', ..., 'saturday']`, the per-day API keys indexed by grid column.
- `fmtMins(m)`: minutes to `Xh Ym`, or an em dash for 0.
- `type TimesheetCurrentStatus`: `"draft" | "submitted" | "pending" | "approved" | "rejected"`.
- `sheetStatusLabel(status)`: UI label for a sheet status, or `null`.
- `TIMESHEET_PAGE_SIZE` (50): tasks per page for the sheet request.
- `extractSheetMetadata(payload)`: `{ totalPages, currentPage, nextPage }` from `payload.metadata`.
- `fetchTimesheetAllTasklist(timesheetId, query)`: tasks that can be added to a sheet, mapped for `AddTaskDialog`.
- `removeTasksFromTimesheet(timesheetId, taskIds)`: removes tasks from a sheet.
- `submitTimesheetForApproval(timesheetId)`: submits a sheet.
- `TIMESHEET_SUBMISSION_PAGE_SIZE` (10).
- `type TimesheetSubmissionRecord`: `{ id, timesheetLogId, userId, approverId, workspaceId, weekStart, weekEnd, snapshotTaskEntries, dailyTotals, submissionStatus, rejectionReason }`.
- `fetchTimesheetSubmissions(timesheetId, page?, size?)`: `{ submissions, metadata }` for a sheet's submission history.
- `revokeTimesheetSubmission(timesheetId)`: cancels the active submission.
- `TimesheetRemoveTaskButton({ onRemove, disabled?, removing? })`: trash-icon button.
- `type TimeTracksQuery`: `{ taskId, weekStart, weekEnd, status?, size?, page?, isPersonal?, timeSheetUserId? }`.
- `fetchTaskTimeTracks(query, weekDates)`: one page of a task's time logs as grid entries, plus metadata.
- `parseTimesheetApiPayload(payload, weekDates)`: `{ sheetId, dailyTotals, tasks }` from a sheet response.
- `AddTaskDialog({ existingTaskIds, onClose, onAdd, pickerTasks?, adding? })`: searchable multi-select task picker modal.

## Interfaces

- **External services:** the Taskroom v2 API at `NEXT_PUBLIC_TASKROOM_URL` (default `https://uatapi.garage.app/taskroomv2/v2/`). It is not part of this repo. Endpoints used:
  - `GET tasks/time/sheets?weekStart&weekEnd&timeZone&page&size[&workspaceId]`: the week's timesheet, tasks and daily totals.
  - `GET tasks/time/sheets/:id/all/tasklist?size&page&assignedToMe[&sBound&eBound&workspaceId&status]`: tasks that can be added.
  - `PUT tasks/time/sheets/:id/add/tasks` with `{ taskIds }`.
  - `PUT tasks/time/sheets/:id/remove/tasks` with `{ taskIds }`.
  - `PUT tasks/time/sheets/submit/:id`: submit for approval.
  - `GET tasks/time/sheets/:id/submissions?page&size`: submission history.
  - `PUT tasks/time/sheets/:id/revoke/submission`.
  - `GET tasks/time/tracks?taskId&weekStart&weekEnd&size&page&isPersonal[&timeSheetUserId&status]`: a task's time logs.
  - `POST tasks/time/tracks`: start a timer (no `endTime`) or create a manual entry (with `endTime`).
  - `PUT tasks/time/tracks/:trackId` with `{ comment, tags, endTime }`: stop a timer.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`: base URL of the Taskroom API.
- **Browser storage / cookies:**
  - `localStorage["garage_tok"]`: bearer token for every request. The add-task flows refuse to run without it.
  - Cookie `TaskRoomUserDetails` (JSON): its `_id` identifies the current user for the owner-only "All timesheets" tab.
- **Background work:** a 1-second `setInterval` while a timer is running; a 120ms hide timeout in the day-header popover.

## Dependencies

- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx`: `useTaskroomWorkspacetore` (current workspace, room, member data) and `isRoomObserver` (observer role means read-only).
  - `components/athena/components/AllTimesheets.tsx`: owner-only "All timesheets" tab, loaded with `next/dynamic` and `ssr: false`.
  - `components/athena/components/TimesheetApprovals.tsx`: "Approvals" tab.
  - `components/athena/components/TimesheetSubmissionDrawer.tsx`: submission history and revoke drawer.
  - `components/athena/components/TimesheetWeekPicker.tsx`: week label and date picker that sets the week offset.
- **Packages:**
  - `react`: hooks.
  - `react-dom`: `createPortal` for the day-header popover.
  - `next`: `next/navigation` `useSearchParams` for share-link params; `next/dynamic` for `AllTimesheets`.
  - `axios`: HTTP.
  - `js-cookie`: reads `TaskRoomUserDetails`.
  - `sonner`: toasts.

## Used by

- `components/athena/ProjectMangement.tsx`: imports the default export as `TimeSheets` and renders it for the `"TimeSheets"` section of the Athena project-management UI.
- `components/athena/projectmangerbacku.tsx`: a backup copy of the project manager that imports it twice (as `TimeSheets` and `TimesheetPage`).
- `components/athena/components/AllTimesheets.tsx`: imports `AddTaskDialog`, `extractSheetMetadata`, `fetchTaskTimeTracks`, `fetchTimesheetAllTasklist`, `fmtMins`, `parseTimesheetApiPayload`, `removeTasksFromTimesheet`, `TIMESHEET_PAGE_SIZE`, the `TIMESHEET_*` layout constants and `TimesheetRemoveTaskButton`.
- `components/athena/components/TimesheetApprovals.tsx`: imports `extractSheetMetadata`.
- `components/athena/components/TimesheetSubmissionDrawer.tsx`: imports `fetchTimesheetSubmissions`, `revokeTimesheetSubmission`, `sheetStatusLabel`, `TIMESHEET_SUBMISSION_PAGE_SIZE` and `TimesheetSubmissionRecord`.

The file has no Next.js route of its own.

## Notes

- **Circular imports:** this file imports `TimesheetApprovals`, `TimesheetSubmissionDrawer` and (dynamically) `AllTimesheets`, and all three import helpers back from it. This works because the helpers are only used at render or call time. Moving shared helpers into a separate module would remove the cycle.
- **Hard-coded time zone:** `loadWeekTimesheet` always sends `timeZone=Asia/Calcutta`. Meanwhile `weekStart`/`weekEnd` are computed in the browser's local time, and the `userTimeZone()` helper exists but is unused. Users outside IST may see day buckets that do not match the API's.
- **Billable flag:** only timer starts send `isBillable`; manual entries never do.
- **Fixed capacity:** daily capacity is fixed at 8h for the header popover (no API value).
- **Header vs. Total column:** day headers prefer API `dailyTotals`, which do not include the running timer's elapsed minutes. The Total column uses local `totalByDay`, which does. The two can disagree briefly while a timer runs.
- **Ignored query fields:** the `spaceId`/`roomId` parameters of the task-list query are accepted but not sent (commented out).
- **Dead code:**
  - The local-only branch of `addTasksFromDialog` (unreachable).
  - The commented-out empty-state buttons, breadcrumb, Configure button, notification bell and approvals badge.
  - `approvalsPendingCount`.
  - `TimesheetEmptyState`'s `onLastWeek` / `onIndividual` / `onTrackTime` props, which are wired up but whose buttons are commented out.
- **Remove-task order:** the "stop the timer first" check runs after the `confirm()` dialog, so the user confirms before being told the removal is blocked.
- **Error toasts:** error messages are trimmed to 240 characters before being shown.
