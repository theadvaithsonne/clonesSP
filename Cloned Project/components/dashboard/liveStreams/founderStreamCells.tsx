"use client";

/**
 * Cell renderers for the founder Live Streams grid.
 *
 * Split out of the column definitions so the table, the CSV export and the
 * options drawer can all render the same badge for the same status — a row
 * that says "Completed" and a drawer that offers "Start" is the kind of
 * contradiction that costs a founder a live session.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Activity, CheckCircle2, Hourglass, Trash2, Video } from "lucide-react";
import { getCountryFlag } from "@/lib/country-flag";
import type { FounderStreamRow, FounderStreamStatus } from "@/lib/feed-api";

/* ── formatting ─────────────────────────────────────────────────────────── */

export function formatUsd(amount: number): string {
  return `$${(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Money in the stream's own currency — the Payment column shows what the
 *  buyer is actually charged, not a USD conversion of it. */
export function formatPrice(amount: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Currencies map to an issuing country for the flag; anything unmapped
 *  falls back to the globe rather than rendering a wrong flag. */
const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "US",
  INR: "IN",
  GBP: "GB",
  EUR: "EU",
  AED: "AE",
  CAD: "CA",
  AUD: "AU",
  SGD: "SG",
};

export function currencyFlag(currency: string): string {
  const code = CURRENCY_COUNTRY[currency?.toUpperCase()];
  return code ? getCountryFlag(code) : "🌍";
}

/** "Tuesday, March 10th 2026" — the first line of the Date/Time cell. */
export function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)} ${d.getFullYear()}`;
}

