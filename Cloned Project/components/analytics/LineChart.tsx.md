# `components/analytics/LineChart.tsx`

> Client component that draws one or more timeseries as an SVG line chart inside a given `ChartGeometry`. It handles loading, error and empty states, a pointer- and keyboard-driven crosshair, optional tooltip, axis echo chips and a hidden data table for screen readers.

**Kind:** React component (client) · **Lines:** 863

## Purpose
This is the one chart renderer in `components/analytics/`. It deliberately knows nothing about cards, titles or dialogs. It draws into exactly the box described by the `geometry` prop, which is what lets `ChartCard` (356 px card) and `ChartFullscreenDialog` (responsive width) share it. The header comment says a future `BarChart` is meant to fit into `ChartCard` the same way.

## How it works

### Layout and scales (L94-L213)
- **X spacing.**
  - `pointCount` is the length of the longest series.
  - The pitch is `ppp = plot.width / (pointCount - 1)` whenever there are at least 2 points, so the series always fills the plot exactly. The `pixelsPerPoint` prop is used only when there are 0 or 1 points.
  - `virtualWidth` and `useChartPan` are still wired up, but with this pitch the canvas never exceeds the viewport, so panning is effectively inactive.
  - `xAt(i) = plot.x - pan.offset + i * ppp`.
- **Y scale.**
  - All finite values across every series give `domainMin` and `domainMax`.
  - `niceTicks(min, max, geometry.yTickCount, unit)` produces the ticks, and `formatTicks` labels them.
  - `yAt` is `scaleLinear` from the first and last tick to the plot's bottom and top.
- **Year suffix.** `multiYear` is true when `series[0]` spans more than one UTC year. Every x label and chip then gets a `'YY` suffix.
- **X labels (`xLabels`).**
  - The labels cover the visible index range only.
  - How many fit is capped by a minimum width per label (`minLabelPx`), which depends on the interval and `multiYear`: 92 px for hourly, 64 or 84 px for daily/weekly, 44 or 64 px otherwise.
  - The count is also capped by `xTickCount` (default 6; the dialog passes `Infinity`).
  - Labels are placed every `stride` points, a constant whole number. The comment explains that rounding even fractions skipped irregular months (Nov/Mar/Jul vanished), which looked like missing data.
  - The last point is always labelled. If the label before it would be closer than half a stride, that earlier label is dropped.

### Drawing (L426-L614)
- **States.**
  - `loading` renders `ChartSkeleton`: a plot rectangle and tick placeholders, pulsing unless the user prefers reduced motion (`usePrefersReducedMotion`).
  - `error` renders a `role="alert"` box with `errorMessage`.
  - `ready` with no finite values renders `emptyMessage` over the plot.
- **SVG layer (`aria-hidden`).** Gridlines are snapped with `crisp`. Y labels are right-aligned to `geometry.yLabelRight` and x labels sit at `geometry.xLabelY`. Series paths are clipped to the plot through a `clipPath` whose id comes from `useId()`, so server and client produce the same id.
- **Gaps and colours.**
  - `buildRuns` splits each series into runs of consecutive non-null points.
  - A run of 2 or more points draws as a path with stroke width 2. A one-point run draws as a dot of radius 4, which also covers a series with a single point.
  - Colour is `series.color`, otherwise from `SERIES_PALETTE`: gold `#FFC200`, translucent white, blue, green.
- **Crosshair (when `showCrosshair` is on).**
  - A vertical guide is drawn whenever an index is hovered. A horizontal guide is drawn only when the primary series has a value there.
  - Every series gets a marker at the hovered index.
  - The guides use `CROSSHAIR_GUIDE`, a brighter version of the gridline colour, so they read as guides rather than data.

