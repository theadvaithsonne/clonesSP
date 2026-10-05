// Deterministic mock data for the sandbox + the Traction page.
//
// Not part of the data seam — a real binder does its own bucketing against
// real queries. This file exists only so the presentational layer has
// something believable to render. Everything here is seeded (mulberry32),
// never Math.random() at render time, so the sandbox looks identical on
// every load and every server/client render (no hydration mismatch).

import type { ChartInterval, ChartPoint, ChartSeries, ChartUnit, DateRange } from "./types";
import type { DateRangePreset } from "./ControlBar";

/** Small, fast, deterministic PRNG (mulberry32). Good enough for fake
 *  chart data; not for anything security-sensitive. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const MS = {
  hour: 3_600_000,
  day: 86_400_000,
} as const;

/** Aligns a UTC timestamp down to the start of its interval bucket. */
function alignStart(t: number, interval: ChartInterval): Date {
  const d = new Date(t);
  switch (interval) {
    case "hour":
      d.setUTCMinutes(0, 0, 0);
      return d;
    case "day":
      d.setUTCHours(0, 0, 0, 0);
      return d;
    case "week": {
      d.setUTCHours(0, 0, 0, 0);
      const dow = d.getUTCDay(); // 0 = Sunday
      const mondayOffset = (dow + 6) % 7;
      d.setUTCDate(d.getUTCDate() - mondayOffset);
      return d;
    }
    case "month":
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(1);
      return d;
    case "quarter": {
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(1);
      const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
      d.setUTCMonth(qMonth);
      return d;
    }
    case "year":
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(0, 1);
      return d;
  }
}

function addInterval(d: Date, interval: ChartInterval): Date {
  const next = new Date(d);
  switch (interval) {
    case "hour":
      next.setUTCHours(next.getUTCHours() + 1);
      return next;
    case "day":
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    case "week":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "month":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case "quarter":
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    case "year":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
  }
}

const MAX_BUCKETS = 2000;

/** Fixed-length bucket boundaries covering `range`, aligned to `interval`
 *  starts. This is bucketing logic a real binder must do server-side —
 *  kept here only so mock series have realistic, well-formed timestamps. */
export function bucketStarts(range: DateRange, interval: ChartInterval): number[] {
  const starts: number[] = [];
  let cursor = alignStart(range.start, interval);
  let guard = 0;
  while (cursor.getTime() <= range.end && guard < MAX_BUCKETS) {
    starts.push(cursor.getTime());
    cursor = addInterval(cursor, interval);
    guard++;
  }
  return starts;
}

export interface GenerateSeriesOptions {
  id: string;
  name: string;
  color?: string;
  range: DateRange;
  interval: ChartInterval;
  unit: ChartUnit;
  /** Rough magnitude to walk around. */
  base?: number;
  /** Per-step drift, same units as `base`. */
  trend?: number;
  /** Per-step random jitter, same units as `base`. */
  volatility?: number;
  /** Forces every point's value to 0. */
  allZero?: boolean;
  /** Allows the walk to go negative (otherwise clamped at 0, except for
   *  "duration"/"count" which are never negative in practice). */
  allowNegative?: boolean;
}

/** A seeded random-walk series, bucketed per `interval` over `range`. */
export function generateSeries(opts: GenerateSeriesOptions): ChartSeries {
  const {
    id,
    name,
    color,
    range,
    interval,
    unit,
    base = 100,
    trend = 0,
    volatility = base * 0.08,
    allZero = false,
    allowNegative = false,
  } = opts;

  const starts = bucketStarts(range, interval);
  const rand = mulberry32(hashString(id + name));

  let value = base;
  const points: ChartPoint[] = starts.map((t) => {
    if (allZero) return { t, v: 0 };
    value += trend + (rand() - 0.5) * 2 * volatility;
    let v = value;
    if (unit === "percent") v = Math.min(100, Math.max(0, v));
    else if (!allowNegative) v = Math.max(0, v);
    if (unit === "count" || unit === "currencyCents" || unit === "duration") v = Math.round(v);
    return { t, v };
  });

  return { id, name, color, points };
}

