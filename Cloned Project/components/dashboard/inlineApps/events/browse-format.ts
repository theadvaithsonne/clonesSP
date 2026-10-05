// Formatting shared by the attendee-facing Events pages: Discover, the event
// page and Purchases.
//
// Dates are written day-first ("12–14 Nov 2026") to match the design. Month
// names come from en-US on purpose: en-GB abbreviates September to "Sept",
// which breaks the three-letter rhythm of the card labels.

import type { EventProgram } from "./types";

const DAY_MS = 86_400_000;

type Timed = Pick<EventProgram, "startsAt" | "endsAt">;

const pad = (n: number) => String(n).padStart(2, "0");

function monthName(d: Date, style: "short" | "long") {
  return d.toLocaleDateString("en-US", { month: style });
}

export function isLive(e: Timed, now = Date.now()) {
  return (
    new Date(e.startsAt).getTime() <= now && new Date(e.endsAt).getTime() >= now
  );
}

export function hasEnded(e: Timed, now = Date.now()) {
  return new Date(e.endsAt).getTime() < now;
}

/** "28 Oct" — card labels uppercase it in CSS. */
export function dayMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())} ${monthName(d, "short")}`;
}

/**
 * "12–14 Nov 2026", "30 Oct – 2 Nov 2026", or a single date for a one-day
 * event. `long` spells the month out for the event page's hero.
 */
export function dateRange(
  startIso: string,
  endIso?: string,
  style: "short" | "long" = "short"
) {
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : s;
  if (Number.isNaN(s.getTime())) return "";
  if (Number.isNaN(e.getTime()) || s.toDateString() === e.toDateString()) {
    return `${s.getDate()} ${monthName(s, style)} ${s.getFullYear()}`;
  }
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${monthName(e, style)} ${e.getFullYear()}`;
  }
  return `${s.getDate()} ${monthName(s, style)}${sameYear ? "" : ` ${s.getFullYear()}`} – ${e.getDate()} ${monthName(e, style)} ${e.getFullYear()}`;
}

/** "48 days to go", counted in calendar days rather than 24-hour blocks. */
export function timeToGo(e: Timed, now = Date.now()) {
  if (hasEnded(e, now)) return "Ended";
  if (isLive(e, now)) return "Happening now";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(e.startsAt);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - today.getTime()) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days to go`;
}

/** Last moment of the current Monday–Sunday week, local time. */
export function endOfWeek(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Whether the event runs at any point inside [from, to]. */
export function overlaps(e: Timed, from: Date, to: Date) {
  return (
    new Date(e.startsAt).getTime() <= to.getTime() &&
    new Date(e.endsAt).getTime() >= from.getTime()
  );
}

export type DateFilter = "" | "today" | "week" | "weekend" | "month";

export function matchesDate(e: Timed, filter: DateFilter, now = new Date()) {
  if (!filter) return true;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (filter === "today") {
    const end = new Date(startOfToday);
    end.setHours(23, 59, 59, 999);
    return overlaps(e, startOfToday, end);
  }
  const weekEnd = endOfWeek(now);
  if (filter === "week") return overlaps(e, now, weekEnd);
  if (filter === "weekend") {
    const saturday = new Date(weekEnd);
    saturday.setDate(weekEnd.getDate() - 1);
    saturday.setHours(0, 0, 0, 0);
    return overlaps(e, saturday, weekEnd);
  }
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return overlaps(e, now, monthEnd);
}

/** "BIEC, Bengaluru" — the venue and its city, without repeating either. */
export function placeName(e: Pick<EventProgram, "venue">) {
  const name = (e.venue?.name || "").trim();
  const city = (e.venue?.city || "").trim();
  if (name && city && name.toLowerCase() !== city.toLowerCase()) {
    return `${name}, ${city}`;
  }
  return name || city;
}

/**
 * Where the event happens. Cards keep a hybrid event to its city
 * ("Bengaluru & Online"); the featured card and the event page name the venue
 * ("BIEC, Bengaluru + Online").
 */
export function locationLabel(
  e: Pick<EventProgram, "venue" | "format">,
  variant: "card" | "full" = "card"
) {
  if (e.format === "virtual") return "Online";
  const place =
    variant === "card" && e.format === "hybrid"
      ? (e.venue?.city || e.venue?.name || "").trim()
      : placeName(e);
  if (e.format === "hybrid") {
    return place ? `${place} ${variant === "card" ? "&" : "+"} Online` : "Online";
  }
  return place || "Venue to be announced";
}

/**
 * "$299" / "₹2,499". Narrow symbols, because several locales write USD as
 * "US$", which the price labels have no room for.
 */
export function money(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** "From $120" / "Free", or null when the event has no admission tier yet. */
export function fromPriceLabel(fromPrice: number | null, currency: string) {
  if (fromPrice == null) return null;
  return fromPrice > 0 ? `From ${money(fromPrice, currency)}` : "Free";
}

/** "09:30" — the agenda reads in 24-hour time. */
export function clock(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function durationLabel(startIso: string, endIso: string) {
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000
  );
  if (!Number.isFinite(mins) || mins <= 0) return "";
  if (mins <= 180) return `${mins} min`;
  return `${Math.round(mins / 60)} h`;
}

/** Local calendar day, so a 23:30 session doesn't land on tomorrow's tab. */
export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inclusive number of calendar days the event covers. */
export function dayCount(e: Timed) {
  const s = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(end.getTime())) return 0;
  const a = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((b - a) / DAY_MS) + 1);
}
