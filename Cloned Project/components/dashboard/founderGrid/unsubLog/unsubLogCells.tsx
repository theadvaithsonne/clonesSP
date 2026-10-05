"use client";

/**
 * Cell renderers + formatters for the founder Unsub Log grid.
 *
 * Split out of the column definitions so the table and the footer strip
 * format the same event the same way.
 */

import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Repeat,
  User as UserIcon,
} from "lucide-react";
import type { FounderUnsubLogRow } from "@/lib/feed-api";
import { GLASS_STYLE } from "../tokens";

/* ── formatting ─────────────────────────────────────────────────────────── */

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Today" / "Yesterday" / "12d ago" — the second line of the When cell.
 *  How long ago someone left is the thing a founder actually scans for. */
export function relativeDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

/**
 * Lifetime value.
 *
 * `lifetimeValueUsdSnapshot` is frozen on the event at the moment it fired,
 * so the log reads the same way it did that day even if the user goes on
 * spending. Rendered in plain dollars — that is the unit the channel/workshop
 * writer stores.
 */
export function formatLtv(amount: number): string {
  return (amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ── cells ──────────────────────────────────────────────────────────────── */

/** The person who left. Name falls back to email, then "Unknown" — a blank
 *  first column would make the row look like a loading artefact. */
export function MemberCell({ row }: { row: FounderUnsubLogRow }) {
  const displayName = row.customerName || row.customerEmail || "Unknown";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={GLASS_STYLE}
      >
        <UserIcon className="h-3.5 w-3.5 text-white/45" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-white/90">
          {displayName}
        </div>
        {row.customerEmail && (
          <div className="truncate text-[13px] text-white/50">
            {row.customerEmail}
          </div>
        )}
      </div>
    </div>
  );
}

/** What they left — the community or the live stream. */
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

/**
 * Cancelled vs Expired.
 *
 * Amber for a cancel (the member chose to go), zinc for an expiry (the cycle
 * simply ran out). Different problems, so they must not look the same.
 */
export function EventBadge({ row }: { row: FounderUnsubLogRow }) {
  const isCancel = row.eventType === "unsubscribed";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-[18px] ${
        isCancel
          ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
          : "border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
      }`}
    >
      {isCancel ? "Cancelled" : "Expired"}
    </span>
  );
}

/** What they were paying — recurring period, one-time, or free. */
export function PeriodCell({ row }: { row: FounderUnsubLogRow }) {
  if (row.channelKind === "recurring") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-white/85">
        <Repeat className="h-3 w-3 shrink-0 text-blue-400" />
        <span className="capitalize">
          {row.subscriptionPeriod || "Recurring"}
        </span>
      </span>
    );
  }
  if (row.channelKind === "one_time") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-white/85">
        <DollarSign className="h-3 w-3 shrink-0 text-emerald-400" />
        One-time
      </span>
    );
  }
  return <span className="text-[13px] text-white/40">Free</span>;
}

export function WhenCell({ row }: { row: FounderUnsubLogRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[14px] text-white/85">
        <Calendar className="h-3 w-3 shrink-0 text-white/40" />
        {formatDate(row.occurredAt)}
      </span>
      <span className="text-[12px] text-white/40">
        {relativeDay(row.occurredAt) || ""}
      </span>
    </div>
  );
}

/** Populated only for per-session workshop cancels — which session in the
 *  recurrence they walked away from. Everything else shows a dash so the
 *  column still reads consistently. */
export function SessionCell({ row }: { row: FounderUnsubLogRow }) {
  if (!row.sessionDate) {
    return <span className="text-[13px] text-white/35">—</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-violet-300">
      <Calendar className="h-3 w-3 shrink-0 text-violet-400/70" />
      {formatDate(row.sessionDate)}
    </span>
  );
}

/**
 * How much of what they paid for they actually used.
 *
 * For a recurring member, days used plus days still left at the moment they
 * cancelled — the second number is what they're owed access to. For anything
 * else, just how long they were a member.
 */
export function AccessWindowCell({ row }: { row: FounderUnsubLogRow }) {
  const isCancel = row.eventType === "unsubscribed";
  const recurring = row.channelKind === "recurring";
  return (
    <div className="flex flex-col gap-0.5">
      {recurring ? (
        <span className="flex items-center gap-1.5 text-[13px] text-white/85">
          <Clock className="h-3 w-3 shrink-0 text-white/40" />
          <span>{row.activeDaysUsed ?? 0}d used</span>
          {isCancel &&
            row.activeDaysLeftAtCancel !== null &&
            row.activeDaysLeftAtCancel > 0 && (
              <>
                <ArrowRight className="h-3 w-3 shrink-0 text-white/40" />
                <span className="text-amber-300">
                  {row.activeDaysLeftAtCancel}d left
                </span>
              </>
            )}
        </span>
      ) : row.activeDaysUsed !== null ? (
        <span className="flex items-center gap-1.5 text-[13px] text-white/85">
          <Clock className="h-3 w-3 shrink-0 text-white/40" />
          {row.activeDaysUsed}d as member
        </span>
      ) : (
        <span className="text-[13px] text-white/35">—</span>
      )}
      {row.accessUntil && recurring && (
        <span className="text-[12px] text-white/40">
          {isCancel ? "Ends" : "Ended"} {formatDate(row.accessUntil)}
        </span>
      )}
    </div>
  );
}

export function LtvCell({ row }: { row: FounderUnsubLogRow }) {
  return (
    <span className="flex items-center gap-0.5 font-mono text-[14px] font-semibold text-[#10B981]">
      <DollarSign className="h-3 w-3 shrink-0 text-white/40" />
      {formatLtv(row.lifetimeValueUsdSnapshot)}
    </span>
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