### Interaction (L215-L424, L616-L665)
The interactive surface is a `role="group"` div exactly the size of the plot, layered above the SVG. It is focusable when there is data, uses `touchAction: pan-y`, and shows a focus ring on keyboard focus.
- **Hit-testing.** `indexFromClientX` converts the pointer x to an index with `round((localX + offset) / ppp)`, then clamps it. The comment stresses that this must stay the exact inverse of `xAt` and must use `ppp`, not the `pixelsPerPoint` prop. Using the prop made the crosshair lag the cursor on wide ranges.
- **Mouse.** Moving with no button pressed sets the hover index. Moving with a button held counts as a drag-to-pan and clears the hover.
- **Touch and pen.** Touching down shows a crosshair preview. Moving more than `TOUCH_MOVE_THRESHOLD` (8 px) turns the gesture into a pan and clears the crosshair for the rest of it. Lifting after a movement under the threshold counts as a tap and places the crosshair.
- **Clearing.** Pointer cancel, pointer leave and blur all clear the hover.
- **Keyboard with the crosshair on.**
  - Left and Right arrows move one bucket. Home and End jump to the first and last point.
  - Page Up and Page Down jump by `pageJump`, one tenth of the range. Escape clears the crosshair.
  - The view pans only as much as needed to keep the crosshair in frame.
  - With no crosshair yet, the first key press starts from the point at the left edge.
- **Keyboard with the crosshair off.** The arrow, Home, End and Page keys pan the viewport directly.
- **Reporting hover.** Every hover change also calls `onHoverChange(index | null)`. `ChartCard` uses this to swap its header to the hovered point.
- **Edge fades.** Gradients at the left and right edges appear when more data is off-screen (`pan.canPan` and not at that end).

### Overlays and accessibility (L667-L862)
- **`YAxisChip`.** A gold chip in the y-label margin showing the exact value, formatted with `formatTicks`.
- **`XAxisChip`.** A dark chip below the x labels showing the bucket date, formatted with `formatAxisDate`. Using the same formatters as the axes means the chips can never disagree with them.
- **`CrosshairTooltip`** (when `showTooltip` is on). Shows the long date and each series' value with `formatValue`. When the crosshair is within 140 px of the right edge, it flips to the crosshair's left.
- **Screen-reader table.** An `sr-only` table mirrors all the plotted data, with one row per bucket (long date) and one column per series. The SVG is `aria-hidden`, so this table is the real data path for assistive technology.
- **Live region.** An `aria-live="polite"` region announces `"<long date>: <value>"` as the crosshair moves, and clears when it is idle.

## Exports
- `LineChart(props: LineChartProps)` - the chart.
- `LineChartProps`:
  - `geometry`, `series`, `unit`, `interval` - required data and layout.
  - `status?` - defaults to `"ready"`.
  - `errorMessage?`, `emptyMessage?` - have defaults.
  - `pixelsPerPoint?` (default 26), `showCrosshair?`, `showTooltip?`, `onHoverChange?`, `xTickCount?` (default 6) - behaviour options.
  - `ariaLabel` (required), `className?`.
- `LineChartStatus` - `"loading" | "error" | "ready"`.

Internal helpers: `usePrefersReducedMotion`, `buildRuns`, `CrosshairTooltip`, `YAxisChip`, `XAxisChip`, `ChartSkeleton`.

## Interfaces
- **Browser APIs:** `window.matchMedia("(prefers-reduced-motion: reduce)")` with a change listener; pointer capture through `useChartPan`.

## Dependencies
- **Internal:**
  - `./types` - geometry, series and unit types.
  - `./scale` - `niceTicks`, `scaleLinear`, `crisp`.
  - `./format` - `formatAxisDate`, `formatAxisDateLong`, `formatTicks`, `formatValue`.
  - `./use-chart-pan` - offset state and pointer handlers.
- **Packages:** `react` (`useState`, `useEffect`, `useMemo`, `useRef`, `useId`).

## Used by
- `components/analytics/ChartCard.tsx` - compact 356 px card with `showCrosshair`.
- `components/analytics/ChartFullscreenDialog.tsx` - responsive width with `showCrosshair`, `showTooltip` and `xTickCount={Infinity}`.

## Notes
- **Primary series.** The crosshair value, the axis chips, the x labels, the screen-reader row headers and the live-region text all come from `series[0]`. Extra series are drawn and get markers, but they are assumed to share `series[0]`'s timestamps, as the `ChartSeries` contract requires.
- **Unused handlers.** `pan.handlers.onWheel` is never attached to the hit region. The plain-pan keyboard branch and the edge fades only matter if a canvas wider than the viewport is ever brought back.
- **Hover math depends on layout.** Pointer mapping assumes the rendered box matches `geometry` (1 CSS px = 1 SVG unit). Do not scale the component with CSS transforms or stretched widths.
- `Math.min(...allValues)` and `Math.max(...allValues)` spread the whole array. That is fine at the bucket counts used here (up to about 2000).
