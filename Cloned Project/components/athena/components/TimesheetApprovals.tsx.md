# `components/athena/components/TimesheetApprovals.tsx`

> The "Approvals" screen of the Athena/Taskroom timesheet module: approvers list a workspace's weekly timesheet submissions by status, open a member's detail, approve or request changes, and manage which members submit to which approvers.

**Kind:** React component · **Lines:** 2487

## Purpose
Athena timesheets work as a weekly submit-and-approve flow. A member submits their week from `timesheet.tsx`; designated approvers review it here. The file also owns the workspace's **submitter -> approvers** mapping ("timesheet managers"), edited in a full-screen dialog. All data lives in the external Taskroom service (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`), not in this repo's Express backend. The file is self-contained: types, API helpers, inline SVG icons, inline styles and several private sub-components, with one default export.

## How it works

### Types and constants (L19-L82)
- UI tabs `to_review` / `changes_requested` / `approved` map (via `TAB_CONFIG`) to API `submissionStatus` `pending` / `rejected` / `approved`; UI badge statuses are `pending` / `changes_needed` / `approved`.
- `ApprovalSubmission` is the table row model (member identity, formatted week range, tracked/capacity/billable minutes and `"00h 00m"` strings, per-day breakdown, submitted-at, timezone).
- `SubmitterRow` = `{ recordId?, submitterId, approverIds[] }` - one timesheet-manager record.
- `SUBMISSION_PAGE_SIZE = 50`; capacity is a fixed `DEFAULT_WEEKLY_CAPACITY_H = 50` hours for everyone. `DUE_DAYS`, `DUE_TIMES`, `REMIND_BEFORE`, `REMIND_AFTER` feed deadline/reminder selects that are currently commented out.

### Formatting and mapping helpers (L86-L312)
- `taskroomBase()` / `authHeaders()` - API base and `Authorization: Bearer <localStorage garage_tok>`.
- Week maths: `getWeekRange(offsetWeeks)` returns the Sunday-Saturday dates of the current week shifted by N weeks, with `weekStartMs` (local Sunday 00:00) and `weekEndMs` (Saturday 23:59:59.999).
- `normalizeDailyTotals` / `dailyBreakdownFromSheet` read `dailyTotals`, falling back to `approvalDailyTotals` then `draftDailyTotals`, keyed `sunday`..`saturday` with `billable` / `nonBillable` (or `non_billable`) minutes.
- `mapSubmissionRow` tolerates many response shapes: sheet data in `timeSheetData` / `timesheet` / root, user in `userData` / `user` / `submitter` / `submitterData`, status in `submissionStatus` / `approvalStatus` / `currentStatus`. Rows without an ID or user ID are dropped.
- `submissionToMember` converts a row into the `AllTimesheetsMember` shape used by `MemberTimesheetDetail`.

### API helpers (L314-L649)
- `fetchWorkspaceSubmissions` - `GET {base}tasks/time/sheets/submission/:workspaceId/workspace?submissionStatus&weekStart&weekEnd&page&size`. Concurrent identical requests are de-duplicated through the module-level `submissionInflight` map (cleared when each promise settles). Pagination comes from `extractSheetMetadata` (imported from `timesheet.tsx`), plus `metadata.count`.
- `apiReviewSubmission(id, action, comment?)` - `PUT {base}tasks/time/sheets/admin/review/submission/:submissionId` with `{ action: "approve" | "reject", comment? }`.
- Timesheet-manager CRUD (note: these paths have no `tasks/` prefix):
  - `apiGetTimesheetManagers` - `GET {base}time/sheets/manager/:workspaceId/workspace`; parses `reportMgr` arrays or generic lists and builds a people lookup from populated `submitter` / `approvers` fields.
  - `apiPostTimesheetManager` - `POST {base}time/sheets/manager/bulk` with `{ workspaceId, reportMgr: [{ submitter, approvers[] }] }`.
  - `apiUpdateTimesheetManagerApprovers` - `PUT {base}time/sheets/manager/:recordId` with `addedApprovers` or `removedApprovers`.
  - `apiDeleteTimesheetManager` - `DELETE {base}time/sheets/manager/:recordId`.
  - `apiSearchWorkspaceMembers` - `GET {base}time/sheets/manager/:workspaceId/workspace/users?page=1&size=25&searchData=` (candidate submitters).
  - `apiGetApproversForSubmitter` - `GET {base}time/sheets/manager/add/approvers?page&size&workspaceId&newObj&searchData&status&approverList[]=...`, adding `mgrId` only for an already-saved record (`newObj=false`). The API excludes already-selected approvers.

### Presentational pieces (L651-L916)
`Ico` (inline SVG icon set), shared style objects, `Avatar` (initials circle), `StatusBadge`, `SettingsSelect`, `MemberPickerSkeleton`.

