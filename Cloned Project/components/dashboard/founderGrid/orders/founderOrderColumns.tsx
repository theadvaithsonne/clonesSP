"use client";

/**
 * The columns of the founder Orders grid.
 *
 * One definition serving every item type the `/feed/founder/invoices`
 * endpoint supports — the only thing that varies per type is the header of
 * the item column ("Community", "Digital Product", …), passed in.
 *
 * TWO COLUMN SETS, TWO ROW TYPES
 *   Invoices   one row per invoice — who bought, which community, how much,
 *              what state the payment is in.
 *   Users      one row per buyer — the same money rolled up per customer.
 *
 * NO SELECTION COLUMN. Unlike the Live Streams grid (where the tick is the
 * Options control) a row here has exactly one action — open the invoice — so
 * there is nothing a checkbox could mean. `FounderOrdersTable`
 * deliberately does not pass `selectable`, which makes Invoice Number the
 * literal left edge of the grid.
 *
 * NO `sortable` FLAGS. `GET /feed/founder/invoices` sorts `createdAt: -1` and
 * accepts no sort parameter, and the grid paginates server-side — so a sort
 * control here could only reorder the 20 rows already in the browser while
 * claiming to have sorted 4,000. Add them the same day the endpoint learns
 * `sortBy`.
 *
 * Widths and ids are the contract with `localStorage`: the DataTable persists
 * widths/order per column id, so renaming an id silently resets everyone's
 * saved layout.
 */

import Link from "next/link";
import { ExternalLink, Users as UsersIcon } from "lucide-react";
import type { ColumnDef } from "@/components/data-table/types";
import type {
  FounderChannelInvoiceRow,
  FounderItemUserRow,
} from "@/lib/feed-api";
import {
  AmountCell,
  Bar,
  CreatedCell,
  CustomerCell,
  InvoiceNumberCell,
  InvoiceStatusBadge,
  ItemCell,
  TypeCell,
  UserStatusBadge,
  formatDate,
  formatMoney,
} from "./founderOrderCells";

/* ── loading placeholders ───────────────────────────────────────────────── */

/** Two stacked bars — the shape every "value over a note" cell renders. */
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

/** Avatar tile plus a name/email stack. */
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

/* ── invoices ───────────────────────────────────────────────────────────── */

