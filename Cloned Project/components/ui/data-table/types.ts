import type { ReactNode } from "react";

export type SortOrder = "asc" | "desc";
export interface SortState {
  by: string;
  order: SortOrder;
}

export type ColAlign = "left" | "right" | "center";

/** One column of the reusable Bigin-style table. `id` doubles as the sort key. */
export interface ColumnDef<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: number; // initial px (persisted per tableId after resize)
  minWidth?: number; // default 72
  align?: ColAlign;
  /** Vertical alignment of the cell body. Multi-line cells (person blocks,
   *  location) read best from the top; single-line cells (Name) are centred. */
  vAlign?: "top" | "middle";
  sortable?: boolean;
  /** Let a long header wrap to a second line instead of truncating — for
   *  qualified labels like "Processing Volume (2025)" that don't fit the
   *  column's data width. */
  headerWrap?: boolean;
  filterable?: boolean; // shows the per-column filter affix on hover
  /** Sticky to an edge on horizontal scroll. `true`/"left" pins to the left
   *  (e.g. Name); "right" pins to the right (e.g. an Actions column). Only
   *  leading-contiguous left and trailing-contiguous right columns stick. */
  frozen?: boolean | "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableTotal {
  label: string;
  value: ReactNode;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  rangeLabel: string; // e.g. "1 to 20"
  recordsPerPage?: number;
  recordsPerPageOptions?: number[];
  onPrev: () => void;
  onNext: () => void;
  /** Omit (with recordsPerPage) to hide the per-page selector — for pages with a
   *  server-fixed page size or cursor pagination. */
  onRecordsPerPageChange?: (n: number) => void;
}

export interface DataTableProps<T> {
  /** Stable id — persists column widths + order in localStorage so the layout
   *  survives reloads (and can be shared across the pages that reuse this table). */
  tableId: string;
  columns: ColumnDef<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  emptyLabel?: string;

  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;
  /** Fired when a column's filter affix is clicked (opens the drawer on that field). */
  onColumnFilter?: (columnId: string) => void;

  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  /** Header checkbox shows a dash when some — but not all — rows are selected. */
  someSelected?: boolean;

  onRowClick?: (row: T) => void;

  /** The whole top control bar (view selector + search + actions). Page-supplied. */
  topBar?: ReactNode;
  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;
}
