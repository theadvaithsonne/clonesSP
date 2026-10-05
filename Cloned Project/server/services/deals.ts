// src/services/deals.ts
//
// The Deals feed — "every time anyone on Garage got paid", as a social
// timeline (Garage Connect → Deals tab).
//
// ── Why this is a projection, not a collection ────────────────────────────
// Nothing new is written when a deal happens. A deal IS a commission
// distribution, and there are two engines that produce them:
//
//   unilevelplusdistributions  Garage's own products ($25 licence, NetworkChain,
//                              Founders Office, reserve licences). Pays a direct
//                              bonus, 15 levels of level bonus, and two
//                              infinity tiers.
//   commissiondistributions    Founder comb plans — OTHER people's products sold
//                              through a founder's own storefront. Pays the
//                              seller, plus an upline of commission levels.
//
// Reading both and shaping them here means the feed can never drift from what
// actually paid out, and no backfill is needed for the 800+ historical deals.
//
// ── One card per SALE, and every earner on it ─────────────────────────────
// A single $25 sale pays up to 22 people: 1 direct + 15 levels + 3 infinity
// tier-1 + 3 tier-2. Carding each payout would turn one purchase into 22
// near-identical rows, so a deal is one SALE, headlined by the person who
// earned the most visible share — but `payouts[]` carries every single
// recipient, so the card can expand into the full chain.
//
// ── `amount` vs `creditedAmount` ──────────────────────────────────────────
// The NetworkChain coverage split (services/networkChainCoverage.ts) forwards
// half of an earner's cut away when they have no live coverage. `amount` is
// what the plan ALLOCATED; `creditedAmount` is what actually reached the
// wallet. The feed reports what people actually got — 94 distributions in the
// database carry a forfeiture, so using `amount` overstates them by 2×.
//
// ── Product card ──────────────────────────────────────────────────────────
// Garage's own products deliberately have NO product card ("it will get too
// repetitive" — Shorupan, 26 Sep); the product name goes in the subline
// instead. Founder-plan deals DO get one, built from the fields
// commissiondistributions already stores.

import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Invoice } from "../models/invoice.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { convertToUsd } from "../utils/exchangeRate";
import { DealReaction } from "../models/dealReaction.model";
import { DealComment } from "../models/dealComment.model";
import mongoose from "mongoose";

export type DealSource = "unilevel_plus" | "comb_plan";

/**
 * How someone came to be paid on this sale.
 *   direct        the buyer's own referrer (unilevel), or the level-1 upline
 *   level         an upline affiliate at depth N
 *   infinity      an infinity-tier pool recipient (unilevel only)
 *   seller        the merchant whose storefront made the sale (comb plans)
 *   drop_creator  the drop-attribution carve-out (comb plans)
 */
export type DealPayoutRole =
  | "direct"
  | "level"
  | "infinity"
  | "seller"
  | "drop_creator";

export interface DealPerson {
  id: string | null;
  name: string | null;
  avatar: string | null;
}

export interface DealPayout {
  user: DealPerson;
  role: DealPayoutRole;
  /** Upline depth. 1 = the buyer's direct referrer. Null for seller/infinity. */
  level: number | null;
  /** Infinity tier (1 or 2). Null for every other role. */
  tier: number | null;
  /** What actually reached this person's wallet, USD. Render this one. */
  amountUsd: number;
  /** What the plan allocated before the coverage split, USD. */
  allocatedUsd: number;
  /** Forwarded away by the coverage split, USD. 0 for almost every row. */
  forfeitedUsd: number;
  /** Unilevel level bonus only — the comp-plan maths behind the amount. */
  points: number | null;
  legMultiplier: number | null;
  /** Comb plans only — the commission percentage this level earns. */
  percentage: number | null;
}

export interface DealTotals {
  /** What the buyer paid. */
  saleUsd: number;
  /** Everything that reached a human wallet on this sale. */
  paidOutUsd: number;
  recipientCount: number;
  levelCount: number;
  infinityCount: number;
}

export interface DealProduct {
  id: string | null;
  name: string;
  /** Who sells it — the org name, rendered as "by EtherChains". */
  brand: string | null;
  priceUsd: number | null;
  image: string | null;
  itemType: string | null;
}

export interface Deal {
  /** Synthetic and stable: `up_<distributionId>` or `cp_<distributionId>`. */
  id: string;
  source: DealSource;
  occurredAt: string;
  currency: string;
  /** What the HEADLINE earner received, USD. `payouts` has everyone else. */
  amountUsd: number;
  /** What the buyer paid, USD. Drives the product card's price. */
  saleAmountUsd: number;
  earner: DealPerson;
  buyer: DealPerson;
  /** "Shorupan Earned $9.00" */
  headline: string;
  /** "When Chiranjeeb bought NetworkChains" */
  subline: string;
  /** Null for Garage's own products — by design. */
  product: DealProduct | null;
  /** Every person paid on this sale, biggest share first. */
  payouts: DealPayout[];
  totals: DealTotals;
  /** What the authenticated viewer earned on this sale. Null if nothing. */
  viewerPayoutUsd: number | null;
  reactions: { total: number; mine: string | null };
  comments: { total: number };
}

