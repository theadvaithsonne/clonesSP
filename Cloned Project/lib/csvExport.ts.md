# `lib/csvExport.ts`

> Small client-side helper that turns an array of rows plus a column spec into an RFC 4180 CSV string and triggers a browser download.

**Kind:** frontend library · **Lines:** 79

## Purpose
Several wallet, order and invoice screens offer a "Download as CSV" button for data that is already loaded in the browser. This module gives them one shared, correct implementation instead of each page hand-building CSV text. The header comment notes that very large exports (for example the admin global ledger, 10k+ rows) should instead use the backend-streamed pattern in `lib/admin-api/wallets.ts` (`fetchLedgerCsv`).

## How it works
- **Cell escaping (`escapeCsvCell`, private):**
  - `null` / `undefined` become an empty cell.
  - `Date` values are written as ISO 8601 (`toISOString()`).
  - Other objects are written as `JSON.stringify(value)`.
  - Everything else goes through `String(value)`.
  - A cell is wrapped in double quotes only if it contains a comma, double quote, `\n` or `\r`; embedded quotes are doubled (`"` -> `""`).
- **CSV building (`rowsToCsv`):** the first line is the escaped `header` of each column; each row then maps every column's `accessor(row)` through the escaper. Lines are joined with `\n` (not CRLF). The string is prefixed with a UTF-8 byte-order mark (U+FEFF) so Excel detects UTF-8 when the file is opened. With zero rows the output is BOM + header only.
- **Download (`downloadCsv`):** returns immediately during SSR (`typeof window === "undefined"`). Otherwise it creates a `text/csv;charset=utf-8;` Blob, an object URL and a temporary `<a download>` element, clicks it, removes the element and revokes the URL. `.csv` is appended to the filename if missing.
- **One-shot (`exportRowsAsCsv`):** builds and downloads in one call and returns the number of rows written, which callers use in toast messages.

## Exports
- `interface CsvColumn<T>` - `{ header: string; accessor: (row: T) => unknown }`; one output column. The accessor's return value is stringified by the escaper.
- `rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string` - builds the BOM-prefixed CSV text.
- `downloadCsv(csv: string, filename: string): void` - triggers a browser download of a CSV string (no-op on the server).
- `exportRowsAsCsv<T>(rows: T[], columns: CsvColumn<T>[], filename: string): number` - `rowsToCsv` + `downloadCsv`; returns `rows.length`.

## Interfaces
- **Browser storage / cookies:** none; uses only `Blob`, `URL.createObjectURL` and a transient DOM anchor.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `app/garage-admin/(admin-dashboard)/wallets/[orgId]/page.tsx`
- `components/dashboard/FounderCommunityInvoicesPage.tsx`
- `components/dashboard/WalletPageNew.tsx`
- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`

## Notes
- No protection against CSV/formula injection: a cell beginning with `=`, `+`, `-` or `@` is written as-is and may be interpreted as a formula by Excel. Keep this in mind when exporting user-supplied text.
- `URL.revokeObjectURL` is called synchronously right after `click()`; this works in current browsers but is the usual suspect if a download ever silently fails.
