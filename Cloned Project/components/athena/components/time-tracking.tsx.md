# `components/athena/components/time-tracking.tsx`

> ClickUp-style "Time estimate" and "Track time" rows for an Athena task card. Both are popovers, and both read and write time logs on the external Taskroom API.

**Kind:** React component · **Lines:** 941

## Purpose
The Athena task board's card modal (`card-modal.tsx`) shows two property rows for each task: a time estimate and a time tracker. This file holds both widgets, plus a few formatting helpers.
- **The estimate** is saved by the parent through an `onSave` callback. This file makes no network call for it.
- **The tracker** talks directly to the Taskroom v2 time-tracking endpoints. Taskroom is an external service, not part of this repo's Express backend. With it you can start and stop a live timer, add time by hand, list entries grouped by user (with infinite scroll), and delete entries.

## How it works

### Helpers (L41-L116)
- `parseEstimateInput` turns `"1h 30m"`, `"2h"`, `"45m"` or a bare number (read as minutes) into seconds. It returns `null` if the input doesn't match.
- `fmtSeconds` shows durations compactly (`1h 30m`, `45m`, `5m 10s`, `0m` for zero or negative).
- `fmtElapsed` is the live clock (`m:ss` padded, or `h:mm:ss`).
- `fmtDateTime` formats a start or end time in the browser locale ("Jun 14, 2:30 PM").
- `avatarColor` hashes a name to one of 8 Tailwind colour sets for the user initials avatar.
- URL builders: `API` = `${NEXT_PUBLIC_TASKROOM_URL}tasks/time/tracks`, and `LOGS(taskId)` = `${NEXT_PUBLIC_TASKROOM_URL}tasks/${taskId}/time/logs`.
- `authHeaders()` adds `Authorization: Bearer <garage_tok>` from `localStorage`.

### `TimeEstimate` (L122-L253)
- **Units:** the estimate is stored in **minutes** (prop `initialEstimate`), but the widget keeps it in state as seconds (`initialEstimate * 60`). It re-syncs whenever the prop changes.
- **Setting a value:** the popover offers a free-text input (Enter or "Set"), presets (30m, 1h, 2h, 4h, and "1d", which is 8h), and "Clear estimate".
- **Saving:** `handleSave` converts seconds back to whole minutes and awaits `onSave(minutes | null)`. An empty input clears the estimate. Bad input shows a toast with the expected format. If saving fails, a "Failed to save estimate" toast appears.
- **Read-only:** when `isReadOnly` is set, the popover never opens.

### `UserLogGroupItem` (internal, L259-L399)
- **What it shows:** one collapsible row per user, from the `timeLogData` groups the logs endpoint returns. The row has an initials avatar, the user's name, and their total time (`totalTimePeriod` minutes).
- **Expanded view:** each log shows its start time, its end time (or "now"), an optional comment in quotes, its duration (`timePeriod` minutes), and a delete button unless read-only.
- **Paging:** the first page comes from the group's `logsData`. `hasMore` is set when `totalCount` is larger than the number of logs loaded.
- **Infinite scroll:** while the row is expanded, an `IntersectionObserver` watches a spinner sentinel. When it scrolls into view, the next page is fetched from `GET {TASKROOM}tasks/:taskId/user/:userId/time/logs?size=10&page=N`.
- **Paging response:** the code accepts the page either as `data.data` or as `data`, and reads `metadata.totalPages` from either level of the response.