/**
 * `metadata.source` on a unilevel distribution → what the buyer actually
 * bought. Without this the subline would read "bought invoice_fulfillment".
 * Unknown sources fall back to a neutral phrase rather than leaking an
 * internal enum into the UI.
 */
const OWN_PRODUCT_LABEL: Record<string, string> = {
  unilevel_plus_checkout: "Unilevel Plus",
  reserve_license: "a Reserve Licence",
  third_party_subscription: "NetworkChains",
  office_subscription_pro_invoice: "Founders Office",
  comb_plan_unilevel_plus: "a founder's product",
  invoice_fulfillment: "a Garage product",
  webhook_fallback: "a Garage product",
  manual_activation: "a Garage product",
  manual_fix: "a Garage product",
};
const DEFAULT_OWN_LABEL = "a Garage product";

const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
const money = (n: number) => `$${round2(n).toFixed(2)}`;
/**
 * What actually reached the wallet. `??` not `||` — a genuinely credited 0
 * (the whole cut forfeited) must not fall back to the allocated figure.
 */
const credited = (creditedAmount: any, allocated: any) =>
  round2(typeof creditedAmount === "number" ? creditedAmount : allocated || 0);

export interface DealsQuery {
  limit?: number;
  /** ISO instant from a previous page's `nextCursor`. Returns older deals. */
  cursor?: string;
  /** Deals where this user was paid ANYTHING — direct, level, infinity or seller. */
  earnerId?: string;
  /** Viewer, for `reactions.mine` and `viewerPayoutUsd`. */
  viewerId?: string;
  /** Hide deals whose headline payout is below this, USD. */
  minAmountUsd?: number;
  /** `none` drops `payouts[]` from the response to keep a long feed light. */
  payouts?: "full" | "none";
}

/** A payout before its recipient has been hydrated into a name and avatar. */
interface RawPayout extends Omit<DealPayout, "user"> {
  userId: string | null;
}

interface RawDeal {
  id: string;
  source: DealSource;
  occurredAt: Date;
  currency: string;
  saleAmountUsd: number;
  buyerId: string | null;
  productLabel: string;
  product: Omit<DealProduct, "brand"> | null;
  orgId: string | null;
  payouts: RawPayout[];
}

/**
 * Only completed distributions are deals. 22 failed + 8 reversed unilevel
 * rows and 6 failed comb rows exist; none of them moved money, and showing
 * them would announce earnings that never landed.
 */
const COMPLETED = { status: "completed" };

/** Shape one `unilevelplusdistributions` document. */
function rawFromUnilevel(d: any): RawDeal | null {
  const payouts: RawPayout[] = [];

  if (d.directBonusRecipientId) {
    payouts.push({
      userId: String(d.directBonusRecipientId),
      role: "direct",
      level: 1,
      tier: null,
      amountUsd: credited(d.directBonusCreditedAmount, d.directBonusAmount),
      allocatedUsd: round2(d.directBonusAmount || 0),
      forfeitedUsd: round2(d.directBonusForfeitedAmount || 0),
      points: null,
      legMultiplier: null,
      percentage: null,
    });
  }

  for (const r of d.levelBonusRecipients || []) {
    if (!r?.userId) continue;
    payouts.push({
      userId: String(r.userId),
      role: "level",
      level: r.level ?? null,
      tier: null,
      amountUsd: credited(r.creditedAmount, r.amount),
      allocatedUsd: round2(r.amount || 0),
      forfeitedUsd: round2(r.forfeitedAmount || 0),
      points: r.points ?? null,
      legMultiplier: r.legMultiplier ?? null,
      percentage: null,
    });
  }

  for (const r of [
    ...(d.infinityTier1Recipients || []),
    ...(d.infinityTier2Recipients || []),
  ]) {
    if (!r?.userId) continue;
    payouts.push({
      userId: String(r.userId),
      role: "infinity",
      level: null,
      tier: r.tier ?? null,
      amountUsd: credited(r.creditedAmount, r.amount),
      allocatedUsd: round2(r.amount || 0),
      forfeitedUsd: round2(r.forfeitedAmount || 0),
      points: null,
      legMultiplier: null,
      percentage: null,
    });
  }

  // 23 rows pay literally nobody (buyer had no sponsor). Nothing was earned,
  // so there is no deal to show.
  if (!payouts.some((p) => p.amountUsd > 0)) return null;

  return {
    id: `up_${d._id}`,
    source: "unilevel_plus",
    occurredAt: d.createdAt,
    currency: d.currency || "USD",
    saleAmountUsd: round2(d.saleAmount || 0),
    buyerId: d.buyerId ? String(d.buyerId) : null,
    productLabel:
      OWN_PRODUCT_LABEL[String(d.metadata?.source || "")] ?? DEFAULT_OWN_LABEL,
    // Garage's own products carry no product card, by design.
    product: null,
    orgId: null,
    payouts,
  };
}

