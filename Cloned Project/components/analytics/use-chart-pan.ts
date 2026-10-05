"use client";

// Drag / wheel horizontal panning over a virtual-width plot, plus the
// clamped `setOffset` LineChart's keyboard handler drives directly for
// crosshair-triggered edge-panning (arrow keys move the crosshair, not the
// viewport — see LineChart.tsx's onKeyDown — so keyboard input isn't
// wired up as a handler here, just `offset`/`setOffset`/`maxOffset`).
//
// The plot is always laid out at a fixed pixels-per-point, so a series with
// more points than fit the viewport produces a virtual canvas wider than
// the visible plot. This hook owns the scroll offset into that canvas and
// every input method that can move it, clamped so it never scrolls into
// empty space on either end.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampPan } from "./scale";

export interface ChartPanHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
}

export interface ChartPanResult {
  /** Current scroll offset in px, measured from the start of the virtual
   *  canvas. */
  offset: number;
  setOffset: (next: number | ((prev: number) => number)) => void;
  maxOffset: number;
  /** True when more data exists off-screen to the left/right — drives the
   *  edge-fade affordance. */
  atStart: boolean;
  atEnd: boolean;
  /** Whether panning is even possible (virtual canvas fits the viewport). */
  canPan: boolean;
  handlers: ChartPanHandlers;
}

export function useChartPan(params: {
  virtualWidth: number;
  viewportWidth: number;
  /** Called after any offset change (post-clamp). Optional — most callers
   *  just read `offset` back from the return value each render. */
  onOffsetChange?: (offset: number) => void;
}): ChartPanResult {
  const { virtualWidth, viewportWidth, onOffsetChange } = params;
  const maxOffset = Math.max(0, virtualWidth - viewportWidth);

  const [offset, setOffsetRaw] = useState(0);
  const dragRef = useRef<{ startX: number; startOffset: number; pointerId: number } | null>(
    null
  );

  const setOffset = useCallback(
    (next: number | ((prev: number) => number)) => {
      setOffsetRaw((prev) => {
        const raw = typeof next === "function" ? (next as (p: number) => number)(prev) : next;
        const clamped = clampPan(raw, virtualWidth, viewportWidth);
        if (clamped !== prev) onOffsetChange?.(clamped);
        return clamped;
      });
    },
    [virtualWidth, viewportWidth, onOffsetChange]
  );

  // Re-clamp when the virtual/viewport size changes — e.g. switching
  // interval changes point count, resizing the window changes the
  // viewport. Without this a stale offset could point past the new max.
  useEffect(() => {
    setOffsetRaw((prev) => clampPan(prev, virtualWidth, viewportWidth));
  }, [virtualWidth, viewportWidth]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, startOffset: offset, pointerId: e.pointerId };
    },
    [offset]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      // Dragging right (positive dx) reveals earlier data -> offset decreases.
      setOffset(drag.startOffset - dx);
    },
    [setOffset]
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      // Only hijack genuinely horizontal gestures (trackpad shift-scroll,
      // horizontal swipe, or shift+wheel) — a plain vertical wheel should
      // keep scrolling the page, not get eaten by the chart.
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
      if (!horizontalIntent) return;
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      setOffset((o) => o + delta);
    },
    [setOffset]
  );

  const handlers = useMemo<ChartPanHandlers>(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onWheel,
    }),
    [onPointerDown, onPointerMove, endDrag, onWheel]
  );

  return {
    offset,
    setOffset,
    maxOffset,
    atStart: offset <= 0,
    atEnd: offset >= maxOffset,
    canPan: maxOffset > 0,
    handlers,
  };
}
