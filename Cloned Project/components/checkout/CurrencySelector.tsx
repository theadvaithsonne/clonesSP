"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ============ Types ============

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface PreviewedLineItem {
  productId: string;
  title: string;
  image?: string;
  vendor?: string;
  storeId?: string;
  storeName?: string;
  organizationId: string;
  quantity: number;
  nativeCurrency: "USD" | "INR";
  nativeUnitPrice: number;
  convertedUnitPrice: number;
  convertedTotalPrice: number;
}

export interface CartPreview {
  lineItems: PreviewedLineItem[];
  subtotal: number;
  discount: number;
  discountReason?: string;
  total: number;
  displayCurrency: "USD" | "INR";
  exchangeRate: number | null;
  inventoryIssues: Array<{
    productId: string;
    requested: number;
    available: number;
  }>;
  appliedCouponCode?: string;
}

interface CurrencySelectorProps {
  items: CartItemInput[];
  /** Initial currency to preview. Defaults to "USD". */
  defaultCurrency?: "USD" | "INR";
  /** Optional coupon to include in the preview. */
  couponCode?: string;
  /** Fired with the picked currency + the most-recent preview of that currency. */
  onConfirm: (
    currency: "USD" | "INR",
    preview: CartPreview
  ) => void | Promise<void>;
  /** Disable the confirm button (e.g. while parent is creating the invoice). */
  disabled?: boolean;
}

// ============ Helpers ============

function formatAmount(smallestUnit: number, currency: "USD" | "INR") {
  const value = smallestUnit / 100;
  if (currency === "INR")
    return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// ============ Component ============

export function CurrencySelector({
  items,
  defaultCurrency = "USD",
  couponCode,
  onConfirm,
  disabled,
}: CurrencySelectorProps) {
  const [selected, setSelected] = useState<"USD" | "INR">(defaultCurrency);
  const [previews, setPreviews] = useState<
    Partial<Record<"USD" | "INR", CartPreview>>
  >({});
  const [loading, setLoading] = useState<"USD" | "INR" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsKey = useMemo(
    () => JSON.stringify(items.map((i) => [i.productId, i.quantity]).sort()),
    [items]
  );

  useEffect(() => {
    // Refetch previews when items or coupon change
    setPreviews({});
    setError(null);
  }, [itemsKey, couponCode]);

  useEffect(() => {
    if (previews[selected]) return;
    let cancelled = false;
    const run = async () => {
      setLoading(selected);
      setError(null);
      try {
        const token = getToken();
        const res = await fetch(`${API_URL}/api/ecommerce/cart/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            items,
            displayCurrency: selected,
            couponCode,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load cart preview");
          setLoading(null);
          return;
        }
        setPreviews((prev) => ({ ...prev, [selected]: data as CartPreview }));
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to load cart preview"
        );
      } finally {
        if (!cancelled) setLoading(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selected, items, couponCode, itemsKey, previews]);

  const current = previews[selected];

  const hasInventoryIssues =
    !!current && current.inventoryIssues.length > 0;

  return (
    <div className="space-y-4">
      <div className="text-[11px] uppercase tracking-wider text-[#9fa0b8]">
        Select payment currency
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["USD", "INR"] as const).map((cur) => {
          const isActive = selected === cur;
          const preview = previews[cur];
          return (
            <button
              key={cur}
              type="button"
              onClick={() => setSelected(cur)}
              disabled={disabled}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                isActive
                  ? "border-brand/60 bg-brand/5"
                  : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a4a]",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{cur === "INR" ? "🇮🇳" : "🇺🇸"}</span>
                <span className="text-sm font-semibold text-white">{cur}</span>
              </div>
              <div className="text-xs text-[#9fa0b8] mb-2">
                {cur === "INR"
                  ? "Pay in Indian Rupees"
                  : "Pay in US Dollars"}
              </div>
              <div className="text-lg font-bold text-white">
                {loading === cur && !preview ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-normal text-[#9fa0b8]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Calculating…
                  </span>
                ) : preview ? (
                  formatAmount(preview.total, cur)
                ) : (
                  <span className="text-sm font-normal text-[#6b6b80]">—</span>
                )}
              </div>
              {preview && preview.exchangeRate && (
                <div className="text-[10px] text-[#6b6b80] mt-1">
                  1 USD ≈ {preview.exchangeRate.toFixed(2)} INR
                </div>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {hasInventoryIssues && current && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 space-y-1">
          <div className="font-medium">Some items are short on stock:</div>
          {current.inventoryIssues.map((iss) => (
            <div key={iss.productId} className="opacity-80">
              {iss.productId.slice(0, 8)}… requested {iss.requested}, only{" "}
              {iss.available} available.
            </div>
          ))}
          <div className="opacity-80 pt-1">
            Adjust quantities before checking out.
          </div>
        </div>
      )}

      {current && (
        <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[#9fa0b8]">
            Order summary
          </div>
          <div className="space-y-1 text-sm">
            {current.lineItems.map((li) => (
              <div
                key={li.productId}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-white truncate">
                  {li.title}
                  {li.quantity > 1 && (
                    <span className="text-[#6b6b80] text-xs ml-1.5">
                      × {li.quantity}
                    </span>
                  )}
                  {li.vendor && (
                    <span className="ml-1.5 text-[10px] text-[#9fa0b8] uppercase tracking-wider">
                      {li.vendor}
                    </span>
                  )}
                </span>
                <span className="text-white shrink-0">
                  {formatAmount(li.convertedTotalPrice, selected)}
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-[#2a2a35]" />
          <div className="flex justify-between text-sm">
            <span className="text-[#9fa0b8]">Subtotal</span>
            <span className="text-white">
              {formatAmount(current.subtotal, selected)}
            </span>
          </div>
          {current.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#9fa0b8]">
                Discount{" "}
                {current.appliedCouponCode && (
                  <span className="text-[10px] text-brand uppercase tracking-wider ml-1">
                    {current.appliedCouponCode}
                  </span>
                )}
              </span>
              <span className="text-emerald-400">
                −{formatAmount(current.discount, selected)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span className="text-white">Total</span>
            <span className="text-white">
              {formatAmount(current.total, selected)}
            </span>
          </div>
        </div>
      )}

      <Button
        disabled={disabled || !current || hasInventoryIssues || loading !== null}
        onClick={() => current && onConfirm(selected, current)}
        className={cn(
          "w-full h-12 rounded-xl font-semibold text-base transition-all",
          current && !hasInventoryIssues
            ? "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
            : "bg-[#1a1a22] text-[#6b6b80] cursor-not-allowed"
        )}
      >
        {loading !== null ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculating…
          </span>
        ) : current ? (
          <>Pay {formatAmount(current.total, selected)}</>
        ) : (
          "Loading…"
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
        <ShieldCheck className="h-3 w-3" />
        Totals authoritative on the server. Conversion locked at invoice creation.
      </div>
    </div>
  );
}