/** Shape one `commissiondistributions` document. */
function rawFromCombPlan(d: any): RawDeal | null {
  const payouts: RawPayout[] = [];

  for (const c of d.commissions || []) {
    if (!c?.userId) continue;
    const isDrop = c.role === "drop_creator";
    payouts.push({
      userId: String(c.userId),
      role: isDrop ? "drop_creator" : c.level === 1 ? "direct" : "level",
      level: isDrop ? null : c.level ?? null,
      tier: null,
      amountUsd: round2(c.amount || 0),
      allocatedUsd: round2(c.amount || 0),
      forfeitedUsd: 0,
      points: null,
      legMultiplier: null,
      percentage: c.percentage ?? null,
    });
  }

  // The merchant's own take. 183 of 322 comb distributions have an EMPTY
  // `commissions[]` — a sale with no upline — and every one of them still
  // paid the seller. Without this they vanish from the feed entirely.
  if (d.sellerId && (d.sellerAmount || 0) > 0) {
    payouts.push({
      userId: String(d.sellerId),
      role: "seller",
      level: null,
      tier: null,
      amountUsd: round2(d.sellerAmount),
      allocatedUsd: round2(d.sellerAmount),
      forfeitedUsd: 0,
      points: null,
      legMultiplier: null,
      percentage: null,
    });
  }

  if (!payouts.some((p) => p.amountUsd > 0)) return null;

  return {
    id: `cp_${d._id}`,
    source: "comb_plan",
    occurredAt: d.createdAt,
    currency: d.currency || "USD",
    saleAmountUsd: round2(d.saleAmount || 0),
    buyerId: d.customerId ? String(d.customerId) : null,
    productLabel: d.itemName || "this item",
    product: {
      id: d.itemId ? String(d.itemId) : null,
      name: d.itemName || "Item",
      priceUsd: round2(d.saleAmount || 0),
      image: null, // filled in by resolveProductImages
      itemType: d.itemType || null,
    },
    orgId: d.orgId ? String(d.orgId) : null,
    payouts,
  };
}

/**
 * Who headlines the card: the referral earner if there is one, otherwise
 * whoever took the largest share (the seller, on a storefront sale with no
 * upline). Everyone else is in `payouts`.
 */
function headlinePayout(payouts: RawPayout[]): RawPayout {
  const direct = payouts.find((p) => p.role === "direct" && p.amountUsd > 0);
  if (direct) return direct;
  return [...payouts].sort((a, b) => b.amountUsd - a.amountUsd)[0];
}

/**
 * One page of the global deals feed, newest first.
 *
 * Both collections are queried with the same cursor and limit, merged, then
 * re-sliced — so the page size holds no matter how the two engines interleave.
 */
export async function listDeals(q: DealsQuery = {}): Promise<{
  deals: Deal[];
  nextCursor: string | null;
}> {
  const db = mongoose.connection.db!;
  const limit = Math.min(Math.max(1, Math.floor(q.limit ?? 20)), 50);
  const before = q.cursor ? new Date(q.cursor) : null;
  if (before && Number.isNaN(before.getTime())) {
    throw new Error("cursor must be an ISO date");
  }
  const timeFilter = before ? { createdAt: { $lt: before } } : {};
  const earner = q.earnerId ? new Types.ObjectId(q.earnerId) : null;

  // Over-fetch from each side: after merging we keep only `limit`, and a
  // one-sided burst (50 unilevel sales in a row) must not starve the page.
  const perSide = limit + 1;

  const [ups, cps] = await Promise.all([
    db
      .collection("unilevelplusdistributions")
      .find({
        ...COMPLETED,
        ...timeFilter,
        // "Paid me anything" — not just the direct bonus. A level-12 earner's
        // $0.06 makes the sale one of their deals too.
        ...(earner
          ? {
              $or: [
                { directBonusRecipientId: earner },
                { "levelBonusRecipients.userId": earner },
                { "infinityTier1Recipients.userId": earner },
                { "infinityTier2Recipients.userId": earner },
              ],
            }
          : {}),
      })
      .sort({ createdAt: -1 })
      .limit(perSide)
      .toArray(),
    db
      .collection("commissiondistributions")
      .find({
        ...COMPLETED,
        ...timeFilter,
        ...(earner
          ? { $or: [{ "commissions.userId": earner }, { sellerId: earner }] }
          : {}),
      })
      .sort({ createdAt: -1 })
      .limit(perSide)
      .toArray(),
  ]);

  const raw: RawDeal[] = [];
  for (const d of ups as any[]) {
    const r = rawFromUnilevel(d);
    if (r) raw.push(r);
  }
  for (const d of cps as any[]) {
    const r = rawFromCombPlan(d);
    if (r) raw.push(r);
  }

  if (q.minAmountUsd) {
    const min = q.minAmountUsd;
    for (let i = raw.length - 1; i >= 0; i--) {
      if (headlinePayout(raw[i].payouts).amountUsd < min) raw.splice(i, 1);
    }
  }

  await nameOwnProducts(db, ups as any[], raw);

  raw.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  const page = raw.slice(0, limit);
  // Only a full page can have more behind it.
  const nextCursor =
    page.length === limit && raw.length > limit
      ? new Date(page[page.length - 1].occurredAt).toISOString()
      : null;

  return { deals: await hydrate(page, q), nextCursor };
}

