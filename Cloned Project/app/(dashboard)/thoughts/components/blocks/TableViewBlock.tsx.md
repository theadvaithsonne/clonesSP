# `app/(dashboard)/thoughts/components/blocks/TableViewBlock.tsx`

> A BlockNote custom block (`tableView`) that renders an editable spreadsheet-like "Data table" whose headers and rows are stored as JSON in the block's props.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 231

## Purpose
This file provides the "table view" database-style block for the Thoughts notes editor. Users can add, rename and delete columns, add and delete rows, and edit cells inline. A column named "Status" in the second position becomes a status dropdown.

## How it works
- **Initial data.** If the `headers` or `rows` props are empty (their default is `""`), the block seeds itself with sample data. The headers are `INITIAL_HEADERS` (`Name`, `Status`, `Due Date`) and the rows are three sample tasks (`INITIAL_ROWS`). Otherwise both props are parsed with `JSON.parse`.
- **State.** `headers: string[]` and `rows: string[][]` are mirrored into `headersRef` and `rowsRef`, so the stable callbacks always see the latest values.
- **Persistence.** Every mutation goes through `persistTable(newHeaders, newRows)`. It updates local state and calls `editor.updateBlock(block, { props: { headers, rows } })` with both arrays JSON-stringified. Every keystroke in a cell therefore writes to the document.
- **Operations.**
  - `addRow` appends an empty row and focuses its first cell on the next animation frame through `firstCellRef`, which is attached to the last row's first input.
  - `deleteRow(i)` removes a row.
  - `addColumn` appends `Column N` and an empty cell to every row.
  - `deleteColumn(i)` removes a column and its cells. It refuses when only one column is left.
  - `updateHeader` and `updateCell` replace a single value.
- **UI.** Double-click a header to rename it. Hovering a header shows an X to delete the column, and hovering a row shows a trash icon. There is a + button for columns and an "Add row" footer. The header bar shows the row count.
- **Status column.** When the column index is 1 and the header (case-insensitive) is `status`, the cell renders a `<select>` with the keys of `STATUS_COLORS` (`In Progress`, `Done`, `Todo`) plus an empty "Select status" option.

## Exports
- `tableViewBlock` - BlockNote block spec factory: type `tableView`, props `headers` and `rows` (JSON strings, default `""`), `content: "none"`.

## Dependencies
- **Packages:** `@blocknote/react` (`createReactBlockSpec`), `lucide-react` (Plus, Trash2, X), `react`.

## Used by
- Re-exported by `app/(dashboard)/thoughts/components/blocks/index.ts`. `app/(dashboard)/thoughts/page.tsx` registers it as `tableView: tableViewBlock()`.

## Notes
- The status colours are only partly applied. The option `style.color` is built by replacing `text-` with `#` in a Tailwind class name (for example `#amber-300`), which is not a valid CSS colour, so it has no effect. The select itself only gets an inline grey colour when the value is empty.
- Rows and columns are keyed by array index, so React reuses inputs by position after a deletion.
- The props are parsed with `JSON.parse` and no try/catch, so malformed JSON crashes the block.