### Approver management UI (L918-L1724)
- `ApproverPopover` - searchable candidate list with selection check marks; closes on outside mousedown.
- `SubmitterRowItem` - one submitter row: avatar, "NEW" tag for unsaved rows, approver avatars (up to 4; on saved rows hovering shows an X and mousedown removes that approver), the popover trigger, and a trash button. Opening the popover preloads candidates; typing searches with a 400 ms debounce.
- `ManageApproversDialog` - full-screen dialog "Manage Timesheet Approvers and Submitters".
  - On open it copies `initialRows` into `existingRows` and clears `newRows`.
  - A debounced (400 ms) search adds a member as a new draft row (duplicates rejected).
  - **Saved rows apply immediately**: toggling an approver updates optimistically and calls `PUT .../manager/:recordId`, reverting on failure; removing a saved row (after a confirm overlay) calls `DELETE .../manager/:recordId`, restoring the row on failure.
  - **New rows are batched**: "Save N new submitters" requires at least one approver per new row, posts them to `/bulk`, then refetches managers and closes.
  - An effect mirrors every local change back to the parent through `onSave`, so the settings drawer stays current. Escape or backdrop click closes it.
- `ApprovalSettingsDrawer` (L1728-L1865) - 360px side panel showing the unique-people count and avatar preview for all submitters and approvers, with "Edit list" opening the dialog. The deadline and reminder sections are commented out.

### Review UI (L1879-L2194)
- `ReviewCommentDialog` - "Request changes" modal; a non-empty reason is required.
- `ApprovalsListView` - tabs plus a Settings button; week navigation (prev/next, `TimesheetWeekPicker`, "This week" reset); a table with Details (click opens the detail view), Tracked, Capacity, Billable, Over capacity (amber when tracked > 50h), and either Review buttons (request changes / approve; To review tab only) or a `StatusBadge`; plus pagination.

### Main component `TimesheetApprovals` (L2198-L2487)
- Workspace: `?workspaceId=` when `?shareTask` is present, otherwise `currentWorkspace._id` from `useTaskroomWorkspacetore`. With no workspace it shows "Missing workspace.".
- Loading: an effect refetches submissions on workspace, week, tab, page or `refreshKey` change. A ref-based flag forces page 1 after a week, workspace or refresh change. The tab's count is stored in `tabCounts`, but the count badge in the tab bar is commented out.
- Reviewing: `handleReviewAction` approves directly or opens the comment dialog for reject; `handleReview` calls the API, toasts, bumps `refreshKey` and closes the detail view and dialog for that submission. Only one review can run at a time (`reviewingId`).
- Detail mode: when a row is selected, the component renders `MemberTimesheetDetail` (from `AllTimesheets.tsx`) with an `approvalContext` (submission ID, status, submitted-at, billable minutes, whether review actions are shown, and an `onReview` callback) instead of the list.
- Settings: opening the drawer loads the managers; closing the manage dialog reloads them from the API.

## Exports
- `default TimesheetApprovals()` - the approvals screen; takes no props and reads the workspace from the URL or the Taskroom store.

## Interfaces
- **Backend endpoints called (external Taskroom service, `{NEXT_PUBLIC_TASKROOM_URL}`):**
  - `GET tasks/time/sheets/submission/:workspaceId/workspace` - list submissions for a week and status
  - `PUT tasks/time/sheets/admin/review/submission/:submissionId` - approve / reject
  - `GET time/sheets/manager/:workspaceId/workspace` - submitter-approver records
  - `POST time/sheets/manager/bulk` - create records
  - `PUT time/sheets/manager/:recordId` - add or remove approvers
  - `DELETE time/sheets/manager/:recordId` - delete a record
  - `GET time/sheets/manager/:workspaceId/workspace/users` - search members
  - `GET time/sheets/manager/add/approvers` - approver candidates
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - `currentWorkspace`; `components/athena/components/timesheet.tsx` - `extractSheetMetadata`; `components/athena/components/AllTimesheets.tsx` - `MemberTimesheetDetail`, `AllTimesheetsMember`, `MemberTimesheetApprovalContext`; `components/athena/components/TimesheetWeekPicker.tsx` - week picker; `components/ui/skeleton.tsx`.
- **Packages:** `axios` - HTTP and error inspection; `next` - `useSearchParams`; `sonner` - toasts; `react`.

## Used by
- `components/athena/components/timesheet.tsx` - rendered as `<TimesheetApprovals />` when its `mainNav` is `"approvals"`.

## Notes
- Due-date and reminder state (`dueDay`, `dueTime`, `remindBefore`, `remindAfter`) is held only in React state, never sent to an API, and its UI is commented out.
- Capacity and over-capacity always assume 50 h/week; they do not use any per-member capacity.
- `ManageApproversDialog` pushes unsaved draft rows into the parent's `submitterRows` through the `onSave` mirror effect. "Discard & close" works only because the close handler reloads managers from the API afterwards.
- `apiSearchWorkspaceMembers` leaves several `console.log("peopleccc", ...)` debug statements that log member data to the browser console.
- The checkbox in each submitter row is not wired to anything.
- Submitter, approver and submission IDs are opaque strings from the external service; authorisation (who may review) is enforced there, not here.