export function emptySeries(id: string, name: string, range: DateRange, interval: ChartInterval): ChartSeries {
  return { id, name, points: bucketStarts(range, interval).map((t) => ({ t, v: null })) };
}

/** Builds a series from explicit values (padding with `null` past the end)
 *  — used by the sandbox for exact fixtures like "exactly one point" or
 *  "exactly two points" that a random walk can't guarantee. */
export function seriesFromValues(
  id: string,
  name: string,
  range: DateRange,
  interval: ChartInterval,
  values: (number | null)[]
): ChartSeries {
  const starts = bucketStarts(range, interval);
  return {
    id,
    name,
    points: starts.map((t, i) => ({ t, v: i < values.length ? values[i] : null })),
  };
}

export function rangeFromPreset(preset: DateRangePreset, now: number = Date.now()): DateRange {
  const end = now;
  const day = MS.day;
  switch (preset) {
    case "last_7_days":
      return { start: end - 7 * day, end };
    case "last_30_days":
      return { start: end - 30 * day, end };
    case "last_90_days":
      return { start: end - 90 * day, end };
    case "last_12_months":
      return { start: end - 365 * day, end };
    case "year_to_date": {
      const d = new Date(end);
      return { start: Date.UTC(d.getUTCFullYear(), 0, 1), end };
    }
    case "all_time":
      return { start: end - 3 * 365 * day, end };
  }
}

/** A sensible default interval for a given preset — mirrors what a real
 *  binder would pick so the chart never renders an absurd bucket count. */
export function defaultIntervalForPreset(preset: DateRangePreset): ChartInterval {
  switch (preset) {
    case "last_7_days":
      return "day";
    case "last_30_days":
      return "day";
    case "last_90_days":
      return "week";
    case "last_12_months":
      return "month";
    case "year_to_date":
      return "month";
    case "all_time":
      return "quarter";
  }
}

// ── Traction page metrics ──────────────────────────────────────────────

export interface TractionMetric {
  id: string;
  title: string;
  unit: ChartUnit;
  base: number;
  trend: number;
}

/** The ten KPI cards visible in the Figma. Order matches the design. */
export const TRACTION_METRICS: TractionMetric[] = [
  { id: "users", title: "Users", unit: "count", base: 4200, trend: 18 },
  { id: "founders", title: "Founders", unit: "count", base: 860, trend: 3 },
  { id: "companies", title: "Companies", unit: "count", base: 610, trend: 2.5 },
  { id: "offices", title: "Offices", unit: "count", base: 340, trend: 1.2 },
  { id: "ecommerce_stores", title: "E-commerce Stores", unit: "count", base: 275, trend: 2 },
  { id: "irl_stores", title: "IRL Stores", unit: "count", base: 96, trend: 0.6 },
  { id: "crypto_offices", title: "Crypto Offices", unit: "count", base: 54, trend: 0.4 },
  { id: "affiliates", title: "Affiliates", unit: "count", base: 1830, trend: 9 },
  { id: "shoppers", title: "Shoppers", unit: "count", base: 9600, trend: 42 },
  { id: "employees", title: "Employees", unit: "count", base: 1210, trend: 5 },
];

export function generateTractionSeries(
  metric: TractionMetric,
  range: DateRange,
  interval: ChartInterval
): ChartSeries {
  return generateSeries({
    id: metric.id,
    name: metric.title,
    range,
    interval,
    unit: metric.unit,
    base: metric.base,
    trend: metric.trend,
    volatility: Math.max(1, metric.base * 0.04),
  });
}

export function headlineFromSeries(series: ChartSeries): number | null {
  for (let i = series.points.length - 1; i >= 0; i--) {
    const v = series.points[i].v;
    if (v !== null) return v;
  }
  return null;
}
