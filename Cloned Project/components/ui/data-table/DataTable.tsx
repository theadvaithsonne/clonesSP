"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DUR, EASE, T, cssEase } from "./motion";
import type { ColumnDef, DataTableProps, SortOrder } from "./types";

// Ported from the auction.garage "Bigin-style" DataTable (itself ported from
// NetworkChains), adapted to the Garage theme (bg #161616, accent var(--brand)).
// Same interaction model: sticky header, frozen leading/trailing columns,
// click-to-sort headers, column resize + reorder with persisted layout, row
// selection, footer totals + pager.
const DEFAULT_MIN = 72;
const CHECKBOX_W = 44;
const HEADER_BG = "#161616"; // sticky header ground
const ROW_BG = "#000000"; // body ground — rows read black against the header
const FROZEN_BG = ROW_BG; // frozen column ground (must be opaque, matches rows)
const ACCENT = "var(--brand)"; // office brand colour

function mergeColumnOrder(saved: string[], colIds: string[]): string[] {
  const known = new Set(colIds);
  const result = saved.filter((id) => known.has(id));
  const placed = new Set(result);
  for (let i = 0; i < colIds.length; i++) {
    const id = colIds[i];
    if (placed.has(id)) continue;
    let insertAt = result.length;
    for (let j = i - 1; j >= 0; j--) {
      const idx = result.indexOf(colIds[j]);
      if (idx >= 0) {
        insertAt = idx + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
    placed.add(id);
  }
  return result;
}

const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function usePersistentLayout<T>(tableId: string, columns: ColumnDef<T>[]) {
  const colIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const [order, setOrder] = useState<string[]>(colIds);
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dt:${tableId}`);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.order) setOrder(mergeColumnOrder(saved.order, colIds));
      if (saved?.widths) setWidths(saved.widths);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    setOrder((prev) => {
      const merged = mergeColumnOrder(prev, colIds);
      return sameOrder(prev, merged) ? prev : merged;
    });
  }, [colIds]);

  const persist = useCallback(
    (nextOrder: string[], nextWidths: Record<string, number>) => {
      try {
        localStorage.setItem(
          `dt:${tableId}`,
          JSON.stringify({ order: nextOrder, widths: nextWidths })
        );
      } catch {
        /* ignore */
      }
    },
    [tableId]
  );

  const setWidth = useCallback(
    (id: string, w: number) =>
      setWidths((prev) => {
        const next = { ...prev, [id]: w };
        persist(order, next);
        return next;
      }),
    [order, persist]
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
    [persist, widths]
  );

  return { order, widths, setWidth, move };
}

export function DataTable<T>({
  tableId,
  columns,
  rows,
  getRowId,
  loading,
  emptyLabel = "Nothing here yet.",
  sort,
  onSortChange,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  allSelected,
  someSelected,
  onRowClick,
  topBar,
  footerTotals,
  pagination,
}: DataTableProps<T>) {
  const { order, widths, setWidth, move } = usePersistentLayout(tableId, columns);

  const colMap = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const orderedCols = useMemo(
    () => order.map((id) => colMap.get(id)).filter(Boolean) as ColumnDef<T>[],
    [order, colMap]
  );
  const widthOf = (c: ColumnDef<T>) => widths[c.id] ?? c.width ?? 160;

  const stickyLeft = useMemo(() => {
    const map = new Map<string, number>();
    let left = selectable ? CHECKBOX_W : 0;
    for (const c of orderedCols) {
      if (!(c.frozen === true || c.frozen === "left")) break;
      map.set(c.id, left);
      left += widthOf(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCols, widths, selectable]);

  const stickyRight = useMemo(() => {
    const map = new Map<string, number>();
    let right = 0;
    for (let i = orderedCols.length - 1; i >= 0; i--) {
      const c = orderedCols[i];
      if (c.frozen !== "right") break;
      map.set(c.id, right);
      right += widthOf(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCols, widths]);

  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const resizing = useRef<{
    id: string;
    startX: number;
    startW: number;
    lastW: number;
  } | null>(null);
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

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Header sort toggle: first click sorts ascending, clicking the active column
  // flips the direction. Sorting lives on the header itself — there is no
  // column menu.
  const toggleSort = useCallback(
    (id: string) => {
      const nextOrder: SortOrder =
        sort?.by === id && sort.order === "asc" ? "desc" : "asc";
      onSortChange?.({ by: id, order: nextOrder });
    },
    [sort, onSortChange]
  );

  const gridMinWidth =
    (selectable ? CHECKBOX_W : 0) + orderedCols.reduce((s, c) => s + widthOf(c), 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {topBar}

      <div
        ref={scrollRef}
        className="scrollbar-hide min-h-0 flex-1 overflow-auto"
        // Body ground: rows, the empty/skeleton states and any underflow below
        // the last row all sit on black. The sticky header keeps HEADER_BG.
        style={{ background: ROW_BG }}
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
                  transition: isResizing ? "none" : T.colWidth,
                }}
              />
            ))}
          </colgroup>

          <thead>
            <tr>
              {selectable && (
                <th
                  className="sticky left-0 top-0 z-30 h-12"
                  style={{
                    background: HEADER_BG,
                    boxShadow:
                      "inset 0 -1px 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex h-full items-center justify-center">
                    <Check
                      checked={!!allSelected}
                      indeterminate={!allSelected && !!someSelected}
                      onChange={() => onToggleAll?.()}
                    />
                  </div>
                </th>
              )}
              {orderedCols.map((c) => {
                const left = stickyLeft.get(c.id);
                const right = stickyRight.get(c.id);
                const frozenX = left != null || right != null;
                const active = sort?.by === c.id;
                return (
                  <th
                    key={c.id}
                    data-col={c.id}
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
                    className={`group/th sticky top-0 z-20 h-12 select-none px-3 ${
                      frozenX ? "z-30" : ""
                    } ${c.headerClassName ?? ""}`}
                    style={{
                      background: HEADER_BG,
                      textAlign: c.align ?? "left",
                      left,
                      right,
                      // Every column carries a right-hand rule, so the header
                      // and body read as a grid (per design), not just rows.
                      boxShadow:
                        "inset 0 -1px 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(255,255,255,0.06)" +
                        (right != null ? ", inset 1px 0 0 rgba(255,255,255,0.06)" : ""),
                      opacity: dragId === c.id ? 0.4 : 1,
                      transition: `opacity ${DUR.micro}s ${cssEase(EASE.decel)}`,
                    }}
                  >
                    {overId === c.id && dragId !== c.id && (
                      <span
                        className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded"
                        style={{ background: ACCENT }}
                      />
                    )}
                    <div
                      className={`relative flex items-center gap-1.5 ${
                        c.align === "right" ? "justify-end" : ""
                      }`}
                    >
                      {c.sortable ? (
                        /* The header itself is the sort control: click to sort
                           ascending, click again to flip. The arrow sits right
                           beside the label — active columns keep it, the rest
                           reveal a neutral ⇅ hint on hover. */
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSort(c.id);
                          }}
                          title={`Sort by ${typeof c.header === "string" ? c.header : "column"}`}
                          aria-label={`Sort by ${typeof c.header === "string" ? c.header : "column"}`}
                          className="flex min-w-0 items-center gap-1.5 rounded transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
                        >
                          <span
                            className={`font-medium tracking-tight transition-colors ${
                              c.headerWrap ? "whitespace-normal leading-tight" : "truncate"
                            } ${
                              active ? "text-white" : "text-zinc-400 group-hover/th:text-zinc-200"
                            }`}
                          >
                            {c.header}
                          </span>
                          {active ? (
                            <span className="shrink-0 text-zinc-300">
                              {sort?.order === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )}
                            </span>
                          ) : (
                            <ArrowUpDown
                              className="h-3.5 w-3.5 shrink-0 text-zinc-500 opacity-0 transition group-hover/th:opacity-100"
                              style={{ transition: T.headerHover }}
                            />
                          )}
                        </button>
                      ) : (
                        <span
                          className={`font-medium tracking-tight ${
                            c.headerWrap ? "whitespace-normal leading-tight" : "truncate"
                          } ${active ? "text-white" : "text-zinc-400"}`}
                        >
                          {c.header}
                        </span>
                      )}
                    </div>

                    <span
                      onPointerDown={(e) => startResize(e, c)}
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize opacity-0 transition group-hover/th:opacity-100"
                      style={{ transition: T.headerHover }}
                    >
                      <span className="absolute right-0 top-2 bottom-2 w-px bg-[rgba(255,255,255,0.2)]" />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 ? (
              <SkeletonRows cols={(selectable ? 1 : 0) + orderedCols.length} />
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
                    onRowClick={onRowClick}
                    onToggleRow={onToggleRow}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(footerTotals || pagination) && (
        <Footer totals={footerTotals} pagination={pagination} />
      )}
    </div>
  );
}

function Check({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const on = checked || !!indeterminate;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      aria-checked={indeterminate ? "mixed" : checked}
      role="checkbox"
      className={`flex h-4 w-4 items-center justify-center rounded border transition ${
        on
          ? "border-brand bg-brand text-brand-foreground"
          : "border-white/20 bg-transparent hover:border-white/40"
      }`}
      style={{ transition: `${DUR.micro}s ${cssEase(EASE.overshoot)}` }}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded-full bg-black" />
      ) : checked ? (
        <svg
          viewBox="0 0 12 12"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M2.5 6.5 5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

function RowInner<T>({
  row,
  rowId,
  selected,
  selectable,
  columns,
  stickyLeft,
  stickyRight,
  onRowClick,
  onToggleRow,
}: {
  row: T;
  rowId: string;
  selected: boolean;
  selectable?: boolean;
  columns: ColumnDef<T>[];
  stickyLeft: Map<string, number>;
  stickyRight: Map<string, number>;
  onRowClick?: (row: T) => void;
  onToggleRow?: (id: string) => void;
}) {
  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={`group/row ${onRowClick ? "cursor-pointer" : ""}`}
      style={{ transition: T.rowHover }}
    >
      {selectable && (
        <td
          // Row tint is written as arbitrary rgba, not `bg-white/[0.03]`: the
          // inline Deals shell normalizes `[class*="bg-white"]` to #13131a with
          // !important, which would repaint every cell navy.
          className="sticky left-0 z-10 align-middle group-hover/row:bg-[rgba(255,255,255,0.03)]"
          style={{
            background: FROZEN_BG,
            boxShadow:
              "inset 0 -1px 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(255,255,255,0.06)",
            transition: T.rowHover,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center py-4">
            <Check checked={selected} onChange={() => onToggleRow?.(rowId)} />
          </div>
        </td>
      )}
      {columns.map((c) => {
        const left = stickyLeft.get(c.id);
        const right = stickyRight.get(c.id);
        const frozenX = left != null || right != null;
        return (
          <td
            key={c.id}
            data-col={c.id}
            className={`overflow-hidden px-3 py-3.5 text-zinc-200 group-hover/row:bg-[rgba(255,255,255,0.03)] ${
              c.vAlign === "middle" ? "align-middle" : "align-top"
            } ${frozenX ? "sticky z-10" : ""} ${c.cellClassName ?? ""}`}
            style={{
              background: frozenX ? FROZEN_BG : undefined,
              textAlign: c.align ?? "left",
              left,
              right,
              boxShadow:
                "inset 0 -1px 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(255,255,255,0.06)" +
                (right != null ? ", inset 1px 0 0 rgba(255,255,255,0.06)" : ""),
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

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td
              key={c}
              className="px-3 py-3.5"
              style={{
                boxShadow:
                  "inset 0 -1px 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Footer<T>({
  totals,
  pagination,
}: {
  totals?: DataTableProps<T>["footerTotals"];
  pagination?: DataTableProps<T>["pagination"];
}) {
  return (
    <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-5">
        {totals?.map((t) => (
          <span key={t.label} className="flex items-center gap-1.5">
            <span className="text-zinc-500">{t.label}</span>
            <span className="font-semibold text-white">{t.value}</span>
          </span>
        ))}
      </div>
      {pagination && (
        <div className="flex items-center gap-4 text-zinc-400">
          {pagination.onRecordsPerPageChange && pagination.recordsPerPage != null && (
            <div className="flex items-center gap-2">
              <span className="hidden text-zinc-500 sm:inline">Records per page</span>
              <select
                value={pagination.recordsPerPage}
                onChange={(e) => pagination.onRecordsPerPageChange?.(Number(e.target.value))}
                className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1 text-zinc-200 outline-none"
              >
                {(pagination.recordsPerPageOptions ?? [10, 20, 50, 100]).map((n) => (
                  <option key={n} value={n} className="bg-[#1b1b1b]">
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="tabular-nums text-zinc-400">{pagination.rangeLabel}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={pagination.onPrev}
              disabled={pagination.page <= 1}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.1] text-zinc-300 transition enabled:hover:bg-white/[0.06] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={pagination.onNext}
              disabled={pagination.page >= pagination.totalPages}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.1] text-zinc-300 transition enabled:hover:bg-white/[0.06] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
