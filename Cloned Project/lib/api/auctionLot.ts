/**
 * Live auction lots — the bidding half of a live stream.
 *
 * Wire-identical to the storefront web app (garage-store-nextjs-v1
 * lib/api/auctionLot.ts) on purpose: a lot opened by a host on the store side
 * is readable and biddable from the webinar room, and both audiences see the
 * same numbers.
 *
 * The Garage Store backend is the arbiter. It orders bids atomically (a single
 * Mongo transaction), applies anti-snipe in the same write, and settles on a
 * cron. The client never decides anything — REST is truth, and the `nc:bid`
 * LiveKit data channel only ever says "this lot changed, refetch".
 *
 * Concept map (room mental model → storefront endpoint):
 *   "lot"           → a Product with a live `auction` subdoc
 *   "place bid"     → POST /products/:id/bids      (atomic, needs auth)
 *   "current state" → GET  /storefront/marketplace/products/:id  (public)
 *   "bid history"   → GET  /products/:id/bids      (public; names unmasked
 *                                                   for the seller only)
 *   "auto-close"    → server cron, up to 60s past endsAt
 *
 * MONEY MODEL (NetworkChain's, shared with the store app):
 *   - Bidding is backed by a prepaid AUCTION WALLET: one USD balance per buyer
 *     spanning every store's auctions. Placing a bid ESCROWS against it in the
 *     same write that orders the bid, so a 30s lot is never spent waiting on a
 *     card sheet, and a bid that would overdraw the wallet is refused up front
 *     with 402 rather than half-placed.
 *   - Closing the lot CAPTURES the winner's escrow server-side; losers get
 *     theirs released. The winner owes nothing further, so THERE IS NO WINNER
 *     CHECKOUT — the win-time surface is a READ (`fetchAuctionWin`) reporting
 *     whether the money actually moved.
 */

import { getToken } from "@/lib/auth";

/**
 * Garage Store backend. Distinct from NEXT_PUBLIC_API_URL (the main Garage
 * backend) — products, bids and lot state all live on the store side, while
 * the Auction Wallet lives on the main side. Both names are read so a deploy
 * that already sets NEXT_PUBLIC_ECOMMERCE_API_URL keeps working.
 */
export const STORE_API_URL =
  process.env.NEXT_PUBLIC_STORE_API_URL ||
  process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ||
  "https://ecommerce.networkchains.com";

export type AuctionStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "sold"
  | "unsold"
  | "cancelled";

/** Normalized view of a lot, in the shape the room renders. */
export interface AuctionLot {
  productId: string;
  name: string;
  image?: string;
  currency: string;
  status: AuctionStatus;
  /** Epoch ms — the server's ISO clocks, converted once here. */
  startsAt: number;
  endsAt: number;
  startPrice: number;
  minBidIncrement: number;
  /** What the lot stands at: the high bid, or the opening price with no bids. */
  currentBid: number;
  bidCount: number;
  leaderName: string | null;
  leaderUserId: string | null;
  /**
   * Add this to `Date.now()` to get the server's clock. `endsAt` is the
   * server's deadline, so the countdown — and therefore whether the Bid button
   * is offered at all — has to be measured against the same clock. A device
   * running a minute fast would otherwise show every 30s lot as already closed
   * and never render a Bid button.
   */
  clockSkewMs: number;
}

interface RawBid {
  _id: string;
  amount: number;
  currency: string;
  status: "active" | "outbid" | "won" | "released" | "cancelled";
  createdAt: string;
  bidderName?: string;
}

const base = () => STORE_API_URL.replace(/\/$/, "");

