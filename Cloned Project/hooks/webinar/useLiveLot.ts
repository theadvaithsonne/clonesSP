"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  fetchAuctionLot,
  fetchAuctionWin,
  fetchBidHistory,
  isSettled,
  type AuctionLot,
  type AuctionWin,
  type LotBid,
} from "@/lib/api/auctionLot";
import { placeBid, InsufficientAuctionBalanceError } from "@/lib/api/auctions";
import {
  getAuctionWalletBalance,
  type AuctionWalletBalance,
} from "@/lib/api/auctionWallet";
import { AUCTION_PING_EVENT } from "@/lib/webinar/bid-channel";

/**
 * The live lot on the block inside a webinar room.
 *
 * The store backend is the arbiter: it orders bids atomically, applies
 * anti-snipe in the same write, and settles on a cron. So every number here
 * comes from REST, and the `nc:bid` LiveKit data channel only ever says "lot X
 * changed, refetch". That is why this hook takes a product id rather than a
 * catalogue — a lot is whatever the host pinned, and reading it needs nothing
 * but its id.
 *
 * Two transports drive the same refetch:
 *   - the data-channel ping, re-broadcast by useWebinarLiveKit as the window
 *     event `webinar:auction-ping` (sub-100ms, the common case)
 *   - a 3s poll while the lot is open (late joiners, dropped packets, and the
 *     cron-driven close, which arrives with no ping at all)
 */

/** While a lot is open. Settlement is a cron, so the winner can be decided with
 *  no bid and no ping — without this the lot would sit on "live" past its own
 *  deadline. */
const LOT_POLL_MS = 3_000;
/**
 * While the pinned item has no round on it yet. A host can pin a product and
 * start the auction minutes later, so we can't stop reading — but a plain Buy
 * Now pin must not cost every viewer a request every three seconds for the
 * whole stream.
 */
const IDLE_POLL_MS = 15_000;
/** Retry cadence while an escrow capture is still pending. */
const WIN_RETRY_MS = 5_000;
/** A win endpoint that isn't deployed answers 404 forever — don't loop on it. */
const WIN_MAX_FAILURES = 3;

/** Emitted by every ping transport — see lib/webinar/bid-channel. */
export { AUCTION_PING_EVENT } from "@/lib/webinar/bid-channel";

export interface LiveLot {
  auction: AuctionLot | null;
  /** Newest-first bid feed, refetched alongside the lot. */
  bids: LotBid[];
  /** A bid is in flight — the server hasn't ruled yet. */
  bidding: boolean;
  /** How a lot this viewer WON settled against their Auction Wallet. */
  win: AuctionWin | null;
  /** The bidder's prepaid balance, when signed in. */
  wallet: AuctionWalletBalance | null;
  /** Place a bid at exactly the amount the button advertised. */
  bid: (amount: number) => Promise<void>;
  /** Set when a bid was refused for lack of wallet balance; drives the top-up. */
  shortfallUsd: number | null;
  clearShortfall: () => void;
  /** Re-read lot state now (after someone else's bid ping). */
  refresh: () => void;
}

