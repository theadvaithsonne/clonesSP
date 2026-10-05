"use client";

import { createPortal } from "react-dom";

/**
 * Renders children into <body> so fixed overlays escape any transformed /
 * z-indexed ancestor stacking context — otherwise their z-index can't beat the
 * global quick-add FAB (which lives at the layout root). SSR-safe: returns null
 * on the server (overlays only have content after user interaction anyway).
 */
export function DrawerPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
