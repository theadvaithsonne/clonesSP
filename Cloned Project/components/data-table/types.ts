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
  sortable?: boolean;
  filterable?: boolean; // shows the per-column filter affix on hover
  /**
   * Plain-text value this column filters on.
   *
   * `cell` returns a ReactNode — avatars, badges, formatted money — so it
   * can't be matched against. A filterable column supplies the raw string
   * instead, which also lets "Bengaluru" match a row whose cell renders a
   * flag plus the city.
   *
   * Required for `filterable` columns; without it the affix is hidden,
   * because a filter that silently matches nothing is worse than no filter.
   */
  filterAccessor?: (row: T) => string | number | null | undefined;
  /**
   * This column is filtered by the SERVER, so it needs no accessor — the page
   * forwards the value to its API and refetches.
   *
   * Set on tables that paginate server-side, where matching the rows already
   * in the browser would search one page out of many.
   */
  serverFiltered?: boolean;
  /**
   * Loading placeholder for this column's cell.
   *
   * Supply one whenever `cell` renders something other than a single line —
   * an avatar stack, a badge, a three-line money block. The default skeleton
   * is one grey bar, which makes a table of rich cells visibly rearrange
   * itself the moment real data lands.
   */
  skeleton?: ReactNode;
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
  /**
   * Collapse the tail of a row into ONE merged cell.
   *
   * Return the column id to merge FROM — that cell and every column after it
   * become a single `<td colSpan>` holding `content`. Return null (the
   * default for every row) and the row renders normally, so existing tables
   * are unaffected.
   *
   * For rows where the remaining columns genuinely don't apply: a recurring
   * live stream has no single date, price or rating, so it offers one
   * drill-down button instead of ten blank cells.
   */
  mergeTail?: (row: T) => { fromColumnId: string; content: ReactNode } | null;
  /** Stable id — persists column widths + order in localStorage so the layout
   *  survives reloads (and can be shared across the pages that reuse this table). */
  tableId: string;
  columns: ColumnDef<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  /** Shown in place of the rows when there are none. A ReactNode rather than
   *  a string so a page can offer a way OUT of the empty state — the founder
   *  Orders grid renders a "Clear all filters" button next to the message. */
  emptyLabel?: ReactNode;

  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;
  /**
   * Fired when a column's filter affix is clicked. Only used by tables that
   * drive their own filter UI (NC Subs opens a drawer). Leave unset to get
   * the built-in per-column popover instead.
   */
  onColumnFilter?: (columnId: string) => void;

  /**
   * Active column filters, keyed by column id — a "contains" match, case
   * insensitive.
   *
   * Controlled by the page rather than held here on purpose: several of these
   * tables paginate before handing rows over, so filtering inside this
   * component would only ever search the current page. The page owns the full
   * dataset, so it owns the filtering; this component owns the UI.
   */
  filters?: Record<string, string>;
  onFiltersChange?: (next: Record<string, string>) => void;

  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  /**
   * Hide the select-all tick in the header, keeping the per-row ticks.
   *
   * For tables where a row's tick isn't "arm this row for a bulk action" but
   * an action in itself — the founder Live Streams grid opens one row's
   * Options drawer — there is nothing for "select all" to mean.
   */
  hideSelectAll?: boolean;

  onRowClick?: (row: T) => void;

  /** The whole top control bar (view selector + search + actions). Page-supplied. */
  topBar?: ReactNode;
  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;

  /** Background colour for sticky elements (frozen columns + the sticky
   *  header row) — needs to be opaque so scrolled content doesn't leak
   *  through, and it also paints the table's own surface.
   *
   *  Defaults to #181818, this app's shell. It used to default to NC's
   *  near-black #0b0b0b, which this repo has no page for: every surface here
   *  is #181818 or #1e1e1e, so any table that didn't override it rendered as
   *  a black slab against a paler page. Any CSS colour string works. */
  stickyBg?: string;
  /**
   * Colour of EVERY line the table draws — the cell grid, the header rule and
   * the footer divider — so a table can't end up with a #5d5d5d grid inside a
   * shell bordered in something else. Defaults to NC's grey; pass the host
   * page's own border colour to make the table read as part of the shell
   * rather than a panel dropped on top of it.
   */
  borderColor?: string;
  /**
   * Fixed footer height in px. Set it when the table sits beside a shell whose
   * own bottom bar has a known height — the founder Live Streams grid passes
   * 64 so its top rule lands on exactly the same line as the sidebar's user
   * menu divider, instead of a few pixels above or below it. Omit to let the
   * footer size to its content.
   */
  footerHeight?: number;
  /** Grow with content and let the surrounding page scroll, instead of
   *  filling a fixed-height parent and scrolling internally (vertical scroll is
   *  removed; horizontal scroll for wide tables is kept). Default false. */
  autoHeight?: boolean;
  /**
   * Row height in px, or "auto" to let cell padding size the row.
   *
   * Defaults to 95 — Garage's own tables carry avatar + multi-line money cells
   * and are designed around that height. The ported NetworkChains admin tables
   * are compact and pass "auto" to reproduce their original metrics exactly.
   */
  rowHeight?: number | "auto";
  /**
   * Where a cell's content sits inside its row.
   *
   * Defaults to "top", which is right for the tall rows this grid was built
   * around — a three-line money stack must start on the same baseline as the
   * two-line one beside it. Tables whose cells are one or two lines should
   * pass "middle": in a fixed-height row, top-aligned single-line content
   * hangs off the ceiling with dead space under it, and a row of status pills
   * reads as misaligned even though every one of them is in the same place.
   */
  cellVerticalAlign?: "top" | "middle";
  /** Header row height in px. Defaults to Garage's 45; NC's tables pass 48. */
  headerHeight?: number;
}
