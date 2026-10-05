"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronsRight,
  Gavel,
  Hourglass,
  Loader2,
  Minus,
  Package,
  Timer,
  TrendingUp,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { nextBidAmount, type AuctionLot, type AuctionWin } from "@/lib/api/auctionLot";
import type { AuctionWalletBalance } from "@/lib/api/auctionWallet";
import { formatMoney } from "@/lib/webinar/currency";
import AuctionTopUpModal from "./AuctionTopUpModal";

/**
 * The live lot overlay inside a webinar room. Takes the pinned-product slot
 * whenever the pinned item has an auction running on it, because a lot and a
 * Buy Now button are mutually exclusive offers on the same thing:
 *
 *   @someone is winning!            ← social pressure, the reason people bid
 *   ┌──────────────────────────┐
 *   │ [img] Item name          │
 *   │       $35        00:29   │  ← price, then the countdown going hot
 *   │       12 bids            │
 *   ├──────────────────────────┤
 *   │ [      Bid $40  ≫      ] │  ← the loudest thing on the card
 *   └──────────────────────────┘
 *
 * Every number arrives from REST via useLiveLot; nothing is decided here. The
 * one piece of local reasoning is the clock: `endsAt` is the server's, so the
 * countdown — and therefore whether a Bid button is offered at all — is
 * measured against the server's clock via the lot's measured skew.
 */
