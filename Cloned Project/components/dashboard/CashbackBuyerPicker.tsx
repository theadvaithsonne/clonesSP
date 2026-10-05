"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchEligibleBuyers,
  type EligibleBuyer,
} from "@/lib/hooks/useCashbackCodes";

interface Props {
  selected: EligibleBuyer[];
  onChange: (buyers: EligibleBuyer[]) => void;
  disabled?: boolean;
}

function initials(buyer: EligibleBuyer) {
  const src = buyer.name || buyer.email || "?";
  return src
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function CashbackBuyerPicker({ selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<EligibleBuyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // Lazy-load on first open (one round-trip — list is bounded by direct downline).
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    fetchEligibleBuyers()
      .then(setPool)
      .catch((e) => setError(e?.message || "Failed to load downline"))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const selectedIds = new Set(selected.map((b) => b._id));
    const list = pool.filter((b) => !selectedIds.has(b._id));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q)
    );
  }, [pool, query, selected]);

  const remove = (id: string) =>
    onChange(selected.filter((b) => b._id !== id));

  return (
    <div className="space-y-2" ref={wrapRef}>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white text-sm flex items-center gap-2 transition-colors",
            "focus:outline-none focus:border-brand/40 hover:border-[#3a3a45]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Users className="w-4 h-4 text-[#6b6b80] shrink-0" />
          <span className="flex-1 text-left text-[#9fa0b8]">
            {selected.length === 0
              ? "Anyone in my direct downline"
              : `${selected.length} selected${
                  pool.length ? ` / ${pool.length} direct` : ""
                }`}
          </span>
          <ChevronDown className="w-4 h-4 text-[#6b6b80] shrink-0" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-[60] rounded-lg border border-[#2a2a35] bg-[#0e0e12] shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[#2a2a35] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#6b6b80] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="flex-1 bg-transparent text-sm text-white placeholder-[#6b6b80] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[#6b6b80] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-[#6b6b80] gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading direct downline…
                </div>
              ) : error ? (
                <div className="px-3 py-4 text-sm text-red-400">{error}</div>
              ) : pool.length === 0 ? (
                <div className="px-3 py-6 text-sm text-[#6b6b80] text-center">
                  You don&apos;t have any direct downline yet.
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-sm text-[#6b6b80] text-center">
                  {query ? "No matches" : "All directs already selected"}
                </div>
              ) : (
                filtered.map((b) => (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => {
                      onChange([...selected, b]);
                      setQuery("");
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#1a1a22] transition-colors text-left"
                  >
                    {b.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.profilePicture}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#2a2a35] text-[10px] text-white flex items-center justify-center shrink-0">
                        {initials(b)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {b.name || b.email}
                      </div>
                      {b.name && b.email && (
                        <div className="text-[11px] text-[#6b6b80] truncate">
                          {b.email}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((b) => (
            <span
              key={b._id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-[#1a1a22] border border-[#2a2a35] text-xs text-white"
            >
              {b.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.profilePicture}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-[#2a2a35] text-[9px] flex items-center justify-center">
                  {initials(b)}
                </span>
              )}
              <span className="truncate max-w-[140px]">
                {b.name || b.email}
              </span>
              <button
                type="button"
                onClick={() => remove(b._id)}
                disabled={disabled}
                className="text-[#6b6b80] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
