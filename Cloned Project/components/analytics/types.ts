// Analytics chart template — shared types.
//
// This file is the data seam. A future developer binds real APIs here: the
// only thing they need to produce is a `ChartData` (below). Everything else
// in components/analytics/ is presentational and derives from it.

/**
 * One bucket in a timeseries.
 *
 * `t` is the bucket's start, epoch milliseconds, UTC. `v` is `null` when the
 * bucket genuinely has no data — that renders as a gap in the line, distinct
 * from a real `0`. Never use `NaN`/`Infinity`; use `null`.
 */
export interface ChartPoint {
  t: number;
  v: number | null;
}

/**
 * One line on the chart.
 *
 * Model this on the one well-built timeseries contract in these backends,
 * `GET /affiliate/downline/:userId/monthly`: **fixed-length, zero-filled
 * buckets** (see `MemberActivityChart`'s `MONTHS.map` — it always renders
 * 12 rows and fills missing months with `0`/`null`, never a sparse array).
 *
 * A binder MUST supply:
 *   - `points` already bucketed to the requested `ChartInterval`/`DateRange`
 *     — the chart does no date bucketing itself, only formatting.
 *   - the SAME bucket count and boundaries (same `t` values, in order)
 *     across every series on the same chart, so multiple series stay
 *     aligned index-for-index.
 *   - `v: null` for "no data", never `0` used as a stand-in for missing —
 *     that would silently understate the series.
 */
export interface ChartSeries {
  id: string;
  name: string;
  /** Defaults to the accent gold (#FFC200) when omitted. */
  color?: string;
  points: ChartPoint[];
}

/**
 * How to format values/ticks. Determines number formatting only — it does
 * not change how points are plotted (plotting is always a plain linear
 * scale over the raw numeric `v`).
 *
 *   - "count": integers, thousands separators, no decimals.
 *   - "currencyCents": `v` is USD cents (matches how money is stored across
 *     these backends, e.g. Invoice.amountCents) — formatted as currency.
 *   - "percent": `v` is 0–100, capped at 100.
 *   - "duration": `v` is seconds, formatted human (s/m/h/d).
 */
export type ChartUnit = "count" | "currencyCents" | "percent" | "duration";

/**
 * Bucket density. Controls how many buckets exist over a `DateRange`, not
 * how the line is squashed to fit — the plot pans horizontally instead of
 * compressing when a series has more points than fit the viewport.
 */
export type ChartInterval = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface DateRange {
  /** Epoch ms, inclusive. */
  start: number;
  /** Epoch ms, inclusive. */
  end: number;
}

/**
 * Only "line" exists today. The user explicitly wants more kinds later
 * (e.g. "bar") — this union is the seam for that. Do not add a kind that
 * has no implementation; extend this type AND add the renderer together.
 */
export type ChartKind = "line";

/** Async/data status a binder reports; the chart never infers this itself. */
export type ChartLoadState = "loading" | "error" | "ready";

/**
 * The full contract a binder must produce for one KPI card.
 *
 * `ChartCard` accepts either a `ChartData` (state === "ready") or an
 * explicit `loading`/`error` status alongside it — see `ChartCardProps` in
 * ChartCard.tsx. This type is only the "ready" payload shape.
 */
export interface ChartData {
  kind: ChartKind;
  unit: ChartUnit;
  interval: ChartInterval;
  range: DateRange;
  series: ChartSeries[];
  /**
   * The big number under the title. Deciding what it means (latest bucket,
   * sum, a separately-fetched all-time total, …) is the binder's call, not
   * the chart's — the chart only formats and displays whatever is passed.
   */
  headline: number | null;
}

/** Pixel geometry the chart draws into. Computed once by `computeGeometry`
 *  (scale.ts) from a caller-chosen size + margins, so the compact card and
 *  the fullscreen dialog can each pick their own size and still hand the
 *  same shape to `LineChart`. */
export interface ChartGeometry {
  width: number;
  height: number;
  plot: { x: number; y: number; width: number; height: number };
  /** Number of horizontal gridlines / y-axis tick labels (the Figma's 6). */
  yTickCount: number;
  /** X coordinate the y-axis tick labels are right-aligned to. */
  yLabelRight: number;
  /** Baseline y for x-axis tick labels. */
  xLabelY: number;
}
