# `components/analytics/types.ts`

> Shared TypeScript types for the admin analytics chart kit: the data contract (`ChartData`, `ChartSeries`, `ChartPoint`) and the pixel geometry (`ChartGeometry`) every chart component consumes.

**Kind:** TypeScript types module · **Lines:** 117

## Purpose
This file is the "data seam" of `components/analytics/`. Everything else in that folder is presentational and derives from these shapes, so wiring a new metric to real data only means producing values of these types. It contains no runtime code: only interfaces and string-literal unions, each with comments that spell out the rules a data provider ("binder") must follow.

## How it works
- **Points and series.** A `ChartPoint` is one bucket: `t` is the bucket start in epoch milliseconds (UTC) and `v` is the value, or `null` when the bucket genuinely has no data. `null` draws as a gap in the line, which is different from a real `0`. `NaN`/`Infinity` are not allowed.
- **Binder rules (on `ChartSeries`).** Series must be fixed-length and already bucketed to the requested interval and range. The chart does no date bucketing, only formatting. Every series on one chart must share the same `t` values in the same order, so they line up index for index. Missing data must be `null`, never a stand-in `0`. The comment names `GET /affiliate/downline/:userId/monthly` and `MemberActivityChart` as the model to copy.
- **Units (`ChartUnit`).** These change formatting only, never plotting: `count` (integers), `currencyCents` (USD cents, as money is stored in the backend, for example `Invoice.amountCents`), `percent` (0-100) and `duration` (seconds).
- **Interval (`ChartInterval`).** Sets how many buckets exist across a range. When there are more points than fit, the chart is meant to pan rather than squash them.
- **`ChartKind`.** Only `"line"` exists. The comment says a new kind (such as `"bar"`) must be added together with its renderer, never on its own.
- **`ChartData`.** The full "ready" payload for one KPI card: kind, unit, interval, range, series and `headline`. What the headline number means (latest bucket, sum, a separate total) is the binder's decision.
- **`ChartGeometry`.** Pixel layout produced by `computeGeometry` in `scale.ts`. It holds the outer size, the plot rectangle, the y-tick count, the x position that y labels right-align to, and the baseline for x labels.

## Exports
- `ChartPoint` - `{ t: number; v: number | null }`, one timeseries bucket.
- `ChartSeries` - `{ id; name; color?; points }`, one line. `color` falls back to the accent gold `#FFC200`.
- `ChartUnit` - `"count" | "currencyCents" | "percent" | "duration"`.
- `ChartInterval` - `"hour" | "day" | "week" | "month" | "quarter" | "year"`.
- `DateRange` - `{ start; end }`, epoch ms, both ends inclusive.
- `ChartKind` - `"line"`.
- `ChartLoadState` - `"loading" | "error" | "ready"`.
- `ChartData` - the complete ready payload for one card.
- `ChartGeometry` - `{ width; height; plot: {x,y,width,height}; yTickCount; yLabelRight; xLabelY }`.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
`app/garage-admin/(admin-dashboard)/analytics/sandbox/page.tsx`, `components/analytics/AnalyticsMetricsPage.tsx`, `ChartCard.tsx`, `ChartFullscreenDialog.tsx`, `ControlBar.tsx`, `LineChart.tsx`, `format.ts`, `mock.ts` and `scale.ts`.

## Notes
- `ChartData` and `ChartLoadState` are defined but no component takes them as one object. `ChartCard` and `LineChart` receive the same fields as separate props and declare their own `status` unions.
- The live backend (`server/routes/garageAdminAnalytics.ts`) follows this contract: one point per bucket, shared `t` values and integer counts.
