# `components/analytics/AnalyticsMetricsPage.tsx`

> Client component that renders a whole garage-admin analytics screen: a heading, a page-wide range/interval control bar, and a grid of KPI chart cards filled from one backend analytics endpoint.

**Kind:** React component (client) · **Lines:** 293

## Purpose
The Traction and Subscriptions admin pages are the same screen with different metrics and endpoints. Both render this component, so the fetch logic and the per-card filter logic live in one place. It is the only file in `components/analytics/` that talks to the backend. Everything it renders (`ControlBar`, `ChartCard`) is presentational.

## How it works
**Two levels of filtering**
1. **Page-wide.** `AnalyticsMetricsPage` holds `rangePreset`, `interval` and `customRange`. When they change, `query` is rebuilt and one bulk request, `GET <endpoint>?rangeStart&rangeEnd&interval`, fills every card from `data.metrics[metric.id]`.
2. **Per card.** Each `MetricCard` can carry an `Override` (its own range, interval and optional custom window), set from the card's filter drawer or its fullscreen dialog. A card with an override makes its own request with `&metrics=<id>` and shows that result. Cards without one keep using the bulk payload.

Any page-wide change (`handleRangeChange` or `handleIntervalChange`) clears every override, so the grid is back on one shared window and the cards are comparable again.

**Query building (`buildQuery`)**
- A preset becomes `{start, end}` through `rangeFromPreset(range, Date.now())` from `mock.ts`.
- A custom window (`"YYYY-MM-DD"` strings) runs from `T00:00:00Z` on the start day to `T23:59:59Z` on the end day, so choosing the same date twice still gives one full day instead of a zero-length range.
- The query string carries `rangeStart` and `rangeEnd` (epoch ms), `interval` and, optionally, `metrics`.

**Interval defaults**
- Choosing a new page-wide preset also resets the interval with `defaultIntervalForPreset`. The exception is `"custom"`: it keeps the current interval, because a custom window could be one day or three years long.
- In a card, choosing a range picks that range's default interval, and choosing an interval keeps the range.

**Requests**
Both effects keep a `cancelled` flag, so a late response from an earlier query cannot overwrite newer state. On failure they store `e.message` and set status `"error"`.

**Layout**
The grid uses `repeat(auto-fill, minmax(356px, 1fr))` and centres each card in its track. The comment explains why a card is never stretched: `ChartCard` is pixel-specified at 356 px, and `LineChart` maps pointer x to a data index assuming 1 CSS px equals 1 SVG unit, so stretching would break hover.

## Exports
- `AnalyticsMetricsPage({ title, subtitle, endpoint, metrics, defaultRange? })` - the page body. `endpoint` is a backend path such as `"/garage-admin/analytics/subscriptions"`. `defaultRange` defaults to `"last_12_months"`.
- `AnalyticsMetric` - `{ id: string; title: string; unit: ChartUnit }`. `id` must match a backend metric id.

`MetricCard`, `buildQuery` and the response types are module-private.

## Interfaces
- **Backend endpoints called** (through `garageAdminApi`, with `Authorization: Bearer <garage_admin_token>`):
  - `GET /backend/garage-admin/analytics/traction?rangeStart=&rangeEnd=&interval=[&metrics=]` - Traction metrics.
  - `GET /backend/garage-admin/analytics/subscriptions?...` - Subscription metrics.
  - Both are served by `server/routes/garageAdminAnalytics.ts` (mounted at `/garage-admin`), behind `requireGarageAdminAuth`, and return `{ interval, buckets, metrics: { [id]: { points, headline, total } } }`.
- **Browser storage:** `garageAdminApi` reads `localStorage.garage_admin_token`. This component does not touch storage directly.

## Dependencies
- **Internal:** `./ChartCard` (renders each card), `./ControlBar` (`ControlBar`, `DateRangePreset`), `./mock` (`rangeFromPreset`, `defaultIntervalForPreset`, the only helpers used from it), `./types`, `@/lib/api` (`garageAdminApi`).
- **Packages:** `react`.

## Used by
- `app/garage-admin/(admin-dashboard)/analytics/traction/page.tsx` - route `/garage-admin/analytics/traction`, 10 count metrics.
- `app/garage-admin/(admin-dashboard)/analytics/subscriptions/page.tsx` - route `/garage-admin/analytics/subscriptions`, 4 subscription metrics.

## Notes
- **Per-card custom range looks buggy.** When a card's drawer applies `"custom"`, `onRangeChange` builds the override with `interval: defaultIntervalForPreset("custom")`. That function has no `"custom"` case, so the interval is `undefined`. `URLSearchParams` then sends `interval=undefined`, which the backend's zod enum rejects with a 400, so the card shows an error. If the user changes the interval in the same Apply, `ChartCard` calls `onIntervalChange` right after `onRangeChange`. That handler builds its override from the range and custom dates captured before the change, so the newer override replaces the custom one.
- `buildQuery` with `range === "custom"` and no dates would call `rangeFromPreset("custom")`, which returns `undefined`, and crash on `r.start`. Today the UI prevents this: the drawer's Apply is disabled without both dates, and `ControlBar` commits the window before the range.
- The headline means "created within the range" and `total` is the all-time running count, which `ChartCard` shows underneath.
