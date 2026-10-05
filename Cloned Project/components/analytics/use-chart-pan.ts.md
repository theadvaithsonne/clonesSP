# `components/analytics/use-chart-pan.ts`

> React hook that owns the horizontal scroll offset into a chart drawn wider than its visible plot, with drag and horizontal-wheel panning and a clamped `setOffset`.

**Kind:** React hook (client) · **Lines:** 134

## Purpose
`LineChart` was designed around a fixed pixels-per-point spacing: a series with more points than fit the viewport becomes a "virtual canvas" wider than the plot, and the user pans through it. This hook keeps the offset into that canvas, always clamped so it never scrolls into empty space, and supplies the pointer and wheel handlers that move it. Keyboard input is not handled here. `LineChart`'s `onKeyDown` calls `setOffset` directly to keep the crosshair in view.

## How it works
- **Bounds.** `maxOffset = max(0, virtualWidth - viewportWidth)`. Every write goes through `clampPan` from `scale.ts`. `onOffsetChange` is called only when the clamped value actually changes.
- **Re-clamping.** An effect re-clamps the stored offset whenever `virtualWidth` or `viewportWidth` changes, for example after switching interval or resizing, so a stale offset cannot point past the new end.
- **Dragging.**
  - `onPointerDown` captures the pointer and records `{ startX, startOffset, pointerId }` in a ref.
  - `onPointerMove` (same pointer only) sets `offset = startOffset - dx`. Dragging right shows earlier data.
  - `onPointerUp` and `onPointerCancel` clear the drag.
- **Wheel.** Only horizontal gestures are taken over: `|deltaX| > |deltaY|`, or Shift is held. Those call `preventDefault` and shift the offset by the dominant delta. A plain vertical wheel keeps scrolling the page.
- **Return values.** `atStart`, `atEnd` and `canPan` drive `LineChart`'s edge-fade gradients and its grab cursor.

## Exports
- `useChartPan({ virtualWidth, viewportWidth, onOffsetChange? }): ChartPanResult` - the hook.
- `ChartPanHandlers` - `{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel }`, typed for React pointer and wheel events.
- `ChartPanResult` - `{ offset, setOffset(next | updater), maxOffset, atStart, atEnd, canPan, handlers }`.

## Dependencies
- **Internal:** `./scale` - `clampPan`.
- **Packages:** `react` (`useState`, `useRef`, `useCallback`, `useEffect`, `useMemo`).

## Used by
`components/analytics/LineChart.tsx` only.

## Notes
- In practice panning is mostly inactive now. `LineChart` sets the point pitch to `plot.width / (pointCount - 1)`, so the virtual width equals the viewport, `maxOffset` is 0 and `canPan` is false. The hook stays in place for callers or future chart kinds that need a wider canvas.
- `LineChart` attaches `handlers.onWheel` to nothing. It wires only the pointer handlers, so the wheel code here is currently unused.
