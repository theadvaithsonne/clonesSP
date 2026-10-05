"use client";

import { createMagicLink, readMagicLink } from "@/lib/webinar/magic-link";
import {
  resolveGarageStoreItem,
  parseGarageStoreId,
  offerPrice,
  resolveTermMonths,
  type PlanOffer,
  type OfficeOffer,
} from "@/lib/webinar/garage-store-plans";
import { getOrgId } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import useWebinarStore from "@/store/webinarStore";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  CURRENCY_SYMBOL,
  convertPrice,
  formatPrice,
  type DisplayCurrency,
} from "@/lib/webinar/currency";
import { htmlToPlainText } from "@/lib/webinar/html-text";
import {
  Package,
  ShoppingBag,
  X,
  Minus,
  Repeat,
  Loader2,
  Check,
  Timer,
} from "lucide-react";

type BuyState = "idle" | "loading" | "opened" | "paid" | "error";

interface Props {
  /**
   * The buyer's chosen display currency is forwarded so the parent can
   * pass the same currency into StoreCheckoutDialog — that way the
   * invoice is generated in the unit the buyer was actually looking at.
   * Non-physical items pass null (the toggle is hidden for them and
   * pricing falls back to the item's native currency).
   */
  onBuy: (displayCurrency: DisplayCurrency | null) => Promise<void> | void;
  onUnpin?: () => void;
  onSwap?: () => void;
  onExpired?: () => void;
  buyState: BuyState;
}

