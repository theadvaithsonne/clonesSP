/**
 * Bidding writes against the Garage Store backend.
 *
 * Reads live in ./auctionLot — this file is only the two authenticated
 * mutations the webinar room performs: placing a bid, and (host only) pulling
 * a live lot.
 */

import { getToken } from "@/lib/auth";
import { STORE_API_URL } from "./auctionLot";

const base = () => STORE_API_URL.replace(/\/$/, "");

export interface Bid {
  _id: string;
  amount: number;
  currency: string;
  status: "active" | "outbid" | "won" | "released" | "cancelled";
  createdAt: string;
  bidderName?: string;
}

export interface PlaceBidResult {
  bid: Bid;
  /** Buy-It-Now was hit — the lot closed on this very bid. */
  binHit: boolean;
  newHighest: number;
  escrow?: { lockedUsd: number; deltaUsd: number; exchangeRate: number };
  wallet?: { balance: number; lockedBalance: number; currency: string };
}

/**
 * The bid endpoint responds with 402 + code:"INSUFFICIENT_AUCTION_BALANCE"
 * when the Auction Wallet can't cover the bid. `shortfallUsd` is the exact
 * top-up amount the card should pre-seed into the modal.
 */
export class InsufficientAuctionBalanceError extends Error {
  readonly code = "INSUFFICIENT_AUCTION_BALANCE" as const;
  constructor(
    readonly requiredUsd: number,
    readonly availableUsd: number,
    readonly shortfallUsd: number
  ) {
    super(`Add $${shortfallUsd.toFixed(2)} to your Auction Wallet to place this bid`);
    this.name = "InsufficientAuctionBalanceError";
  }
}

/**
 * Place a bid at exactly the amount the button advertised.
 *
 * The whole write is one Mongo transaction server-side: order the bid, lock
 * the escrow delta against the bidder's Auction Wallet, apply anti-snipe. So
 * there are only three outcomes worth branching on here — accepted, wallet
 * short (402), or someone got in first (409, surfaced as a plain error).
 */
export async function placeBid(
  productId: string,
  amount: number
): Promise<PlaceBidResult> {
  const token = getToken();
  if (!token) throw new Error("Sign in to bid");

  const res = await fetch(`${base()}/products/${encodeURIComponent(productId)}/bids`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }),
  });

  const body = await res.json().catch(() => null);

  if (res.status === 402 && body?.code === "INSUFFICIENT_AUCTION_BALANCE") {
    const d = body.data || {};
    // Round the shortfall UP so a sub-cent rounding difference doesn't leave
    // the buyer $0.01 short after top-up and force a second round-trip through
    // Garage Invoice.
    throw new InsufficientAuctionBalanceError(
      Number(d.requiredUsd) || 0,
      Number(d.availableUsd) || 0,
      Math.ceil((Number(d.shortfallUsd) || 0) * 100) / 100
    );
  }

  if (!res.ok) {
    throw new Error(
      body?.error || body?.message || "Someone may have outbid you — try again."
    );
  }

  return (body?.data ?? body) as PlaceBidResult;
}

/** What the host sets when they put an item on the block. Major units in the
 *  product's own currency — this API never deals in cents. */
export interface AuctionRoundConfig {
  startPrice: number;
  minBidIncrement: number;
  durationSec: number;
}

/**
 * Host opens a round on one of their own storefront products.
 *
 * The auction IS the product: there is no lot document, so starting a round
 * writes a fresh `auction` subdoc window server-side. The endpoint wipes what a
 * previous round left behind (highest bidder, winning bid, settlement status,
 * reserve/BIN) in the same write, which is why a re-auctioned item can't
 * inherit the last winner — and it refuses (409) rather than clobbering a round
 * that still has live escrow riding on it.
 *
 * Only the seller's own org may call it; anyone else gets 403. `saleType` is
 * deliberately left alone, so the item stays a Buy Now listing on the
 * storefront and is a lot only for the length of the session.
 */
export async function startAuctionRound(
  productId: string,
  { startPrice, minBidIncrement, durationSec }: AuctionRoundConfig
): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Sign in to start an auction");

  const res = await fetch(`${base()}/products/${encodeURIComponent(productId)}/round`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ startPrice, minBidIncrement, durationSec }),
  });

  if (res.ok) return;

  const body = await res.json().catch(() => null);
  // 409 is the one worth passing through verbatim: the backend distinguishes
  // "already running" from "a previous round is still settling", and the host's
  // next move differs between them.
  throw new Error(
    body?.error ||
      body?.message ||
      (res.status === 403
        ? "Only the seller can auction this item"
        : "Couldn't start the auction")
  );
}

/**
 * Host pulls a live lot. Releases every escrow held against it server-side, so
 * nobody's wallet is left locked on an auction that will never settle. Only
 * the seller's own org may call it — a viewer gets 403.
 */
export async function cancelAuction(
  productId: string
): Promise<{ cancelled: boolean; refundedCount: number; refundedUsd: number }> {
  const token = getToken();
  if (!token) throw new Error("Sign in to cancel this auction");

  const res = await fetch(
    `${base()}/products/${encodeURIComponent(productId)}/auction/cancel`,
    {
      method: "POST",
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || body?.message || "Couldn't cancel the auction");
  }
  return (body?.data ?? body) as {
    cancelled: boolean;
    refundedCount: number;
    refundedUsd: number;
  };
}
