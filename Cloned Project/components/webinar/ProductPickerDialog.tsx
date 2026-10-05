"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listOrgSellables,
  type Sellable,
  type SellableItemType,
} from "@/lib/feed-api";
import { listOrgStoreProducts } from "@/lib/webinar/store-sellables";
import { htmlToPlainText } from "@/lib/webinar/html-text";
import {
  getUnilevelPlusProduct,
  listOfficePlans,
} from "@/lib/webinar/garage-store-plans";
import { getUserDataFromToken } from "@/lib/auth";
import {
  CURRENCY_SYMBOL,
  convertPrice,
  formatPrice,
  type DisplayCurrency,
} from "@/lib/webinar/currency";
import {
  Package,
  ArrowLeft,
  Users,
  GraduationCap,
  Wrench,
  Presentation,
  Truck,
  Store as StoreIcon,
  ListFilter,
  Gavel,
  ShoppingBag,
} from "lucide-react";
import type { AuctionRoundConfig } from "@/lib/api/auctions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // durationMinutes === null means "pinned for whole webinar".
  // `auction` set means the host chose to put the item on the block rather than
  // offer it Buy Now — the caller pins it AND opens a round on it.
  onPick: (
    item: Sellable,
    durationMinutes: number | null,
    auction?: AuctionRoundConfig
  ) => void;
}

const DEFAULT_DURATION_MIN = 5;

// ── Live auction round ─────────────────────────────────────────────
// A lot and a Buy Now button are mutually exclusive offers on the same item, so
// the host picks one here rather than pinning first and auctioning later.

/** Only storefront merch can be auctioned: the round, the bids and the escrow
 *  all live in the Garage Store backend, keyed by the store product id. A
 *  legacy `product` (or a course/community) has no row there at all, so
 *  offering the choice would just earn a 404 at confirm time. */
function canAuction(item: Sellable): boolean {
  return item.itemType === "store-product";
}

/** Round lengths a live host actually wants. Seconds, because that's what the
 *  backend takes — and it clamps to 10s..24h regardless. */
const ROUND_DURATIONS: { label: string; sec: number }[] = [
  { label: "1 min", sec: 60 },
  { label: "2 min", sec: 120 },
  { label: "5 min", sec: 300 },
  { label: "10 min", sec: 600 },
];

const BID_INCREMENTS = [1, 5, 10, 25];

/** How long the PIN lasts when a round is running. The lot's own deadline plus
 *  a buffer: settlement is a cron up to 60s behind the close, and unpinning the
 *  product is what tears the auction card off the stream — do it at `endsAt`
 *  and the room never sees who won. */
function pinMinutesForRound(durationSec: number): number {
  return Math.ceil(durationSec / 60) + 2;
}

// Garage office plans in the Garage Store tab — off until the partner
// subscriptions have settled. Everything downstream already supports them.
const SHOW_OFFICE_PLANS = false;

// Cross-cutting "Physical" / "Digital" chips sit alongside itemType
// chips — they aren't itemTypes, they're flags we filter the merged
// list on.
type FilterKey = "all" | "physical" | "digital" | SellableItemType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  // Physical chip — surfaces the host's storefront merch
  // (storeproducts.isPhysicalProduct === true). listOrgSellables is
  // already org-scoped, so the picker only ever shows the founder's
  // own store products.
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  // Ecommerce chip — widens to include legacy `product` + storefront
  // `store-product` items. Was labeled "Products" before; hosts asked
  // for ecommerce by name and couldn't find it.
  { key: "product", label: "Ecommerce" },
  { key: "channel", label: "Communities" },
  { key: "course", label: "Courses" },
  { key: "workshop", label: "Webinars" },
  { key: "service", label: "Services" },
  // Garage Store — the $25 Unilevel Plus combo. Not org merch: it's a
  // platform plan, and what each viewer pays is resolved at buy time
  // from their own combo window (see lib/webinar/garage-store-plans).
  { key: "garage-store", label: "Garage Store" },
];

