"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShoppingBag, X } from "lucide-react";
import {
  listOrgSellables,
  type Sellable,
  type SellableItemType,
} from "@/lib/feed-api";
import { listOrgStoreProducts } from "@/lib/webinar/store-sellables";
import { htmlToPlainText } from "@/lib/webinar/html-text";

interface ShopPanelProps {
  /**
   * Whose catalog to show. Comes from the join response when the backend
   * supplies it, otherwise the viewer's own token — see the note in
   * WebinarRoomClient where this is resolved.
   */
  orgId: string | null;
  /** Hands the picked item to the page's checkout flow. */
  onBuy: (item: Sellable) => void;
  /** itemId currently being purchased, so its button can show a spinner. */
  busyItemId?: string | null;
}

// Sellables carry no free-form category field — `itemType` IS the
// category. Fixed display order + label per type; pills only render for
// types actually present in the loaded catalog.
const CATEGORY_ORDER: Array<{ type: SellableItemType; label: string }> = [
  { type: "product", label: "Products" },
  { type: "store-product", label: "Store" },
  { type: "course", label: "Courses" },
  { type: "service", label: "Services" },
  { type: "channel", label: "Channels" },
  { type: "workshop", label: "Workshops" },
  { type: "garage-store", label: "Plans" },
];

/**
 * Last line of defence against showing something that can't be bought.
 *
 * Both sources already drop auctioned/sold/out-of-stock rows and completed
 * webinars — the backend catalog in `listOrgSellables`, storefront merch in
 * `toSellable`. Sellable itself carries none of those flags, so this only
 * fires when a source starts passing them through; keeping it means a
 * sold lot can never linger in the Shop while a fix ships.
 */
function isForSale(item: Sellable): boolean {
  const raw = item as unknown as Record<string, unknown>;
  const auction = (raw.auction ?? null) as Record<string, unknown> | null;
  if (raw.isSold === true || raw.soldOut === true) return false;
  if (auction?.status === "sold" || auction?.settlementStatus === "settled") {
    return false;
  }
  if (raw.saleType === "auction") return false;
  if (typeof raw.status === "string" && raw.status !== "active") return false;
  if (raw.trackInventory === true && typeof raw.quantity === "number") {
    if (raw.quantity <= 0) return false;
  }
  // Workshops that have already run are dropped server-side; this catches
  // any that a stale cache still hands us.
  if (item.itemType === "workshop" && raw.workshopStatus === "completed") {
    return false;
  }
  return true;
}

function formatPrice(price: number, currency?: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price || 0);
  } catch {
    // Unknown/blank currency code — Intl throws rather than falling back.
    return `${code} ${(price || 0).toFixed(2)}`;
  }
}

/**
 * The host's storefront, in the sidebar. Same two-source merge the pin
 * picker uses — the org catalog plus the founder's `storeproducts` rows,
 * which /api/invoices/sellables doesn't include.
 *
 * Read-only: pinning stays a host action in the control bar. This tab is
 * for viewers to browse and buy without waiting for something to be pinned.
 */
export default function ShopPanel({ orgId, onBuy, busyItemId }: ShopPanelProps) {
  const [items, setItems] = useState<Sellable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SellableItemType | "all">("all");

  // Only the categories that exist in this catalog, in fixed order. One
  // lone category would make the pill row pure noise, so hide it then.
  const categories = useMemo(() => {
    const present = new Set(items.map((i) => i.itemType));
    const found = CATEGORY_ORDER.filter((c) => present.has(c.type));
    return found.length > 1 ? found : [];
  }, [items]);

  // Client-side filter — the whole catalog is already loaded, so there's
  // nothing to be gained from a server round-trip per keystroke. Category
  // and search compose (AND).
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.itemType !== category) return false;
      if (!q) return true;
      return [item.name, htmlToPlainText(item.description), item.storeName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [items, query, category]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      // The panel is scoped to the host's org, not the viewer's — without
      // the argument this falls back to the viewer's own stored orgId and
      // shows the wrong catalog.
      listOrgSellables(orgId || undefined).catch(() => [] as Sellable[]),
      listOrgStoreProducts(orgId).catch(() => [] as Sellable[]),
    ])
      .then(([catalog, storeProducts]) => {
        if (cancelled) return;
        const merged = [...(catalog || []), ...storeProducts];
        const seen = new Set<string>();
        setItems(
          // Filtering before setItems (rather than at render) keeps the
          // category pills and the "nothing listed" empty state honest.
          merged.filter((s) => {
            if (!isForSale(s)) return false;
            const k = `${s.itemType}:${s.itemId}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          }),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load items");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#282828]">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto bg-[#282828] px-4 py-6">
        <p className="text-[13px] text-red-400">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-[#282828] px-4 py-6">
        <p className="text-[13px] text-zinc-400">
          No products are listed for sale at this moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#282828]">
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1e1e1e] px-2.5 py-1.5 transition-colors focus-within:border-white/25">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder-zinc-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="shrink-0 rounded-md p-0.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="scrollbar-hide -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3">
            {[{ type: "all" as const, label: "All" }, ...categories].map(
              (c) => {
                const active = category === c.type;
                return (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => setCategory(c.type)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors ${
                      active
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              },
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {visibleItems.length === 0 && (
          <p className="px-1 py-3 text-[13px] text-zinc-400">
            {query.trim()
              ? `No products match “${query.trim()}”.`
              : "No products in this category."}
          </p>
        )}
        <ul className="space-y-2">
        {visibleItems.map((item) => {
          // A physical storefront item with no slug has no checkout route —
          // /storefront/:slug/cart/checkout is the only way to sell it.
          const sellable =
            item.itemType !== "store-product" || !!item.storeSlug;
          const busy = busyItemId === item.itemId;
          return (
            <li
              key={`${item.itemType}:${item.itemId}`}
              className="rounded-xl border border-white/10 bg-[#1e1e1e] p-3 transition-all hover:border-white/20"
            >
              <div className="flex items-start gap-3">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg bg-zinc-900 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                    <ShoppingBag className="h-5 w-5 text-zinc-600" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {item.name}
                  </p>
                  {/* Descriptions are rich-text HTML from the store editor —
                      flatten to text so tags don't print in the card. */}
                  {htmlToPlainText(item.description) && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-400">
                      {htmlToPlainText(item.description)}
                    </p>
                  )}
                  {item.storeName && (
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                      {item.storeName}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold tabular-nums text-white">
                  {formatPrice(item.price, item.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => onBuy(item)}
                  disabled={!sellable || busy}
                  title={
                    sellable
                      ? undefined
                      : "This item has no storefront to check out through"
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-[#f4511e] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#e0491b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {item.itemType === "store-product"
                    ? "View Product"
                    : (item.price || 0) > 0
                      ? "Buy"
                      : "Redeem"}
                </button>
              </div>
            </li>
          );
        })}
        </ul>
      </div>
    </div>
  );
}