/** "Mar 10" — the compact form used inside a recurrence rule. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/** "7:00 PM" from a stored "19:00". */
export function formatClock(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`;
}

/**
 * Zones English has no abbreviation for, so `Intl` falls back to an offset.
 *
 * `timeZoneName: "short"` only knows the North American abbreviations; ask it
 * for Asia/Kolkata and it answers "GMT+5:30", which is correct and useless —
 * the founder set the zone as India and expects to read IST. Anything absent
 * from this table keeps whatever Intl returns, so US zones still get their
 * real EST/EDT distinction for free.
 *
 * `dst` is only set where the zone actually observes it AND changes name.
 */
const ZONE_ABBR: Record<string, { std: string; dst?: string }> = {
  "Asia/Kolkata": { std: "IST" },
  "Asia/Calcutta": { std: "IST" },
  "Asia/Karachi": { std: "PKT" },
  "Asia/Dhaka": { std: "BST" },
  "Asia/Kathmandu": { std: "NPT" },
  "Asia/Colombo": { std: "IST" },
  "Asia/Dubai": { std: "GST" },
  "Asia/Riyadh": { std: "AST" },
  "Asia/Jerusalem": { std: "IST", dst: "IDT" },
  "Asia/Singapore": { std: "SGT" },
  "Asia/Hong_Kong": { std: "HKT" },
  "Asia/Shanghai": { std: "CST" },
  "Asia/Tokyo": { std: "JST" },
  "Asia/Seoul": { std: "KST" },
  "Asia/Jakarta": { std: "WIB" },
  "Asia/Manila": { std: "PHT" },
  "Asia/Bangkok": { std: "ICT" },
  "Europe/London": { std: "GMT", dst: "BST" },
  "Europe/Dublin": { std: "GMT", dst: "IST" },
  "Europe/Lisbon": { std: "WET", dst: "WEST" },
  "Europe/Paris": { std: "CET", dst: "CEST" },
  "Europe/Berlin": { std: "CET", dst: "CEST" },
  "Europe/Madrid": { std: "CET", dst: "CEST" },
  "Europe/Rome": { std: "CET", dst: "CEST" },
  "Europe/Amsterdam": { std: "CET", dst: "CEST" },
  "Europe/Brussels": { std: "CET", dst: "CEST" },
  "Europe/Vienna": { std: "CET", dst: "CEST" },
  "Europe/Zurich": { std: "CET", dst: "CEST" },
  "Europe/Stockholm": { std: "CET", dst: "CEST" },
  "Europe/Oslo": { std: "CET", dst: "CEST" },
  "Europe/Copenhagen": { std: "CET", dst: "CEST" },
  "Europe/Warsaw": { std: "CET", dst: "CEST" },
  "Europe/Prague": { std: "CET", dst: "CEST" },
  "Europe/Budapest": { std: "CET", dst: "CEST" },
  "Europe/Athens": { std: "EET", dst: "EEST" },
  "Europe/Helsinki": { std: "EET", dst: "EEST" },
  "Europe/Bucharest": { std: "EET", dst: "EEST" },
  "Europe/Kyiv": { std: "EET", dst: "EEST" },
  "Europe/Kiev": { std: "EET", dst: "EEST" },
  "Europe/Istanbul": { std: "TRT" },
  "Europe/Moscow": { std: "MSK" },
  "Africa/Cairo": { std: "EET", dst: "EEST" },
  "Africa/Lagos": { std: "WAT" },
  "Africa/Nairobi": { std: "EAT" },
  "Africa/Johannesburg": { std: "SAST" },
  "Australia/Sydney": { std: "AEST", dst: "AEDT" },
  "Australia/Melbourne": { std: "AEST", dst: "AEDT" },
  "Australia/Brisbane": { std: "AEST" },
  "Australia/Adelaide": { std: "ACST", dst: "ACDT" },
  "Australia/Perth": { std: "AWST" },
  "Pacific/Auckland": { std: "NZST", dst: "NZDT" },
  "America/Sao_Paulo": { std: "BRT" },
  "America/Argentina/Buenos_Aires": { std: "ART" },
  "America/Bogota": { std: "COT" },
  "America/Lima": { std: "PET" },
  "America/Santiago": { std: "CLT", dst: "CLST" },
};

/** Minutes a zone is offset from UTC at a given instant. */
function offsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  // Drop sub-second precision on both sides or the difference carries the
  // instant's milliseconds and never lands on a whole minute.
  return (local - Math.floor(at.getTime() / 1000) * 1000) / 60000;
}

/** Whether `tz` is on daylight time at `at` — the zone's offset that day is
 *  its larger of the two it uses across the year. */
function isDaylight(tz: string, at: Date): boolean {
  const year = at.getUTCFullYear();
  const jan = offsetMinutes(tz, new Date(Date.UTC(year, 0, 1)));
  const jul = offsetMinutes(tz, new Date(Date.UTC(year, 6, 1)));
  if (jan === jul) return false;
  return offsetMinutes(tz, at) === Math.max(jan, jul);
}

/**
 * The short zone label for a stream ("IST", "EST", "BST").
 *
 * `at` is the session's own instant, not now: a London series shows GMT for
 * its January sessions and BST for its July ones, which is what the founder
 * will actually be working to.
 */
export function timezoneAbbr(tz: string, at?: string | Date): string {
  if (!tz) return "";
  try {
    const when = at ? new Date(at) : new Date();
    const instant = Number.isNaN(when.getTime()) ? new Date() : when;

    const intl =
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
      })
        .formatToParts(instant)
        .find((p) => p.type === "timeZoneName")?.value || tz;

    // Intl only falls back to an offset when it has no name to give, so an
    // entry in our table is an improvement; otherwise Intl already won.
    if (!/^(GMT|UTC)[+-]/.test(intl)) return intl;

    const mapped = ZONE_ABBR[tz];
    if (!mapped) return intl;
    return mapped.dst && isDaylight(tz, instant) ? mapped.dst : mapped.std;
  } catch {
    // An unknown IANA name would throw — show the raw string rather than
    // dropping the timezone entirely, which would make two streams an hour
    // apart look identical.
    return tz;
  }
}

/** "1 hr", "90 min" — the window length, for the recurring Date/Time line. */
export function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = (startTime || "0:0").split(":").map(Number);
  const [eh, em] = (endTime || "0:0").split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return "";
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  if (mins % 60 === 0) {
    const hrs = mins / 60;
    return `${hrs} hr${hrs === 1 ? "" : "s"}`;
  }
  return `${mins} min`;
}

/* ── status ─────────────────────────────────────────────────────────────── */

const STATUS_META: Record<
  FounderStreamStatus,
  { label: string; icon: typeof Activity; tone: string; muted?: boolean }
> = {
  active: { label: "Active", icon: Activity, tone: "text-brand" },
  completed: { label: "Completed", icon: CheckCircle2, tone: "text-[#22C55E]" },
  deleted: { label: "Deleted", icon: Trash2, tone: "text-[#F43F5E]" },
  not_started: {
    label: "Yet To Start",
    icon: Hourglass,
    tone: "text-white/40",
    muted: true,
  },
};

/** The label/icon/tone behind a status, for anything that needs to render one
 *  outside a table cell (the recurring view's series header chip). */
export function statusMeta(status: FounderStreamStatus) {
  return STATUS_META[status] ?? STATUS_META.not_started;
}

export function StatusBadge({ status }: { status: FounderStreamStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_started;
  const Icon = meta.icon;
  return (
    <span
      // whitespace-nowrap is load-bearing: "Yet To Start" is the longest
      // label and wrapped to two lines inside the 130px column, which made
      // the pill twice as tall as every other row's.
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold leading-none ${
        // "Yet To Start" is the only outlined pill — it reads as an empty
        // slot rather than a state something has reached.
        meta.muted
          ? "border border-white/[0.18] text-white/45"
          : "bg-[rgba(114,114,114,0.32)] text-white"
      }`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${meta.tone}`} />
      {meta.label}
    </span>
  );
}

/* ── avatars ────────────────────────────────────────────────────────────── */

/**
 * Frosted grey surface for anything with no image of its own — a host with no
 * profile picture, a stream with no cover art.
 *
 * These were tinted gradients (first two-stop and saturated, then hue-washed
 * per seed), and both read as decoration: in a table where most streams have
 * no cover, the placeholders became the loudest column on screen. They're now
 * neutral grey glass — a soft white wash, an inset hairline and a blur — so a
 * missing image reads as an empty slot rather than a coloured badge, and the
 * eye goes to the title next to it.
 *
 * No per-seed variation on purpose: with one flat grey, six placeholder tiles
 * in a column look like one quiet surface instead of six competing swatches.
 */
export const GLASS_STYLE: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.055)",
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.09)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
};

export function Avatar({
  src,
  name,
  className = "h-9 w-9",
  rounded = "rounded-full",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  rounded?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label = (name || "?").trim().charAt(0).toUpperCase();
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name || ""}
        onError={() => setBroken(true)}
        className={`${className} ${rounded} shrink-0 object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} ${rounded} grid shrink-0 place-items-center text-[12px] font-semibold text-white/60`}
      style={GLASS_STYLE}
    >
      {label}
    </span>
  );
}

/** Stream thumbnail — falls back to the same frosted grey tile with a muted
 *  video glyph, rather than a broken image or a coloured block. */
export function StreamThumb({ src, title }: { src?: string; title: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={title}
        onError={() => setBroken(true)}
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
      style={GLASS_STYLE}
    >
      <Video className="h-4 w-4 text-white/45" />
    </span>
  );
}

/* ── stacked cell primitives ────────────────────────────────────────────── */

/** The two- and three-line money/count stacks columns 11–15 all use. */
export function Stack({
  lines,
}: {
  lines: Array<{ text: string; tone?: "primary" | "money" | "muted" } | null>;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {lines.filter(Boolean).map((l, i) => (
        <span
          key={i}
          className={
            l!.tone === "money"
              ? "text-[14px] font-semibold text-[#10B981]"
              : l!.tone === "primary"
                ? "text-[14px] font-semibold text-white/90"
                : "text-[12px] text-white/50 sm:text-[13px]"
          }
        >
          {l!.text}
        </span>
      ))}
    </div>
  );
}

/* ── communities ────────────────────────────────────────────────────────── */

/**
 * How many communities fit in a row before the overflow pill is needed.
 *
 * The row is a fixed 95px, leaving ~70px of usable cell. Each line is a 16px
 * tile plus a 6px gap, and the "+ N More" pill needs a line of its own:
 * 16 + 6 + 16 + 6 + 20 = 64px. Two named communities plus the pill is the most
 * that fits without clipping.
 */
const COMMUNITIES_INLINE = 2;

/**
 * The communities a stream is published to.
 *
 * Shows as many as the row can hold, then a "+ N More" pill that reveals the
 * rest on click. An earlier version listed all of them in a scrollable cell,
 * which technically showed everything but hid it behind a scrollbar the grid
 * deliberately doesn't render — so rows 4+ were invisible with no cue they
 * existed. A pill states the count up front and is obviously clickable.
 *
 * The overflow list renders in a portal: the table cell clips its content
 * (`overflow-hidden` keeps resized columns tidy), so a popover positioned
 * inside it would be cut off at the cell edge.
 */
export function CommunitiesCell({ row }: { row: FounderStreamRow }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Any scroll moves the cell out from under the portal, so dismiss rather
    // than chase it.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!row.communities.length) {
    return <span className="text-[13px] text-white/35">—</span>;
  }

  const inline = row.communities.slice(0, COMMUNITIES_INLINE);
  const overflow = row.communities.length - inline.length;

  return (
    <div className="flex flex-col items-start gap-1.5">
      {inline.map((c) => (
        <CommunityLine key={c.id} community={c} />
      ))}

      {overflow > 0 && (
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => {
            // The row click opens the Options drawer — revealing the rest of
            // the list must not also do that.
            e.stopPropagation();
            const r = btnRef.current?.getBoundingClientRect();
            if (r) setAnchor({ top: r.bottom + 6, left: r.left });
            setOpen((v) => !v);
          }}
          className="rounded-full bg-[rgba(114,114,114,0.32)] px-2 py-0.5 text-[12px] text-white/70 transition hover:bg-[rgba(114,114,114,0.5)] hover:text-white"
        >
          + {overflow} More
        </button>
      )}

      {open &&
        anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[130]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              className="fixed z-[131] max-h-64 w-56 overflow-y-auto rounded-xl border border-[#2E2E2E] bg-[#161618] p-1.5 shadow-2xl shadow-black/70"
              style={{ top: anchor.top, left: anchor.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* The full list, not just the overflow — reading "Chamak,
                  Bengaluru, +3" and then a popover that starts at #3 forces
                  you to hold the first two in your head. */}
              {row.communities.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05]"
                >
                  <Avatar
                    src={c.icon}
                    name={c.title}
                    className="h-5 w-5"
                    rounded="rounded-[6px]"
                  />
                  <span className="truncate text-[13px] text-white/85">
                    {c.title}
                  </span>
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

function CommunityLine({
  community,
}: {
  community: { id: string; title: string; icon?: string };
}) {
  return (
    <span className="flex max-w-full items-center gap-1.5">
      <Avatar
        src={community.icon}
        name={community.title}
        className="h-4 w-4"
        rounded="rounded-[5px]"
      />
      <span
        className="truncate text-[13px] text-white/85"
        title={community.title}
      >
        {community.title}
      </span>
    </span>
  );
}