export default function LiveAuctionCard({
  auction,
  fallbackName,
  fallbackImage,
  authed,
  meId,
  bidding,
  win,
  wallet,
  onBid,
  shortfallUsd,
  onShortfallClear,
  isHost,
  onCancelAuction,
  cancelling,
  onUnpin,
}: {
  auction: AuctionLot;
  /** Pin copy, used until the lot's own product read lands. */
  fallbackName?: string;
  fallbackImage?: string;
  authed: boolean;
  /** Current user's id, so a bidder can be told when they're the one winning. */
  meId?: string | null;
  bidding: boolean;
  win: AuctionWin | null;
  wallet: AuctionWalletBalance | null;
  onBid: (amount: number) => void;
  shortfallUsd: number | null;
  onShortfallClear: () => void;
  isHost: boolean;
  onCancelAuction?: () => void;
  cancelling?: boolean;
  onUnpin?: () => void;
}) {
  const router = useRouter();
  const [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // One ticker drives the auction clock. 250ms so the last ten seconds — where
  // the whole auction happens — never look stuck.
  const onAuctionClock = auction.status === "live";
  const deadline = onAuctionClock ? auction.endsAt : null;
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  // ── Bid feedback ──
  // The number is the whole event, and a price silently changing from $38 to
  // $42 is easy to miss while watching video. Driven off `bidCount` rather than
  // the amount, because a bid that ties the displayed price (a corrected poll,
  // an anti-snipe re-read) is still a bid, and the count only moves one way.
  const bidCount = auction.bidCount;
  const [popping, setPopping] = useState(false);
  // Seeded on the first render for this lot so arriving mid-auction doesn't
  // fire a celebration for bids that happened before you got here.
  const seenBids = useRef<{ lot: string | null; count: number }>({
    lot: null,
    count: 0,
  });
  useEffect(() => {
    const lot = auction.productId;
    const seen = seenBids.current;
    if (seen.lot !== lot || bidCount <= seen.count) {
      seenBids.current = { lot, count: bidCount };
      return;
    }
    seenBids.current = { lot, count: bidCount };
    // Next frame, not this commit: flipping the class in the same paint as the
    // new price batches into one style change and the transition never runs.
    const raf = requestAnimationFrame(() => setPopping(true));
    const t = setTimeout(() => setPopping(false), 900);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [bidCount, auction.productId]);

  // The last live bid this card saw, kept so a settled lot whose state has
  // stopped reporting a price doesn't render the win as 0. Adjusted during
  // render rather than in an effect — the value is needed on this same pass.
  //
  // Scoped to the lot it was measured on: this figure is the fallback the sold
  // banner falls back to, so carrying it across a re-pin is how a fresh item
  // announces the previous item's hammer price.
  const liveBid = auction.currentBid;
  const [lastLiveBid, setLastLiveBid] = useState(0);
  const lastLiveBidLot = useRef<string | null>(null);
  if (lastLiveBidLot.current !== auction.productId) {
    lastLiveBidLot.current = auction.productId;
    if (lastLiveBid !== 0) setLastLiveBid(0);
  } else if (bidCount > 0 && liveBid > 0 && liveBid !== lastLiveBid) {
    setLastLiveBid(liveBid);
  }

  // `endsAt` is on the server's clock; `now` is on this device's. Bidding is
  // gated on the countdown reaching zero, so an unsynced clock would otherwise
  // decide whether this viewer gets a Bid button at all.
  const clock = onAuctionClock ? now + auction.clockSkewMs : now;
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - clock) / 1000)) : null;
  const countdown =
    secondsLeft == null
      ? null
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  // Under ten seconds the clock goes hot — the strongest urgency cue there is.
  const urgent = secondsLeft != null && secondsLeft <= 10;

  const running = auction.status === "live" || auction.status === "scheduled";
  // A lot outlives its own deadline: the server only settles on a cron (up to
  // 60s later), so it still reads as 'live' with the clock at zero. Bidding is
  // already closed server-side, so offer a closing state instead of a Bid
  // button that is certain to be rejected.
  const settling = running && auction.status === "live" && secondsLeft === 0;
  const open = running && !settling;
  const sold = auction.status === "sold";
  // 'unsold' is the reserve-not-met close; 'ended' is the same shape before the
  // cron has decided which of the two it was.
  const unsold = auction.status === "unsold" || auction.status === "ended";
  const cancelled = auction.status === "cancelled";
  // Naming the leader is the pressure; telling *you* that you're the leader is
  // the payoff.
  const youLead = Boolean(meId && auction.leaderUserId && auction.leaderUserId === meId);
  const bidAmount = nextBidAmount(auction);

  const name = auction.name || fallbackName || "Item";
  const image = auction.image || fallbackImage;
  const priceLabel = formatMoney(auction.currentBid, auction.currency);

  // What the lot actually went for, best source first: the server's own record
  // of the winning bid, then a still-good live figure, then the last one this
  // card saw. A settled lot that no longer reports either would otherwise land
  // on 0 and congratulate the winner on nothing.
  const wonAmount =
    win?.amount ?? (auction.currentBid > 0 ? auction.currentBid : lastLiveBid);
  const wonLabel =
    wonAmount > 0 ? formatMoney(wonAmount, win?.currency ?? auction.currency) : null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="absolute bottom-28 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_8px_28px_rgba(0,0,0,0.8)] transition-colors hover:bg-zinc-200"
        title="Show live auction"
      >
        <Gavel className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {open && !isHost
            ? `Bid ${formatMoney(bidAmount, auction.currency)}`
            : priceLabel}
        </span>
        {countdown && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-mono ${
              urgent ? "bg-red-600 text-white" : "bg-zinc-900 text-white"
            }`}
          >
            <Timer className="w-3 h-3" />
            {countdown}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="absolute bottom-28 right-4 z-30 box-border w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/15 bg-black/85 shadow-[0_12px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          <Gavel className="w-3 h-3" />
          {open ? "Live auction" : settling ? "Closing" : "Auction"}
        </span>
        <div className="flex items-center gap-2">
          {countdown && (
            <span
              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                urgent
                  ? "border-red-500/50 bg-red-500/15 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <Timer className="w-3 h-3" />
              {countdown}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded p-1 text-zinc-500 transition-colors hover:text-white"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {isHost && onUnpin && (
            <button
              type="button"
              onClick={onUnpin}
              className="rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
              title="Unpin item"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        {/* Winner line — the social pressure that makes people bid. */}
        {bidCount > 0 && (
          <div
            className={`mb-2 inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1 transition-transform duration-200 ${
              sold ? "bg-amber-500/20" : "bg-white/10"
            } ${popping ? "scale-[1.06]" : "scale-100"}`}
          >
            {sold ? (
              <Trophy className="h-3 w-3 shrink-0 text-amber-300" />
            ) : (
              <TrendingUp className="h-3 w-3 shrink-0 text-amber-300" />
            )}
            <span className="flex min-w-0 items-center gap-1 text-[11px] text-zinc-300">
              {youLead ? (
                <span className="truncate font-bold text-amber-300">
                  {sold ? "You won!" : "You're winning!"}
                </span>
              ) : (
                <>
                  {/* Only the handle truncates — the verb that follows it is
                      the whole point of the line, so it never gets cut. */}
                  <span className="truncate font-bold text-amber-300">
                    {auction.leaderName ? `@${auction.leaderName}` : "Someone"}
                  </span>
                  <span className="shrink-0">{sold ? "won!" : "is winning!"}</span>
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={image}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-lg bg-zinc-900 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900">
              <Package className="h-6 w-6 text-zinc-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-sm font-semibold text-white">
              {name}
            </p>
            <p
              className={`mt-0.5 text-xl font-bold tabular-nums text-white transition-transform duration-200 ${
                popping ? "scale-[1.12]" : "scale-100"
              } origin-left`}
            >
              {priceLabel}
            </p>
            <p className="text-[11px] font-semibold text-zinc-500">
              {bidCount > 0
                ? `${bidCount} bid${bidCount === 1 ? "" : "s"}`
                : open
                  ? "no bids yet · opening price"
                  : "current bid"}
            </p>
          </div>
        </div>

        {/* ── Action ── */}
        {open ? (
          // The seller is the one person who may not bid: the backend refuses
          // it (400, "sellers cannot bid on their own auctions"), so offering
          // the button would only ever produce an error toast. The host gets
          // the state of their own room instead — and the Cancel control below.
          isHost ? (
            <div className="mt-3 flex w-full max-w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
              <Gavel className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="min-w-0 break-words text-[11px] font-semibold text-white">
                Live auction active
                {countdown ? ` · closes in ${countdown}` : ""}
                {bidCount > 0
                  ? ` · ${bidCount} bid${bidCount === 1 ? "" : "s"}`
                  : " · no bids yet"}
              </span>
            </div>
          ) : authed ? (
            <>
              <button
                type="button"
                onClick={() => onBid(bidAmount)}
                disabled={bidding}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-300 disabled:opacity-60 active:scale-[0.98]"
              >
                {bidding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Placing bid…
                  </>
                ) : (
                  <>
                    Bid {formatMoney(bidAmount, auction.currency)}
                    <ChevronsRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {/* Bidding is free by design, not by omission — say so, because a
                  bidder about to tap that button wants to know what it costs. */}
              <p className="mt-1.5 text-center text-[10px] font-semibold text-zinc-500">
                Free to bid — you only pay if you win
              </p>
              {wallet && (
                <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-zinc-500">
                  <Wallet className="h-3 w-3" />
                  Wallet ${wallet.availableBalance.toFixed(2)}
                  {wallet.lockedBalance > 0 && (
                    <span className="text-zinc-600">
                      · ${wallet.lockedBalance.toFixed(2)} in escrow
                    </span>
                  )}
                </p>
              )}
            </>
          ) : (
            // Signing in mid-auction shouldn't cost the viewer the lot, but the
            // room has no inline auth — send them to login and back.
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-3 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-300"
            >
              Sign in to bid
            </button>
          )
        ) : settling ? (
          <div className="mt-3 flex w-full max-w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
            <Hourglass className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="min-w-0 break-words text-[11px] font-semibold text-white">
              Bidding closed at {priceLabel} · confirming the winner
            </span>
          </div>
        ) : sold ? (
          // Nothing to tap when a lot sells, deliberately. The money left the
          // winner's Auction Wallet as escrow when they bid, and closing the lot
          // captured it, so there is no payment to make. What a winner can't
          // know from the room is whether the capture actually went through, and
          // that is all this reports.
          <div
            className={`mt-3 flex w-full max-w-full flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-center ${
              win?.status === "failed"
                ? "border-red-500/50 bg-red-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <span className="flex w-full max-w-full items-center justify-center gap-2 text-[11px] font-semibold text-white">
              <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="min-w-0 break-words text-center">
                {!youLead
                  ? auction.leaderName
                    ? `@${auction.leaderName} won${wonLabel ? ` for ${wonLabel}` : ""}`
                    : wonLabel
                      ? `Won for ${wonLabel}`
                      : "Lot closed"
                  : win?.status === "settled"
                    ? `You won · paid ${
                        win.amountUsd != null
                          ? formatMoney(win.amountUsd, "USD")
                          : (wonLabel ?? "")
                      } from your wallet`
                    : win?.status === "failed"
                      ? `You won${wonLabel ? ` at ${wonLabel}` : ""} · payment didn't go through`
                      : `You won${wonLabel ? ` at ${wonLabel}` : ""} · settling from your wallet`}
              </span>
            </span>
            {youLead && win?.invoiceId && (
              <a
                href={`/invoice/${win.invoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-amber-300 underline"
              >
                View invoice
              </a>
            )}
          </div>
        ) : (
          <div className="mt-3 w-full max-w-full break-words rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center text-[11px] font-semibold text-zinc-400">
            {cancelled
              ? "Auction cancelled — every bid was refunded"
              : unsold
                ? "Auction ended with no winner"
                : "Auction not open"}
          </div>
        )}

        {/* Host control. Cancelling releases every escrow held against the lot,
            so it is safe to pull — but it is not undoable, hence the confirm. */}
        {isHost && open && onCancelAuction && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Cancel this auction? Every bid is refunded and the lot closes with no winner."
                )
              ) {
                onCancelAuction();
              }
            }}
            disabled={cancelling}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-red-300 disabled:opacity-60"
          >
            {cancelling ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Cancel auction"
            )}
          </button>
        )}
      </div>

      {shortfallUsd != null && (
        <AuctionTopUpModal shortfallUsd={shortfallUsd} onClose={onShortfallClear} />
      )}
    </div>
  );
}
