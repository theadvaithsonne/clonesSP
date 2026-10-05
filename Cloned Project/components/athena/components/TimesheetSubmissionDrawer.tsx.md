# `components/athena/components/TimesheetSubmissionDrawer.tsx`

> Right-hand slide-over drawer that shows the paginated approval-submission history of one Athena timesheet and lets the owner revoke a pending submission.

**Kind:** React component · **Lines:** 398

## Purpose
In the Athena/Taskroom timesheet feature a user fills in a weekly timesheet and submits it to an approver. Each submission is recorded server-side (status, week, task snapshot, rejection reason). The main timesheet screen (`timesheet.tsx`) opens this drawer to show that history ("Submission status") and to cancel a submission that has not yet been decided. The API calls themselves live in `timesheet.tsx`; this file is presentation plus load/revoke orchestration.

## How it works
- **Rendering**: when `open` is true (and `document` exists), it portals into `document.body` a dimmed backdrop (click closes) and a 420px fixed drawer (z-index 9998/9999). Escape closes it via a window `keydown` listener. Wheel events are stopped from bubbling to the page behind. All styling is inline.
- **Loading** (`loadSubmissions(page)`): calls `fetchTimesheetSubmissions(timesheetId, page, TIMESHEET_SUBMISSION_PAGE_SIZE)` (10 per page), stores rows and pagination metadata, and reports the newest row back through `onSubmissionsLoaded(result.submissions[0] ?? null)` so the parent can show the current status. Errors extract a server `message`/`error` string from axios responses. It reloads page 1 every time the drawer opens or `timesheetId` changes.
- **Cards** (`SubmissionCard`): week range (`weekStart`-`weekEnd` epoch ms formatted as dates), the last 8 chars of the submission ID, a coloured status pill using `sheetStatusLabel` ("Pending approval", "Approved", "Changes needed"; otherwise the raw status), an optional rejection-reason box, the timesheet log ID, and a count of tasks captured in `snapshotTaskEntries` (accepts an array or an object with `tasks`/`data`).
- **Revoke**: shown only for status `pending` or `submitted`. `handleRevoke` calls `revokeTimesheetSubmission(timesheetId)` - note it revokes by **timesheet** ID (the active submission), not by the card's submission ID - toasts, calls `onRevoked()` and reloads the current page. A single `revoking` flag disables all revoke buttons.
- **Pagination**: Previous/Next footer when `metadata.totalPages > 1`.
- **Helpers**: `fmtEpochDate`, `isRevocableStatus`, `submissionStatusColors` (rejected = amber, approved/pending = brand, revoked/cancelled = grey), `snapshotTaskCount`, `FieldRow`.

## Exports
- `default TimesheetSubmissionDrawer({ open, onClose, timesheetId, onSubmissionsLoaded?, onRevoked? })` - `timesheetId: string | null`; `onSubmissionsLoaded(latest: TimesheetSubmissionRecord | null)`; `onRevoked()` fires after a successful revoke.

## Interfaces
- **Backend endpoints called (external Taskroom service, via helpers in `timesheet.tsx`):**
  - `GET {NEXT_PUBLIC_TASKROOM_URL}tasks/time/sheets/:id/submissions?page&size` - history
  - `PUT {NEXT_PUBLIC_TASKROOM_URL}tasks/time/sheets/:id/revoke/submission` - revoke
- **Browser storage / cookies:** the helpers read `localStorage.garage_tok` for the bearer token.

## Dependencies
- **Internal:** `components/athena/components/timesheet.tsx` - `fetchTimesheetSubmissions`, `revokeTimesheetSubmission`, `sheetStatusLabel`, `TIMESHEET_SUBMISSION_PAGE_SIZE`, `TimesheetSubmissionRecord`.
- **Packages:** `react-dom` - `createPortal`; `axios` - `isAxiosError` for error messages; `sonner` - toasts; `react`.

## Used by
- `components/athena/components/timesheet.tsx` - rendered near the bottom of the timesheet view, opened via its `submissionDrawerOpen` state.

## Notes
- Circular import: `timesheet.tsx` imports this drawer and this drawer imports helpers from `timesheet.tsx`; it works because the helpers are only used at call time.
- `loadSubmissions` depends on `onSubmissionsLoaded`; if the parent passes a new function each render, the open-effect re-runs and refetches page 1 repeatedly. The parent should memoise that callback.
