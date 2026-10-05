"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchDiscoverOffices,
  type DiscoverCategory,
  type DiscoverOffice,
} from "@/lib/discover-api";
import { SkeletonBar } from "./OfficesSkeletons";
import { OfficeEmblem, formatCount } from "./ui";

const RESULT_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 250;

export function shortcutLabel() {
  if (typeof navigator === "undefined") return "⌘ K";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘ K" : "Ctrl K";
}

/**
 * The ⌘K panel under the top bar: top matching offices as you type, arrow
 * keys to move, Enter to open. With nothing typed it offers categories.
 */
export function OfficeSearchPalette({
  query,
  onQueryChange,
  onClose,
  categories,
  onOpenOffice,
  onSubmit,
  onSelectCategory,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  categories: DiscoverCategory[];
  onOpenOffice: (office: DiscoverOffice) => void;
  /** Enter with nothing highlighted: the full search page. */
  onSubmit: (q: string) => void;
  onSelectCategory: (category: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<DiscoverOffice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmed = query.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchDiscoverOffices({ search: trimmed, limit: RESULT_LIMIT })
        .then((res) => {
          if (cancelled) return;
          setResults(res.organizations || []);
          setTotal(res.pagination?.total ?? 0);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) onOpenOffice(results[activeIndex]);
      else if (trimmed) onSubmit(trimmed);
    }
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-x-0 bottom-0 top-[76px] z-40 bg-black/70 animate-in fade-in-0 duration-150"
      />
      <div
        role="dialog"
        aria-label="Search offices"
        className="fixed left-1/2 top-[88px] z-50 flex w-[564px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 rounded-[20px] border border-[#3a362c] bg-[#181713] p-2.5 shadow-[0_18px_21px_rgba(0,0,0,0.4)] animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="flex h-11 items-center gap-2.5 rounded-full border border-[#ffc200] bg-[#181713] px-[15px] shadow-[0_10px_30px_rgba(214,155,48,0.2)]">
          <Search className="size-[17px] shrink-0 text-[#747169]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search offices"
            aria-label="Search offices"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#f5f1e7] outline-none placeholder:text-[#747169]"
          />
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-[#747169]" />
          ) : (
            <kbd className="shrink-0 rounded-[6px] bg-[#201e18] px-[7px] py-[3px] font-sans text-[11px] text-[#747169]">
              {shortcutLabel()}
            </kbd>
          )}
        </div>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-2 pb-2 pt-2.5">
          {trimmed ? (
            <>
              <div className="flex items-start justify-between text-[#747169]">
                <p className="text-[12px] font-semibold uppercase">Top results</p>
                {!loading && !error && (
                  <p className="text-[11px]">
                    {total} {total === 1 ? "match" : "matches"}
                  </p>
                )}
              </div>
              {error ? (
                <p className="px-4 py-3 text-[13px] text-[#aaa69c]">Search isn&apos;t responding. Try again in a moment.</p>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {results.map((office, i) => (
                    <button
                      key={office._id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => onOpenOffice(office)}
                      className={cn(
                        "flex w-full items-center gap-3.5 rounded-[14px] px-4 py-3 text-left transition-colors",
                        i === activeIndex ? "bg-[#201e18]" : "hover:bg-[#201e18]"
                      )}
                    >
                      <OfficeEmblem
                        name={office.name}
                        icon={office.icon}
                        className="size-[42px] rounded-[14px] bg-[rgba(229,184,92,0.1)]"
                        textClassName="text-[15px] text-[#ffc200]"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-[15px] font-semibold text-[#f5f1e7]">{office.name}</p>
                        <p className="truncate text-[11px] text-[#747169]">
                          {[office.category, office.memberCount ? `${formatCount(office.memberCount)} members` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-[#747169]" />
                    </button>
                  ))}
                  {total > results.length && (
                    <button
                      type="button"
                      onClick={() => onSubmit(trimmed)}
                      className="rounded-[14px] px-4 py-2.5 text-left text-[13px] font-medium text-[#ffc200] hover:bg-[#201e18]"
                    >
                      See all {total} results
                    </button>
                  )}
                </div>
              ) : !loading ? (
                <p className="px-4 py-3 text-[13px] text-[#aaa69c]">
                  No offices match &ldquo;{trimmed}&rdquo;.
                </p>
              ) : (
                <div className="flex flex-col gap-1" aria-hidden>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3.5 px-4 py-3">
                      <SkeletonBar className="size-[42px] shrink-0 rounded-[14px]" />
                      <div className="flex flex-1 flex-col gap-2">
                        <SkeletonBar className="h-4 w-40 max-w-full" />
                        <SkeletonBar className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            categories.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[12px] font-semibold uppercase text-[#747169]">Browse categories</p>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 8).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onSelectCategory(c.name)}
                      className="inline-flex h-[42px] items-center rounded-full border border-[#2b2923] bg-[#121210] px-4 text-[13px] font-medium text-[#aaa69c] transition-colors hover:border-[#3a362c] hover:text-[#f5f1e7]"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          <div className="mt-1 flex items-start justify-between border-t border-[#2b2923] pt-3 text-[11px] text-[#747169]">
            <p>↑↓ Navigate · ↵ Open</p>
            <p>Esc to close</p>
          </div>
        </div>
      </div>
    </>
  );
}
