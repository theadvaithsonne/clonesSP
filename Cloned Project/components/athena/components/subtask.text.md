# `components/athena/components/subtask.text`

> A saved sample JSON response from the Taskroom timesheet API (one user's weekly timesheet with per-task, per-day billable/non-billable time), kept as a developer reference. Despite the name, it is not about subtasks and is not code.

**Kind:** Reference data (plain text) · **Lines:** 352

## Purpose
It is a scratch note: the body of an API response pasted into a Markdown-style code fence (` ``` ` on the first and last line) so a developer could build the timesheet UI against its shape. Nothing imports or loads it, and the `.text` extension keeps it out of the TypeScript build.

## How it works
The JSON has the usual Taskroom envelope `{ "status": true, "data": { ... } }`. The `data` object describes one weekly timesheet:
- **Identity and period:** `_id`, `userId`, `workspaceId`, `weekStart` / `weekEnd` (epoch milliseconds covering one week), `timeZone` (`Asia/Calcutta`).
- **Workflow state:** `currentStatus` (`draft`), `status` (`active`), plus `draftTaskIds` and `approvalTaskIds` arrays.
- **`taskEntries`:** one entry per task, with `monday` ... `sunday` each holding `{ billable, nonBillable }` amounts.
- **`dailyTotals`:** the same seven-day `{ billable, nonBillable }` structure summed over all tasks.
- **`taskCount`** and **`paginatedTaskEntries`:** the page of task rows the UI renders. Each has `taskDetails` (the full task: `title`, `priority`, `tags`, `assignedToIds`, `stageId`, `roomId`, `spaceId`, `dueDate`, `isOverDue`, `isCompleted`, `trackTime` or `subTaskCount`, and embedded `stageData`, `roomData`, `spaceData`). Its seven day objects add an `isTimerRunning` flag.
- A task with a live timer carries `activeTimerDetails` (a time-log record with `comment`, `isBillable`, `startTime`, `logStatus: "tracked"`, `timesheetLogId`, `dayOfWeek`, `isTimerActive`).

## Exports
None. This is a data file.

## Interfaces
- Describes the response of the external Taskroom timesheet API (uatapi.garage.app). The exact endpoint is not recorded in the file.

## Dependencies
None.

## Used by
Nothing references it; it appears unused. It documents the data shape for the Athena timesheet views.

## Notes
- The file name is misleading; it holds timesheet data, not subtask data.
- It contains real-looking MongoDB ids for a user, organisation, workspace, space and room from a test environment. There are no secrets in it.
- It is a candidate for deletion or for moving into a fixtures folder.
