# `components/athena/components/import-export/types.ts`

> Shared types and constants for the Athena task Import / Export wizard: the wizard steps, the parsed-sheet and import-row shapes, the column mapping, room stages, the upload result and the list of standard fields a column can map to.

**Kind:** types and constants module · **Lines:** 68

## Purpose
This module is the single source of truth for the data shapes passed between the dashboard UI (`ImportExportDashboard.tsx`), the spreadsheet parser (`parseSpreadsheet.ts`) and the Taskroom API layer (`importExportApi.ts`). Apart from the two constant arrays, it contains no logic.

## How it works
- **Wizard flow:** `ImportExportStep` lists the five steps in order: `target` (choose workspace, space and room), `upload`, `sheet` (choose a worksheet), `mapping`, `review`. `IMPORT_STEPS` pairs each step with its label (Destination, Upload, Sheet, Map fields, Import). The dashboard's step indicator draws them in that order.
- **Parsed data:** `ParsedSheet` holds the worksheet name, unique header labels, `headerColumnIndex` and the data rows as raw cell arrays. `headerColumnIndex` maps each header label to its original column index; it is needed because headers may have been renamed to keep them unique.
- **Import row:** `ImportTaskRow` holds the mapped string values of one spreadsheet row. Only `title` is required. Optional `customFields` are keyed by custom-field id. `TaskFieldKey` is any `ImportTaskRow` key except `customFields`.
- **Mapping:** `ColumnMapping` maps a field key, either a standard key or `cf:<fieldId>`, to a spreadsheet header.
- **Target metadata and results:** `RoomStage` is `{ _id, name, stageType? }`. `UploadResult` holds total, successful and failed counts plus per-row `errors` (`{ row, message }`).
- **Standard fields:** `MAPPABLE_TASK_FIELDS` lists the eight standard fields shown in the mapping step: Task Name (required), Description, Status / Stage, Priority, Start Date, Due Date, Assignees, Tags.

## Exports
- `ImportExportStep` - union of the five wizard step ids.
- `ParsedSheet` - one parsed worksheet.
- `ImportTaskRow` - one mapped row ready to become a task.
- `TaskFieldKey` - standard field keys of `ImportTaskRow`.
- `ColumnMapping` - `Partial<Record<string, string>>`, field key to header.
- `RoomStage` - a room's stage or column.
- `UploadResult` - outcome of a bulk import.
- `MAPPABLE_TASK_FIELDS` - array of `{ key, label, required? }` for the standard fields.
- `IMPORT_STEPS` - array of `{ id, label }` for the step indicator.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `components/athena/components/import-export/ImportExportDashboard.tsx`
- `components/athena/components/import-export/importExportApi.ts`
- `components/athena/components/import-export/parseSpreadsheet.ts`

## Notes
- `assignees` can be mapped, but `importExportApi.ts` currently sends `assignedToIds: []`, so mapped assignee values are not imported.