/** One deal by its synthetic id, shaped exactly like a feed row. */
export async function getDeal(
  dealId: string,
  q: Pick<DealsQuery, "viewerId" | "payouts"> = {}
): Promise<Deal | null> {
  if (!isValidDealId(dealId)) return null;
  const db = mongoose.connection.db!;
  const isUp = dealId.startsWith("up_");
  const doc = await db
    .collection(isUp ? "unilevelplusdistributions" : "commissiondistributions")
    .findOne({ _id: new Types.ObjectId(dealId.slice(3)), ...COMPLETED });
  if (!doc) return null;
  const raw = isUp ? rawFromUnilevel(doc) : rawFromCombPlan(doc);
  if (!raw) return null;
  if (isUp) await nameOwnProducts(db, [doc], [raw]);
  const [deal] = await hydrate([raw], q);
  return deal ?? null;
}

/* ── Stats (the two cards above the feed) ───────────────────────────────── */

export interface DealStatPoint {
  /** UTC day, `YYYY-MM-DD` — the LAST day this point covers. */
  date: string;
  /** Running total as of the end of `date`. */
  value: number;
}

export interface DealStatSeries {
  /** All-time total — equals the last point's `value`. */
  total: number;
  /**
   * All time, oldest first: a zero point the day before the first event, then
   * one point per `bucketDays`, the last one ending today.
   */
  series: DealStatPoint[];
  /** How many days each point spans — 1 until history outgrows the cap. */
  bucketDays: number;
}

export interface DealStats {
  /** Every commission that reached an affiliate's wallet, USD: both deal
   *  engines plus the NetworkChain (TPS) bonus. Excludes the merchant's own
   *  take on storefront sales — that's revenue, not earnings. */
  earnedByAffiliatesUsd: DealStatSeries;
  /** Every paid invoice except wallet top-ups, USD — Garage's own products
   *  and TPS included. Same figure as the franchise dashboard's
   *  `totalSalesVolumeIncludingGarageProductsUsd`. */
  purchaseVolumeUsd: DealStatSeries;
  /** Every user document — the same figure as the admin panel's Total Users.
   *  Affiliate-link joins and upline-enrolled members carry `guest: true` and
   *  ARE counted; see the query for why. */
  users: DealStatSeries;
  /** Organizations (businesses / HQs). */
  businesses: DealStatSeries;

  /** Paid-invoice volume for GARAGE's own products: 1Network (Unilevel Plus),
   *  NetworkChains, white-label / cryptosub, Founders Office. */
  garageProductVolumeUsd: DealStatSeries;
  /** Commission credited to affiliates on those sales — the Unilevel Plus
   *  engine (direct + levels + infinity) plus the NetworkChain bonus. */
  garageProductCommissionsUsd: DealStatSeries;
  /** Paid-invoice volume for products FOUNDERS sell through their own
   *  storefronts: store products, courses, channels, workshops, calls. */
  founderProductVolumeUsd: DealStatSeries;
  /** Commission credited to the upline on those sales. The seller's own take
   *  is their revenue, not a commission, and is excluded. */
  founderProductCommissionsUsd: DealStatSeries;
  /** Paid-invoice volume for franchise licensing — global, territory and
   *  programme. */
  franchiseVolumeUsd: DealStatSeries;
  /** Anything matching none of the buckets above. $0 today; a new itemType
   *  surfaces here rather than vanishing, and keeps the volumes adding back
   *  to `purchaseVolumeUsd`. */
  otherVolumeUsd: DealStatSeries;

  asOf: string;
}

/**
 * Which side of the house a sale belongs to. Buckets set by Shorupan, 1 Oct.
 *
 *   garage     Garage's own products — 1Network (Unilevel Plus), NetworkChains,
 *              white-label / cryptosub, and Founders Office.
 *   founder    "TPS" — everything sold through a founder's own storefront:
 *              store products, courses, channels, workshops, calls, AND
 *              BAT246. Note BAT246 is sold as a plain `product` with a
 *              hand-typed name ("BAT 246 - $650", "bat264-650$" — yes, 264),
 *              so `itemType` alone places it here; no name matching needed.
 *   franchise  Franchise licensing — global, territory and programme.
 *   other      Catch-all. Should be $0 today: every itemType currently in the
 *              invoices collection is assigned above. It exists so a NEW
 *              itemType shows up here instead of silently vanishing, and so
 *              the buckets always add back to `purchaseVolumeUsd`.
 */