### `TrackTime` (L405-L941)
- **Initial load:** `fetchLogs` runs **once on mount** (its effect has empty deps, even though a comment says "when popover opens"). It calls `GET LOGS(cardId)` and reads `data.activeTimeLog` and `data.timeLogData`:
  - It stores the user groups for the list.
  - It flattens all logs into `entries`, with `duration = timePeriod * 60` (or the log's `duration`), and reports them through `onEntriesChange`.
  - If the server has a running log, it becomes `activeEntry` (`endTime: null`). This is how a timer the user forgot to stop picks up from the server's `startTime`.
- **Live clock:** while `activeEntry` exists, a 1s `setInterval` updates `elapsed = Date.now() - startTime`. The interval is cleared on stop and on unmount.
- **`runningEntry` prop:** it seeds `activeEntry` when no timer is active yet. `card-modal.tsx` does not pass it.
- **Start (`handleStart`):** `POST API` with `{ comment, tags: [], taskId: cardId, roomId, startTime: Date.now(), isBillable }`. The response's `data` becomes the active entry. A "Billable" checkbox and an optional note go with the start.
- **Stop (`handleStop`):** `PUT API/:id` with `{ comment, tags, endTime: Date.now() }`. It then adds the completed entry to the local list, clears the timer, refetches the logs, and shows a "Tracked Xm" toast.
- **Manual add (`handleAddManual`):** this is the collapsible "Add time manually" section.
  - It has two `datetime-local` inputs, each with a calendar button that calls `showPicker()`, plus a note field and a comma-separated tags field.
  - It checks that both times are present, valid, and that end is after start.
  - It then sends `POST API` with `startTime` and `endTime` in epoch ms. `isBillable` is not sent here.
- **Delete (`handleDelete`):** asks `confirm()`, then sends `DELETE API/:id`, removes the entry locally, and refetches.
- **Totals:**
  - Tracked time is the sum of all entry durations plus the live elapsed time.
  - If an `estimate` (minutes) is given, the widget computes a percentage capped at 100. It shows it in the trigger pill and as a progress bar, which turns red at 100% or more.
- **Trigger button (closed state):** shows one of three things:
  - a skeleton while loading;
  - a pulsing red live clock while a timer runs;
  - the total time (with % of the estimate), or "Empty" when nothing is tracked.

  Read-only users can open the popover only while a timer is running. The popover ignores outside clicks while the manual-add (or note-edit) panel is open.

## Exports
- `interface TimeEntry` - one time log: `_id`, `userId?`, `userName?`, `startTime` (epoch ms), `endTime` (epoch ms or `null` while running), `duration` (seconds), `comment`, `tags`, `createdAt?`, `timePeriod?` (minutes), plus any other fields the server returns.
- `parseEstimateInput(raw: string): number | null` - parses an estimate string into seconds.
- `fmtSeconds(sec: number): string` - turns seconds into a compact duration label.
- `TimeEstimate({ cardId, initialEstimate?, onSave?, isReadOnly? })` - the estimate row. `initialEstimate` is in minutes, and `onSave` receives minutes or `null`.
- `TrackTime({ cardId, roomId, userId?, runningEntry?, onEntriesChange?, isReadOnly?, estimate? })` - the time-tracking row. `estimate` is in minutes.

## Interfaces
- **External services:** Taskroom v2 API (base `NEXT_PUBLIC_TASKROOM_URL`, e.g. `https://uatapi.garage.app/taskroomv2/v2/`):
  - `GET tasks/:taskId/time/logs` - grouped logs plus the active timer
  - `GET tasks/:taskId/user/:userId/time/logs?size=10&page=N` - next page of one user's logs
  - `POST tasks/time/tracks` - start a timer, or add a manual entry
  - `PUT tasks/time/tracks/:id` - stop a timer (sets `endTime`), or update a comment
  - `DELETE tasks/time/tracks/:id` - delete an entry
- **Environment variables:**
  - `NEXT_PUBLIC_TASKROOM_URL` - base URL of the Taskroom API. It must end with `/`, because paths are appended directly.
  - `NEXT_PUBLIC_BASE_URL` - read into `BASE` but never used.
- **Browser storage / cookies:** reads `localStorage.garage_tok` to build the Bearer token.
- **Background work:** a 1-second interval for the live clock, and an `IntersectionObserver` for per-user infinite scroll.

## Dependencies
- **Internal:** `components/ui/popover.tsx` - Radix `Popover`, `PopoverTrigger` and `PopoverContent`, used by both widgets.
- **Packages:**
  - `react` - state, effects, refs and callbacks.
  - `lucide-react` - icons.
  - `sonner` - toast notifications.

## Used by
- `components/athena/components/card-modal.tsx` (its only importer). It renders `<TimeEstimate>` and `<TrackTime>` in the card's property list:
  - The estimate is saved through `updateCard(..., { timeEstimate })` and broadcast with `emitPatched`.
  - `roomId` is the board ID.
  - `onEntriesChange` sends `timeEntries` through `emitPatched`.

## Notes
- **Unit naming trap:** the `onSave` parameter is named `seconds` (in the props type, and in `card-modal.tsx`), but it actually receives **minutes** (L151). `timeEstimate` on the card is stored in minutes.
- **Two response shapes:** start reads `data.data` from the response, but manual add spreads the whole response body into the entry. The two create calls treat the response differently.
- **Manual add doesn't refresh the list:** it does not call `fetchLogs()`. The total updates (it comes from `entries`), but the user-grouped list (which comes from `userGroups`) won't show the new entry until the next fetch.
- **Unchecked delete response:** `handleDelete` ignores the HTTP status, so a failed DELETE still removes the entry locally.
- **Dead code:**
  - `handleUpdateNote`, `addNoteOpen` and `addNoteValue` exist, but no UI ever opens the note editor.
  - `userId` (prop) and `BASE` are unused.
  - The icon imports `X`, `Check`, `Edit2` and `User` are unused.
- **Debug log:** `TimeEstimate` logs `initialEstimate` to the console on every render (L133).
- **Hardcoded fallback:** the paging URL in `UserLogGroupItem` falls back to a hardcoded UAT Taskroom base if the env var is missing. The other calls have no fallback.
- **Clock skew:** elapsed time is `Date.now()` minus the server-provided `startTime`. If the client's clock differs from the server's, the live timer and the stop duration are off by that amount.
