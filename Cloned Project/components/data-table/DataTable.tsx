"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check as CheckIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ListFilter,
  X,
} from "lucide-react";
import { DUR, EASE, T, cssEase } from "./motion";
import type { ColumnDef, DataTableProps, SortOrder } from "./types";

const DEFAULT_MIN = 72;
const CHECKBOX_W = 44;
/** Row height, shared by real rows AND the skeleton. One constant so a
 *  loading table can't be a different height than the table it becomes —
 *  that mismatch shows up as the whole grid jolting when data lands. */
const ROW_H = 95;

/** Persisted column widths + order, keyed by tableId. New columns append; removed
 *  ones drop out. Falls back gracefully when localStorage is unavailable (SSR). */
function usePersistentLayout<T>(tableId: string, columns: ColumnDef<T>[]) {
  const colIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const [order, setOrder] = useState<string[]>(colIds);
  const [widths, setWidths] = useState<Record<string, number>>({});

  // Hydrate on mount AND whenever the table identity changes — one component
  // can swap between tableIds (the founder grid does, One Time ↔ recurring
  // sessions). Without the resets below, the previous table's `order` survives
  // the swap: the new set's own ids get filtered out of it by the sync effect
  // below and re-appended at the END, so a column defined first renders last.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dt:${tableId}`);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.order) {
        const known = saved.order.filter((id: string) => colIds.includes(id));
        const missing = colIds.filter((id) => !known.includes(id));
        setOrder([...known, ...missing]);
      } else {
        setOrder(colIds);
      }
      setWidths(saved?.widths || {});
    } catch {
      setOrder(colIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Keep order in sync when the column set changes.
  useEffect(() => {
    setOrder((prev) => {
      const known = prev.filter((id) => colIds.includes(id));
      const missing = colIds.filter((id) => !known.includes(id));
      return known.length === prev.length && missing.length === 0
        ? prev
        : [...known, ...missing];
    });
  }, [colIds]);

  const persist = useCallback(
    (nextOrder: string[], nextWidths: Record<string, number>) => {
      try {
        localStorage.setItem(
          `dt:${tableId}`,
          JSON.stringify({ order: nextOrder, widths: nextWidths }),
        );
      } catch {
        /* ignore */
      }
    },
    [tableId],
  );

  const setWidth = useCallback(
    (id: string, w: number) =>
      setWidths((prev) => {
        const next = { ...prev, [id]: w };
        persist(order, next);
        return next;
      }),
    [order, persist],
  );

  const move = useCallback(
    (fromId: string, toId: string) =>
      setOrder((prev) => {
        if (fromId === toId) return prev;
        const from = prev.indexOf(fromId);
        const to = prev.indexOf(toId);
        if (from < 0 || to < 0) return prev;
        const next = [...prev];
        next.splice(to, 0, next.splice(from, 1)[0]);
        persist(next, widths);
        return next;
      }),
    [persist, widths],
  );

  return { order, widths, setWidth, move };
}

export function DataTable<T>({
  mergeTail,
  tableId,
  columns,
  rows,
  getRowId,
  loading,
  emptyLabel = "Nothing here yet.",
  sort,
  onSortChange,
  onColumnFilter,
  filters,
  onFiltersChange,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  allSelected,
  hideSelectAll,
  onRowClick,
  topBar,
  footerTotals,
  pagination,
  stickyBg = "#181818",
  // Same line the admin chrome draws — `border-white/[0.06]` on the header,
  // sidebar and drawer edges. A solid mid-grey here made the grid read as a
  // different, much louder surface than everything around it.
  borderColor = "rgba(255,255,255,0.06)",
  footerHeight,
  autoHeight = false,
  rowHeight = ROW_H,
  cellVerticalAlign = "top",
  headerHeight = 45,
}: DataTableProps<T>) {
  // Resolved once here rather than per cell — Tailwind can't build a class
  // name from a variable, so this is the one place the two options exist.
  const alignClass =
    cellVerticalAlign === "middle" ? "align-middle" : "align-top";
  const { order, widths, setWidth, move } = usePersistentLayout(tableId, columns);

  const colMap = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const orderedCols = useMemo(
    () => order.map((id) => colMap.get(id)).filter(Boolean) as ColumnDef<T>[],
    [order, colMap],
  );
  // Enforce minWidth as a hard floor so a stale localStorage width of ~0
  // (from an accidental resize drag) can't render a column zero-wide and
  // make neighbouring cells' content overlap. Also lifts the missing-key
  // case to a sane default (160).
  const widthOf = (c: ColumnDef<T>) => {
    const raw = widths[c.id] ?? c.width ?? 160;
    const min = c.minWidth ?? DEFAULT_MIN;
    return Math.max(raw, min);
  };

  // Left offset for the sticky (frozen) leading columns: checkbox + any frozen cols.
  const stickyLeft = useMemo(() => {
    const map = new Map<string, number>();
    let left = selectable ? CHECKBOX_W : 0;
    for (const c of orderedCols) {
      if (!(c.frozen === true || c.frozen === "left")) break; // leading contiguous only
      map.set(c.id, left);
      left += widthOf(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCols, widths, selectable]);

  // Right offset for the sticky trailing right-frozen columns (e.g. Actions), so
  // they stay reachable no matter the horizontal scroll — the mirror of stickyLeft.
  const stickyRight = useMemo(() => {
    const map = new Map<string, number>();
    let right = 0;
    for (let i = orderedCols.length - 1; i >= 0; i--) {
      const c = orderedCols[i];
      if (c.frozen !== "right") break; // trailing contiguous only
      map.set(c.id, right);
      right += widthOf(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCols, widths]);

  // ── Column resize (pointer drag on the right-edge handle) ───────────────────
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const resizing = useRef<{ id: string; startX: number; startW: number; lastW: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const startResize = (e: React.PointerEvent, c: ColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = widthOf(c);
    const min = colMap.get(c.id)?.minWidth ?? DEFAULT_MIN;
    resizing.current = { id: c.id, startX: e.clientX, startW, lastW: startW };
    setIsResizing(true);
    const onMove = (ev: PointerEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(min, r.startW + (ev.clientX - r.startX));
      r.lastW = w;
      // Update the <col> width DIRECTLY — no React state per pointer-move, so we
      // don't re-render every row each frame (that was the resize lag). Commit
      // once on release.
      const el = colRefs.current[r.id];
      if (el) el.style.width = `${w}px`;
    };
    const onUp = () => {
      const r = resizing.current;
      resizing.current = null;
      setIsResizing(false);
      if (r) setWidth(r.id, r.lastW);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── Column reorder (HTML5 drag on the header cell) ──────────────────────────
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sortMenu, setSortMenu] = useState<string | null>(null);
  // Which column's filter popover is open. One at a time — two open boxes in
  // a header row is unreadable, and the click-away layer would fight itself.
  const [filterMenu, setFilterMenu] = useState<string | null>(null);

  const gridMinWidth =
    (selectable ? CHECKBOX_W : 0) + orderedCols.reduce((s, c) => s + widthOf(c), 0);

  return (
    // Exposes stickyBg to descendants via a CSS variable so both the header
    // row and the frozen-column cells can pick it up without prop-drilling.
    // Frozen cells derive their hover colour from this var too (an opaque
    // color-mix), so nothing bleeds through the sticky column on row hover.
    <div
      // autoHeight: grow with content and let the PAGE scroll, instead of
      // filling a fixed-height parent and scrolling internally.
      // The whole table surface uses the sticky bg so non-frozen (transparent)
      // cells, toolbar and footer read the same colour as the header + frozen
      // columns — one uniform #181818 in the admin, never the page's darker bg.
      className={
        autoHeight
          ? "flex flex-col bg-[var(--dt-sticky-bg)]"
          : "flex h-full min-h-0 flex-col bg-[var(--dt-sticky-bg)]"
      }
      style={{
        ["--dt-sticky-bg" as string]: stickyBg,
        ["--dt-border" as string]: borderColor,
      }}
    >
      {topBar}

      {/*
        Active filters as chips. A column filter lives behind a hover affix in
        the header, so without this a table can sit there filtered with no
        visible reason why rows are missing — the classic "where did my data
        go" bug report.
      */}
      {onFiltersChange && filters && activeFilterChips(filters, columns).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">
            Filters
          </span>
          {activeFilterChips(filters, columns).map(({ id, label, value }) => (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 py-1 pl-2.5 pr-1.5 text-[12px] text-brand"
            >
              <span className="text-zinc-400">{label}:</span>
              <span className="max-w-[160px] truncate">{value}</span>
              <button
                type="button"
                onClick={() => {
                  const next = { ...filters };
                  delete next[id];
                  onFiltersChange(next);
                }}
                aria-label={`Clear ${label} filter`}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-brand/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onFiltersChange({})}
            className="ml-1 text-[12px] text-zinc-400 underline-offset-2 hover:text-white hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Scroll region: the ONLY thing that scrolls (Excel-like); the header is
          sticky inside it so column titles stay put while rows scroll. */}
      <div
        className={
          autoHeight
            ? "overflow-x-auto glass-scrollbar"
            : "min-h-0 flex-1 overflow-auto glass-scrollbar"
        }
      >
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-[13px]"
          style={{ minWidth: gridMinWidth }}
        >
          <colgroup>
            {selectable && <col style={{ width: CHECKBOX_W }} />}
            {orderedCols.map((c) => (
              <col
                key={c.id}
                ref={(el) => {
                  colRefs.current[c.id] = el;
                }}
                style={{
                  width: widthOf(c),
                  transition: isResizing ? "none" : T.colWidth, // Bigin: width 0.2s ease-in
                }}
              />
            ))}
          </colgroup>

          <thead>
            <tr>
              {selectable && (
                <th
                  className="sticky left-0 top-0 z-30 bg-[var(--dt-sticky-bg)]"
                  style={{
                    height: headerHeight,
                    boxShadow: "inset -1px -1px 0 0 var(--dt-border), inset 1px 1px 0 0 var(--dt-border)",
                  }}
                >
                  {/* The column still exists so the header lines up with the
                      rows' ticks — only the select-all control is dropped. */}
                  {!hideSelectAll && (
                    <div className="flex h-full items-center justify-center">
                      <Check
                        checked={!!allSelected}
                        onChange={() => onToggleAll?.()}
                      />
                    </div>
                  )}
                </th>
              )}
              {orderedCols.map((c, idx) => {
                const left = stickyLeft.get(c.id);
                const right = stickyRight.get(c.id);
                const frozenX = left != null || right != null;
                const active = sort?.by === c.id;
                const isLeftEdge = !selectable && idx === 0;
                return (
                  <th
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragId && dragId !== c.id) setOverId(c.id);
                    }}
                    onDrop={() => {
                      if (dragId) move(dragId, c.id);
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    className={`group/th sticky top-0 z-20 select-none bg-[var(--dt-sticky-bg)] px-3 ${
                      frozenX ? "z-30" : ""
                    } ${c.headerClassName ?? ""}`}
                    style={{
                      textAlign: c.align ?? "left",
                      height: headerHeight,
                      left,
                      right,
                      // Uniform grid, one colour for every line (top + right + bottom +
                      // optional left) per the Figma; the
                      // frozen column's right edge comes from the same right line.
                      boxShadow: isLeftEdge
                        ? "inset -1px -1px 0 0 var(--dt-border), inset 1px 1px 0 0 var(--dt-border)"
                        : "inset -1px -1px 0 0 var(--dt-border), inset 0 1px 0 0 var(--dt-border)",
                      opacity: dragId === c.id ? 0.4 : 1,
                      transition: `opacity ${DUR.micro}s ${cssEase(EASE.decel)}`,
                    }}
                  >
                    {/* gold drop indicator */}
                    {overId === c.id && dragId !== c.id && (
                      <span className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded bg-brand" />
                    )}
                    <div
                      className={`relative flex items-center gap-1.5 ${
                        c.align === "right" ? "justify-end" : ""
                      }`}
                    >
                      <span
                        className={`truncate font-medium tracking-tight ${
                          active ? "text-white" : "text-zinc-400"
                        }`}
                      >
                        {c.header}
                      </span>
                      {c.sortable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSortMenu((m) => (m === c.id ? null : c.id));
                          }}
                          aria-label="Sort column"
                          className={`transition ${active ? "" : "opacity-0 group-hover/th:opacity-100"}`}
                          style={{ transition: T.headerHover }}
                        >
                          <SortAffix active={active} order={active ? sort?.order : undefined} />
                        </button>
                      )}
                      {/*
                        A filterable column needs a filterAccessor to be
                        matchable — `cell` returns a ReactNode. Without one the
                        affix is hidden rather than offering a filter that
                        can never match. Tables driving their own UI (a drawer)
                        pass onColumnFilter and are exempt.
                      */}
                      {c.filterable &&
                        (onColumnFilter || c.filterAccessor || c.serverFiltered) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onColumnFilter) onColumnFilter(c.id);
                            else setFilterMenu((m) => (m === c.id ? null : c.id));
                          }}
                          aria-label="Filter column"
                          className={`ml-auto transition hover:text-brand ${
                            filters?.[c.id]?.trim()
                              ? "text-brand opacity-100"
                              : "text-zinc-600 opacity-0 group-hover/th:opacity-100"
                          }`}
                          style={{ transition: T.headerHover }}
                        >
                          <ListFilter className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <AnimatePresence>
                        {filterMenu === c.id && (
                          <FilterMenu
                            label={typeof c.header === "string" ? c.header : "value"}
                            value={filters?.[c.id] || ""}
                            onChange={(v) =>
                              onFiltersChange?.({ ...(filters || {}), [c.id]: v })
                            }
                            onClose={() => setFilterMenu(null)}
                          />
                        )}
                      </AnimatePresence>
                      <AnimatePresence>
                        {sortMenu === c.id && (
                          <SortMenu
                            current={active ? sort?.order : undefined}
                            onPick={(order) => {
                              onSortChange?.({ by: c.id, order });
                              setSortMenu(null);
                            }}
                            onClose={() => setSortMenu(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    {/* resize handle */}
                    <span
                      onPointerDown={(e) => startResize(e, c)}
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize opacity-0 transition group-hover/th:opacity-100"
                      style={{ transition: T.headerHover }}
                    >
                      <span className="absolute right-0 top-2 bottom-2 w-px bg-white/20" />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 ? (
              <SkeletonRows
                columns={orderedCols}
                selectable={selectable}
                rowHeight={rowHeight}
                alignClass={alignClass}
              />
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={(selectable ? 1 : 0) + orderedCols.length}
                  className="py-24 text-center text-sm text-zinc-500"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                return (
                  <DataRow
                    key={id}
                    row={row}
                    rowId={id}
                    selected={!!selectedIds?.has(id)}
                    selectable={selectable}
                    columns={orderedCols}
                    stickyLeft={stickyLeft}
                    stickyRight={stickyRight}
                    rowHeight={rowHeight}
                    alignClass={alignClass}
                    onRowClick={onRowClick}
                    onToggleRow={onToggleRow}
                    mergeTail={mergeTail}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(footerTotals || pagination) && (
        <Footer
          totals={footerTotals}
          pagination={pagination}
          height={footerHeight}
        />
      )}
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

function SortAffix({ active, order }: { active?: boolean; order?: SortOrder }) {
  if (active) {
    return order === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-red-400" />
    );
  }
  return <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500" />;
}

/** Bigin's per-column sort menu: green ↑ Ascending / red ↓ Descending. */
function SortMenu({
  current,
  onPick,
  onClose,
}: {
  current?: SortOrder;
  onPick: (order: SortOrder) => void;
  onClose: () => void;
}) {
  const Item = ({ order, label, icon }: { order: SortOrder; label: string; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPick(order);
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
        current === order ? "bg-white/[0.06] text-white" : "text-zinc-300 hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      {label}
      {current === order && <CheckIcon className="ml-auto h-4 w-4 text-brand" />}
    </button>
  );
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: DUR.fast, ease: EASE.decel }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-8 z-50 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111]/95 p-1 font-normal shadow-2xl backdrop-blur-xl"
      >
        <Item order="asc" label="Ascending" icon={<ArrowUp className="h-4 w-4 text-emerald-400" />} />
        <Item order="desc" label="Descending" icon={<ArrowDown className="h-4 w-4 text-red-400" />} />
      </motion.div>
    </>
  );
}

/**
 * Per-column filter popover: a "contains" box.
 *
 * Deliberately a free-text contains match rather than a list of the distinct
 * values in the column. The distinct list is the nicer control, but this
 * component only ever receives the current PAGE of rows, so that list would
 * silently offer whatever happened to be on screen — and quietly omit the
 * value you were looking for. Text search has no such failure mode.
 *
 * Typing filters live; there's no Apply button to forget to press.
 */
function FilterMenu({
  label,
  value,
  onChange,
  onClose,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: DUR.fast, ease: EASE.decel }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-8 z-50 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111]/95 p-2 font-normal shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wider text-zinc-500">
          Filter {label}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "Escape") onClose();
          }}
          placeholder="Contains…"
          className="h-8 w-full rounded-lg border border-white/[0.1] bg-black/40 px-2.5 text-[13px] text-white placeholder-zinc-600 focus:border-brand/50 focus:outline-none"
        />
        {value.trim().length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              onClose();
            }}
            className="mt-1.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            Clear this filter
          </button>
        )}
      </motion.div>
    </>
  );
}

/** Active filters paired with their column's header text, for the chip row. */
function activeFilterChips<T>(
  filters: Record<string, string>,
  columns: ColumnDef<T>[],
): Array<{ id: string; label: string; value: string }> {
  return Object.entries(filters)
    .filter(([, v]) => v.trim().length > 0)
    .map(([id, value]) => {
      const col = columns.find((c) => c.id === id);
      const label =
        col && typeof col.header === "string" ? col.header : id;
      return { id, label, value };
    });
}

function Check({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      aria-checked={checked}
      role="checkbox"
      className={`flex h-4 w-4 items-center justify-center rounded border transition ${
        checked
          ? "border-brand bg-brand text-brand-foreground"
          : "border-white/20 bg-transparent hover:border-white/40"
      }`}
      style={{ transition: `${DUR.micro}s ${cssEase(EASE.overshoot)}` }}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M2.5 6.5 5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// Memoized row. The sort menu / column-drag / hover state lives in the parent
// table, so isolating rows here stops those interactions from re-rendering every
// cell each frame — the main source of the interaction lag.
function RowInner<T>({
  row,
  rowId,
  selected,
  selectable,
  columns,
  stickyLeft,
  stickyRight,
  rowHeight,
  alignClass,
  onRowClick,
  onToggleRow,
  mergeTail,
}: {
  row: T;
  rowId: string;
  selected: boolean;
  selectable?: boolean;
  columns: ColumnDef<T>[];
  stickyLeft: Map<string, number>;
  stickyRight: Map<string, number>;
  rowHeight: number | "auto";
  /** "align-top" | "align-middle" — resolved by the parent. */
  alignClass: string;
  onRowClick?: (row: T) => void;
  onToggleRow?: (id: string) => void;
  mergeTail?: (row: T) => { fromColumnId: string; content: ReactNode } | null;
}) {
  // Collapse the tail of THIS row into a single cell. For rows where the
  // remaining columns don't apply at all — a recurring live stream has no one
  // date or price — that beats printing ten blanks. Opt-in per row: return
  // null and the row renders normally.
  const merge = mergeTail?.(row) ?? null;
  const mergeAt = merge
    ? columns.findIndex((c) => c.id === merge.fromColumnId)
    : -1;
  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={`group/row ${onRowClick ? "cursor-pointer" : ""}`}
      style={{ transition: T.rowHover }}
    >
      {selectable && (
        <td
          className="sticky left-0 z-10 bg-[var(--dt-sticky-bg)] align-top group-hover/row:bg-[color-mix(in_srgb,var(--dt-sticky-bg)_97%,white)]"
          style={{
            ...(rowHeight === "auto" ? {} : { height: rowHeight }),
            boxShadow:
              "inset -1px -1px 0 0 var(--dt-border), inset 1px 0 0 0 var(--dt-border)",
            transition: T.rowHover,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-full items-center justify-center">
            <Check checked={selected} onChange={() => onToggleRow?.(rowId)} />
          </div>
        </td>
      )}
      {columns.map((c, idx) => {
        // Past the merge point the cells are absorbed into the spanning one.
        if (mergeAt >= 0 && idx > mergeAt) return null;
        if (mergeAt >= 0 && idx === mergeAt) {
          return (
            <td
              key={c.id}
              colSpan={columns.length - mergeAt}
              className={`overflow-hidden px-3 py-3.5 ${alignClass} text-zinc-200 group-hover/row:bg-white/[0.03]`}
              style={{
                height: ROW_H,
                textAlign: "left",
                boxShadow: "inset -1px -1px 0 0 var(--dt-border)",
                transition: T.rowHover,
              }}
            >
              {merge!.content}
            </td>
          );
        }
        const left = stickyLeft.get(c.id);
        const right = stickyRight.get(c.id);
        const frozenX = left != null || right != null;
        const isLeftEdge = !selectable && idx === 0;
        return (
          <td
            key={c.id}
            className={`overflow-hidden px-3 py-3.5 ${alignClass} text-zinc-200 ${
              // Frozen cells MUST stay opaque on hover — a translucent hover bg would
              // let the horizontally-scrolled cells behind them show through the
              // sticky column. color-mix keeps it theme-correct (blend the sticky bg
              // with the same 3% white as the row highlight, but opaque).
              frozenX
                ? "sticky z-10 bg-[var(--dt-sticky-bg)] group-hover/row:bg-[color-mix(in_srgb,var(--dt-sticky-bg)_97%,white)]"
                : "group-hover/row:bg-white/[0.03]"
            } ${c.cellClassName ?? ""}`}
            style={{
              ...(rowHeight === "auto" ? {} : { height: rowHeight }),
              textAlign: c.align ?? "left",
              left,
              right,
              // Uniform grid, one colour for every line (right + bottom +
              // optional left) per the Figma.
              boxShadow: isLeftEdge
                ? "inset -1px -1px 0 0 var(--dt-border), inset 1px 0 0 0 var(--dt-border)"
                : "inset -1px -1px 0 0 var(--dt-border)",
              transition: T.rowHover,
            }}
          >
            {c.cell(row)}
          </td>
        );
      })}
    </tr>
  );
}
const DataRow = memo(RowInner) as typeof RowInner;

/**
 * Loading rows that mirror the real ones cell-for-cell.
 *
 * A generic "one grey bar per cell" skeleton is worse than none here: this
 * grid's cells are two- and three-line stacks, avatars and pills, so a single
 * bar per column made the table visibly rearrange itself the moment data
 * arrived. Columns supply their own `skeleton` shape; anything that doesn't
 * falls back to the plain bar.
 */
function SkeletonRows<T>({
  columns,
  selectable,
  rowHeight,
  alignClass,
}: {
  columns: ColumnDef<T>[];
  selectable?: boolean;
  rowHeight: number | "auto";
  alignClass: string;
}) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, r) => (
        <tr key={r}>
          {selectable && (
            <td
              className="px-3 py-3.5 align-middle"
              style={{
                ...(rowHeight === "auto" ? {} : { height: rowHeight }),
                boxShadow:
                  "inset -1px -1px 0 0 var(--dt-border), inset 1px 0 0 0 var(--dt-border)",
              }}
            >
              <div className="mx-auto h-4 w-4 animate-pulse rounded bg-white/[0.08]" />
            </td>
          )}
          {columns.map((c, i) => {
            const isLeftEdge = !selectable && i === 0;
            return (
              <td
                key={c.id}
                className={`overflow-hidden px-3 py-3.5 ${alignClass}`}
                style={{
                  ...(rowHeight === "auto" ? {} : { height: rowHeight }),
                  boxShadow: isLeftEdge
                    ? "inset -1px -1px 0 0 var(--dt-border), inset 1px 0 0 0 var(--dt-border)"
                    : "inset -1px -1px 0 0 var(--dt-border)",
                }}
              >
                {c.skeleton ?? (
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function Footer<T>({
  totals,
  pagination,
  height,
}: {
  totals?: DataTableProps<T>["footerTotals"];
  pagination?: DataTableProps<T>["pagination"];
  height?: number;
}) {
  return (
    // One fixed-height bar, no vertical padding: padding on top of an explicit
    // height is how the old footer ended up taller than it claimed.
    <div
      className="flex flex-none items-center justify-between gap-4 border-t border-white/[0.06] bg-[#0E0E11] px-4 text-[12px]"
      style={{ height: height ?? 44 }}
    >
      {/* Totals stay on ONE line each — "One Time Live Streams" wrapping to two
          lines doubled the footer's height and split every label from its
          number. They scroll sideways when the viewport is too narrow, which
          keeps the pagination controls reachable. */}
      <div className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
        {totals?.map((t) => (
          <span
            key={t.label}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <span className="font-normal text-white/50">{t.label}</span>
            {/* The colour is the page's call — counts gold, money emerald —
                so the value arrives as a ReactNode already styled. */}
            <span className="font-semibold text-white">{t.value}</span>
          </span>
        ))}
      </div>

      {pagination && (
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          {pagination.onRecordsPerPageChange && pagination.recordsPerPage != null && (
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-white/50">
                Records per page
              </span>
              <select
                value={pagination.recordsPerPage}
                onChange={(e) =>
                  pagination.onRecordsPerPageChange?.(Number(e.target.value))
                }
                className="h-7 rounded-lg border border-[#2A2A2E] bg-[#18181B] px-2 text-[12px] text-zinc-200 outline-none transition hover:border-[#3E3E42] focus:border-brand/40"
              >
                {(pagination.recordsPerPageOptions ?? [10, 20, 50, 100]).map((n) => (
                  <option key={n} value={n} className="bg-[#18181B]">
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="whitespace-nowrap font-medium tabular-nums text-zinc-400">
            {pagination.rangeLabel}
          </span>

          <div className="flex items-center gap-1">
            <PageButton
              onClick={pagination.onPrev}
              disabled={pagination.page <= 1}
              label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </PageButton>
            <PageButton
              onClick={pagination.onNext}
              disabled={pagination.page >= pagination.totalPages}
              label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rim-light rim-light-strong flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