const GARAGE_ITEM_TYPES = new Set([
  "unilevel_plus",
  "third_party_subscription",
  "whitelabel_addon",
  "cryptosub",
  "office_plan",
  "office_addon",
]);

const FOUNDER_ITEM_TYPES = new Set([
  "product",
  "bat246_membership",
  "ecommerce_item",
  "course",
  "channel",
  "workshop",
  "event_ticket",
  "call",
  "service",
  "hifi_investment",
  // Neither is a storefront sale, but both were put here rather than left
  // floating in `other`.
  "auction_wallet_topup",
  "admin_adhoc",
]);

const FRANCHISE_ITEM_TYPES = new Set([
  "franchise_global",
  "franchise_territory",
  "franchise_program",
]);

type VolumeBucket = "garage" | "founder" | "franchise" | "other";

function bucketOf(itemType: string): VolumeBucket {
  if (GARAGE_ITEM_TYPES.has(itemType)) return "garage";
  if (FOUNDER_ITEM_TYPES.has(itemType)) return "founder";
  if (FRANCHISE_ITEM_TYPES.has(itemType)) return "franchise";
  return "other";
}

/** Keeps the graph smooth and the payload flat however long history grows. */
const STATS_MAX_POINTS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The feed tab opens often and the totals move a few times a day at most. */
const STATS_TTL_MS = 60 * 1000;

let statsCache: { at: number; value: DealStats } | null = null;
let statsInFlight: Promise<DealStats> | null = null;

/**
 * Platform-wide totals for the four cards above the Deals feed, each with an
 * all-time running series for its graph.
 *
 * Money comes from the SAME projection as the feed (`rawFromUnilevel` /
 * `rawFromCombPlan`): credited amounts, completed distributions only. Both
 * collections are a few thousand rows at most, so this reads them whole and
 * caches the result briefly rather than keeping counters in sync.
 */
export async function getDealStats(): Promise<DealStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.value;
  statsInFlight ??= computeDealStats()
    .then((value) => {
      statsCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      statsInFlight = null;
    });
  return statsInFlight;
}

const utcDay = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Bucket timestamped amounts into a running total ending today. */
function runningSeries(
  events: { t: number; v: number }[],
  today: number,
  money: boolean
): DealStatSeries {
  let first = today;
  for (const e of events) if (e.t < first) first = e.t;
  const firstDay = utcDay(first);

  // Buckets are anchored to END today, so the last point is always "now".
  const spanDays = Math.max(1, Math.round((today - firstDay) / DAY_MS) + 1);
  const bucketDays = Math.max(1, Math.ceil(spanDays / STATS_MAX_POINTS));
  const buckets = Math.ceil(spanDays / bucketDays);
  const sums = new Array<number>(buckets).fill(0);
  for (const e of events) {
    const daysAgo = Math.max(0, Math.round((today - utcDay(e.t)) / DAY_MS));
    sums[buckets - 1 - Math.floor(daysAgo / bucketDays)] += e.v;
  }

  const fmt = (n: number) => (money ? round2(n) : n);
  const dayString = (daysAgo: number) =>
    new Date(today - daysAgo * DAY_MS).toISOString().slice(0, 10);
  // The origin: nothing yet, the day before bucket 0 opens.
  const series: DealStatPoint[] = [{ date: dayString(buckets * bucketDays), value: 0 }];
  let running = 0;
  for (let i = 0; i < buckets; i++) {
    running += sums[i];
    series.push({ date: dayString((buckets - 1 - i) * bucketDays), value: fmt(running) });
  }
  return { total: fmt(running), series, bucketDays };
}

/**
 * Signups per UTC day for a timestamped collection. Rows with no `createdAt`
 * (pre-timestamps legacy) still count — they're dated to the earliest day.
 */
async function countsByDay(model: any, match: Record<string, unknown>) {
  const rows: { _id: string | null; n: number }[] = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        n: { $sum: 1 },
      },
    },
  ]);
  const dated = rows.filter((r) => r._id);
  let earliest = Date.now();
  for (const r of dated) earliest = Math.min(earliest, Date.parse(`${r._id}T00:00:00Z`));
  return rows.map((r) => ({
    t: r._id ? Date.parse(`${r._id}T00:00:00Z`) : earliest,
    v: r.n,
  }));
}

/**
 * Purchase volume per UTC day, USD. Every paid invoice except store-wallet
 * top-ups (users pre-loading their own funds, not commerce) — the exact rule
 * behind the franchise dashboard's "including Garage products" figure
 * (routes/franchiseApi.ts, /dashboard/garagepay-stats), so the two agree.
 *
 * Invoices, not distributions: a distribution records only the slice of a
 * Garage product that went through a plan ($25 of a $96 Office Pro, $12 of a
 * $36 NetworkChain month), and since 2026-08-11 TPS writes no distribution at
 * all. `totalAmount` is in minor units and includes GST, as on the dashboard.
 */