export function buildFounderOrderColumns({
  itemLabel,
}: {
  /** Singular name of what was bought — heads the item column. */
  itemLabel: string;
}): ColumnDef<FounderChannelInvoiceRow>[] {
  return [
    {
      id: "invoiceNumber",
      header: "Invoice Number",
      width: 210,
      minWidth: 170,
      // Frozen so the row keeps its identity while the founder scrolls
      // sideways through amount/status/date. With no checkbox column this
      // is the grid's left edge.
      frozen: true,
      filterable: true,
      // Matched by the BACKEND (`search`, which also covers customer name +
      // email). Filtering here would only ever search the page already in
      // the browser, so a match two pages away would read as "no results".
      serverFiltered: true,
      skeleton: <StackSkeleton lines={2} />,
      cell: (r) => <InvoiceNumberCell row={r} />,
    },
    {
      id: "customer",
      header: "Customer",
      width: 250,
      minWidth: 190,
      skeleton: <PersonSkeleton />,
      cell: (r) => <CustomerCell name={r.customerName} email={r.customerEmail} />,
    },
    {
      // Id stays "community" whatever the header says: it's the localStorage
      // key for this column's saved width/order, and renaming it would reset
      // every founder's layout. The BE returns the item under the legacy
      // `channelTitle` alias for all four item types.
      id: "community",
      header: itemLabel,
      width: 210,
      minWidth: 150,
      skeleton: <Bar w="w-28" />,
      cell: (r) => <ItemCell title={r.channelTitle} />,
    },
    {
      id: "type",
      header: "Type",
      width: 140,
      minWidth: 118,
      skeleton: <PillSkeleton w="w-24" />,
      cell: (r) => <TypeCell row={r} />,
    },
    {
      id: "amount",
      header: "Amount",
      width: 160,
      minWidth: 130,
      skeleton: <StackSkeleton lines={2} />,
      cell: (r) => <AmountCell row={r} />,
    },
    {
      id: "status",
      header: "Status",
      width: 150,
      minWidth: 124,
      skeleton: <PillSkeleton />,
      cell: (r) => <InvoiceStatusBadge row={r} />,
    },
    {
      id: "created",
      header: "Created",
      width: 175,
      minWidth: 140,
      skeleton: <StackSkeleton lines={2} />,
      cell: (r) => <CreatedCell row={r} />,
    },
    {
      id: "open",
      header: "Open",
      width: 84,
      minWidth: 72,
      // Pinned right so the action stays reachable however wide the grid is
      // dragged — the same reason Invoice Number is pinned left.
      frozen: "right",
      skeleton: (
        <div className="h-7 w-7 animate-pulse rounded-lg bg-white/[0.06]" />
      ),
      cell: (r) => (
        <Link
          href={`/invoice/${r.invoiceNumber || r._id}`}
          target="_blank"
          rel="noopener noreferrer"
          // The row click already opens this invoice; without this the click
          // would fire both handlers and open two tabs.
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label="Open invoice"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];
}

/* ── users / customers ──────────────────────────────────────────────────── */

export function buildFounderCustomerColumns({
  itemLabelPlural,
}: {
  /** Plural name of what was bought — heads the "how many did they buy"
   *  column ("Communities", "Digital Products", "Courses"). */
  itemLabelPlural: string;
}): ColumnDef<FounderItemUserRow>[] {
  return [
    {
      id: "user",
      header: "User",
      width: 270,
      minWidth: 200,
      frozen: true,
      skeleton: <PersonSkeleton />,
      cell: (r) => (
        <CustomerCell name={r.name} email={r.email} picture={r.profilePicture} />
      ),
    },
    {
      // Id kept as "communities" for the same localStorage reason as the
      // invoice grid's item column.
      id: "communities",
      header: itemLabelPlural,
      width: 140,
      minWidth: 110,
      skeleton: <Bar w="w-8" />,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <UsersIcon className="h-3.5 w-3.5 shrink-0 text-white/40" />
          <span className="text-[14px] tabular-nums text-white/85">
            {r.itemCount.toLocaleString()}
          </span>
        </span>
      ),
    },
    {
      id: "invoices",
      header: "Total Invoices",
      width: 140,
      minWidth: 110,
      skeleton: <Bar w="w-8" />,
      // Gold is this console's "how many" accent, the same one the footer
      // counts use.
      cell: (r) => (
        <span className="text-[14px] font-semibold tabular-nums text-brand">
          {r.invoiceCount.toLocaleString()}
        </span>
      ),
    },
    {
      id: "lifetimeSpend",
      header: "Lifetime Spend",
      width: 170,
      minWidth: 140,
      skeleton: <Bar w="w-20" />,
      // Emerald is "how much" — so a spend figure is never read as a count.
      cell: (r) => (
        <span className="font-mono text-[14px] font-semibold text-[#10B981]">
          {formatMoney(r.totalPaid, r.currency || "USD")}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: 150,
      minWidth: 124,
      skeleton: <PillSkeleton />,
      cell: (r) => <UserStatusBadge row={r} />,
    },
    {
      id: "firstPurchase",
      header: "First Purchase",
      width: 165,
      minWidth: 130,
      skeleton: <Bar w="w-24" />,
      cell: (r) => (
        <span className="text-[14px] text-white/85">
          {formatDate(r.firstActivityAt)}
        </span>
      ),
    },
    {
      id: "lastPurchase",
      header: "Last Purchase",
      width: 165,
      minWidth: 130,
      skeleton: <Bar w="w-24" />,
      cell: (r) => (
        <span className="text-[14px] text-white/85">
          {formatDate(r.lastActivityAt)}
        </span>
      ),
    },
  ];
}
