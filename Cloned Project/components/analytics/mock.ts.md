# `components/analytics/mock.ts`

> Deterministic mock-data helpers for the analytics chart kit: UTC bucketing, seeded random-walk series, fixed fixtures, plus the date-range preset helpers that the live analytics page also uses.

**Kind:** Utility module (no React) · **Lines:** 276

## Purpose
This file started as fake data so the presentational chart components had something believable to render, mainly in the sandbox page. A real data source does its own bucketing on the server. All randomness is seeded (`mulberry32`), never `Math.random()` at render time, so the sandbox looks the same on every load and on both server and client renders (no hydration mismatch). Two of its helpers, `rangeFromPreset` and `defaultIntervalForPreset`, are also used in production by `AnalyticsMetricsPage`.

## How it works
- **PRNG.**
  - `mulberry32(seed)` is a small, deterministic random-number generator. The comment says it is not for anything security-sensitive.
  - `hashString` is a 31-multiplier string hash. `generateSeries` hashes `id + name` with it to get its seed.
- **Bucketing.**
  - `alignStart` rounds a timestamp down to the start of its UTC bucket. Weeks start on Monday, months on the 1st, quarters on Jan/Apr/Jul/Oct 1, and years on Jan 1.
  - `addInterval` moves forward exactly one bucket.
  - `bucketStarts(range, interval)` walks from the aligned start up to `range.end` inclusive, capped at `MAX_BUCKETS` = 2000.
- **Series builders.**
  - `generateSeries` builds a random walk. Each step adds `trend` plus jitter of up to ±`volatility`; the defaults are `base` 100 and `volatility` 8% of `base`.
  - Percent values are clamped to 0-100. Other units are clamped at 0 unless `allowNegative` is set.
  - `count`, `currencyCents` and `duration` values are rounded to integers. `allZero` forces every point to 0.
  - `emptySeries` fills every bucket with `null`.
  - `seriesFromValues` builds a series from exact values and pads with `null`, for fixtures such as "exactly one point".
- **Presets** (both work in UTC milliseconds relative to `now`):
  - `rangeFromPreset(preset, now)`:
    - last 7, 30 or 90 days - that many days back from `now`.
    - last 12 months - 365 days back.
    - year to date - from 1 January (UTC) of the current year.
    - all time - 3 × 365 days back. This is a fixed window, not the true start of the data.
  - `defaultIntervalForPreset(preset)`:
    - last 7 or 30 days - day.
    - last 90 days - week.
    - last 12 months or year to date - month.
    - all time - quarter.
- **Traction fixtures.**
  - `TRACTION_METRICS` lists the ten Figma KPI cards with mock `base` and `trend` values.
  - `generateTractionSeries` turns one of them into a random-walk series.
  - `headlineFromSeries` returns the last non-null value of a series.

## Exports
- `bucketStarts(range: DateRange, interval: ChartInterval): number[]` - aligned bucket starts.
- `GenerateSeriesOptions` - options for `generateSeries`: `id`, `name`, `color?`, `range`, `interval`, `unit`, `base?`, `trend?`, `volatility?`, `allZero?`, `allowNegative?`.
- `generateSeries(opts): ChartSeries` - seeded random walk.
- `emptySeries(id, name, range, interval): ChartSeries` - all-null series.
- `seriesFromValues(id, name, range, interval, values): ChartSeries` - explicit fixture.
- `rangeFromPreset(preset: DateRangePreset, now = Date.now()): DateRange`.
- `defaultIntervalForPreset(preset: DateRangePreset): ChartInterval`.
- `TractionMetric` - `{ id, title, unit, base, trend }`.
- `TRACTION_METRICS: TractionMetric[]` - the ten mock KPI definitions.
- `generateTractionSeries(metric, range, interval): ChartSeries`.
- `headlineFromSeries(series): number | null` - last non-null value.

## Dependencies
- **Internal:** `./types` (series and range types), `./ControlBar` (the `DateRangePreset` type only).
- **Packages:** none.

## Used by
- `app/garage-admin/(admin-dashboard)/analytics/sandbox/page.tsx` - uses `bucketStarts`, `emptySeries`, `generateSeries`, `headlineFromSeries` and `seriesFromValues`. Route `/garage-admin/analytics/sandbox`.
- `components/analytics/AnalyticsMetricsPage.tsx` - uses `rangeFromPreset` and `defaultIntervalForPreset` for live queries.

## Notes
- **No `custom` case.** Neither `rangeFromPreset` nor `defaultIntervalForPreset` handles `"custom"`, so both return `undefined` for it, despite their declared return types. See the bug note in `AnalyticsMetricsPage.tsx.md`.
- **Unused exports.** `TRACTION_METRICS`, `TractionMetric` and `generateTractionSeries` are not imported anywhere. The live Traction page defines its own local `TRACTION_METRICS` list and uses real backend data.
- **Production code in a mock file.** The preset helpers decide the real query window sent to the backend, even though they live in a file named `mock`.
