"use client";

import { useCallback, useRef } from "react";

type Options = {
  delay?: number;
  movementTolerance?: number;
};

// Returns handlers that fire `onLongPress` after a touch-and-hold gesture.
// Designed for mobile - desktop hover/click flow stays untouched.
export function useLongPress(onLongPress: () => void, options: Options = {}) {
  const { delay = 450, movementTolerance = 10 } = options;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const triggered = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      triggered.current = false;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = setTimeout(() => {
        triggered.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate?.(15); } catch {}
        }
        onLongPress();
      }, delay);
    },
    [delay, onLongPress]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - start.current.x);
      const dy = Math.abs(t.clientY - start.current.y);
      if (dx > movementTolerance || dy > movementTolerance) clear();
    },
    [movementTolerance, clear]
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (triggered.current) {
      // Suppress the synthetic click that follows a long press
      e.preventDefault();
    }
    clear();
  }, [clear]);

  const onTouchCancel = useCallback(() => clear(), [clear]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
