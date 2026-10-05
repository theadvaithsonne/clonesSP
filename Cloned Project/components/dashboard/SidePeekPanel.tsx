"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppWindow, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const WIDTH_KEY = "dashboard.sidepeek.width";
const MIN_WIDTH = 360;
// Always leave this much of the page beside the peek.
const MIN_PAGE_GAP = 320;

const savedWidth = () => {
  if (typeof window === "undefined") return 560;
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (saved > 0) return saved;
  } catch {
    // storage unavailable — fall through to the default
  }
  return Math.min(760, Math.max(440, window.innerWidth * 0.45));
};

const HEADER_BUTTON =
  "h-8 w-8 flex items-center justify-center rounded-lg text-[#c7c7da] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:pointer-events-none";

export interface SidePeek {
  popover: string;
  title: string;
  subtitle?: string;
}

interface SidePeekPanelProps {
  peek: SidePeek | null;
  /** Width the right panel takes when it's open beside the peek (0 if closed). */
  rightOffset: number;
  /** The page's tab is already open, so "Open in new tab" has nothing to add. */
  tabOpen: boolean;
  onClose: () => void;
  onOpenFullPage: () => void;
  onOpenInNewTab: () => void;
  children: ReactNode;
}

/**
 * A page opened beside the current one ("Open in side peek" in the sidebar's
 * right-click menu). Sits in the right panel's slot on desktop, resizable
 * from its left edge; full screen on mobile.
 *
 * When the right panel opens as well — a peeked page playing a video or a
 * playlist there, say — the peek moves over to its left instead of covering
 * it, and gives up width if the window runs short.
 *
 * The body is a `side-peek` container: pages' sm:/md:/lg: breakpoints follow
 * the panel's width there (see globals.css), and, as in the main content
 * area, their fixed-position pieces stay inside it.
 */
export default function SidePeekPanel({
  peek,
  rightOffset,
  tabOpen,
  onClose,
  onOpenFullPage,
  onOpenInNewTab,
  children,
}: SidePeekPanelProps) {
  // What the user asked for; what's shown is that, fitted to the window.
  const [preferredWidth, setPreferredWidth] = useState(savedWidth);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const isOpen = !!peek;

  const maxWidth = Math.max(MIN_WIDTH, viewportWidth - rightOffset - MIN_PAGE_GAP);
  const width = Math.round(Math.min(Math.max(preferredWidth, MIN_WIDTH), maxWidth));
  const docked = rightOffset > 0;

  // Escape closes — unless something inside (a dialog, a menu) took it.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  // Focus moves into the peek when it opens, so the keyboard follows.
  useEffect(() => {
    if (isOpen) panelRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  // Pointer events + capture: one path for mouse, trackpad, pen and touch.
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = width;
    let latest = startWidth;
    setIsResizing(true);
    document.body.style.userSelect = "none";

    const handleMove = (ev: PointerEvent) => {
      latest = Math.round(Math.min(Math.max(startWidth + startX - ev.clientX, MIN_WIDTH), maxWidth));
      setPreferredWidth(latest);
    };
    const handleUp = () => {
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleUp);
      handle.removeEventListener("pointercancel", handleUp);
      setIsResizing(false);
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(WIDTH_KEY, String(latest));
      } catch {
        // storage unavailable — the width just isn't remembered
      }
    };
    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleUp);
    handle.addEventListener("pointercancel", handleUp);
  };

  const positionStyle = {
    "--side-peek-width": `${width}px`,
    "--side-peek-right": `${rightOffset}px`,
  } as CSSProperties;

  return (
    <AnimatePresence>
      {peek && (
        <motion.div
          key="side-peek-backdrop"
          // Stops at the right panel so that stays usable beside the peek;
          // the right panel's own tint already dims the page then.
          className={cn(
            "fixed inset-0 z-[1090] md:absolute md:right-[var(--side-peek-right)] md:z-[615]",
            docked ? "bg-transparent" : "bg-black/40 backdrop-blur-[2px]"
          )}
          style={positionStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
      )}
      {peek && (
        <motion.aside
          key="side-peek"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label={`Side peek: ${peek.subtitle ?? peek.title}`}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
          className={cn(
            "fixed inset-0 z-[1100] flex flex-col bg-[#0e0e12] outline-none md:absolute md:inset-y-0 md:left-auto md:right-[var(--side-peek-right)] md:z-[620] md:w-[var(--side-peek-width)] md:border-l md:border-[#2E2E2E] md:shadow-2xl",
            // Slides along when the right panel opens or closes beside it.
            !isResizing && "md:transition-[right,width] md:duration-300 md:ease-[cubic-bezier(0.16,1,0.3,1)]"
          )}
          style={positionStyle}
        >
          <div
            onPointerDown={startResize}
            className="absolute inset-y-0 left-0 z-20 hidden w-1.5 cursor-col-resize touch-none md:block"
            title="Drag to resize"
          />

          <header className="flex h-[48px] flex-shrink-0 items-center gap-1 border-b border-[#2E2E2E] bg-[#0e0e12]/95 pl-4 pr-2 backdrop-blur">
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-white">{peek.title}</span>
              {peek.subtitle && (
                <span className="truncate text-xs text-[#8888a0]">{peek.subtitle}</span>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenInNewTab}
              disabled={tabOpen}
              className={HEADER_BUTTON}
              title={tabOpen ? "Already open in a tab" : "Open in new tab"}
              aria-label="Open in new tab"
            >
              <AppWindow className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenFullPage}
              className={HEADER_BUTTON}
              title="Open as full page"
              aria-label="Open as full page"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className={HEADER_BUTTON} title="Close" aria-label="Close side peek">
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* data-side-peek + the `side-peek` container make the page's
              sm:/md:/lg: breakpoints follow this panel's width rather than
              the window's (see "Side peek breakpoints" in globals.css). */}
          <div data-side-peek="" className="@container/side-peek relative flex min-h-0 flex-1 flex-col">
            <div
              key={peek.popover}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {children}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
