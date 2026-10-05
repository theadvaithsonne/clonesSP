// Pure math: nice-tick generation, linear scales, and geometry layout.
// No React, no DOM, no dependencies — safe to unit-test with a throwaway
// `node --experimental-strip-types` script.

import type { ChartGeometry, ChartUnit } from "./types";

/** The 1/2/5/10 × 10^n "nice number" ladder, ascending within one decade. */
const NICE_LADDER = [1, 2, 5, 10];

/** Smallest ladder value (1/2/5/10 × 10^n) that is >= x. This is a *lower
 *  bound* pick — unlike the old nearest-rounding approach, it never returns
 *  a step smaller than what's asked for, which is what coverage depends on
 *  below. */
function niceStepAtLeast(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  for (const m of NICE_LADDER) {
    const candidate = m * base;
    if (candidate >= x - x * 1e-9) return candidate;
  }
  return 10 * base; // unreachable given the ladder tops out at 10x base
}

/** The next step up the same ladder — used to grow a step that turned out
 *  not to cover the domain. Strictly greater than `step`, so a coverage
 *  loop built on this always terminates. */
function nextNiceStep(step: number): number {
  const exp = Math.floor(Math.log10(step));
  const base = Math.pow(10, exp);
  const ratio = step / base;
  for (let i = 0; i < NICE_LADDER.length; i++) {
    if (Math.abs(ratio - NICE_LADDER[i]) < 1e-6 && i < NICE_LADDER.length - 1) {
      return NICE_LADDER[i + 1] * base;
    }
  }
  return 10 * base; // was already at the "10" rung -> roll into the next decade
}

/**
 * Computes exactly `count` y-axis tick VALUES spanning a nice domain built
 * from the data's [dataMin, dataMax].
 *
 * Rules:
 *  - Zero-baseline unless the data goes negative; if it does, the domain
 *    still spans zero (min(0, dataMin) .. max(0, dataMax)).
 *  - "percent" is clamped to [0, 100].
 *  - "count" / "currencyCents" / "duration" ticks are integers (no
 *    fractional counts, no fractional cents, no fractional seconds).
 *  - Flat series (all-zero, all-equal, single point) synthesize a small
 *    span instead of dividing by zero or repeating one label.
 *  - The returned array is de-duplicated and always sorted ascending; it
 *    may be shorter than `count` only when de-duplication removes an
 *    exact collision, which — given the synthesized span above — should
 *    not happen in practice.
 */
