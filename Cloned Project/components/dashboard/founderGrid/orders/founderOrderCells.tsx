"use client";

/**
 * Cell renderers + formatters for the founder Orders grid (Communities and
 * Digital Products today; the endpoint also serves courses and workshops).
 *
 * Split out of the column definitions (mirroring `liveStreams/
 * founderStreamCells.tsx`) so the table, the CSV export and the footer
 * strip all format the same invoice the same way — a row that reads
 * "₹4,999.00" and a CSV column that reads "4999" is the kind of mismatch
 * that turns into a support ticket.
 */

import type { ReactNode } from "react";
import {
  Building2,
  DollarSign,
  Repeat,
  User as UserIcon,
} from "lucide-react";
import type {
  ChannelInvoiceStatus,
  FounderChannelInvoiceRow,
  FounderItemUserRow,
} from "@/lib/feed-api";
import { GLASS_STYLE } from "../tokens";

// Re-exported so the columns/table files keep one import site for everything
// visual, rather than reaching past this module for the token.
export { GLASS_STYLE };

/* ── formatting ─────────────────────────────────────────────────────────── */

/**
 * Amounts on Invoice are stored in the smallest unit (paise/cents) — see
 * invoice.model.ts:113. `Intl.NumberFormat` handles the currency symbol per
 * row's native currency, no manual $/₹ switching.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format((amountMinor || 0) / 100);
  } catch {
    return `${((amountMinor || 0) / 100).toFixed(2)} ${currency || ""}`.trim();
  }
}

export function formatDate(
  iso: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(
    "en-US",
    opts ?? { month: "short", day: "numeric", year: "numeric" },
  );
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Money totals across rows that may not share a currency.
 *
 * A founder selling in both USD and INR has no single "total" — adding
 * 4999 paise to 49 dollars produces a number that is wrong in both
 * currencies. So sum per currency and print them side by side.
 */
export function sumByCurrency(
  entries: Array<{ amount: number; currency: string | null }>,
): string {
  const byCurrency = new Map<string, number>();
  for (const e of entries) {
    const cur = (e.currency || "USD").toUpperCase();
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (e.amount || 0));
  }
  if (byCurrency.size === 0) return formatMoney(0, "USD");
  return Array.from(byCurrency.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cur, amt]) => formatMoney(amt, cur))
    .join(" · ");
}

/* ── status ─────────────────────────────────────────────────────────────── */

/**
 * Invoice status → badge colour.
 *
 * Emerald paid, amber awaiting payment (`draft` and `pending` are the same
 * thing from a founder's POV — see the BE's `$in: ["draft","pending"]`
 * branch), zinc cancelled, rose failed/expired, blue refunded.
 */
export function statusBadgeClass(status: ChannelInvoiceStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "pending":
    case "draft":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "cancelled":
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    case "failed":
    case "expired":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    case "refunded":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

export function userStatusBadgeClass(
  status: FounderItemUserRow["status"],
): string {
  switch (status) {
    case "active":
    case "paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "cancelling":
    case "pending":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "expired":
    case "refunded":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

/** A pill. `whitespace-nowrap` is load-bearing — the cell clips its overflow,
 *  and a wrapped label would render twice as tall as every other row's. */
export function Pill({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize leading-[18px] ${className}`}
    >
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ row }: { row: FounderChannelInvoiceRow }) {
  return (
    <div className="flex flex-col gap-1">
      <Pill className={statusBadgeClass(row.status)}>
        {/* Row-level relabel of "draft" → "Pending", matching the Status
            filter pills and the recurring-cycle timeline elsewhere. */}
        {row.status === "draft" ? "Pending" : row.status}
      </Pill>
      {row.cancelledAt && (
        <span className="text-[12px] text-white/40">
          {formatDate(row.cancelledAt)}
        </span>
      )}
    </div>
  );
}

export function UserStatusBadge({ row }: { row: FounderItemUserRow }) {
  return <Pill className={userStatusBadgeClass(row.status)}>{row.status}</Pill>;
}

/* ── cells ──────────────────────────────────────────────────────────────── */

export function InvoiceNumberCell({ row }: { row: FounderChannelInvoiceRow }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="truncate font-mono text-[13px] font-semibold text-white">
        {row.invoiceNumber || "—"}
      </span>
      {row.recurringPaymentNumber && (
        <span className="text-[12px] text-white/40">
          Cycle {row.recurringPaymentNumber}
          {row.parentInvoiceId ? "" : " (root)"}
        </span>
      )}
    </div>
  );
}

/** The buyer. No profile picture on the invoice row, so the icon tile is the
 *  avatar — same frosted tile the Live Streams grid falls back to. */
export function CustomerCell({
  name,
  email,
  picture,
}: {
  name: string | null;
  email: string | null;
  picture?: string | null;
}) {
  return (
    // items-center, not items-start: the row centres its content vertically,
    // so an avatar pinned to the top of a two-line name/email stack would sit
    // half a line above the text it belongs to.
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full"
        style={GLASS_STYLE}
      >
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-3.5 w-3.5 text-white/45" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-white/90">
          {name || "—"}
        </div>
        <div className="truncate text-[13px] text-white/50">{email || "—"}</div>
      </div>
    </div>
  );
}

/** The thing that was bought — a community, a digital product, a course. */
export function ItemCell({ title }: { title: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
      <span className="truncate text-[14px] text-white/85" title={title || ""}>
        {title || "—"}
      </span>
    </span>
  );
}

export function TypeCell({ row }: { row: FounderChannelInvoiceRow }) {
  return row.isRecurring ? (
    <Pill className="border-blue-500/30 bg-blue-500/15 text-blue-300">
      <Repeat className="h-3 w-3 shrink-0" />
      {row.recurringPeriod || "recurring"}
    </Pill>
  ) : (
    <Pill className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
      <DollarSign className="h-3 w-3 shrink-0" />
      One-time
    </Pill>
  );
}

export function AmountCell({ row }: { row: FounderChannelInvoiceRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[14px] font-semibold text-white/90">
        {formatMoney(row.totalAmount, row.itemCurrency)}
      </span>
      {/* Only when the buyer was actually charged in a different currency —
          otherwise this line restates the number above it. */}
      {row.paymentCurrency && row.paymentCurrency !== row.itemCurrency && (
        <span className="text-[12px] text-white/40">
          Paid in {row.paymentCurrency}
        </span>
      )}
    </div>
  );
}

export function CreatedCell({ row }: { row: FounderChannelInvoiceRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[14px] text-white/85">
        {formatDate(row.createdAt)}
      </span>
      {row.paidAt && (
        <span className="text-[12px] text-emerald-400/70">
          Paid {formatDate(row.paidAt)}
        </span>
      )}
    </div>
  );
}

/* ── shimmer ────────────────────────────────────────────────────────────── */

/** One shimmer bar. `w` is a Tailwind width class so the skeleton can echo
 *  the rough length of the text it stands in for. */
export function Bar({
  w,
  h = "h-3.5",
  dim,
  rounded = "rounded",
}: {
  w: string;
  h?: string;
  dim?: boolean;
  rounded?: string;
}) {
  return (
    <div
      className={`${h} ${w} ${rounded} animate-pulse ${
        dim ? "bg-white/[0.04]" : "bg-white/[0.08]"
      }`}
    />
  );
}
