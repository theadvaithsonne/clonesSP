"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { DUR, EASE, cssEase } from "./motion";

/** A saved view / quick-filter preset — the Bigin "Views" dropdown. Each view is
 *  a named filter the page applies when selected. `count` (optional) rides along
 *  in the dropdown, replacing bespoke per-status pill counts. */
export interface TopBarView {
  id: string;
  label: string;
  /** Optional avatar shown on the active pill + row (else the label initial). */
  avatar?: string;
  count?: number;
}

/**
 * The shared, page-agnostic table top bar (generalized from the downline bar):
 * an optional filter toggle, an optional Views selector, the Bigin search-morph,
 * and a right-side actions slot. Every piece is opt-in — pass only what a page
 * needs. Rendered via <DataTable>'s `topBar` prop.
 */
export function TableTopBar({
  views,
  activeView,
  onViewChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  onOpenFilters,
  filterActive,
  leftActions,
  actions,
}: {
  views?: TopBarView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  onOpenFilters?: () => void;
  filterActive?: boolean;
  /** Leading slot, before the search (e.g. a Views switcher trigger). */
  leftActions?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const current = views?.find((v) => v.id === activeView) ?? views?.[0];
  const showSearch = typeof onSearchChange === "function";

  return (
    <div className="relative flex flex-none items-center gap-3 px-4 py-3">
      {/* Leading slot (e.g. Views switcher) — sits at the far left, before search. */}
      {leftActions && <div className="flex flex-none items-center gap-2">{leftActions}</div>}

      {/* Filter toggle */}
      {onOpenFilters && (
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label="Filters"
          className={`grid h-9 w-9 place-items-center rounded-full border transition ${
            filterActive
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      )}

      {/* Views selector */}
      {views && views.length > 0 && current && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setViewOpen((o) => !o)}
            className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] pl-2 pr-3 text-sm text-white transition hover:bg-white/[0.06]"
          >
            <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-[#FFA800] text-[11px] font-bold text-brand-foreground">
              {current.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                current.label.charAt(0)
              )}
            </span>
            <span className="font-medium">{current.label}</span>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>
          <AnimatePresence>
            {viewOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setViewOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: DUR.fast, ease: EASE.decel }}
                  className="absolute left-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111]/95 p-1 backdrop-blur-xl"
                >
                  {views.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        onViewChange?.(v.id);
                        setViewOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                        v.id === current.id
                          ? "bg-white/[0.06] text-white"
                          : "text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="truncate">{v.label}</span>
                      {typeof v.count === "number" && (
                        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
                          {v.count}
                        </span>
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Center search — click to expand to full width (Bigin morph). */}
      {showSearch && (
        <div className="relative flex flex-1 justify-center">
          <AnimatePresence initial={false} mode="wait">
            {searchOpen ? (
              <motion.div
                key="open"
                initial={{ width: "60%", opacity: 0.6 }}
                animate={{ width: "100%", opacity: 1 }}
                exit={{ width: "60%", opacity: 0 }}
                transition={{ duration: DUR.morph, ease: EASE.expo }}
                className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4"
              >
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  ref={inputRef}
                  value={search ?? ""}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange?.("");
                    setSearchOpen(false);
                  }}
                  className="grid h-6 w-6 place-items-center rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="closed"
                type="button"
                onClick={() => setSearchOpen(true)}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DUR.morph, ease: EASE.decel }}
                className="flex h-9 w-[min(520px,100%)] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-zinc-500 transition hover:bg-white/[0.05]"
                style={{ transition: `${DUR.micro}s ${cssEase(EASE.decel)}` }}
              >
                <Search className="h-4 w-4" />
                <span className="truncate">{search || searchPlaceholder}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Right-side actions (create, refresh, more…) */}
      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </div>
  );
}