export function niceTicks(
  dataMin: number,
  dataMax: number,
  count: number,
  unit: ChartUnit
): number[] {
  const n = Math.max(2, Math.floor(count) || 6);

  let lo = Number.isFinite(dataMin) ? dataMin : 0;
  let hi = Number.isFinite(dataMax) ? dataMax : 0;
  if (lo > hi) [lo, hi] = [hi, lo];

  // Zero-baseline unless data goes negative (then zero stays in range).
  lo = Math.min(lo, 0);
  hi = Math.max(hi, 0);

  if (unit === "percent") {
    lo = Math.max(0, lo);
    hi = Math.min(100, Math.max(hi, lo));
  }

  // Flat / degenerate range: synthesize a span so ticks aren't repeated.
  if (hi - lo <= 0) {
    const magnitude = Math.abs(hi) || Math.abs(lo) || 1;
    hi = lo + (unit === "percent" ? Math.min(10, 100 - lo || 10) : magnitude);
    if (hi - lo <= 0) hi = lo + 1;
  }

  const isIntegerUnit = unit === "count" || unit === "currencyCents" || unit === "duration";

  // Pick the smallest ladder step that's at least the raw per-tick span,
  // then align niceMin down to a multiple of it. For integer units, a
  // ladder step under 1 (e.g. the raw span is 0.3) still has to become an
  // integer — ceil is a no-op on every ladder value >= 1 and correctly
  // promotes anything smaller up to 1.
  let step = niceStepAtLeast((hi - lo) / (n - 1));
  if (isIntegerUnit) step = Math.max(1, Math.ceil(step));

  let niceMin = Math.floor(lo / step) * step;
  let niceMax = niceMin + step * (n - 1);

  // Verify [niceMin, niceMax] actually covers [lo, hi] — rounding niceMin
  // down can eat into the span by up to one step, and integer rounding can
  // shrink it further, so the naive pick isn't guaranteed to reach `hi`
  // (this was the bug: a domain topping at 6 or 7 rendered with a top tick
  // of 5, silently plotting the line above the last gridline). Grow the
  // step up the ladder — strictly increasing, so this always terminates —
  // until it does.
  const EPS = 1e-9 * (Math.abs(hi) + 1);
  let guard = 0;
  while (niceMax < hi - EPS && guard < 60) {
    step = nextNiceStep(step);
    if (isIntegerUnit) step = Math.max(1, Math.ceil(step));
    niceMin = Math.floor(lo / step) * step;
    niceMax = niceMin + step * (n - 1);
    guard++;
  }

  if (unit === "percent") {
    // hi was already clamped to <= 100 above, and niceMax >= hi by the
    // loop, so clamping down to 100 can't reopen the coverage gap.
    niceMin = Math.max(0, niceMin);
    niceMax = Math.min(100, Math.max(niceMax, niceMin + step));
    step = (niceMax - niceMin) / (n - 1);
  }

  // Ticks are kept at full precision here (no rounding for percent) —
  // format.ts's formatTicks() decides display precision, growing it until
  // labels are distinct instead of this function silently collapsing
  // close-but-different values to one rounded label.
  const ticks: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = niceMin + step * i;
    if (isIntegerUnit) v = Math.round(v);
    ticks.push(v);
  }

  const uniq = Array.from(new Set(ticks)).sort((a, b) => a - b);
  return uniq.length >= 2 ? uniq : ticks;
}

/** value -> pixel, plain linear interpolation. Works for either axis. */
export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Snaps a coordinate to a half-pixel so a 1px stroke renders crisp instead
 *  of anti-aliased across two rows/columns. */
export function crisp(v: number): number {
  return Math.round(v) + 0.5;
}

/** Clamps a pan offset into [0, virtualWidth - viewportWidth] (or 0 if the
 *  content already fits the viewport). Shared by the pan hook and anything
 *  that needs to reason about scroll bounds without owning the hook. */
export function clampPan(offset: number, virtualWidth: number, viewportWidth: number): number {
  const max = Math.max(0, virtualWidth - viewportWidth);
  return Math.min(max, Math.max(0, offset));
}

/**
 * Lays out a `ChartGeometry` from an outer box + margins. The compact card
 * and the fullscreen dialog each call this with their own numbers — the
 * card matches the Figma spec exactly (see ChartCard.tsx), the dialog picks
 * bigger margins for bigger type. `LineChart` only ever consumes the
 * resulting `ChartGeometry`, never these raw margins.
 */
export function computeGeometry(params: {
  width: number;
  height: number;
  /** Space above the plot (title/value area for the card; a header for the
   *  dialog). */
  topMargin: number;
  /** Space below the plot reserved for x-axis labels. */
  bottomMargin: number;
  /** Space left of the plot reserved for y-axis labels + gap. */
  leftMargin: number;
  rightMargin: number;
  yTickCount?: number;
  /** Gap between the right edge of y labels and the plot's left edge. */
  yLabelGap?: number;
}): ChartGeometry {
  const {
    width,
    height,
    topMargin,
    bottomMargin,
    leftMargin,
    rightMargin,
    yTickCount = 6,
    yLabelGap = 8,
  } = params;

  const plot = {
    x: leftMargin,
    y: topMargin,
    width: Math.max(0, width - leftMargin - rightMargin),
    height: Math.max(0, height - topMargin - bottomMargin),
  };

  return {
    width,
    height,
    plot,
    yTickCount,
    yLabelRight: leftMargin - yLabelGap,
    xLabelY: plot.y + plot.height + 17,
  };
}
