# `components/athena/components/tiemlineback.text`

> A saved sample JSON response from the Taskroom timesheet-approval API (a page of submitted timesheets awaiting approval), kept as a developer reference. It is not code.

**Kind:** Reference data (plain text) · **Lines:** 357

## Purpose
It is a scratch file holding a pasted API response so a developer could build the timesheet approval / timeline UI against its shape. Nothing imports it, and the `.text` extension keeps it out of the build. The name is probably a misspelling of "timeline back[end]".

## How it works
It uses the standard paginated Taskroom envelope:
- `status: true`, `message: "All Record Details"`.
- `metadata`: `{ count, totalPages, currentPage, nextPage }`, the same pagination shape the Athena components read elsewhere (for example `hasMorePages()` in `space-members-dialog.tsx`).
- `data[]`: one record per submitted timesheet:
  - `timesheetLogId`, `userId`, `approverId` (null here), `workspaceId`, `weekStart` / `weekEnd` (epoch ms).
  - `snapshotTaskEntries`: a frozen copy of each task's `monday` ... `sunday` `{ billable, nonBillable }` values at submission time.
  - `dailyTotals`: per-day sums.
  - `submissionStatus`: `pending`.
  - `userData`: the submitter's `_id`, `name` and `email`.
  - `timeSheetDetails[]`: the live timesheet document behind the submission (`currentStatus: "submitted"`, `timeZone`, `draftDailyTotals`, `approvalDailyTotals`, `dailyTotals`, `taskEntries`, `draftTaskIds`, `approvalTaskIds`).
The values appear to be minutes. In the sample, Thursday's non-billable total of 1219 equals 1099 + 120 from two task entries.

## Exports
None. This is a data file.

## Interfaces
- Describes the response of the external Taskroom timesheet approval endpoint (uatapi.garage.app). The endpoint path is not recorded in the file.

## Dependencies
None.

## Used by
Nothing references it; it appears unused.

## Notes
- It contains a real staff member's name and work email address plus internal MongoDB ids. There are no secrets, but treat it as personal data and avoid copying it into public places.
- It is a candidate for deletion or for moving into a fixtures folder.