async function purchaseVolumeByDay(): Promise<
  Record<VolumeBucket | "all", { t: number; v: number }[]>
> {
  const rows: {
    _id: { day: string | null; cur: string | null; type?: string | null };
    amount: number;
  }[] =
    await Invoice.aggregate([
      {
        $match: {
          status: "paid",
          "lineItems.itemType": { $ne: "store_wallet_topup" },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$paidAt", "$createdAt"] } },
            },
            cur: "$itemCurrency",
            // The first line item decides the bucket, the same way the rest of
            // this file reads an invoice.
            type: { $arrayElemAt: ["$lineItems.itemType", 0] },
          },
          amount: { $sum: "$totalAmount" },
        },
      },
    ]);

  // One FX lookup per currency, not per day.
  const rates = new Map<string, number>();
  for (const cur of new Set(rows.map((r) => (r._id.cur || "USD").toUpperCase()))) {
    if (cur === "USD") {
      rates.set(cur, 1);
      continue;
    }
    try {
      rates.set(cur, (await convertToUsd(1, cur)).usdAmount);
    } catch {
      // Same fallback as the dashboard: never fail the whole card on FX.
      rates.set(cur, cur === "INR" ? 1 / 83 : 1);
    }
  }

  const now = Date.now();
  const out: Record<VolumeBucket | "all", { t: number; v: number }[]> = {
    all: [],
    garage: [],
    founder: [],
    franchise: [],
    other: [],
  };
  for (const r of rows) {
    const point = {
      t: r._id.day ? Date.parse(`${r._id.day}T00:00:00Z`) : now,
      v: ((r.amount || 0) / 100) * (rates.get((r._id.cur || "USD").toUpperCase()) ?? 1),
    };
    // `all` stays exactly what it always was, so the existing card does not
    // move; the three buckets add back to it.
    out.all.push(point);
    out[bucketOf(String(r._id.type || ""))].push(point);
  }
  return out;
}

/**
 * The NetworkChain (TPS) bonus. Since 2026-08-11 it is paid straight to the
 * buyer's sponsor through `creditAffiliateOrPlatform`, so it lives ONLY in
 * `wallettransactions` — no distribution row (before that it went through
 * Unilevel Plus and is already in `unilevelplusdistributions`; no overlap).
 *
 * Counted as credited, matching the distributions: a coverage split writes the
 * gross credit, a `debit` forfeiture row, and a forwarded credit to the upline,
 * so credits minus forfeitures nets to what affiliates kept. Money that reached
 * no affiliate is left out: credits to the platform account itself, and rows
 * whose money the platform seized (`routedToPlatform`).
 */
async function tpsBonusByDay(): Promise<{ t: number; v: number }[]> {
  const platform = await User.findOne({ email: "shorupan@gmail.com" }).select("_id").lean();
  const rows = await WalletTransaction.find({
    walletType: "affiliate",
    status: "completed",
    type: { $in: ["commission", "debit"] },
    "metadata.bonusType": "networkchain_direct",
    "metadata.routedToPlatform": { $ne: true },
    ...(platform ? { userId: { $ne: (platform as any)._id } } : {}),
  })
    .select("type amount createdAt")
    .lean();
  return (rows as any[]).map((r) => ({
    t: new Date(r.createdAt).getTime(),
    v: (r.type === "debit" ? -1 : 1) * (r.amount || 0),
  }));
}