function toMs(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** What a bidder must beat: the standing bid plus one increment. */
export function nextBidAmount(lot: AuctionLot): number {
  return lot.bidCount > 0 ? lot.currentBid + lot.minBidIncrement : lot.startPrice;
}

/**
 * Whether a storefront product should be treated as an auction.
 *
 * saleType alone is not enough: a live-session round (the host taps "Start
 * auction" mid-broadcast) deliberately leaves saleType untouched, so a
 * `buy_now` product with a round running carries the auction only in its
 * `auction` subdoc. A product that has never seen a round has no
 * `auction.status` and still falls through to the Buy Now path.
 */
export function isAuctionProduct(p: {
  saleType?: string;
  auction?: { status?: string };
}): boolean {
  return (
    p.saleType === "auction" || p.saleType === "hybrid_auction" || !!p.auction?.status
  );
}

/** True once the lot is decided, whichever way it went. */
export function isSettled(status: AuctionStatus): boolean {
  return (
    status === "sold" ||
    status === "unsold" ||
    status === "ended" ||
    status === "cancelled"
  );
}

/**
 * The leader's name only exists in the bid history — the state endpoint carries
 * `highestBidderId` and nothing else. Cached against the bid count so the poll
 * costs one request, and the second is spent only when someone actually bids.
 */
let leaderCache: { productId: string; bidCount: number; name: string | null } | null =
  null;

async function leaderNameFor(
  productId: string,
  bidCount: number
): Promise<string | null> {
  if (bidCount <= 0) return null;
  if (
    leaderCache &&
    leaderCache.productId === productId &&
    leaderCache.bidCount === bidCount
  ) {
    return leaderCache.name;
  }
  let name: string | null = null;
  try {
    const bids = await fetchBidHistory(productId);
    // History comes back newest-first; the standing bid is the active one.
    const top = bids.find((b) => b.status === "active" || b.status === "won") ?? bids[0];
    name = top?.bidderName ?? null;
  } catch {
    /* names are decoration — a live lot must still render without them */
  }
  leaderCache = { productId, bidCount, name };
  return name;
}

/**
 * One row of the bid feed. `bidderName` is masked to everyone but the seller —
 * the backend decides that from the JWT, we just surface what comes back.
 */
export interface LotBid {
  id: string;
  amount: number;
  currency: string;
  status: RawBid["status"];
  /** Epoch ms. */
  at: number;
  bidderName: string | null;
}

export async function fetchBidHistory(productId: string): Promise<LotBid[]> {
  // Public path — the backend uses the JWT if present to decide whether to
  // unmask bidder names for the seller.
  const token = getToken();
  const res = await fetch(`${base()}/products/${encodeURIComponent(productId)}/bids`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  const items = (body?.data?.items || []) as RawBid[];
  return items.map((b) => ({
    id: String(b._id),
    amount: b.amount,
    currency: b.currency,
    status: b.status,
    at: toMs(b.createdAt),
    bidderName: b.bidderName ?? null,
  }));
}

/**
 * Canonical lot state. The read is public and unauthenticated — this is the
 * late-joiner and post-reconnect read, and the poll that picks up cron-driven
 * settlement.
 *
 * Resolves null when the id isn't a lot at all. THROWS on request failure so
 * callers can keep what they already had rather than blanking a live auction.
 */
export async function fetchAuctionLot(productId: string): Promise<AuctionLot | null> {
  const res = await fetch(
    `${base()}/storefront/marketplace/products/${encodeURIComponent(productId)}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Failed to load auction (${res.status})`);
  // Every deadline the backend hands out is on ITS clock, so a device whose
  // clock is off has to correct for the difference or it reads a live lot as
  // expired. The HTTP `Date` header is that clock.
  const serverDate = Date.parse(res.headers.get("date") || "");
  const readAt = Date.now();
  const body = await res.json().catch(() => null);
  const p = body?.data;
  if (!p?._id) return null;
  const a = p.auction || {};
  // A product that has never been auctioned carries no auction subdoc at all —
  // that's a Buy Now item, not a lot with no bids.
  if (!a.status && !a.endsAt) return null;
  const bidCount = a.bidCount ?? 0;
  const startPrice = a.startPrice ?? 0;
  return {
    productId: String(p._id),
    name: p.title || "Item",
    image: p.images?.[0]?.url,
    currency: p.currency || p.store?.currency || "USD",
    status: (a.status || "scheduled") as AuctionStatus,
    startsAt: toMs(a.startsAt),
    endsAt: toMs(a.endsAt),
    startPrice,
    minBidIncrement: a.minBidIncrement ?? 1,
    currentBid: bidCount > 0 ? a.highestBidAmount ?? startPrice : startPrice,
    bidCount,
    leaderName: await leaderNameFor(String(p._id), bidCount),
    leaderUserId: a.highestBidderId ?? null,
    // Measured before the leader-name round trip so that request's own latency
    // isn't folded into the offset.
    clockSkewMs: (Number.isNaN(serverDate) ? readAt : serverDate) - readAt,
  };
}

// ── Winning a lot (settlement, not checkout) ───────────────────────
//
// There is NO winner checkout. The wallet already holds the money: a bid
// escrows against the buyer's Auction Wallet, and closing the lot captures
// that escrow server-side. The winner owes nothing further — losers simply get
// their escrow released.
//
// So the win-time surface is a READ, not a payment. This reports what the
// server did with the escrow, which is the one thing a winner can't infer from
// the room.

/**
 * Where the escrow capture got to. 'settled' and 'failed' are both final;
 * 'pending' means the server's settlement job hasn't finished.
 */
export type AuctionSettlementStatus = "pending" | "settled" | "failed";

export interface AuctionWin {
  won: boolean;
  paid: boolean;
  status: AuctionSettlementStatus;
  /**
   * The winning bid in the lot's currency, and what was actually taken out of
   * the wallet. Both nullable — a pending settlement may not have figures yet.
   */
  amount: number | null;
  currency: string | null;
  amountUsd: number | null;
  settlementId: string | null;
  orderId: string | null;
  invoiceId: string | null;
}

/**
 * How the lot settled for the caller. Returns null when they didn't win, so
 * callers can treat "not mine" and "no answer" the same way.
 */
export async function fetchAuctionWin(productId: string): Promise<AuctionWin | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(
    `${base()}/products/${encodeURIComponent(productId)}/auction-win`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  const w = (body?.data ?? body) as
    | {
        won?: boolean;
        paid?: boolean;
        status?: AuctionSettlementStatus;
        amount?: number;
        currency?: string;
        amountUsd?: number;
        settlementId?: string;
        orderId?: string;
        invoiceId?: string;
      }
    | null;
  if (!w?.won) return null;
  const paid = Boolean(w.paid);
  return {
    won: true,
    paid,
    // `paid` is the fact; `status` is the job's own account of itself. Trust
    // the flag when the two disagree — money having moved outranks a status
    // field that hasn't caught up.
    status: w.status ?? (paid ? "settled" : "pending"),
    amount: w.amount ?? null,
    currency: w.currency ?? null,
    amountUsd: w.amountUsd ?? null,
    settlementId: w.settlementId ?? null,
    orderId: w.orderId ?? null,
    invoiceId: w.invoiceId ?? null,
  };
}
