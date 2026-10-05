// Small shared helper for client-side CSV exports. Used by wallet pages
// (transaction lists) and anywhere else we want a "download as CSV" button
// without round-tripping to the backend.
//
// For very large datasets (admin global ledger, 10k+ rows), prefer the
// backend-streamed pattern at lib/admin-api/wallets.ts `fetchLedgerCsv`.

/**
 * Escape a single cell per RFC 4180:
 *  - Wrap in quotes if it contains comma, quote, newline, or carriage return
 *  - Double up any embedded quotes
 *  - Convert null/undefined to empty string
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === "object") {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  const needsQuotes = /[",\n\r]/.test(s);
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export interface CsvColumn<T> {
  /** Header label written as the first row. */
  header: string;
  /** Extract the cell value from a row. Return value will be stringified. */
  accessor: (row: T) => unknown;
}

/**
 * Build a CSV string from rows + a column spec.
 * Excel-safe: prepends UTF-8 BOM so Excel detects encoding on open.
 */
export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(c.accessor(row))).join(","))
    .join("\n");
  // BOM + header + (body if any)
  return "﻿" + header + (body ? "\n" + body : "");
}

/**
 * Trigger a browser download of a CSV string.
 * Anchor-tag pattern; cleans up the object URL afterwards.
 */
export function downloadCsv(csv: string, filename: string): void {
  if (typeof window === "undefined") return; // SSR guard
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * One-shot: build CSV from rows + columns and trigger a download.
 * Returns the number of rows written (for toast messages, etc.).
 */
export function exportRowsAsCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string
): number {
  const csv = rowsToCsv(rows, columns);
  downloadCsv(csv, filename);
  return rows.length;
}
