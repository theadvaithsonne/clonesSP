"use client";

/**
 * The columns of the founder Live Streams grid.
 *
 * THREE COLUMN SETS, ONE ROW TYPE
 *   One Time              every column — each row is a different stream, so
 *                         name, communities and price all differ per row.
 *   Recurring · per       the sessions of one series, each bought separately:
 *   session               drop name/communities (identical on every row, and
 *                         printed once in the header above the table), keep
 *                         Payment and the enrolment columns, since a session
 *                         is its own sale.
 *   Recurring · one time  same, minus every enrolment column. The series is
 *   enrollment            bought once, so its price, enrolments, revenue and
 *                         affiliate split are series facts and live in the
 *                         header. Repeating one series-wide figure down 45
 *                         rows reads as 45 separate sales.
 *
 * Widths and ids are the contract with two other things: `localStorage` (the
 * DataTable persists widths/order per column id) and the backend's `sortBy`
 * (which switches on these same ids). Renaming an id resets everyone's saved
 * layout and silently drops server-side sorting to the default, so treat the
 * ids as stable.
 */

import type { ColumnDef } from "@/components/data-table/types";
import type { FounderStreamRow } from "@/lib/feed-api";
import { getCountryFlag } from "@/lib/country-flag";
import {
  Avatar,
  CommunitiesCell,
  Stack,
  StatusBadge,
  StreamThumb,
  currencyFlag,
  formatClock,
  formatDuration,
  formatLongDate,
  formatPrice,
  formatShortDate,
  formatUsd,
  timezoneAbbr,
} from "./founderStreamCells";

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ── loading placeholders ───────────────────────────────────────────────── */

/** One shimmer bar. `w` is a Tailwind width class so the skeleton can echo the
 *  rough length of the text it stands in for. */
function Bar({ w, h = "h-3.5", dim }: { w: string; h?: string; dim?: boolean }) {
  return (
    <div
      className={`${h} ${w} animate-pulse rounded ${
        dim ? "bg-white/[0.04]" : "bg-white/[0.08]"
      }`}
    />
  );
}

/** The two- and three-line stacks columns 11–15 render. */
function StackSkeleton({ lines = 2 }: { lines?: number }) {
  const widths = ["w-16", "w-20", "w-14"];
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} w={widths[i] ?? "w-16"} h={i === 0 ? "h-3.5" : "h-2.5"} dim={i > 0} />
      ))}
    </div>
  );
}

/** Single value, left-aligned like the metric columns it stands in for. */
function MetricSkeleton() {
  return <div className="h-3.5 w-10 animate-pulse rounded bg-white/[0.06]" />;
}

/** Which table is being built. The recurring sets differ by enrolment type —
 *  see the header comment. */
export type FounderColumnVariant =
  | { view: "one-time" }
  | { view: "recurring"; enrollmentType: "once" | "per_session" };

export function buildFounderStreamColumns(
  variant: FounderColumnVariant = { view: "one-time" },
): ColumnDef<FounderStreamRow>[] {
  const all = columnMap();
  if (variant.view === "one-time") {
    return [
      all.name,
      all.host,
      all.communities,
      all.dateTime,
      all.status,
      all.payment,
      all.totalEnrollments,
      all.totalAttendees,
      all.garageTvViews,
      all.enrollmentRevenue,
      all.enrollmentAffiliateStats,
      all.liveSellingProducts,
      all.liveSellingStats,
      all.liveSellingAffiliates,
    ];
  }

  if (variant.enrollmentType === "per_session") {
    return [
      all.session,
      all.dateTime,
      all.host,
      all.status,
      all.payment,
      all.totalEnrollments,
      all.totalAttendees,
      all.garageTvViews,
      all.enrollmentRevenue,
      all.enrollmentAffiliateStats,
      all.liveSellingProducts,
      all.liveSellingStats,
      all.liveSellingAffiliates,
    ];
  }

  // Enrol-once: no Payment, no enrolment columns. What's left is what a single
  // session actually produced on its own — who turned up and what was sold.
  return [
    all.session,
    all.dateTime,
    all.host,
    all.status,
    all.totalAttendees,
    all.garageTvViews,
    all.liveSellingProducts,
    all.liveSellingStats,
    all.liveSellingAffiliates,
  ];
}

