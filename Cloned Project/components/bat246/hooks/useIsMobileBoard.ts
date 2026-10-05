"use client";

import { useSyncExternalStore } from "react";

/**
 * Below this width the board page renders BoardLayoutMobile instead of the
 * desktop BoardLayout.
 *
 * Deliberately NOT the repo's generic useIsMobile (768px): the desktop board
 * is a fixed ~1,900px design that only shrinks uniformly, so at 768–1023px
 * (tablet portrait, big phones in landscape) it is already scaled to ~0.4–0.5
 * and unreadable. The stacked layout is the better fit all the way up to the
 * `lg` breakpoint.
 */
const QUERY = "(max-width: 1023px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
// Server has no viewport — render desktop, then correct on the client before
// first paint (useSyncExternalStore re-renders synchronously on hydration).
const getServerSnapshot = () => false;

export function useIsMobileBoard(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