export default function ProductPickerDialog({ open, onOpenChange, onPick }: Props) {
  const [items, setItems] = useState<Sellable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  // Empty set = "All stores". Any non-empty selection narrows the
  // visible list to the chosen Garage storefronts (matched by slug).
  const [storeFilter, setStoreFilter] = useState<Set<string>>(() => new Set());
  // Display currency for physical-item prices. The catalog stores
  // each item's native currency; this is purely a viewing toggle so
  // the host can scan the list in a consistent unit.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");

  const [selected, setSelected] = useState<Sellable | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION_MIN);
  const [wholeWebinar, setWholeWebinar] = useState(false);

  // ── Sell mode ──
  // Buy Now unless the host says otherwise: an auction is the deliberate act,
  // and defaulting to it would put stock on the block by accident.
  const [mode, setMode] = useState<"buy" | "auction">("buy");
  const [startPrice, setStartPrice] = useState<number>(0);
  const [minBidIncrement, setMinBidIncrement] = useState<number>(1);
  const [roundSec, setRoundSec] = useState<number>(120);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setDurationMinutes(DEFAULT_DURATION_MIN);
    setWholeWebinar(false);
    setMode("buy");
    setRoundSec(120);
    setMinBidIncrement(1);
    setFilter("all");
    setStoreFilter(new Set());
    setDisplayCurrency("USD");

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Two-source merge:
    //   • listOrgSellables() — org-scoped catalog (products, channels,
    //     courses, services, workshops). Already filtered to the
    //     host's org by the backend.
    //   • listOrgStoreProducts(orgId) — physical/digital merch from
    //     the founder's storeproducts collection (the picker's "Physical"
    //     chip is empty without this because /api/invoices/sellables
    //     doesn't include storeproducts).
    // Dedupe is by itemType+itemId; storeproducts always claim the
    // `store-product` itemType so they won't collide with `product`.
    const hostOrgId = getUserDataFromToken().orgId;
    Promise.all([
      listOrgSellables().catch((err) => {
        // The catalog side failing is a real error — surface it.
        throw err;
      }),
      listOrgStoreProducts(hostOrgId).catch(() => [] as Sellable[]),
      // Garage Store plans. Best-effort: an older backend (or a failed
      // catalog lookup server-side) just means the tab is empty — it
      // must never block the rest of the picker.
      getUnilevelPlusProduct()
        .then((p) =>
          // One pinnable plan per TERM (1 / 3 / 6 / 12 months …), not one
          // per partner — the host picks the exact term they're selling.
          // The term rides on the itemId because a pin carries nothing else.
          // List from `standaloneTerms`, NOT `terms`.
          //
          // `terms` is the bundle catalog priced for whoever is asking — and
          // inside an open 24h window the backend drops the 1-month tier
          // from it entirely ("a bundle catalog must not offer a bundled
          // monthly tier"). Building the picker from that would make the
          // host's OWN offer state decide which plans exist for everyone.
          // `standaloneTerms` is the full, stable catalog; each viewer is
          // still re-quoted from their own window at buy time.
          (p.comboTerms || []).flatMap<Sellable>((g) =>
            (g.standaloneTerms || []).map((t) => {
              const label =
                t.termMonths === 1
                  ? "Monthly"
                  : `${t.termMonths} months`;
              return {
                itemType: "garage-store" as const,
                itemId: `${g.thirdPartyClientId}:${t.termMonths}`,
                name: `${g.clientName} — ${label}`,
                description: `${t.termMonths} month${t.termMonths > 1 ? "s" : ""} of ${g.clientName}`,
                // Headline only — every viewer is re-quoted at buy time from
                // their own combo window.
                price: t.totalAmount,
                currency: "USD",
                isSubscription: true,
                isPhysical: false,
                organizationId: hostOrgId || "",
              };
            }),
          ),
        )
        .catch(() => [] as Sellable[]),
      // Garage office plans (Starter / Pro) — what "Launch an Office"
      // sells. Built and working, but deliberately NOT listed yet: the
      // tab is meant to show the partner subscriptions first. Flip this
      // to true to surface them (the pin + buy paths already handle them).
      (SHOW_OFFICE_PLANS
        ? listOfficePlans()
        : Promise.resolve([])
      )
        .then((plans) =>
          plans.map<Sellable>((p) => ({
            itemType: "garage-store",
            itemId: p._id,
            name: `Garage ${p.name}`,
            description: p.description || `Garage office — billed ${p.period}.`,
            // Base price. GST is region-dependent (India only) and this
            // endpoint is public, so the real total lands at checkout.
            price: p.amount,
            currency: p.currency || "USD",
            isSubscription: true,
            isPhysical: false,
            organizationId: hostOrgId || "",
          })),
        )
        .catch(() => [] as Sellable[]),
    ])
      .then(([catalog, storeProducts, garageStorePlans, officePlans]) => {
        if (cancelled) return;
        const merged = [
          ...(catalog || []),
          ...storeProducts,
          ...garageStorePlans,
          ...officePlans,
        ];
        const seen = new Set<string>();
        const deduped = merged.filter((s) => {
          const k = `${s.itemType}:${s.itemId}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setItems(deduped);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Could not load items");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Drop physical items with no storefront — without a `storeSlug`
  // there's no checkout flow (we can't drive Garage's
  // /storefront/:slug/cart/checkout), so they can't actually be sold
  // from the pin overlay. Hiding them keeps the picker honest and
  // matches the rule "physical = founder's stores only".
  const sellable = useMemo(
    () => items.filter((s) => !(s.isPhysical === true && !s.storeSlug)),
    [items],
  );

  // Unique stores across the sellable subset, keyed by slug. Items
  // missing a slug fall through; only store-products carry
  // storefront identity.
  const stores = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sellable) {
      if (!s.storeSlug) continue;
      if (!map.has(s.storeSlug)) {
        map.set(s.storeSlug, s.storeName || s.storeSlug);
      }
    }
    return Array.from(map, ([slug, name]) => ({ slug, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [sellable]);

  // Stores only attach to storefront items (which surface under All
  // or Physical), so we only honor the store selection on those two
  // filters. On any other chip — Digital, Communities, Courses,
  // Webinars, Services — applying it would zero out the grid.
  const storeFilterApplies = filter === "all" || filter === "physical";

  const filtered = useMemo(() => {
    let next = sellable;
    if (storeFilterApplies && storeFilter.size > 0) {
      next = next.filter((s) => !!s.storeSlug && storeFilter.has(s.storeSlug));
    }
    if (filter === "all") return next;
    if (filter === "physical") return next.filter((s) => s.isPhysical === true);
    if (filter === "digital")
      return next.filter(
        (s) => s.isPhysical !== true && s.itemType !== "garage-store",
      );
    // "Products" widens to include the storefront items too — buyers
    // don't care which collection an item lives in.
    if (filter === "product") {
      return next.filter(
        (s) => s.itemType === "product" || s.itemType === "store-product",
      );
    }
    return next.filter((s) => s.itemType === filter);
  }, [sellable, filter, storeFilter, storeFilterApplies]);

  const toggleStore = useCallback((slug: string) => {
    setStoreFilter((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  /** Picking an item seeds the round from what the item already sells for —
   *  the host's usual intent is "open at the list price", and a blank field
   *  mid-broadcast is a field nobody fills in. */
  const handleSelect = useCallback((item: Sellable) => {
    setSelected(item);
    setMode("buy");
    setStartPrice(item.price > 0 ? item.price : 1);
  }, []);

  const auctionable = selected ? canAuction(selected) : false;
  const auctionMode = auctionable && mode === "auction";
  // The backend refuses a non-positive opening price outright; catch it here so
  // the host finds out before the room does.
  const roundValid = startPrice > 0 && minBidIncrement >= 0;

  const handleConfirm = () => {
    if (!selected) return;
    if (auctionMode) {
      if (!roundValid) return;
      onPick(selected, pinMinutesForRound(roundSec), {
        startPrice,
        minBidIncrement,
        durationSec: roundSec,
      });
      onOpenChange(false);
      return;
    }
    const minutes = wholeWebinar ? null : Math.max(1, Math.floor(durationMinutes));
    onPick(selected, minutes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* grid-cols-1 is load-bearing: DialogContent is a grid with no declared
          columns, so its implicit track is `auto` — which sizes to max-content
          and happily grows past the dialog's own max-width. A long product name
          then widened the track and every w-full child (the duration input, the
          confirm row) spilled out with it, while `truncate` never engaged
          because nothing downstream was ever constrained. minmax(0,1fr) pins
          the track to the dialog width so the truncation below can do its job. */}
      <DialogContent className="grid-cols-1 bg-zinc-950 text-white border-white/10 p-4 sm:p-6 max-w-[calc(100vw-1.5rem)] sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base sm:text-lg break-words">
            {selected ? "How long should it stay pinned?" : "Pin something to sell"}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 break-words">
            {selected
              ? "Attendees will see a countdown. It auto-unpins when the timer ends."
              : "Pick any sellable item from your org."}
          </DialogDescription>
        </DialogHeader>

        {!selected && (
          <>
            {/* Type filter pills + store filter + currency toggle */}
            <div className="flex flex-wrap items-center gap-1.5 -mt-2 mb-1">
              {FILTERS.map((f) => {
                const count =
                  f.key === "all"
                    ? sellable.length
                    : f.key === "physical"
                      ? sellable.filter((s) => s.isPhysical === true).length
                      : f.key === "digital"
                        ? sellable.filter((s) => s.isPhysical !== true).length
                        : f.key === "product"
                          ? sellable.filter(
                              (s) =>
                                s.itemType === "product" ||
                                s.itemType === "store-product",
                            ).length
                          : sellable.filter((s) => s.itemType === f.key).length;
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isActive
                        ? "bg-white border-white text-black"
                        : "bg-zinc-900 border-white/10 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {f.label}
                    {!loading && count > 0 && (
                      <span className="ml-1 opacity-60">·{count}</span>
                    )}
                  </button>
                );
              })}

              {/* Store filter — surfaced as a single icon button that
                  opens a multi-select popover. Hidden when (a) the
                  response includes no storefront items, or (b) the
                  active type chip is one where store filtering would
                  empty the grid (only All and Physical can carry
                  storefront items). */}
              {stores.length > 0 && storeFilterApplies && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Filter by store"
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                        storeFilter.size > 0
                          ? "bg-white border-white text-black"
                          : "bg-zinc-900 border-white/10 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      <ListFilter className="h-3 w-3" />
                      Store
                      {storeFilter.size > 0 && (
                        <span className="ml-0.5 rounded-full bg-zinc-800 px-1.5 text-[10px] leading-4">
                          {storeFilter.size}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-60 border-white/10 bg-zinc-950 p-2 text-zinc-300"
                  >
                    <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Filter by store
                      </span>
                      {storeFilter.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setStoreFilter(new Set())}
                          className="text-[10px] font-medium text-blue-400 hover:text-blue-300"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {stores.map((s) => {
                        const checked = storeFilter.has(s.slug);
                        return (
                          <label
                            key={s.slug}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-white/10"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleStore(s.slug)}
                              className="h-3.5 w-3.5"
                            />
                            <StoreIcon className="h-3 w-3 shrink-0 text-zinc-500" />
                            <span className="truncate" title={s.name}>
                              {s.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Currency toggle — surfaced on All and Physical (the
                  two chips where physical items appear in the grid).
                  Drives display only; the underlying Sellable.currency
                  on each item is unchanged so the pin payload stays
                  canonical. Only physical items honour the toggle —
                  digital products / courses / etc. stay in their native
                  currency even when the toggle is visible. */}
              {(filter === "all" || filter === "physical") && (
                <div
                  className="ml-auto flex items-center gap-0 rounded-full border border-white/10 bg-zinc-900 p-0.5"
                  role="group"
                  aria-label="Display currency"
                >
                  {(["USD", "INR"] as const).map((c) => {
                    const active = displayCurrency === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDisplayCurrency(c)}
                        aria-pressed={active}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                          active
                            ? "bg-white text-black"
                            : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        {CURRENCY_SYMBOL[c]} {c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2">
              {loading && (
                <div className="py-10 text-center text-zinc-500 text-sm">
                  Loading items...
                </div>
              )}

              {!loading && error && (
                <div className="py-10 text-center text-red-400 text-sm">
                  {error}
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="py-10 text-center text-zinc-500 text-sm space-y-2">
                  <Package className="w-10 h-10 mx-auto text-zinc-500" />
                  <p>No sellable items found.</p>
                </div>
              )}

              {!loading && !error && filtered.length > 0 && (
                <ul className="space-y-2">
                  {filtered.map((item) => {
                    // Only physical items honour the USD/INR toggle.
                    // Everything else (digital, courses, communities, …)
                    // renders its native currency exactly as the backend
                    // supplied it — even when the toggle is visible on All.
                    const toggleVisible =
                      filter === "all" || filter === "physical";
                    const showConverted =
                      toggleVisible && item.isPhysical === true;
                    const displayPrice = showConverted
                      ? convertPrice(item.price, item.currency, displayCurrency)
                      : item.price;
                    const displaySymbol = showConverted
                      ? CURRENCY_SYMBOL[displayCurrency]
                      : null;
                    return (
                      <li key={`${item.itemType}:${item.itemId}`}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          className="w-full min-w-0 max-w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-900 hover:bg-white/10 transition-colors text-left"
                        >
                          <span className="shrink-0">
                            <SellableThumb item={item} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">
                                {item.name}
                              </p>
                              <span className="shrink-0">
                                <TypeBadge type={item.itemType} />
                              </span>
                            </div>
                            {/* Rich-text HTML from the store editor. */}
                            {htmlToPlainText(item.description) && (
                              <p className="text-xs text-zinc-500 truncate mt-0.5">
                                {htmlToPlainText(item.description)}
                              </p>
                            )}
                            {(item.storeName || item.storeSlug) && (
                              <div
                                className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500"
                                title={item.storeName || item.storeSlug}
                              >
                                <StoreIcon className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">
                                  {item.storeName || item.storeSlug}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-white flex-shrink-0 tabular-nums">
                            {displaySymbol
                              ? `${displaySymbol}${formatPrice(displayPrice)}`
                              : formatLegacyPrice(displayPrice, item.currency)}
                            {item.isSubscription && (
                              <span className="text-[10px] text-zinc-500 block text-right">
                                /{item.subscriptionPeriod || "mo"}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {selected && (
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-white/10">
              <span className="shrink-0">
                <SellableThumb item={selected} size={48} />
              </span>
              <div className="flex-1 min-w-0">
                {/* min-w-0 on THIS row too: `truncate` only takes effect when
                    every flex ancestor is allowed to shrink below content
                    width, otherwise a long product name widens the dialog
                    and pushes the confirm button off-screen. */}
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">
                    {selected.name}
                  </p>
                  <span className="shrink-0">
                    <TypeBadge type={selected.itemType} />
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {formatLegacyPrice(selected.price, selected.currency)}
                </p>
              </div>
            </div>

            {/* How this item is being offered. Storefront merch only — see
                canAuction(). One offer or the other, never both: the room gives
                the pinned slot to the auction card while a round is running. */}
            {auctionable && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "buy", label: "Buy Now pin", icon: ShoppingBag },
                    { key: "auction", label: "Live auction", icon: Gavel },
                  ] as const
                ).map(({ key, label, icon: Icon }) => {
                  const active = mode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMode(key)}
                      aria-pressed={active}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? key === "auction"
                            ? "border-amber-400 bg-amber-400/15 text-amber-300"
                            : "border-white bg-white text-black"
                          : "border-white/10 bg-zinc-900 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {auctionMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label
                      htmlFor="lot-start-price"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Opening bid
                    </label>
                    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 focus-within:border-white/30">
                      <span className="shrink-0 text-sm text-zinc-500">
                        {currencySymbol(selected.currency) || selected.currency}
                      </span>
                      <input
                        id="lot-start-price"
                        type="number"
                        min={1}
                        step={1}
                        value={startPrice}
                        onChange={(e) => setStartPrice(Number(e.target.value) || 0)}
                        className="w-full min-w-0 bg-transparent text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Min increment
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {BID_INCREMENTS.map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setMinBidIncrement(inc)}
                          aria-pressed={minBidIncrement === inc}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                            minBidIncrement === inc
                              ? "bg-white text-black"
                              : "bg-zinc-900 text-zinc-400 hover:bg-white/10"
                          }`}
                        >
                          {currencySymbol(selected.currency)}
                          {inc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Round length
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROUND_DURATIONS.map((d) => (
                      <button
                        key={d.sec}
                        type="button"
                        onClick={() => setRoundSec(d.sec)}
                        aria-pressed={roundSec === d.sec}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          roundSec === d.sec
                            ? "bg-amber-400 text-black"
                            : "bg-zinc-900 text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bidding escrows against the bidder's Auction Wallet, so
                    saying what a bid costs is the difference between a room
                    that bids and a room that watches. */}
                <p className="break-words text-[11px] leading-snug text-zinc-500">
                  Opens the moment you confirm. Free to bid — the winner pays
                  from their Auction Wallet, everyone else is refunded. The item
                  stays pinned for {pinMinutesForRound(roundSec)} min so the room
                  sees who won.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    step={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
                    disabled={wholeWebinar}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={wholeWebinar}
                    onChange={(e) => setWholeWebinar(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-white cursor-pointer"
                  />
                  <span className="text-sm text-zinc-300 leading-snug">
                    Keep it pinned for the whole webinar duration
                  </span>
                </label>
              </>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={auctionMode && !roundValid}
                className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 ${
                  auctionMode
                    ? "bg-amber-400 text-black hover:bg-amber-300"
                    : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                {auctionMode
                  ? `Start auction · ${
                      ROUND_DURATIONS.find((d) => d.sec === roundSec)?.label ??
                      `${roundSec}s`
                    }`
                  : `Pin ${
                      wholeWebinar ? "(whole webinar)" : `for ${durationMinutes} min`
                    }`}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function typeIcon(type: SellableItemType) {
  switch (type) {
    case "channel":
      return Users;
    case "course":
      return GraduationCap;
    case "workshop":
      return Presentation;
    case "service":
      return Wrench;
    case "store-product":
      return Truck;
    case "product":
    default:
      return Package;
  }
}

function typeLabel(type: SellableItemType) {
  switch (type) {
    case "channel":
      return "Community";
    case "course":
      return "Course";
    case "workshop":
      return "Webinar";
    case "service":
      return "Service";
    case "store-product":
      return "Store";
    case "product":
    default:
      return "Product";
  }
}

function TypeBadge({ type }: { type: SellableItemType }) {
  const Icon = typeIcon(type);
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-white/10">
      <Icon className="w-3 h-3" />
      {typeLabel(type)}
    </span>
  );
}

function SellableThumb({ item, size = 56 }: { item: Sellable; size?: number }) {
  const Icon = typeIcon(item.itemType);
  if (item.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image}
        alt={item.name}
        className="rounded-md object-cover flex-shrink-0 bg-zinc-800"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-md bg-zinc-800 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Icon className="w-6 h-6 text-zinc-500" />
    </div>
  );
}

function currencySymbol(currency: string) {
  return currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
}

function formatLegacyPrice(price: number, currency: string) {
  return `${currencySymbol(currency)}${price.toLocaleString()}`;
}

// Re-export Sellable so other callers can import it without changing
// their existing path (the original file exposed it indirectly via
// the dialog's onPick signature).
export type { Sellable };
