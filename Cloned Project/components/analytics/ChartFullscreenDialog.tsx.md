# `components/analytics/ChartFullscreenDialog.tsx`

> Client component for the "maximize" view of a KPI card: a Radix dialog showing the same `LineChart` at a responsive width, with a floating tooltip and optional inline range and interval dropdowns.

**Kind:** React component (client) · **Lines:** 171

## Purpose
The compact card has only a 293x210 plot, so it cannot fit a floating tooltip or detailed axes. This dialog renders the same series with more room: bigger margins, 8 y-ticks, no cap on x labels, and the `CrosshairTooltip` turned on (`showTooltip`). It can also re-filter the chart from inside the dialog, so the user does not have to close it to change the range.

## How it works
- **Width.** The chart width follows the dialog. A `ResizeObserver` on the container (attached only while `open`) stores the rounded content width, starting at 900. Each render calls `computeGeometry` with that width, a fixed height of 460 (`DIALOG_HEIGHT`) and margins 16/56/72/32 (top/bottom/left/right).
- **Header.**
  - `DialogTitle` shows the title and `formatValue(headline, unit)`. While loading it shows a pulsing placeholder (the same treatment as the card), and on error it shows "—".
  - When `range`, `onRangeChange` and `onIntervalChange` are all passed, `InlineFilters` from `ControlBar.tsx` sits beside the title.
  - `pr-8` keeps those controls clear of the dialog's close button.
- **Focus handling.** `onOpenAutoFocus` calls `preventDefault()` and focuses the dialog element itself. Otherwise Radix would focus the first focusable node, which is the chart's keyboard-operable hit region, and draw its gold focus ring every time the dialog opens. The ring still appears when a user tabs to the chart.
- **Chart.** `LineChart` is rendered with `showCrosshair`, `showTooltip` and `xTickCount={Infinity}`, so labels are limited only by how many fit (`minLabelPx`). `pixelsPerPoint` defaults to 34.
- **Stacking.** `DialogContent` gets `zIndex: 1100`. This is why `ControlBar`'s drawer (z-100) cannot be used here, and why `InlineMenu` uses z-1200.
- Escape-to-close, the close button and focus trapping come from `components/ui/dialog.tsx`.

## Exports
- `ChartFullscreenDialog(props: ChartFullscreenDialogProps)` - the dialog.
- `ChartFullscreenDialogProps`:
  - `open`, `onOpenChange` - dialog visibility.
  - `title`, `unit`, `interval`, `status`, `errorMessage?`, `series`, `headline` - the chart content.
  - `pixelsPerPoint?` - spacing hint passed to `LineChart`.
  - `range?`, `customStart?`, `customEnd?`, `onRangeChange?(next)`, `onIntervalChange?(next)` - optional filters. Leave them out and no filters are shown.

## Dependencies
- **Internal:**
  - `@/components/ui/dialog` - `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`.
  - `./ControlBar` - `InlineFilters`, `DateRangePreset`.
  - `./LineChart` - the chart.
  - `./scale` - `computeGeometry`.
  - `./format` - `formatValue`.
  - `./types` - shared types.
- **Packages:** `react`.

## Used by
`components/analytics/ChartCard.tsx` only. Every card renders one, and it opens from the card's maximize button.

## Notes
- The width comment in `AnalyticsMetricsPage` (1 CSS px = 1 SVG unit) holds here too: the geometry is recomputed from the measured width instead of being scaled with CSS.
- Custom ranges cannot be chosen in this dialog. `InlineFilters` leaves out the "custom" option, but a card that already uses a custom window still shows its dates as the current value.
