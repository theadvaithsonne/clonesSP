# `components/analytics/format.ts`

> Pure functions that turn chart values into strings (full-precision values, compact axis ticks, de-duplicated tick sets) and bucket timestamps into x-axis dates, all in UTC.

**Kind:** Utility module (no React) · **Lines:** 213

## Purpose
Every number and date the analytics charts display goes through this file: the card headline, the tooltip, the axis ticks and chips, and the hidden screen-reader table. Keeping it pure (no React, no DOM) and fixing `timeZone: "UTC"` makes server and client renders produce the same text byte for byte. That avoids hydration mismatches, and it matches the UTC bucket boundaries the data contract requires.

## How it works
- **Missing values.** Anything that is not a finite number (including `null`) formats as `"—"` (`MISSING`).
- **`formatValue(v, unit)`** gives the full-precision form, never abbreviated:
  - `count` - a rounded integer with thousands separators.
  - `currencyCents` - divided by 100 and formatted as USD with up to 2 decimals.
  - `percent` - clamped to 0-100. Integers show no decimals, values under 1 show 2, everything else shows 1.
  - `duration` - see `formatDuration` below.
- **`formatDuration` (private)** turns seconds into `Ns`, `Nm`, `Nh` or `Nd`. Hours and days show one decimal when they are not whole. Negative values keep their sign.
- **`formatTick(v, unit)`** gives a compact label for one tick. Counts and dollar amounts are shortened to `1.2k` or `3.4M` through `abbreviate`. Percent is rounded to a whole number and clamped. Duration reuses `formatDuration`.
- **`formatTicks(ticks, unit)`** formats a whole axis at once and guarantees no label repeats.
  - It first tries the compact `formatTick` labels. If any of them collide, it switches to a more precise form for that unit:
    - percent - tries 0 to 4 decimals until the labels are unique, then falls back to the raw values.
    - count - drops the k/M abbreviation and prints full integers.
    - currencyCents - tries whole-dollar USD, then cents, then a manual `$x.xx`.
    - duration - prints exact seconds (`Ns`).
  - The comment gives the case that prompted this: cent ticks `[0..50]` all abbreviated to "$0" except the last.
- **`formatAxisDate(t, interval, withYear?)`** gives the x-axis label for a bucket start, shaped by the interval:
  - hour - `3 PM`.
  - day and week - `Sep 8`.
  - month - `Sep`.
  - quarter - `Q3 '26`.
  - year - `2026`.
  - `withYear` adds `'YY` to day, week and month labels. `LineChart` sets it when the series crosses a year boundary, so last September cannot be mistaken for this one.
- **`formatAxisDateLong(t, interval)`** gives the fuller date used in the tooltip, the card's hover line, the aria-live text and the screen-reader table. Examples: `Mon, Sep 8, 2026`, `September 2026`, `Q3 2026`.

## Exports
- `formatValue(v: number | null, unit: ChartUnit): string` - full-precision value.
- `formatTick(v: number, unit: ChartUnit): string` - compact single tick.
- `formatTicks(ticks: number[], unit: ChartUnit): string[]` - a whole tick set with unique labels.
- `formatAxisDate(t: number, interval: ChartInterval, withYear = false): string` - short x-axis date.
- `formatAxisDateLong(t: number, interval: ChartInterval): string` - long date.

## Dependencies
- **Internal:** `./types` - `ChartInterval`, `ChartUnit`.
- **Packages:** none. It uses the built-in `Intl.NumberFormat` and `Intl.DateTimeFormat` with the `en-US` locale.

## Used by
`components/analytics/ChartCard.tsx`, `components/analytics/ChartFullscreenDialog.tsx` and `components/analytics/LineChart.tsx`.

## Notes
- All currency is hard-coded to USD and every value is assumed to be in cents.
- `formatTicks` relies on `niceTicks` in `scale.ts` returning numerically distinct values. The precise fallbacks are only guaranteed to be unique because of that.
