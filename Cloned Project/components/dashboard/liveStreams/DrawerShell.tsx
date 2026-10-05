"use client";

/**
 * The docked right-hand drawer every Live Streams panel sits in.
 *
 * Shared rather than copied because the Options drawer and the Switch View
 * panel are the same object to a founder — they open from the same table, sit
 * in the same place, and are navigated with the same back button. When the
 * shell lived in both files they drifted: one kept a floating rounded card
 * while the other was docked, and the two circular header buttons ended up
 * with different hover states.
 *
 * Docked, not floating: full height, flush to the right edge, square corners,
 * one hairline border on the left. A floating panel with a margin reads as a
 * modal — something you dismiss — where this is a workspace you act in.
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Search, X } from "lucide-react";

export function DrawerShell({
  open,
  title,
  onBack,
  onClose,
  searching,
  onToggleSearch,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  loading,
  skeleton,
  children,
}: {
  open: boolean;
  title: string;
  /** Back arrow action — usually "return to the root panel", falling back to
   *  closing when already there. */
  onBack: () => void;
  /** Backdrop click + Escape. */
  onClose: () => void;
  /** Omit `onToggleSearch` to hide the search affordance; the slot stays so
   *  the title remains optically centred. */
  searching?: boolean;
  onToggleSearch?: () => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** Swaps the header controls and the body for `skeleton`. The header is
   *  skeletonised too — leaving live back/search buttons above placeholder
   *  content invites a click on a panel that has nothing to show yet. */
  loading?: boolean;
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  // A full-screen scrim with no keyboard escape is a trap for anyone not
  // using a mouse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onBack]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 right-0 top-0 z-[121] flex h-screen w-[400px] max-w-full flex-col border-l border-[#222225] bg-[#121214] shadow-[inset_1px_0_0_0_rgba(255,255,255,0.06)]"
            role="dialog"
            aria-label={title}
          >
            {loading ? (
              <header className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="mx-auto h-5 w-28 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              </header>
            ) : (
              <header className="flex items-center justify-between gap-3 px-5 py-4">
                <CircleButton onClick={onBack} label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </CircleButton>

                <h2 className="flex-1 text-center text-[17px] font-semibold tracking-wide text-white">
                  {title}
                </h2>

                {onToggleSearch ? (
                  <CircleButton
                    onClick={onToggleSearch}
                    label={searching ? "Close search" : "Search"}
                  >
                    {searching ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </CircleButton>
                ) : (
                  // Placeholder, not a missing element — without it the title
                  // shifts right by 36px on panels that have no search.
                  <span className="h-9 w-9 shrink-0" aria-hidden />
                )}
              </header>
            )}

            {!loading && onToggleSearch && searching && (
              <div className="px-5 pb-3">
                <input
                  autoFocus
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-[#2A2A2E] bg-white/[0.04] px-3 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-brand/40"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {loading ? skeleton : children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function CircleButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rim-light rim-light-strong flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-white transition hover:bg-white/[0.1]"
    >
      {children}
    </button>
  );
}

/** The rounded, divided card every panel groups its rows into. */
export function DrawerCard({ children }: { children: ReactNode }) {
  return (
    // `rim-light` draws the border, so no `border` class here — the two
    // together would stack a flat outline under the lit one.
    <div className="rim-light divide-y divide-[#26262A] overflow-hidden rounded-2xl bg-[#18181B]/80">
      {children}
    </div>
  );
}

/* ── loading placeholders ───────────────────────────────────────────────── */

/**
 * The nine-ish action rows, as placeholders.
 *
 * Shaped like the real rows — icon, two text lines, chevron — so the panel
 * doesn't reflow when content arrives. `rows` defaults to 9, the full Options
 * list; the Switch View root passes 2.
 */
export function DrawerListSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <DrawerCard>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
          <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 h-3.5 w-24 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-2.5 w-48 max-w-full animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="h-3 w-3 shrink-0 animate-pulse rounded bg-white/[0.04]" />
        </div>
      ))}
    </DrawerCard>
  );
}

/**
 * The recurring-series picker, as placeholders: a search field above five
 * avatar rows. Separate from DrawerListSkeleton because that step leads with
 * a search bar and uses round avatars rather than glyphs.
 */
export function SeriesPickerSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <div className="rim-light mb-3 h-10 w-full animate-pulse rounded-xl bg-white/[0.04]" />
      <DrawerCard>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 h-3.5 w-32 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </DrawerCard>
    </>
  );
}