async function computeDealStats(): Promise<DealStats> {
  const db = mongoose.connection.db!;
  const [ups, cps, tpsBonus, volume, userDays, orgDays] = await Promise.all([
    db.collection("unilevelplusdistributions").find(COMPLETED).toArray(),
    db.collection("commissiondistributions").find(COMPLETED).toArray(),
    tpsBonusByDay(),
    purchaseVolumeByDay(),
    // Every user document, matching the admin panel's "Total Users" exactly.
    //
    // This used to exclude `guest: true`, which read as "drop the throwaway
    // sign-ups" and hid 797 people — the admin showed 1,869 against the card's
    // 1,072. But `guest: true` is set when someone JOINS VIA AN AFFILIATE LINK
    // (routes/affiliate.ts) or is ENROLLED BY THEIR UPLINE (routes/downlines.ts).
    // It marks the affiliate network, not noise: of those 797, 791 have a
    // referrer, 528 hold an affiliate wallet, 425 have earned a commission and
    // 358 have bought a product. The only thing they share is never having set
    // up their own login. Excluding them hid the very people whose deals this
    // feed is showing.
    countsByDay(User, {}),
    countsByDay(Organization, {}),
  ]);

  // Garage's own engine + the NetworkChain bonus; the founder storefronts are
  // the other engine. `earned` stays the union, so the existing card is
  // unchanged and the two new figures add back to it.
  const garageEarned: { t: number; v: number }[] = [...tpsBonus];
  const founderEarned: { t: number; v: number }[] = [];
  for (const d of ups as any[]) {
    const r = rawFromUnilevel(d);
    if (r) {
      garageEarned.push({
        t: new Date(d.createdAt).getTime(),
        v: r.payouts.reduce((s, p) => s + p.amountUsd, 0),
      });
    }
  }
  for (const d of cps as any[]) {
    const r = rawFromCombPlan(d);
    if (r) {
      founderEarned.push({
        t: new Date(d.createdAt).getTime(),
        // The seller's own take is revenue, not an affiliate commission.
        v: r.payouts.filter((p) => p.role !== "seller").reduce((s, p) => s + p.amountUsd, 0),
      });
    }
  }
  const earned = [...garageEarned, ...founderEarned];

  const now = new Date();
  const today = utcDay(now.getTime());
  return {
    earnedByAffiliatesUsd: runningSeries(earned, today, true),
    purchaseVolumeUsd: runningSeries(volume.all, today, true),
    users: runningSeries(userDays, today, false),
    businesses: runningSeries(orgDays, today, false),

    garageProductVolumeUsd: runningSeries(volume.garage, today, true),
    garageProductCommissionsUsd: runningSeries(garageEarned, today, true),
    founderProductVolumeUsd: runningSeries(volume.founder, today, true),
    founderProductCommissionsUsd: runningSeries(founderEarned, today, true),
    franchiseVolumeUsd: runningSeries(volume.franchise, today, true),
    otherVolumeUsd: runningSeries(volume.other, today, true),

    asOf: now.toISOString(),
  };
}

/**
 * Name Garage's own products properly. `metadata.source` only says which FLOW
 * paid ("invoice_fulfillment"), which would render as "bought a Garage
 * product" on nearly half the feed. Every one of those rows carries the
 * invoice id, and the invoice's line item carries the real name — so resolve
 * them in one batched read and fall back to the source map only when an
 * invoice is missing.
 */
async function nameOwnProducts(db: any, ups: any[], raw: RawDeal[]) {
  const invoiceIds = ups
    .map((d) => d.metadata?.invoiceId)
    .filter(Boolean)
    .map(String)
    .filter((i) => Types.ObjectId.isValid(i));
  if (!invoiceIds.length) return;
  const invs = await db
    .collection("invoices")
    .find({ _id: { $in: [...new Set(invoiceIds)].map((i) => new Types.ObjectId(i)) } })
    .project({ "lineItems.itemName": 1 })
    .toArray();
  const nameById = new Map(
    (invs as any[]).map((i) => [String(i._id), i.lineItems?.[0]?.itemName])
  );
  for (const d of ups) {
    const nm = nameById.get(String(d.metadata?.invoiceId || ""));
    if (!nm) continue;
    const hit = raw.find((r) => r.id === `up_${d._id}`);
    if (hit) hit.productLabel = nm;
  }
}

/**
 * Turn shaped rows into cards: people, sellers, product images and social
 * counts. Every lookup is batched, so a page costs a fixed number of queries
 * no matter how many deals — or how many payouts each deal — it holds.
 */
