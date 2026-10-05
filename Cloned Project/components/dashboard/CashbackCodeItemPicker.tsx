"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchEligibleItems,
  type CashbackProductType,
  type EligibleItem,
} from "@/lib/hooks/useCashbackCodes";

interface Props {
  productType: CashbackProductType | "";
  orgId: string | null;
  value: EligibleItem | null;
  onChange: (item: EligibleItem | null) => void;
  disabled?: boolean;
}

function formatPrice(price: number, currency: string) {
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${price.toFixed(2)}`;
}

export function CashbackCodeItemPicker({
  productType,
  orgId,
  value,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EligibleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-fetch the bounded list when productType/orgId change.
  useEffect(() => {
    let alive = true;
    if (!productType || !orgId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchEligibleItems(productType, orgId)
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [productType, orgId]);

  // Close on outside click.
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
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((it) => it.title.toLowerCase().includes(q));
  }, [items, query]);

  const placeholder = !productType
    ? "Pick a product type first"
    : !orgId
    ? "Active organization not set"
    : loading
    ? "Loading products…"
    : items.length === 0
    ? "No eligible products in this org"
    : "Choose a product";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled || !productType || !orgId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white text-sm flex items-center gap-2 transition-colors",
          "focus:outline-none focus:border-brand/40 hover:border-[#3a3a45]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {value?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.image}
            alt=""
            className="w-6 h-6 rounded object-cover shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded bg-[#2a2a35] flex items-center justify-center shrink-0">
            <Package className="w-3.5 h-3.5 text-[#6b6b80]" />
          </div>
        )}
        <span
          className={cn(
            "flex-1 text-left truncate",
            !value && "text-[#6b6b80]"
          )}
        >
          {value ? value.title : placeholder}
        </span>
        {value && (
          <span className="text-[11px] text-[#9fa0b8] shrink-0">
            {formatPrice(value.price, value.currency)}
          </span>
        )}
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
              placeholder="Search products…"
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
                Loading…
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-sm text-red-400">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-[#6b6b80] text-center">
                {items.length === 0
                  ? "No eligible products in this org"
                  : "No matches"}
              </div>
            ) : (
              filtered.map((it) => {
                const isSelected = value?.itemId === it.itemId;
                return (
                  <button
                    key={it.itemId}
                    type="button"
                    onClick={() => {
                      onChange(it);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#1a1a22] transition-colors text-left",
                      isSelected && "bg-brand/5"
                    )}
                  >
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image}
                        alt=""
                        className="w-9 h-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[#2a2a35] flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-[#6b6b80]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {it.title}
                      </div>
                      <div className="text-[11px] text-[#6b6b80] capitalize">
                        {it.productType}
                      </div>
                    </div>
                    <span className="text-xs text-[#9fa0b8] px-2 py-0.5 rounded-full bg-[#1a1a22] border border-[#2a2a35] shrink-0">
                      {formatPrice(it.price, it.currency)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