export function useLiveLot({
  productId,
  authed,
  onBidPlaced,
}: {
  /** The lot the host has on the block, or null when there isn't one. */
  productId: string | null;
  authed: boolean;
  /** Fan out to the room so everyone refetches now rather than on their poll. */
  onBidPlaced?: (productId: string) => void;
}): LiveLot {
  const [auction, setAuction] = useState<AuctionLot | null>(null);
  const [bids, setBids] = useState<LotBid[]>([]);
  const [bidding, setBidding] = useState(false);
  const [win, setWin] = useState<AuctionWin | null>(null);
  const [wallet, setWallet] = useState<AuctionWalletBalance | null>(null);
  const [shortfallUsd, setShortfallUsd] = useState<number | null>(null);

  // Written straight to refs as well as to state: `refreshLot` guards on the
  // id to drop results for a lot we've since moved off, and a fetch can resolve
  // before React has re-rendered.
  const lotIdRef = useRef<string | null>(null);
  lotIdRef.current = productId;
  const biddingRef = useRef(false);
  const auctionRef = useRef<AuctionLot | null>(null);
  auctionRef.current = auction;

  const refreshLot = useCallback(async (id: string) => {
    // Lot state and the feed go together — a viewer watching the Bids tab is
    // watching the same event as the viewer watching the price.
    const [lot, feed] = await Promise.allSettled([
      fetchAuctionLot(id),
      fetchBidHistory(id),
    ]);
    if (lotIdRef.current !== id) return;
    // A transient failure must not blank a live auction: keep what we had.
    if (lot.status === "fulfilled" && lot.value) {
      // Ref first: the poll picks its next delay from it, and that decision is
      // made before React has re-rendered and re-synced the ref.
      auctionRef.current = lot.value;
      setAuction(lot.value);
    }
    if (feed.status === "fulfilled") setBids(feed.value);
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!authed) {
      setWallet(null);
      return;
    }
    try {
      setWallet(await getAuctionWalletBalance());
    } catch {
      /* the balance is a hint, not a gate — the 402 is what actually rules */
    }
  }, [authed]);

  // A new lot replaces the old one OUTRIGHT — every field, before the first
  // read of the new one lands. Keeping the previous lot's state around for the
  // width of a fetch is how a freshly pinned item ends up announcing the last
  // item's winner, price and bid feed to the room. A null id retires the lot on
  // the same terms.
  useEffect(() => {
    // Ref first: refreshLot's stale-result guard and the poll's cadence are
    // both read before React has re-rendered and re-synced it.
    auctionRef.current = null;
    setAuction(null);
    setBids([]);
    setWin(null);
    setShortfallUsd(null);
    if (!productId) return;
    refreshLot(productId);
  }, [productId, refreshLot]);

  // Pull the balance once per lot so the card can say what's available before
  // the bidder finds out the hard way.
  useEffect(() => {
    if (!productId) return;
    refreshWallet();
  }, [productId, refreshWallet]);

  // Status is read through a ref on purpose: depending on `auction` would
  // rebuild this timer on every poll result, so it would restart forever and
  // never fire. Self-scheduling rather than an interval so the cadence can
  // follow the lot — fast while one is running, slow while the pin is just a
  // product, stopped once it's settled.
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const status = auctionRef.current?.status;
      // Settled — nothing left to watch.
      if (status && isSettled(status)) return;
      const delay = auctionRef.current ? LOT_POLL_MS : IDLE_POLL_MS;
      timer = setTimeout(async () => {
        if (cancelled) return;
        await refreshLot(productId);
        if (!cancelled) schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [productId, refreshLot]);

  // ── Data-channel ping ──
  // Someone in the room bid. Refetch immediately instead of waiting out the
  // poll — this is what makes the price move for every viewer at once.
  useEffect(() => {
    if (!productId) return;
    const onPing = (e: Event) => {
      const pinged = (e as CustomEvent<{ productId?: string }>).detail?.productId;
      // A ping with no id (or for the lot we're already on) still means "this
      // room's lot changed" — a host swapping lots re-pins, which is its own
      // event.
      if (pinged && pinged !== productId) return;
      refreshLot(productId);
    };
    window.addEventListener(AUCTION_PING_EVENT, onPing as EventListener);
    return () =>
      window.removeEventListener(AUCTION_PING_EVENT, onPing as EventListener);
  }, [productId, refreshLot]);

  // ── Winning a lot ──
  // There is nothing to pay. The escrow left the bidder's Auction Wallet when
  // they bid and was captured when the lot closed, so winning is purely "did
  // the money actually move" — the one thing a winner can't infer from the
  // room. Capture is a server-side job, so poll only while the answer is
  // genuinely outstanding and stop dead on settled/failed.
  const soldStatus = auction?.status === "sold";
  useEffect(() => {
    if (!productId || !authed || !soldStatus) {
      setWin(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const tick = async () => {
      try {
        const w = await fetchAuctionWin(productId);
        if (cancelled) return;
        failures = 0;
        setWin(w);
        // Only a pending capture is worth asking about again.
        if (w && w.status === "pending") timer = setTimeout(tick, WIN_RETRY_MS);
      } catch {
        if (cancelled) return;
        if (++failures <= WIN_MAX_FAILURES) timer = setTimeout(tick, WIN_RETRY_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [productId, soldStatus, authed]);

  const bid = useCallback(
    async (amount: number) => {
      const id = lotIdRef.current;
      if (!id || biddingRef.current) return;
      if (!authed) {
        toast.error("Sign in to bid — the lot has to be awarded to someone.");
        return;
      }
      biddingRef.current = true;
      setBidding(true);
      try {
        // No card sheet here, by design: the bid escrows against the bidder's
        // prepaid Auction Wallet in the same write that orders it, so a
        // 30-second lot isn't spent waiting on a payment, and whoever gets
        // outbid has their escrow released rather than being charged.
        const { newHighest, binHit } = await placeBid(id, amount);
        // Paint the accepted amount straight away — the refetch behind it
        // carries the authoritative bid count, leader and any anti-snipe
        // extension, but the bidder shouldn't wait a round trip to see they
        // won the click.
        setAuction((prev) =>
          prev && prev.productId === id
            ? { ...prev, currentBid: newHighest, bidCount: prev.bidCount + 1 }
            : prev
        );
        if (binHit) toast.success("You won it — auction ended!");
        // Tell the room first: every other viewer's refetch starts while ours
        // is still in flight.
        onBidPlaced?.(id);
        await refreshLot(id);
        refreshWallet();
      } catch (err) {
        // An empty wallet isn't a lost bid — nothing about the lot changed, so
        // don't refetch it and don't accuse them of being outbid. Surface the
        // top-up instead; they come back and tap Bid again.
        if (err instanceof InsufficientAuctionBalanceError) {
          setShortfallUsd(err.shortfallUsd);
          return;
        }
        await refreshLot(id);
        toast.error(
          (err as Error)?.message || "Someone may have outbid you — try again."
        );
      } finally {
        biddingRef.current = false;
        setBidding(false);
      }
    },
    [authed, refreshLot, refreshWallet, onBidPlaced]
  );

  const refresh = useCallback(() => {
    const id = lotIdRef.current;
    if (id) refreshLot(id);
  }, [refreshLot]);

  const clearShortfall = useCallback(() => setShortfallUsd(null), []);

  return {
    auction,
    bids,
    bidding,
    win,
    wallet,
    bid,
    shortfallUsd,
    clearShortfall,
    refresh,
  };
}