async function hydrate(page: RawDeal[], q: DealsQuery): Promise<Deal[]> {
  if (!page.length) return [];
  const db = mongoose.connection.db!;
  const withPayouts = q.payouts !== "none";

  const userIds = [
    ...new Set(
      page
        .flatMap((d) => [d.buyerId, ...d.payouts.map((p) => p.userId)])
        .filter(Boolean) as string[]
    ),
  ];
  const orgIds = [...new Set(page.map((d) => d.orgId).filter(Boolean) as string[])];
  const dealIds = page.map((d) => d.id);

  const [users, orgs, reactionCounts, myReactions, commentCounts, images] =
    await Promise.all([
      User.find({ _id: { $in: userIds.map((i) => new Types.ObjectId(i)) } })
        .select("name email profilePicture")
        .lean(),
      orgIds.length
        ? db
            .collection("organizations")
            .find({ _id: { $in: orgIds.map((i) => new Types.ObjectId(i)) } })
            .project({ name: 1 })
            .toArray()
        : Promise.resolve([] as any[]),
      DealReaction.aggregate([
        { $match: { dealId: { $in: dealIds } } },
        { $group: { _id: "$dealId", n: { $sum: 1 } } },
      ]),
      q.viewerId
        ? DealReaction.find({
            dealId: { $in: dealIds },
            userId: new Types.ObjectId(q.viewerId),
          })
            .select("dealId type")
            .lean()
        : Promise.resolve([] as any[]),
      DealComment.aggregate([
        { $match: { dealId: { $in: dealIds }, deletedAt: null } },
        { $group: { _id: "$dealId", n: { $sum: 1 } } },
      ]),
      resolveProductImages(page.filter((d) => d.product).map((d) => d.product!)),
    ]);

  const userById = new Map(users.map((u: any) => [String(u._id), u]));
  const orgById = new Map((orgs as any[]).map((o) => [String(o._id), o.name]));
  const reactById = new Map((reactionCounts as any[]).map((r) => [r._id, r.n]));
  const mineById = new Map((myReactions as any[]).map((r) => [r.dealId, r.type]));
  const commentById = new Map((commentCounts as any[]).map((r) => [r._id, r.n]));

  const person = (id: string | null): DealPerson => {
    const u: any = id ? userById.get(id) : null;
    return {
      id,
      // Falls back to the email's local part so a card never reads "null".
      name: u?.name || (u?.email ? String(u.email).split("@")[0] : null),
      avatar: u?.profilePicture || null,
    };
  };

  return page.map((d) => {
    const head = headlinePayout(d.payouts);
    const earnerP = person(head?.userId ?? null);
    const buyerP = person(d.buyerId);
    const who = earnerP.name || "Someone";
    const whoBought = buyerP.name || "Someone";

    // Biggest share first: the chain reads as a hierarchy, not insertion order.
    const sorted = [...d.payouts].sort((a, b) => b.amountUsd - a.amountUsd);
    const mine = q.viewerId
      ? sorted
          .filter((p) => p.userId === q.viewerId)
          .reduce((s, p) => s + p.amountUsd, 0)
      : 0;

    return {
      id: d.id,
      source: d.source,
      occurredAt: new Date(d.occurredAt).toISOString(),
      currency: d.currency,
      amountUsd: head?.amountUsd ?? 0,
      saleAmountUsd: d.saleAmountUsd,
      earner: earnerP,
      buyer: buyerP,
      headline: `${who} Earned ${money(head?.amountUsd ?? 0)}`,
      // The product card repeats the name for founder products, so the
      // subline stays generic there — matching the two screenshot variants.
      subline: d.product
        ? `When ${whoBought} bought this item`
        : `When ${whoBought} bought ${d.productLabel}`,
      product: d.product
        ? {
            ...d.product,
            image: images.get(d.product.id || "") ?? null,
            brand: d.orgId ? orgById.get(d.orgId) ?? null : null,
          }
        : null,
      payouts: withPayouts
        ? sorted.map(({ userId, ...p }) => ({ ...p, user: person(userId) }))
        : [],
      totals: {
        saleUsd: d.saleAmountUsd,
        paidOutUsd: round2(d.payouts.reduce((s, p) => s + p.amountUsd, 0)),
        recipientCount: d.payouts.length,
        levelCount: d.payouts.filter((p) => p.role === "level").length,
        infinityCount: d.payouts.filter((p) => p.role === "infinity").length,
      },
      viewerPayoutUsd: mine > 0 ? round2(mine) : null,
      reactions: { total: reactById.get(d.id) ?? 0, mine: mineById.get(d.id) ?? null },
      comments: { total: commentById.get(d.id) ?? 0 },
    };
  });
}

/**
 * Product images live in whichever collection owns the item, and comb plans
 * can sell several kinds of thing. Look in each candidate collection once
 * for the whole page rather than per deal.
 */
async function resolveProductImages(
  products: { id: string | null }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(products.map((p) => p.id).filter(Boolean) as string[])];
  if (!ids.length) return out;
  const db = mongoose.connection.db!;
  const objIds = ids
    .filter((i) => Types.ObjectId.isValid(i))
    .map((i) => new Types.ObjectId(i));
  if (!objIds.length) return out;

  for (const col of ["products", "storeproducts", "courses", "workshops"]) {
    try {
      const rows = await db
        .collection(col)
        .find({ _id: { $in: objIds } })
        .project({ image: 1, images: 1, thumbnail: 1, coverImage: 1, media: 1 })
        .toArray();
      for (const r of rows as any[]) {
        const img =
          r.image || r.thumbnail || r.coverImage || r.images?.[0] || r.media?.[0];
        if (img && !out.has(String(r._id))) out.set(String(r._id), String(img));
      }
    } catch {
      // A collection that doesn't exist in this environment is not an error —
      // the card simply renders without an image.
    }
  }
  return out;
}

/** Deal ids are synthetic; reject anything that isn't one before it reaches Mongo. */
export function isValidDealId(id: string): boolean {
  return /^(up|cp)_[0-9a-fA-F]{24}$/.test(id);
}

/** Does this deal actually exist? Guards reactions/comments on made-up ids. */
export async function dealExists(dealId: string): Promise<boolean> {
  if (!isValidDealId(dealId)) return false;
  const db = mongoose.connection.db!;
  const col = dealId.startsWith("up_")
    ? "unilevelplusdistributions"
    : "commissiondistributions";
  return !!(await db
    .collection(col)
    .findOne({ _id: new Types.ObjectId(dealId.slice(3)) }, { projection: { _id: 1 } }));
}