export default function PinnedProductCard({
  onBuy,
  onUnpin,
  onSwap,
  onExpired,
  buyState,
}: Props) {
  const pinnedProduct = useWebinarStore((s) => s.pinnedProduct);
  const role = useWebinarStore((s) => s.role);
  const [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();

  const pinnedUntil = pinnedProduct?.pinnedUntil ?? null;
  const hasTimer = pinnedUntil != null;
  const remainingMs = hasTimer ? Math.max(0, pinnedUntil - now) : null;

  // Tick the clock once per second while a timer is active.
  useEffect(() => {
    if (!hasTimer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimer]);

  // Fire onExpired exactly once when the timer hits zero. Guarded by a ref so
  // unmount/remount (e.g. rerenders) don't re-fire, and so only the host
  // client actually emits the unpin (parent decides based on role).
  const expiredFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pinnedProduct) return;
    if (!hasTimer || remainingMs == null) return;
    if (remainingMs > 0) return;
    if (expiredFiredRef.current === pinnedProduct._id) return;
    expiredFiredRef.current = pinnedProduct._id;
    onExpired?.();
  }, [pinnedProduct, hasTimer, remainingMs, onExpired]);

  // Reset the expired guard when a new product is pinned.
  useEffect(() => {
    if (pinnedProduct && expiredFiredRef.current !== pinnedProduct._id) {
      expiredFiredRef.current = null;
    }
  }, [pinnedProduct?._id, pinnedProduct]);

  // Buyer-facing display currency. Only meaningful for physical items
  // (the only ones that flow through the multi-currency invoice
  // endpoint). Passed to onBuy so the parent forwards it to
  // StoreCheckoutDialog.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");
  const showCurrencyToggle = pinnedProduct?.isPhysical === true;

  // ── Garage Store: per-viewer pricing ───────────────────────────────
  // A pinned plan is the same for everyone, but the PRICE isn't: it
  // depends on this viewer's own 24h combo window, whether they already
  // own Unilevel Plus, and whether they've used the combo before. So we
  // resolve it here, per viewer, instead of trusting the pin snapshot.
  const isGarageStore = pinnedProduct?.itemType === "garage-store";
  const [offer, setOffer] = useState<
    (PlanOffer & { termMonths?: number | null }) | OfficeOffer
  >({ kind: "loading" });
  // Whether this viewer already holds a live subscription to the pinned
  // partner plan. Only the magic link can answer that — the server checks
  // for a paid, uncancelled chain and reports `status: "purchased"`; no
  // other endpoint exposes it. Minting is per-viewer (their own rate-limit
  // budget) and re-minting the same offer reuses the token.
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    if (!isGarageStore || !pinnedProduct) {
      setOffer({ kind: "loading" });
      return;
    }
    let cancelled = false;
    resolveGarageStoreItem(pinnedProduct._id, getOrgId())
      .then((o) => {
        if (!cancelled) setOffer(o);
      })
      .catch(() => {
        if (!cancelled)
          setOffer({ kind: "unavailable", reason: "Couldn't load this plan." });
      });
    return () => {
      cancelled = true;
    };
  }, [isGarageStore, pinnedProduct?._id]);

  useEffect(() => {
    setAlreadySubscribed(false);
    if (!isGarageStore || !pinnedProduct || !getToken()) return;
    const { userId } = getUserDataFromToken();
    if (!userId) return;
    const { catalogId, termMonths } = parseGarageStoreId(pinnedProduct._id);
    let cancelled = false;
    createMagicLink({
      userId,
      thirdPartyClientId: catalogId,
      termMonths: termMonths || 1,
    })
      .then((c) => (c?.token ? readMagicLink(c.token) : null))
      .then((link) => {
        if (!cancelled && link?.status === "purchased")
          setAlreadySubscribed(true);
      })
      .catch(() => {
        // Best-effort: the buy click re-checks anyway.
      });
    return () => {
      cancelled = true;
    };
  }, [isGarageStore, pinnedProduct?._id]);

  // CTA copy follows the offer state — "Claim free month" is a very
  // different promise from "Renew", and showing the wrong one is worse
  // than showing none.
  /**
   * The host pins one term, but inside an open 24h window the backend
   * doesn't sell a 1-month bundle (the free month IS that month). When the
   * term we can actually bill differs from the pinned one, say so — the
   * alternative is a card that silently quotes a different plan.
   */
  const termNote = useMemo(() => {
    if (!isGarageStore) return null;
    if (offer.kind === "loading" || offer.kind === "unavailable") return null;
    if (offer.kind === "office") return null;
    const pinned = offer.termMonths;
    const selling = resolveTermMonths(offer);
    // Monthly inside the window: the licence buys the first month outright.
    if (offer.kind === "combo" && offer.windowNeverStarted)
      return "Verify your phone at checkout to claim the free month";
    if (offer.kind === "combo" && offer.freeFirstMonth && selling === 1)
      return "First month free, then billed monthly";
    if (!pinned || pinned === selling) return null;
    const label = (n: number) => (n === 1 ? "1 month" : `${n} months`);
    return `${label(pinned)} isn't available with your offer — showing ${label(selling)}`;
  }, [isGarageStore, offer]);

  const offerCta = useMemo(() => {
    if (!isGarageStore) return null;
    switch (offer.kind) {
      case "loading":
        return "Loading…";
      case "unavailable":
        return "Unavailable";
      case "claim-free":
        return "Claim free month";
      case "renew":
        return "Renew";
      case "subscribe":
        return "Subscribe";
      case "combo":
        return offer.freeFirstMonth || offer.windowNeverStarted
          ? "Get 1st month FREE"
          : "Subscribe";
      case "office":
        // No office yet → they can't subscribe one; send them through
        // the create-an-office flow instead of failing at checkout.
        return offer.orgId ? "Subscribe" : "Launch an Office";
    }
  }, [isGarageStore, offer]);

  const priceLabel = useMemo(() => {
    if (!pinnedProduct) return "";
    if (isGarageStore) {
      if (offer.kind === "loading") return "…";
      if (offer.kind === "unavailable") return "—";
      if (offer.kind === "office") {
        // Base price — GST (India only) is applied at checkout.
        return `$${offer.plan.amount.toLocaleString()}/${offer.plan.period === "yearly" ? "yr" : "mo"}`;
      }
      // Price the term the host pinned, resolved against THIS viewer's
      // own price list (see resolveTermMonths).
      const p = offerPrice(offer, resolveTermMonths(offer));
      if (p == null) return "—";
      return p === 0 ? "FREE" : `$${p.toLocaleString()}`;
    }
    if (showCurrencyToggle) {
      const converted = convertPrice(
        pinnedProduct.price,
        pinnedProduct.currency,
        displayCurrency,
      );
      return `${CURRENCY_SYMBOL[displayCurrency]}${formatPrice(converted)}`;
    }
    return formatLegacyPrice(pinnedProduct.price, pinnedProduct.currency);
  }, [
    pinnedProduct,
    showCurrencyToggle,
    displayCurrency,
    isGarageStore,
    offer,
  ]);

  if (!pinnedProduct) return null;

  const isPresenter = role === "host";
  const hasToken = typeof window !== "undefined" ? !!getToken() : false;

  const countdownLabel = remainingMs != null ? formatCountdown(remainingMs) : null;

  const handleBuyClick = () => {
    if (!hasToken) {
      router.push("/login");
      return;
    }
    onBuy(showCurrencyToggle ? displayCurrency : null);
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="absolute bottom-28 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 bg-white hover:bg-zinc-200 text-black text-sm font-semibold px-4 py-2 rounded-full shadow-[0_8px_28px_rgba(0,0,0,0.8)] transition-colors"
        title="Show featured product"
      >
        <ShoppingBag className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {alreadySubscribed
            ? "Subscribed"
            : `${isGarageStore ? offerCta : "Buy"} · ${priceLabel}`}
        </span>
        {countdownLabel && (
          <span className="flex shrink-0 items-center gap-1 text-xs bg-zinc-900 px-1.5 py-0.5 rounded-full">
            <Timer className="w-3 h-3" />
            {countdownLabel}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="absolute bottom-28 right-4 z-30 box-border w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-black/85 backdrop-blur-xl border border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.9)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-white/10">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <ShoppingBag className="w-3 h-3" />
          Featured
        </span>
        <div className="flex items-center gap-2">
          {countdownLabel && (
            <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
              <Timer className="w-3 h-3" />
              {countdownLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {isPresenter && onUnpin && (
            <button
              type="button"
              onClick={onUnpin}
              className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
              title="Unpin product"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {/* "Generating ad…" ribbon while the Grok Imagine render is in
            flight. Once the render completes the ad video takes over the
            main stage as a spotlight (see VideoGrid.tsx) — this card
            stays as the compact info + buy surface so nothing overlaps. */}
        {(pinnedProduct.videoStatus === "processing" ||
          pinnedProduct.videoStatus === "pending") && (
          <div className="mb-2 flex justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/40 px-2 py-1 rounded">
              Generating ad…
            </span>
          </div>
        )}
        <div className="flex gap-3">
          {pinnedProduct.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pinnedProduct.images[0]}
              alt={pinnedProduct.name}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-zinc-900"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-zinc-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold line-clamp-2 break-words">
              {pinnedProduct.name}
            </p>
            {/* Rich-text HTML from the store editor — flatten to text. */}
            {htmlToPlainText(pinnedProduct.description) && (
              <p className="text-zinc-500 text-xs line-clamp-2 break-words mt-0.5">
                {htmlToPlainText(pinnedProduct.description)}
              </p>
            )}
            <p className="text-white text-base font-bold mt-1 tabular-nums">
              {priceLabel}
            </p>
            {termNote && (
              <p className="mt-0.5 break-words text-[11px] text-amber-400/90">
                {termNote}
              </p>
            )}
            {/* Buyer currency toggle. Only shown for physical items
                (which the invoice endpoint can re-price via
                displayCurrency). The choice flows into onBuy so the
                parent forwards it to StoreCheckoutDialog and the
                invoice is generated in the same currency the buyer
                is looking at. */}
            {showCurrencyToggle && (
              <div
                className="mt-1.5 inline-flex items-center rounded-full border border-white/10 bg-zinc-900 p-0.5"
                role="group"
                aria-label="Display currency"
              >
                {(["USD", "INR"] as const).map((c) => {
                  const active = displayCurrency === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDisplayCurrency(c);
                      }}
                      aria-pressed={active}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
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
        </div>

        {/* CTA */}
        {!isPresenter && (
          <button
            type="button"
            onClick={handleBuyClick}
            disabled={
              buyState === "loading" || buyState === "paid" || alreadySubscribed
            }
            className={`w-full max-w-full mt-3 flex items-center justify-center gap-2 break-words text-center text-sm font-semibold px-3 py-2.5 rounded-lg transition-colors ${
              buyState === "paid" || alreadySubscribed
                ? "bg-green-600 text-white"
                : buyState === "loading"
                  ? "bg-zinc-700 text-white cursor-wait"
                  : "bg-white hover:bg-zinc-200 text-black active:scale-[0.98]"
            }`}
          >
            {!hasToken ? (
              "Sign in to buy"
            ) : alreadySubscribed ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                You already have this subscription
              </>
            ) : buyState === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing...
              </>
            ) : buyState === "opened" ? (
              // Garage Store hands off to the magic-link page AND mails the
              // same link, so say that rather than "waiting for payment" —
              // the buyer may well finish from their inbox instead.
              isGarageStore ? (
                "Link opened — also sent to your email"
              ) : (
                "Waiting for payment..."
              )
            ) : buyState === "paid" ? (
              <>
                <Check className="w-4 h-4" />
                Purchased
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                Buy Now
              </>
            )}
          </button>
        )}

        {isPresenter && onSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="w-full mt-3 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg bg-zinc-900 hover:bg-white/10 text-zinc-300 transition-colors"
          >
            <Repeat className="w-3.5 h-3.5" />
            Swap product
          </button>
        )}
      </div>
    </div>
  );
}

function formatLegacyPrice(price: number, currency: string) {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
  return `${symbol}${price.toLocaleString()}`;
}

function formatCountdown(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
