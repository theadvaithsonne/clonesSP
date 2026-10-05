# `components/analytics/scale.ts`

> Pure math for the analytics charts: "nice" y-axis tick values, a linear scale, half-pixel snapping, pan clamping and chart geometry layout.

**Kind:** Utility module (no React) · **Lines:** 209

## Purpose
This file holds the numeric core of `LineChart` and its wrappers. It has no React, no DOM and no dependencies, so it can be tested with a throwaway Node script (the header suggests `node --experimental-strip-types`). `ChartCard` and `ChartFullscreenDialog` each call `computeGeometry` with their own size and margins. `LineChart` only ever sees the resulting `ChartGeometry`.

## How it works
- **Nice-number ladder.** Steps come from the sequence 1, 2, 5, 10 × 10^n.
  - `niceStepAtLeast(x)` returns the smallest ladder value that is at least `x`. It rounds up, never down.
  - `nextNiceStep(step)` returns the next rung up, so a loop that keeps growing the step is guaranteed to end.
- **`niceTicks(dataMin, dataMax, count, unit)`** builds the y-axis tick values:
  1. Use at least 2 ticks, defaulting to 6. Treat non-finite inputs as 0 and swap the bounds if they are reversed.
  2. Always include 0 (`lo = min(lo, 0)`, `hi = max(hi, 0)`), so the axis starts at zero unless data is negative. Percent is clamped to 0-100.
  3. If the data is flat (all zero, all equal, or a single point), make up a span so ticks are not repeated: the magnitude of the value, or up to 10 for percent.
  4. Take the per-tick step with `niceStepAtLeast`. For integer units (`count`, `currencyCents`, `duration`), force it to an integer of at least 1. Align the minimum down to a multiple of the step.
  5. Check that the top tick reaches `hi`, and move up the ladder (at most 60 times) until it does. The comment records the bug this fixes: data topping out at 6 or 7 was drawn above a top tick of 5.
  6. For percent, clamp the final domain to 0-100 and re-space the step evenly.
  7. Emit `n` ticks (rounded for integer units), de-duplicated and sorted.
  - Ticks keep full precision here. `formatTicks` in `format.ts` decides how many decimals to show.
- **`scaleLinear(domain, range)`** returns a function `v => pixel` doing plain linear interpolation. A zero-width domain is treated as width 1, so it never divides by zero.
- **`crisp(v)`** returns `Math.round(v) + 0.5`, so 1 px gridlines render sharp instead of blurred across two rows.
- **`clampPan(offset, virtualWidth, viewportWidth)`** clamps a pan offset to `[0, max(0, virtualWidth - viewportWidth)]`.
- **`computeGeometry(params)`** turns an outer box and its margins into a `ChartGeometry`:
  - the plot rectangle is the box minus the margins, never negative;
  - `yLabelRight = leftMargin - yLabelGap`;
  - `xLabelY = plot bottom + 17`;
  - `yTickCount` defaults to 6 and `yLabelGap` to 8.

## Exports
- `niceTicks(dataMin: number, dataMax: number, count: number, unit: ChartUnit): number[]` - sorted y tick values.
- `scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number` - linear mapping.
- `crisp(v: number): number` - half-pixel snap.
- `clampPan(offset: number, virtualWidth: number, viewportWidth: number): number` - pan bounds.
- `computeGeometry({ width, height, topMargin, bottomMargin, leftMargin, rightMargin, yTickCount?, yLabelGap? }): ChartGeometry` - layout.

## Dependencies
- **Internal:** `./types` - `ChartGeometry`, `ChartUnit`.
- **Packages:** none.

## Used by
- `components/analytics/ChartCard.tsx` - `computeGeometry`.
- `components/analytics/ChartFullscreenDialog.tsx` - `computeGeometry`.
- `components/analytics/LineChart.tsx` - `niceTicks`, `scaleLinear`, `crisp`.
- `components/analytics/use-chart-pan.ts` - `clampPan`.

## Notes
- The y domain always includes zero, so a series that sits in a narrow band far above 0 is drawn as a near-flat line near the top of the plot. That is intentional (zero baseline), not a bug.
