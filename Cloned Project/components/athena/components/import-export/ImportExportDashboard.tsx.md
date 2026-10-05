# `components/athena/components/import-export/ImportExportDashboard.tsx`

> The Taskroom "Import / Export" screen. It is a five-step wizard that bulk-imports tasks from an Excel/CSV file into a chosen room, and a one-click export of a room's tasks to `.xlsx`.

**Kind:** React component · **Lines:** 1198

## Purpose
Teams moving into Taskroom / Athena from spreadsheets or other tools need to load many tasks at once, and sometimes need to get them back out. This dashboard is the UI for both jobs. It is rendered as the "ImportExport" tab of `components/athena/ProjectMangement.tsx`. The work is split across sibling modules in the same folder:
- `parseSpreadsheet.ts` reads the file and maps its columns.
- `importExportApi.ts` makes every Taskroom HTTP call.
- `roomCustomFields.ts` turns a room's custom fields into mappable fields.
- `types.ts` holds the step list and the built-in task fields.
- `importExportStyles.ts` holds the `ie` class-name tokens.

This file holds the state machine and the rendering.

## How it works

### Modes and steps (L61-L177)
- `mode` is `"import"` or `"export"`. Switching to Import resets the whole import flow. Switching to Export jumps back to the target step.
- `step` follows `IMPORT_STEPS` from `types.ts`: `target` → `upload` → `sheet` → `mapping` → `review`. `StepIndicator` (L68-L121) draws numbered badges for these steps. It is hidden in export mode.

### Choosing the destination (L179-L334, L597-L701)
- There are three cascading, paginated lists: workspaces, then spaces, then rooms. Each has its own items, loading and loading-more flags, and a `ListMetadata`. A ref guard (`workspacesFetchRef`, `spacesFetchRef`, `roomsFetchRef`) stops the same list being fetched twice at once.
- `loadX(page, append)` calls `fetchWorkspacesPage`, `fetchSpacesPage` or `fetchRoomsPage`. When appending it merges pages with `dedupeById`. `loadMoreX` asks for `metadata.nextPage`, or `currentPage + 1`, but only while `hasMorePages` is true.
- Workspaces load on mount. Changing the workspace clears the space and room and reloads spaces. Changing the space clears the room and reloads rooms.
- When a room is selected, `fetchRoomCustomFields(roomId)` and `fetchRoomStages(roomId)` run in parallel; if the stages call fails, it falls back to `[]`. A `cancelled` flag drops results that arrive after the room has changed again.
- Each list is rendered by `PaginatedSelectColumn`, which loads more pages as you scroll. Once all three are chosen, a summary line ("Workspace → Space → Room") appears. "Continue" moves to the upload step in import mode. In export mode the same button is "Export to Excel".

### Upload and parse (L399-L436, L703-L763)
- Only `.xlsx`, `.xls` or `.csv` files are accepted, up to 10 MB.
- `parseSpreadsheetFile(file)` returns every sheet as a `ParsedSheet`.
- A file with one sheet skips straight to mapping, with columns auto-mapped by `buildInitialColumnMapping(headers, headerColumnIndex, roomCustomFields)`. A file with several sheets goes to the sheet-picker table, which shows each sheet's name, row count and column count.

### Column mapping (L336-L385, L453-L480, L848-L1040)
- The mappable fields are the built-in `MAPPABLE_TASK_FIELDS` plus the room's custom fields from `mapRoomCustomFieldsToMappable`:
  - The built-in fields are Task Name (required), Description, Status / Stage, Priority, Start Date, Due Date, Assignees and Tags.
  - Custom-field mapping keys carry a `cf:` prefix (`isCustomFieldMappingKey` / `customFieldIdFromMappingKey`).
- Each field row has a `<select>` of the file's headers ("— Skip —" leaves the field unmapped) and a preview of up to 10 unique values from that column (`getTopUniqueValues`).
- `handleMappingChange` keeps each file column assigned to at most one field. Picking a column removes it from any other field.
- An effect (L363-L385) handles custom fields that load after mapping has started. It fills in auto-mapped custom fields without overwriting choices the user already made.
- "Review & import" requires the `title` mapping. It runs `applyColumnMapping(sheet, mapping, roomCustomFields)` and moves to review only if at least one valid row comes out.

### Review and import (L482-L511, L1042-L1192)
- The preview table shows up to 50 rows: #, Task Name, Stage, Priority, Due Date, and one column per mapped custom field. A "+N more rows" note covers the rest.
- `handleImport` uses the `importInFlightRef` guard to prevent double submits. It uses the cached room stages, or fetches them if none are cached, then calls `importTasksToRoom(roomId, rows, stages, onProgress)`. That function sends all tasks in one `POST tasks/bulk` request, so the progress bar jumps from 0 to 100 rather than filling gradually.
- The result panel shows how many tasks succeeded and failed, plus the first 5 row errors. Toasts report full success (`toast.success`) or partial success (`toast.warning`). "Import another file" resets the flow.

### Export (L513-L542)
- `fetchRoomTasksForExport(roomId)` returns flat rows: title, description, stage, priority, start and due dates, assignees, and tags.
- These are written with `XLSX.utils.json_to_sheet` to a "Tasks" sheet and downloaded as `<roomName>_export_<YYYY-MM-DD>.xlsx` through a temporary object URL and `<a download>`.

## Exports
- `default ImportExportDashboard()` takes no props. It renders the full Import / Export page and holds all of its own state.

The internal helpers `capitalize` and `StepIndicator` are not exported.

## Interfaces
- **External services:** the Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/`. It is not part of this repo and is reached through `importExportApi.ts`:
  - `GET workspaces/me`
  - `GET spaces/me?workspaceId=`
  - `GET rooms/me?spaceId=`
  - `GET rooms/:roomId` (custom fields)
  - `GET stages/room/:roomId`
  - `POST tasks/bulk`
  - `GET rooms/detail/:roomId?page=1&size=50&cardSize=500` (export)

  All calls carry the `garage_tok` bearer token.
- **Browser storage / cookies:** `localStorage.garage_tok`, read indirectly through the API module.

## Dependencies
- **Internal:**
  - `./types`: `IMPORT_STEPS`, `MAPPABLE_TASK_FIELDS`, and the row, sheet and result types.
  - `./parseSpreadsheet`: file parsing, auto-mapping, previews, `applyColumnMapping`.
  - `./roomCustomFields`: custom-field mapping keys and mappable definitions.
  - `./importExportApi`: every network call, pagination helpers, `dedupeById`.
  - `./PaginatedSelectColumn`: the infinite-scroll selection lists.
  - `./importExportStyles`: the `ie` typography and class tokens.
  - `components/ui/button.tsx`, `components/ui/progress.tsx`, `lib/utils.ts` (`cn`).
- **Packages:** `xlsx` (writing the export workbook), `sonner` (toasts), `lucide-react` (icons), `react`.

## Used by
- `components/athena/ProjectMangement.tsx` renders it for the `"ImportExport"` tab.

## Notes
- Export reads at most 50 stages with 500 cards each (`size=50&cardSize=500`), so very large rooms may be truncated without warning.
- There is no drag-and-drop handler. The "Drop your file here" area is a `<label>` around a hidden file input, so only clicking to browse works.
- Import is all-or-nothing at the HTTP level. A non-OK response or `status: false` throws, and nothing is reported per row. Per-row errors appear only if the bulk endpoint returns them.
