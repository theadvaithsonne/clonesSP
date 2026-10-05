"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { Search, Loader2, Globe, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import {
  getAffiliateCatalog,
  getOfficeItems,
  getGeneralLinkItems,
  type LinkItem,
} from "@/lib/affiliate/links-api";
import { fetchMyAffiliateId } from "@/lib/api/garage";
import {
  linkToProductCardItem,
  linkToOfficeCardItem,
} from "@/lib/affiliate/link-card-adapters";
import { ProductCard } from "@/components/shared/product-card";
import { OfficeCard } from "@/components/shared/office-card";
import { cn } from "@/lib/utils";

type Tab = "office" | "physical" | "digital" | "general";
const TABS: { key: Tab; label: string }[] = [
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "office", label: "Offices" },
  { key: "general", label: "General" },
];

export function LinkPicker({
  value,
  onChange,
  affiliateIdOverride,
}: {
  value: string | null;
  onChange: (item: LinkItem | null) => void;
  /**
   * Author general links under THIS affiliate instead of the signed-in user.
   *
   * Set by the admin funnel library, where the stored href is adopted by every
   * affiliate — baking in the editing admin's own id would divert their
   * traffic. Unset everywhere else, so an affiliate building their own funnel
   * still gets their own id.
   */
  affiliateIdOverride?: string | null;
}) {
  const [items, setItems] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  // True when the catalog or offices fetch actually failed (as opposed to
  // succeeding with zero results) — surfaced as an error state below so a
  // missing Garage session doesn't read as "no products".
  const [loadError, setLoadError] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("physical");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, offices] = await Promise.allSettled([
          getAffiliateCatalog(),
          getOfficeItems(),
        ]);
        if (cancelled) return;
        setItems([
          ...(catalog.status === "fulfilled" ? catalog.value : []),
          ...(offices.status === "fulfilled" ? offices.value : []),
        ]);
        if (catalog.status === "rejected" || offices.status === "rejected") {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Affiliate id personalises Network Chains' Web link (register/<id>).
  // An override wins outright and skips the lookup — the admin library must
  // never fall back to the editing admin, even if the fetch fails.
  useEffect(() => {
    if (affiliateIdOverride !== undefined) {
      setAffiliateId(affiliateIdOverride);
      return;
    }
    let cancelled = false;
    fetchMyAffiliateId()
      .then((id) => {
        if (!cancelled) setAffiliateId(id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [affiliateIdOverride]);

  // Catalog + offices (from the API) plus the fixed "General" platform links.
  const allItems = useMemo(
    () => [...items, ...getGeneralLinkItems(affiliateId)],
    [items, affiliateId]
  );

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { office: 0, physical: 0, digital: 0, general: 0 };
    for (const it of allItems) if (it.category in c) c[it.category as Tab] += 1;
    return c;
  }, [allItems]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return allItems.filter(
      (it) => it.category === tab && (!q || it.name.toLowerCase().includes(q))
    );
  }, [allItems, tab, deferredQuery]);

  const selectedItem = useMemo(
    () => allItems.find((it) => it.id === value) ?? null,
    [allItems, value]
  );

  const isOffices = tab === "office";
  const isGeneral = tab === "general";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedItem && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/[0.06] px-3 py-2">
          {selectedItem.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedItem.image}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[10px] text-zinc-500">
              —
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-sm text-white">
            {selectedItem.name}
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-xs text-zinc-400 hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isOffices ? "Search offices..." : `Search ${tab} products...`}
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/[0.2]"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-white/[0.14] bg-white/[0.08] text-white"
                : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white"
            )}
          >
            {t.label}
            <span
              className={cn(
                "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                tab === t.key ? "bg-brand text-brand-foreground" : "bg-white/[0.08] text-zinc-400"
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-auto scrollbar-hide pr-1">
        {loading && !isGeneral ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : loadError && !isGeneral ? (
          <div className="m-1 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
            Couldn&apos;t load the product catalog. This usually means there&apos;s
            no active Garage session in this browser — sign in to Garage, then
            reopen this picker.
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            {query
              ? `No ${isOffices ? "offices" : isGeneral ? "links" : "products"} match "${query}".`
              : "Nothing here yet."}
          </div>
        ) : isGeneral ? (
          <div className="space-y-2">
            {visible.map((it) => (
              <GeneralCard
                key={it.id}
                item={it}
                selected={value === it.id}
                dimmed={!!value && value !== it.id}
                onClick={() => onChange(value === it.id ? null : it)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((it) => (
              <motion.div key={`${it.category}-${it.id}`}>
                {isOffices ? (
                  <OfficeCard
                    item={linkToOfficeCardItem(it)}
                    selected={value === it.id}
                    dimmed={!!value && value !== it.id}
                    onClick={() => onChange(value === it.id ? null : it)}
                  />
                ) : (
                  <ProductCard
                    item={linkToProductCardItem(it)}
                    selected={value === it.id}
                    dimmed={!!value && value !== it.id}
                    onClick={() => onChange(value === it.id ? null : it)}
                  />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Row card for a "General" platform link (Web / iOS / Android). Mirrors the
 *  product/office card selection styling, but shows the destination URL. */
function GeneralCard({
  item,
  selected,
  dimmed,
  onClick,
}: {
  item: LinkItem;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const platform = item.id.split("::")[1];
  const Icon = platform === "web" ? Globe : Smartphone;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
        selected
          ? "border-brand/60 bg-brand/[0.08]"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.14]",
        dimmed && "opacity-40"
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{item.name}</span>
        <span className="block truncate text-[11px] text-zinc-500">
          {item.href || "Link coming soon"}
        </span>
      </span>
    </button>
  );
}
