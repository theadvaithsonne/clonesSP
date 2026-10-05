// Pure formatting helpers — no React, no DOM. Every Date computation uses
// `timeZone: "UTC"` explicitly so server-rendered and client-rendered output
// match byte-for-byte (mock.ts always produces UTC bucket boundaries; a real
// binder should too, per the ChartSeries contract in types.ts).

import type { ChartInterval, ChartUnit } from "./types";

const MISSING = "—";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Full-precision value for tooltips, the sr-only table, and the card's big
 *  number. Never abbreviated — that's what formatTick is for. */
export function formatValue(v: number | null, unit: ChartUnit): string {
  if (!isFiniteNumber(v)) return MISSING;
  switch (unit) {
    case "count":
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        Math.round(v)
      );
    case "currencyCents":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(v / 100);
    case "percent": {
      const capped = Math.min(100, Math.max(0, v));
      const decimals = Number.isInteger(capped) ? 0 : capped < 1 ? 2 : 1;
      return `${capped.toFixed(decimals)}%`;
    }
    case "duration":
      return formatDuration(v);
    default:
      return String(v);
  }
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds === 0) return "0s";
  const sign = totalSeconds < 0 ? "-" : "";
  const s = Math.round(Math.abs(totalSeconds));
  if (s < 60) return `${sign}${s}s`;
  if (s < 3600) return `${sign}${Math.round(s / 60)}m`;
  if (s < 86400) {
    const h = s / 3600;
    return `${sign}${h % 1 === 0 ? h : h.toFixed(1)}h`;
  }
  const d = s / 86400;
  return `${sign}${d % 1 === 0 ? d : d.toFixed(1)}d`;
}

/** Compact single-tick label — abbreviates large counts/currency (1.2k,
 *  3.4M) so six labels never overlap in a 34px-wide column. Precision here
 *  is fixed; formatTicks() (below) is what guards against duplicate labels
 *  across a whole axis. */
export function formatTick(v: number, unit: ChartUnit): string {
  if (!isFiniteNumber(v)) return MISSING;
  switch (unit) {
    case "count":
      return abbreviate(v);
    case "currencyCents": {
      const dollars = v / 100;
      return `$${abbreviate(dollars)}`;
    }
    case "percent":
      return `${Math.round(Math.min(100, Math.max(0, v)))}%`;
    case "duration":
      return formatDuration(v);
    default:
      return String(v);
  }
}

function abbreviate(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = v / 1_000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

/**
 * Formats a whole tick array together, growing decimal precision (for
 * "percent", the only unit whose ticks aren't pre-rounded to integers)
 * until every label is distinct — or giving up at a sane cap rather than
 * spinning. This is the actual guarantee behind "never repeat the same
 * label": niceTicks() can return numerically-distinct-but-close values
 * (e.g. a domain spanning a fraction of a percent), and a fixed-precision
 * formatter could still collapse them to the same string.
 */
export function formatTicks(ticks: number[], unit: ChartUnit): string[] {
  const abbreviated = ticks.map((t) => formatTick(t, unit));
  if (new Set(abbreviated).size === abbreviated.length) return abbreviated;

  // The abbreviated form collided — niceTicks() guarantees the underlying
  // numeric ticks are distinct, so a more precise formatting always exists.
  // Found by testing: e.g. currencyCents ticks [0,10,20,30,40,50] (cents)
  // all abbreviate to whole-dollar "$0" except the last, which rounds up to
  // "$1" — five duplicate "$0" labels on one axis.
  switch (unit) {
    case "percent": {
      for (let decimals = 0; decimals <= 4; decimals++) {
        const labels = ticks.map((t) => `${Math.min(100, Math.max(0, t)).toFixed(decimals)}%`);
        if (new Set(labels).size === labels.length) return labels;
      }
      // Every reasonable precision collided (ticks are effectively
      // identical) — fall back to full precision rather than lie with
      // repeats.
      return ticks.map((t) => `${t}%`);
    }
    case "count": {
      // Ticks are already unique integers — dropping the k/M abbreviation
      // and printing full precision is always distinct.
      const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
      return ticks.map((t) => fmt.format(t));
    }
    case "currencyCents": {
      // Try whole-dollar full precision, then cent precision — cent
      // precision is always distinct since it exactly reflects the
      // (already-unique, integer) cent values.
      for (const digits of [0, 2]) {
        const fmt = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
        const labels = ticks.map((t) => fmt.format(t / 100));
        if (new Set(labels).size === labels.length) return labels;
      }
      return ticks.map((t) => `$${(t / 100).toFixed(2)}`);
    }
    case "duration":
      // Ticks are already unique whole seconds — the exact count is always
      // distinct even when the human "33m"/"1.1h" rounding collides.
      return ticks.map((t) => `${Math.round(t)}s`);
    default:
      return abbreviated;
  }
}

/** Formats a bucket's start timestamp for the x-axis, shaped by interval so
 *  "Jan" doesn't appear for hourly buckets and "3PM" doesn't appear for
 *  yearly ones. */
export function formatAxisDate(
  t: number,
  interval: ChartInterval,
  /** Append a 2-digit year. Set when the series crosses a year boundary —
   *  otherwise "Sep 8" on a 12-month range reads as THIS September (a future
   *  date) rather than last year's, and Monthly shows "Sep … Sep" twice. */
  withYear = false
): string {
  const d = new Date(t);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(d);
  const yy = `'${String(d.getUTCFullYear()).slice(-2)}`;

  switch (interval) {
    case "hour":
      return fmt({ hour: "numeric" });
    case "day":
    case "week": {
      const base = fmt({ month: "short", day: "numeric" });
      return withYear ? `${base} ${yy}` : base;
    }
    case "month": {
      const base = fmt({ month: "short" });
      return withYear ? `${base} ${yy}` : base;
    }
    case "quarter": {
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      return `Q${q} '${String(d.getUTCFullYear()).slice(-2)}`;
    }
    case "year":
      return fmt({ year: "numeric" });
    default:
      return fmt({ month: "short", day: "numeric" });
  }
}

/** Fuller date, for the fullscreen crosshair tooltip. */
export function formatAxisDateLong(t: number, interval: ChartInterval): string {
  const d = new Date(t);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(d);

  switch (interval) {
    case "hour":
      return fmt({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    case "day":
    case "week":
      return fmt({ weekday: "short", month: "short", day: "numeric", year: "numeric" });
    case "month":
      return fmt({ month: "long", year: "numeric" });
    case "quarter": {
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      return `Q${q} ${d.getUTCFullYear()}`;
    }
    case "year":
      return fmt({ year: "numeric" });
    default:
      return fmt({ month: "short", day: "numeric", year: "numeric" });
  }
}
