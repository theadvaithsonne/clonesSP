# `components/athena/components/import-export/parseSpreadsheet.ts`

> Reads an uploaded spreadsheet (xlsx, xls, csv and other formats SheetJS supports) in the browser, guesses which column holds which task field, and turns the mapped rows into `ImportTaskRow` objects for the Athena task import.

**Kind:** parsing utility module (TypeScript, no JSX) · **Lines:** 297

## Purpose
This module is the parsing and mapping half of the Import / Export wizard. It turns a `File` into one `ParsedSheet` per worksheet. It suggests a starting column-to-field mapping from header names and the target room's custom fields, shows sample values for a chosen column, and converts each row into an import row. It also contains the date and priority normalisers that `importExportApi.ts` uses when it builds the task payload. All of this runs in the browser; no server is involved.

## How it works

### Reading the file
`parseSpreadsheetFile(file)` reads the file with a `FileReader` as an `ArrayBuffer`, then calls `XLSX.read(..., { type: "array", cellDates: true })`. For each worksheet:
- it calls `sheet_to_json` with `header: 1, defval: "", raw: false`, which gives an array of row arrays with formatted text values;
- it drops rows in which every cell formats to an empty string;
- it takes the first remaining row as the header row and the rest as data rows;
- it builds `headers` and `headerColumnIndex` with `buildHeaderColumnIndex`.

Worksheets without headers are dropped. If no worksheet is left, the promise rejects with "File is empty or missing column headers". A read error rejects with "Failed to read file".

### Header handling
- `buildHeaderColumnIndex` names blank header cells `Column N`. It makes repeated names unique by adding ` (2)`, ` (3)` and so on, and records each unique label's original column index. That keeps the mapping correct even when headers repeat.
- `normalizeHeader` lowercases a header, turns any run of non-alphanumeric characters into one space, and trims it. For example, "Due-Date" becomes "due date".

### Auto-mapping (`buildInitialColumnMapping`)
For each standard field in `MAPPABLE_TASK_FIELDS`, in order:
1. it looks for a header whose normalised form equals the field key;
2. failing that, it uses `HEADER_ALIASES`. For example, `name`, `task name` and `summary` map to `title`; `status`, `list` and `column` to `stage`; `deadline` and `due` to `dueDate`; `owner` and `assigned to` to `assignees`; `labels` to `tags`.

A header is assigned to at most one field. After the standard fields, each room custom field is matched by its normalised `name` and stored under the key `cf:<fieldId>`.

Because each field key is camelCase (for example `dueDate`) and normalised headers are lowercase, step 1 only ever matches single-word keys. Multi-word fields are matched through the aliases.

### Preview and conversion
- `getTopUniqueValues(sheet, column, limit = 10)` returns up to `limit` distinct non-empty values from a column. The dashboard shows them as a preview while the user maps fields.
- `applyColumnMapping(sheet, mapping, roomCustomFields)` builds one `ImportTaskRow` per data row:
  - for `cf:` keys, the value goes through `parseCustomFieldValue`, using the field type, which defaults to `text`; empty or invalid values are dropped;
  - for other keys, the formatted string is written to the field of the same name.
  - Rows with an empty title are filtered out.
- `formatCellValue` turns raw cell values into strings:
  - Date objects use `toLocaleDateString()`;
  - numbers and booleans become strings; arrays are joined with commas;
  - objects are handled when they are rich-text (`richText[].t`), `text`, formula `result` or SheetJS `h` objects.

### Normalisers used when building the payload
- `parseDateToTimestamp(value)`:
  - a positive number below 100000 is treated as an Excel serial date, counted in days from 1899-12-30 UTC;
  - a larger number is treated as an epoch timestamp;
  - anything else goes through `new Date(value)`;
  - an empty or unparseable value returns `null`.
- `normalizePriority(value)`:
  - `urgent`, `high` and `h` become `high`;
  - `low` and `l` become `low`;
  - `normal`, `medium`, `med` and `m` become `normal`;
  - any other non-empty value passes through in lowercase, and an empty value becomes `normal`.

## Exports
- `normalizeHeader(header: string): string` - canonical lowercase form used for matching.
- `formatCellValue(raw: unknown): string` - converts a cell value to a string for display and import.
- `buildInitialColumnMapping(headers, headerColumnIndex, roomCustomFields?): ColumnMapping` - suggested mapping.
- `getTopUniqueValues(sheet, columnName, limit = 10): string[]` - sample distinct values from a column.
- `parseSpreadsheetFile(file: File): Promise<ParsedSheet[]>` - parses every non-empty worksheet.
- `applyColumnMapping(sheet, mapping, roomCustomFields?): ImportTaskRow[]` - converts mapped rows to import rows.
- `parseDateToTimestamp(value?: string): number | null` - date text, Excel serial or timestamp to epoch milliseconds.
- `normalizePriority(value?: string): string` - priority as `high` / `normal` / `low` where recognised.

## Dependencies
- **Internal:**
  - `./types` - `ColumnMapping`, `ImportTaskRow`, `ParsedSheet`, `TaskFieldKey`, `MAPPABLE_TASK_FIELDS`.
  - `./roomCustomFields` - the `cf:` key helpers, field-type lookup and value parsing.
- **Packages:** `xlsx` (SheetJS) - reads workbooks and converts sheets to row arrays.

## Used by
- `components/athena/components/import-export/ImportExportDashboard.tsx` - `parseSpreadsheetFile`, `buildInitialColumnMapping`, `getTopUniqueValues`, `applyColumnMapping`.
- `components/athena/components/import-export/importExportApi.ts` - `normalizePriority`, `parseDateToTimestamp`.

## Notes
- Because `raw: false` is set, cells arrive as formatted text. Dates therefore usually arrive as strings formatted by the sheet and are then parsed with `new Date(...)`, which depends on the browser. Ambiguous formats such as dd/mm/yyyy versus mm/dd/yyyy may be read the wrong way round.
- An unknown priority value is passed through as-is rather than rejected.
