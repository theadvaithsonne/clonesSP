"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface LayawayPickedUser {
  userId: string;
  name: string;
  email: string;
  profilePicture?: string | null;
  eligibility?: { totalRemaining: number; isAlanK: boolean };
}

/**
 * Small single-select debounced search dropdown, shared by the "Give"
 * (recipient search) and "Request" (eligible-person search) panels in
 * LayawayModal.tsx and SnapBackLoanModal.tsx. Mirrors the debounce/
 * outside-click pattern of components/ui/user-search-picker.tsx, but
 * single-select and pointed at the bat246-scoped endpoints (which return
 * {userId,...}, not {_id,...}).
 *
 * The results list is portaled to document.body and positioned with
 * `fixed` coordinates measured off the input, rather than living inline
 * as `absolute` — every usage of this component sits inside a modal
 * whose wrapper is `overflow-y-auto` with a height that fits its
 * in-flow content, so an inline-absolute dropdown near the top of a
 * short step (e.g. the very first field shown) gets its bottom sliced
 * off by that scroll boundary instead of rendering fully visible. Fixed
 * positioning off the input's real screen coordinates sidesteps that
 * entirely, and keeps working if a future step ever needs it lower on
 * a long, actually-scrolled modal too.
 */
export function LayawayUserSearch({
  endpoint,
  resultsKey,
  placeholder = "Search by name or email…",
  onSelect,
  showRemaining,
}: {
  endpoint: string;
  resultsKey: "users" | "people";
  placeholder?: string;
  onSelect: (u: LayawayPickedUser) => void;
  showRemaining?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LayawayPickedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // A slower earlier request (e.g. "red") must not overwrite the results of
    // a later one ("red baron") that already came back.
    let stale = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
        const res = await fetch(`${API}${endpoint}?q=${encodeURIComponent(query.trim().replace(/\s+/g, " "))}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!stale) setResults(data[resultsKey] ?? []);
      } catch {
        if (!stale) setResults([]);
      } finally {
        if (!stale) setLoading(false);
      }
    }, 250);
    return () => {
      stale = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, endpoint, resultsKey]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      // The dropdown is portaled to document.body, so it's no longer a
      // DOM descendant of containerRef — without also checking it here,
      // a mousedown on a result registers as "outside" and closes the
      // dropdown before its own onClick (which fires onSelect) ever runs.
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keep the portaled dropdown's screen position glued to the input,
  // including when the modal it lives in is itself scrolled.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const showDropdown = open && (query.trim() || loading);

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 sm:w-5 sm:h-5 text-white/30 pointer-events-none" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full pl-11 sm:pl-12 py-3 sm:py-3.5 text-base sm:text-xl rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/30 placeholder:text-sm sm:placeholder:text-lg focus:outline-none focus:border-yellow-500 transition-colors"
      />
      {showDropdown && dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            className="bg-[#0a0a0e] border border-white/15 rounded-lg shadow-xl max-h-72 overflow-y-auto z-[20050]"
          >
            {loading ? (
              <div className="flex items-center justify-center p-4 sm:p-5">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-white/40" />
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 sm:p-5 text-base sm:text-lg text-white/40 text-center">No matches</div>
            ) : (
              results.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => {
                    onSelect(u);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 hover:bg-white/10 transition-colors text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base sm:text-xl text-white truncate">{u.name}</span>
                    <span className="block text-sm sm:text-base text-white/45 truncate">{u.email}</span>
                  </span>
                  {showRemaining && u.eligibility && (
                    <span className="shrink-0 text-base sm:text-lg font-bold text-yellow-400">
                      {u.eligibility.isAlanK ? "∞" : `$${u.eligibility.totalRemaining.toLocaleString()}`}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