function columnMap(): Record<string, ColumnDef<FounderStreamRow>> {
  return {
    // Recurring views only. Replaces Name: every row is the same stream, so a
    // repeated title carried no information — the position in the series is
    // the only identity a session row has, and the series is named in the
    // header above the table.
    session: {
      id: "session",
      header: "Session #",
      // Wider than the number needs, because a session that has been given its
      // own title has nowhere else to show it: the recurring views drop the
      // Name column on the grounds that every row is the same stream, which
      // stopped being true once sessions could be edited individually.
      width: 190,
      minWidth: 110,
      sortable: true,
      frozen: true,
      skeleton: <Bar w="w-6" />,
      cell: (r) => (
        <div className="flex flex-col gap-1">
          <span className="text-[14px] tabular-nums text-white/85">
            {r.sessionNumber ?? "—"}
          </span>
          {/* Only when it differs from the series — printing the shared title
              on all 45 rows is exactly what this column exists to avoid. */}
          {r.isEdited && r.title && (
            <span className="line-clamp-2 text-[12px] text-white/60">
              {r.title}
            </span>
          )}
          {r.isEdited && (
            <span className="inline-flex w-fit items-center rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Edited
            </span>
          )}
        </div>
      ),
    },
    name: {
      id: "name",
      header: "Name",
      width: 260,
      minWidth: 200,
      sortable: true,
      filterable: true,
      // Matched by the backend, not here — the grid paginates server-side, so
      // a client-side accessor would only ever search the visible page.
      serverFiltered: true,
      frozen: true,
      skeleton: (
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/[0.08]" />
          <div className="flex flex-col gap-1.5">
            <Bar w="w-28" />
            <Bar w="w-20" h="h-2.5" dim />
          </div>
        </div>
      ),
      cell: (r) => (
        <div className="flex items-start gap-2.5">
          <StreamThumb src={r.thumbnail} title={r.title} />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[14px] font-medium text-white">
              {r.title}
            </div>
            {/* A session row needs its position in the series, or every row
                in the recurring view reads as the same stream. A tag rather
                than plain text: it's an identifier, not a description. */}
            {r.sessionNumber != null && (
              <span className="mt-1 inline-flex items-center rounded-full bg-[rgba(114,114,114,0.32)] px-2 py-0.5 text-[11px] font-semibold text-white/75">
                Session {r.sessionNumber}
                {r.schedule.totalSessions
                  ? ` / ${r.schedule.totalSessions}`
                  : ""}
              </span>
            )}
          </div>
        </div>
      ),
    },
    host: {
      id: "host",
      header: "Host",
      width: 220,
      minWidth: 180,
      sortable: true,
      filterable: true,
      serverFiltered: true,
      skeleton: (
        <div className="flex items-start gap-2.5">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="flex flex-col gap-1.5">
            <Bar w="w-24" />
            <Bar w="w-28" h="h-2.5" dim />
            <Bar w="w-20" h="h-2.5" dim />
          </div>
        </div>
      ),
      cell: (r) =>
        r.host ? (
          <div className="flex items-start gap-2.5">
            <Avatar
              src={r.host.profilePicture}
              name={r.host.name || r.host.email}
              className="h-8 w-8"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-white/90">
                {r.host.name || "—"}
              </div>
              <div className="truncate text-[13px] text-white/50">
                {r.host.email}
              </div>
              {r.host.phone && (
                <div className="mt-1 flex items-center gap-1.5 text-[13px] text-white/60">
                  <span>{getCountryFlag(r.host.country || null)}</span>
                  <span className="truncate">{r.host.phone}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="text-[13px] text-white/35">—</span>
        ),
    },
    communities: {
      id: "communities",
      header: "Communities",
      width: 180,
      minWidth: 150,
      filterable: true,
      serverFiltered: true,
      // Two lines plus the "+ N More" pill — the same shape the cell renders.
      skeleton: (
        <div className="flex flex-col gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded-[5px] bg-white/[0.08]" />
              <Bar w={i === 0 ? "w-20" : "w-16"} h="h-2.5" dim />
            </div>
          ))}
          <div className="h-4 w-16 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      ),
      cell: (r) => <CommunitiesCell row={r} />,
    },
    dateTime: {
      id: "dateTime",
      header: "Date/Time",
      width: 220,
      minWidth: 180,
      sortable: true,
      // Three lines: the recurring session rows are the tallest case, and a
      // skeleton shorter than the content it becomes makes the row jump.
      skeleton: <StackSkeleton lines={3} />,
      cell: (r) => {
        // Resolved at the ROW's date, not today's: a zone that observes DST
        // changes name mid-series, and the label has to match the session.
        const tz = timezoneAbbr(r.schedule.timezone, r.schedule.date);
        const duration = formatDuration(
          r.schedule.startTime,
          r.schedule.endTime,
        );

        // A recurring SESSION row. Date, window, zone — one fact per line.
        // The cadence ("Every Tuesday") used to lead here; it's the same
        // sentence on every row of a series, and the dates themselves spell
        // out the rule, so the line was spent restating what the column
        // already showed.
        if (r.sessionDate) {
          return (
            <Stack
              lines={[
                { text: formatLongDate(r.schedule.date), tone: "primary" },
                {
                  text: `${formatClock(r.schedule.startTime)} - ${formatClock(
                    r.schedule.endTime,
                  )}`,
                },
                { text: duration ? `${tz} (${duration})` : tz },
                // A moved session shows a date the recurrence rule never
                // produced, so the slot it still belongs to has to be visible
                // — that date is what its enrolments and join links use.
                ...(r.rescheduledFrom
                  ? [
                      {
                        text: `Moved from ${formatShortDate(r.rescheduledFrom)}`,
                      },
                    ]
                  : []),
              ]}
            />
          );
        }

        // A recurring SERIES row (no session pinned) shows the rule and where
        // the series goes next.
        if (r.isRecurring) {
          const next = r.schedule.nextSessionDate;
          return (
            <Stack
              lines={[
                {
                  text: [
                    r.schedule.recurrenceLabel || "Recurring",
                    next ? `Next: ${formatShortDate(next)}` : "No sessions left",
                  ].join(" • "),
                  tone: "primary",
                },
                {
                  text: `${formatClock(r.schedule.startTime)} ${tz}${
                    duration ? ` (${duration})` : ""
                  }`,
                },
              ]}
            />
          );
        }
        return (
          <Stack
            lines={[
              { text: formatLongDate(r.schedule.date), tone: "primary" },
              {
                text: `${formatClock(r.schedule.startTime)} - ${formatClock(
                  r.schedule.endTime,
                )} ${tz}`,
              },
            ]}
          />
        );
      },
    },
    status: {
      id: "status",
      header: "Status",
      width: 130,
      // "Yet To Start" is ~94px of pill plus the cell's px-3 gutters. The cell
      // clips its overflow, so a 110px floor would shave the pill's edge once
      // someone dragged the column narrow.
      minWidth: 124,
      // No align:"center" here or on the metric columns below. The header row
      // is always left-aligned, so a centred value sat off to the right of the
      // label naming it — in a 130px column that reads as belonging to the
      // neighbouring column.
      sortable: true,
      skeleton: (
        <div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      ),
      cell: (r) => <StatusBadge status={r.status} />,
    },
    payment: {
      id: "payment",
      header: "Payment",
      width: 120,
      minWidth: 100,
      sortable: true,
      skeleton: <StackSkeleton lines={2} />,
      cell: (r) =>
        r.payment.isFree ? (
          <span className="text-[14px] text-white/70">Free</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-white/90">
              {formatPrice(r.payment.price, r.payment.currency)}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] text-white/50">
              <span>{currencyFlag(r.payment.currency)}</span>
              {r.payment.currency}
            </span>
          </div>
        ),
    },
    totalEnrollments: {
      id: "totalEnrollments",
      skeleton: <MetricSkeleton />,
      header: "Total Enrollments",
      width: 130,
      minWidth: 100,
      sortable: true,
      cell: (r) => (
        <span className="text-[14px] tabular-nums text-white/85">
          {r.totalEnrollments.toLocaleString()}
        </span>
      ),
    },
    totalAttendees: {
      id: "totalAttendees",
      skeleton: <MetricSkeleton />,
      header: "Total Attendees",
      width: 130,
      minWidth: 100,
      sortable: true,
      cell: (r) => (
        <span className="text-[14px] tabular-nums text-white/85">
          {r.totalAttendees.toLocaleString()}
        </span>
      ),
    },
    garageTvViews: {
      id: "garageTvViews",
      skeleton: <MetricSkeleton />,
      header: "GarageTV Views",
      width: 130,
      minWidth: 100,
      sortable: true,
      cell: (r) => (
        <span className="text-[14px] tabular-nums text-white/85">
          {r.garageTvViews.toLocaleString()}
        </span>
      ),
    },
    enrollmentRevenue: {
      id: "enrollmentRevenue",
      skeleton: <StackSkeleton lines={2} />,
      header: "Enrollment Revenue",
      width: 160,
      minWidth: 140,
      sortable: true,
      cell: (r) => (
        <Stack
          lines={[
            { text: formatUsd(r.enrollmentRevenue.amountUsd), tone: "money" },
            { text: plural(r.enrollmentRevenue.transactions, "Transaction") },
          ]}
        />
      ),
    },
    enrollmentAffiliateStats: {
      id: "enrollmentAffiliateStats",
      skeleton: <StackSkeleton lines={3} />,
      header: "Enrollment Affiliate Stats",
      width: 170,
      minWidth: 150,
      sortable: true,
      cell: (r) => (
        <Stack
          lines={[
            { text: formatUsd(r.enrollmentAffiliate.amountUsd), tone: "money" },
            { text: plural(r.enrollmentAffiliate.affiliates, "Affiliate") },
            { text: plural(r.enrollmentAffiliate.payments, "Payment") },
          ]}
        />
      ),
    },
    liveSellingProducts: {
      id: "liveSellingProducts",
      skeleton: <StackSkeleton lines={2} />,
      header: "Live Selling Products",
      width: 160,
      minWidth: 140,
      sortable: true,
      cell: (r) => (
        <Stack
          lines={[
            { text: plural(r.liveSellingProducts.products, "Product"), tone: "primary" },
            { text: plural(r.liveSellingProducts.customers, "Customer") },
          ]}
        />
      ),
    },
    liveSellingStats: {
      id: "liveSellingStats",
      skeleton: <StackSkeleton lines={3} />,
      header: "Live Selling Stats",
      width: 170,
      minWidth: 150,
      sortable: true,
      cell: (r) => (
        <Stack
          lines={[
            { text: formatUsd(r.liveSellingStats.revenueUsd), tone: "money" },
            { text: plural(r.liveSellingStats.auctions, "Auction") },
            { text: plural(r.liveSellingStats.standardSales, "Standard Sale") },
          ]}
        />
      ),
    },
    liveSellingAffiliates: {
      id: "liveSellingAffiliates",
      skeleton: <StackSkeleton lines={3} />,
      header: "Live Selling Affiliates",
      width: 170,
      minWidth: 150,
      sortable: true,
      cell: (r) => (
        <Stack
          lines={[
            { text: formatUsd(r.liveSellingAffiliates.amountUsd), tone: "money" },
            { text: plural(r.liveSellingAffiliates.affiliates, "Affiliate") },
            { text: plural(r.liveSellingAffiliates.payments, "Payment") },
          ]}
        />
      ),
    },
  };
}
