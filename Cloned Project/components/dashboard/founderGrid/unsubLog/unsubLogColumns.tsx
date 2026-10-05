"use client";

/**
 * The columns of the founder Unsub Log grid.
 *
 * The parent pins one item kind per page (Communities / Live Streams /
 * Courses), so there is no Kind column — every row on a given page is the
 * same kind and the column would repeat one label down the whole table. The
 * item column's header comes from that same pinned label.
 *
 * NO SELECTION COLUMN and NO `sortable` FLAGS, for the same reasons as the
 * Orders grid: the log is read-only with no per-row action, and
 * `/feed/founder/unsub-log` sorts `occurredAt: -1` with no sort parameter —
 * a control here could only reorder the rows already in the browser.
 *
 * Ids are the localStorage key for each column's saved width/order, so
 * renaming one resets every founder's layout.
 */

import type { ColumnDef } from "@/components/data-table/types";
import type { FounderUnsubLogRow } from "@/lib/feed-api";
import {
  AccessWindowCell,
  Bar,
  EventBadge,
  ItemCell,
  LtvCell,
  MemberCell,
  PeriodCell,
  SessionCell,
  WhenCell,
} from "./unsubLogCells";

/* ── loading placeholders ───────────────────────────────────────────────── */

function StackSkeleton({ lines = 2 }: { lines?: number }) {
  const widths = ["w-24", "w-16", "w-14"];
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Bar
          key={i}
          w={widths[i] ?? "w-16"}
          h={i === 0 ? "h-3.5" : "h-2.5"}
          dim={i > 0}
        />
      ))}
    </div>
  );
}

function PersonSkeleton() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
      <div className="flex flex-col gap-1.5">
        <Bar w="w-24" />
        <Bar w="w-28" h="h-2.5" dim />
      </div>
    </div>
  );
}

function PillSkeleton({ w = "w-20" }: { w?: string }) {
  return (
    <div>
      <Bar w={w} h="h-5" rounded="rounded-full" dim />
    </div>
  );
}

/* ── columns ────────────────────────────────────────────────────────────── */

export function buildUnsubLogColumns({
  itemLabel,
  showSession,
}: {
  /** Singular name of the thing they left — heads the item column. */
  itemLabel: string;
  /**
   * Include the Session column.
   *
   * Only workshop events ever carry a `sessionDate` (a per-session cancel),
   * so on a Communities or Courses page this column would be a full height
   * of dashes.
   */
  showSession: boolean;
}): ColumnDef<FounderUnsubLogRow>[] {
  const columns: ColumnDef<FounderUnsubLogRow>[] = [
    {
      id: "member",
      header: "Member",
      width: 260,
      minWidth: 200,
      // Frozen so the row keeps its identity while the founder scrolls
      // sideways through period / access window / LTV. With no checkbox
      // column this is the grid's left edge.
      frozen: true,
      filterable: true,
      // Matched by the BACKEND (`search`, over name and email). Filtering
      // here would only ever search the page already in the browser.
      serverFiltered: true,
      skeleton: <PersonSkeleton />,
      cell: (r) => <MemberCell row={r} />,
    },
    {
      id: "item",
      header: itemLabel,
      width: 210,
      minWidth: 150,
      skeleton: <Bar w="w-28" />,
      // The BE fills channelTitle on channel events and workshopTitle on
      // workshop ones; whichever is present is this row's item.
      cell: (r) => <ItemCell title={r.workshopTitle || r.channelTitle} />,
    },
    {
      id: "event",
      header: "Event",
      width: 140,
      minWidth: 118,
      skeleton: <PillSkeleton w="w-24" />,
      cell: (r) => <EventBadge row={r} />,
    },
    {
      id: "period",
      header: "Period",
      width: 150,
      minWidth: 118,
      skeleton: <Bar w="w-20" />,
      cell: (r) => <PeriodCell row={r} />,
    },
    {
      id: "when",
      header: "When",
      width: 175,
      minWidth: 140,
      skeleton: <StackSkeleton lines={2} />,
      cell: (r) => <WhenCell row={r} />,
    },
  ];

  if (showSession) {
    columns.push({
      id: "session",
      header: "Session",
      width: 165,
      minWidth: 130,
      skeleton: <Bar w="w-24" />,
      cell: (r) => <SessionCell row={r} />,
    });
  }

  columns.push(
    {
      id: "accessWindow",
      header: "Access window",
      width: 220,
      minWidth: 170,
      skeleton: <StackSkeleton lines={2} />,
      cell: (r) => <AccessWindowCell row={r} />,
    },
    {
      id: "ltv",
      header: "LTV",
      width: 140,
      minWidth: 110,
      skeleton: <Bar w="w-20" />,
      cell: (r) => <LtvCell row={r} />,
    },
  );

  return columns;
}
