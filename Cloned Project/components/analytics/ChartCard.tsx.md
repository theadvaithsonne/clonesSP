# `components/analytics/ChartCard.tsx`

> Client component for the fixed 356x356 KPI card from the Figma design: a title, a big headline number, a `LineChart`, plus buttons to filter the card and to open it fullscreen.

**Kind:** React component (client) · **Lines:** 214

## Purpose
`ChartCard` is the only place where the exact pixel spec from the "Admin -> Analytics -> Traction" Figma card lives. It computes one fixed `ChartGeometry` and passes it to the shared `LineChart`, so the chart renderer never deals with card layout. It also wires in the per-card filter drawer and the fullscreen dialog.

## How it works
- **Geometry.** `CARD_GEOMETRY` is computed once at module load with `computeGeometry`. The card is 356x356. The plot starts at x 42 / y 99 and is 293x210 with 6 gridlines. Y labels right-align to x 34 and the x-label baseline sits at y 326. The comments record the measured Figma values: radius 10, fill `rgba(68,68,68,0.2)`, and the title/value fonts.
- **Headline.**
  - While `status === "loading"`, a pulsing skeleton bar replaces the number. On `"error"` the number shows "—".
  - Otherwise it shows `formatValue(displayValue, unit)`. A `null` headline also renders as "—", never "0".
- **Hover readout.** The card has no room for a floating tooltip, so the header becomes the readout instead:
  - `LineChart` reports the crosshair index through `onHoverChange`, and the card stores it in `hoveredIndex`.
  - While hovering, the big number switches to `series[0].points[hoveredIndex].v` and a date line (`formatAxisDateLong`) appears below it.
  - When nothing is hovered, that sub-line shows `"<total> total"` if `total` is a number.
  - The sub-line keeps a fixed-height, truncating row, so nothing in the card moves on hover.
- **Fullscreen button** (`Maximize2` icon). Opens `ChartFullscreenDialog` with the same data.
- **Filter button** (`SlidersHorizontal` icon). Appears only when `range`, `onRangeChange` and `onIntervalChange` are all supplied. It opens `TractionFilterDrawer`, titled with the card's name, and turns brand-coloured when `filtered` is true.
- **Applying a filter.** On Apply, `onRangeChange` fires when the preset changed, or when the preset is `"custom"` and dates were picked (a custom window can change while the preset stays `"custom"`). `onIntervalChange` fires when the interval changed.
- **Filters inside the dialog.** The dialog gets the same handlers, but only when the card is filterable. Its `onRangeChange` drops the custom argument, because the dialog's inline filters cannot pick a custom window.
- **Chart props.** `LineChart` is rendered with `showCrosshair`. `pixelsPerPoint` defaults to 24 and the aria label is `"<title>, <interval>ly"`.

## Exports
- `ChartCard(props: ChartCardProps)` - the card.
- `ChartCardProps`:
  - `title`, `unit`, `interval`, `status` (`"loading" | "error" | "ready"`), `errorMessage?` - what to show and how to format it.
  - `series`, `headline` (`number | null`), `total?` - the data.
  - `pixelsPerPoint?`, `className?` - rendering options.
  - `range?`, `customStart?`, `customEnd?`, `onRangeChange?(next, custom?)`, `onIntervalChange?(next)`, `filtered?` - per-card filtering.

## Dependencies
- **Internal:**
  - `./LineChart` - the SVG chart.
  - `./ChartFullscreenDialog` - the enlarged view.
  - `./scale` - `computeGeometry`.
  - `./format` - `formatValue`, `formatAxisDateLong`.
  - `./ControlBar` - `TractionFilterDrawer`, `DateRangePreset`.
  - `./types` - shared types.
- **Packages:** `react` (`useState`), `lucide-react` (`Maximize2`, `SlidersHorizontal`).

## Used by
- `components/analytics/AnalyticsMetricsPage.tsx` - live data, with filter handlers.
- `app/garage-admin/(admin-dashboard)/analytics/sandbox/page.tsx` - mock fixtures, no filter handlers. Reached at `/garage-admin/analytics/sandbox`.

## Notes
- The card width is fixed on purpose. `LineChart` hit-testing assumes 1 CSS px equals 1 SVG unit, so the card must not be stretched with CSS.
- The fullscreen dialog receives `headline` but not `total`, and has no hover-swap header.
