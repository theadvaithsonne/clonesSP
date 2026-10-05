import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";

/**
 * Admin → Analytics → Traction data.
 *
 * GET /garage-admin/analytics/traction?rangeStart=<ms>&rangeEnd=<ms>&interval=<unit>
 *
 * Returns, per metric, a fixed-length series scoped to the REQUESTED RANGE —
 * the value at each bucket is how many of that entity were created during that
 * bucket, and the headline is the total created across the whole range. `total`
 * carries the all-time running count as of the range end, for context. Matches the
 * frontend ChartSeries contract (components/analytics/types.ts): one point per
 * bucket, aligned t values shared across every series, integer counts.
 *
 * Not mapped to a delegatable page, so the gate keeps it super-admin only
 * (business-wide totals). Definitions per metric are documented on METRICS —
 * adjust a filter there to change what a card counts.
 */
const router = Router();

type Interval = "hour" | "day" | "week" | "month" | "quarter" | "year";

interface MetricDef {
  id: string;
  collection: string;
  filter: Record<string, unknown>;
  /** Date field the entity is bucketed by (default createdAt). */
  dateField?: string;
  /** When set, count DISTINCT values of this field, bucketed by each value's
   *  earliest dateField (e.g. shoppers = distinct buyers by first order). */
  distinctBy?: string;
}

// ── Metric definitions ────────────────────────────────────────────────────
// Each is a cumulative count by createdAt. Change a filter to redefine a card.
const METRICS: MetricDef[] = [
  { id: "users", collection: "users", filter: {} },
  // Distinct users holding a "founder" role in any org membership.
  { id: "founders", collection: "users", filter: { "organizations.role": "founder" } },
  // Non-parent organizations = companies.
  { id: "companies", collection: "organizations", filter: { parent: { $ne: true } } },
  // Public office workspaces.
  { id: "offices", collection: "organizations", filter: { office_public: true } },
  // Online storefronts (Store.storeKind, the storefront backend's own split).
  { id: "ecommerce_stores", collection: "stores", filter: { storeKind: "online" } },
  // Offline / physical storefronts. Stores with no storeKind set (owned by the
  // storefront backend) fall into neither card by design — never guessed.
  { id: "irl_stores", collection: "stores", filter: { storeKind: "offline" } },
  // Orgs created via the cryptobrand office flow.
  { id: "crypto_offices", collection: "organizations", filter: { officeCreatedFromCryptobrand: true } },
  // Real affiliates: someone who has referred at least one person, and that
  // person completed their profile. NOT `affiliateId` — a referral code is
  // minted for every user (scripts/migrate-affiliate.ts backfilled everyone,
  // and /affiliate/my-affiliate-id mints one on first view), so counting code
  // holders just re-counts Users.
  //
  // Counts DISTINCT referrers, bucketed by their earliest qualifying referral
  // — i.e. an affiliate appears on the date their first profile-completed
  // referral signed up. (`profileCompletedAt` is deliberately not used as the
  // date: despite the name it's the free-month offer window, defaulted to
  // account-creation time.)
  {
    id: "affiliates",
    collection: "users",
    filter: { referredBy: { $nin: [null, ""] }, profileComplete: true },
    distinctBy: "referredBy",
  },
  // Pure consumers = Users − Founders − Affiliates − Employees. Only the
  // founder exclusion can be expressed statically; the affiliate and employee
  // sets are ids gathered per-request in the handler and merged into one
  // `_id $nin`. The affiliate set MUST be the same one the Affiliates card
  // counts (referrers with a profile-completed referral), not affiliate-code
  // holders — otherwise the four cards stop adding up to Users.
  {
    id: "shoppers",
    collection: "users",
    filter: { "organizations.role": { $ne: "founder" } },
  },
  // Teamforce employee profiles.
  { id: "employees", collection: "teamforceemployeeprofiles", filter: {} },
];

// ── Subscriptions page (Figma: Admin → Analytics → Subscriptions) ─────────
// The four products sold as subscriptions. Ids match the plan/addon rows in
// prod rather than name strings, so renaming a plan in the admin can't
// silently empty a card.
const OFFICE_PRO_PLAN_ID = "695b96bea3149ec5949aa92e"; // officeplans "Founders Office" (slug: pro)
const WHITELABEL_ADDON_ID = "6960ca76806184c0471267ae"; // officeaddons "White-Label"
const CRYPTOSUB_ADDON_ID = "6a880232d964274f0e805829"; // officeaddons "Cryptosub"

const SUBSCRIPTION_METRICS: MetricDef[] = [
  { id: "networkchains", collection: "networkchain_subscriptions", filter: {} },
  {
    id: "founder_office_pro",
    collection: "officesubscriptions",
    filter: { planId: new mongoose.Types.ObjectId(OFFICE_PRO_PLAN_ID) },
  },
  {
    id: "whitelabel",
    collection: "officeaddonsubscriptions",
    filter: { addonId: new mongoose.Types.ObjectId(WHITELABEL_ADDON_ID) },
  },
  {
    id: "mycryptobrand",
    collection: "officeaddonsubscriptions",
    filter: { addonId: new mongoose.Types.ObjectId(CRYPTOSUB_ADDON_ID) },
  },
];

/** UTC-aligned start of the interval bucket containing `t`. Mirrors the
 *  frontend's alignStart so buckets line up exactly. */
function alignStart(t: number, interval: Interval): Date {
  const d = new Date(t);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  switch (interval) {
    case "hour":
      d.setUTCMinutes(0);
      return d;
    case "day":
      d.setUTCHours(0, 0, 0, 0);
      return d;
    case "week": {
      d.setUTCHours(0, 0, 0, 0);
      const mondayOffset = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - mondayOffset);
      return d;
    }
    case "month":
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(1);
      return d;
    case "quarter": {
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(1);
      d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3);
      return d;
    }
    case "year":
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(0, 1);
      return d;
  }
}

function addInterval(d: Date, interval: Interval): Date {
  const n = new Date(d);
  switch (interval) {
    case "hour": n.setUTCHours(n.getUTCHours() + 1); return n;
    case "day": n.setUTCDate(n.getUTCDate() + 1); return n;
    case "week": n.setUTCDate(n.getUTCDate() + 7); return n;
    case "month": n.setUTCMonth(n.getUTCMonth() + 1); return n;
    case "quarter": n.setUTCMonth(n.getUTCMonth() + 3); return n;
    case "year": n.setUTCFullYear(n.getUTCFullYear() + 1); return n;
  }
}

const MAX_BUCKETS = 400;

function bucketStarts(start: number, end: number, interval: Interval): number[] {
  const out: number[] = [];
  let cursor = alignStart(start, interval);
  let guard = 0;
  while (cursor.getTime() <= end && guard < MAX_BUCKETS) {
    out.push(cursor.getTime());
    cursor = addInterval(cursor, interval);
    guard++;
  }
  return out;
}

/** $dateTrunc unit for each interval (all valid Mongo units). */
const TRUNC_UNIT: Record<Interval, string> = {
  hour: "hour", day: "day", week: "week", month: "month", quarter: "quarter", year: "year",
};

async function seriesFor(
  def: MetricDef,
  buckets: number[],
  interval: Interval,
  rangeEnd: number,
): Promise<{
  points: { t: number; v: number }[];
  headline: number | null;
  total: number | null;
}> {
  const dateField = def.dateField || "createdAt";
  const firstStart = new Date(buckets[0]);
  const endDate = new Date(rangeEnd);
  const zeroed = () => ({
    points: buckets.map((t) => ({ t, v: 0 })),
    headline: buckets.length ? 0 : null,
    total: null,
  });
  const db = mongoose.connection.db;
  if (!db) return zeroed();
  const coll = db.collection(def.collection);

  const pre: any[] = [{ $match: { ...def.filter, [dateField]: { $type: "date" } } }];
  if (def.distinctBy) {
    pre.push({ $group: { _id: `$${def.distinctBy}`, d: { $min: `$${dateField}` } } });
  } else {
    pre.push({ $project: { d: `$${dateField}` } });
  }

  const pipeline = [
    ...pre,
    {
      $facet: {
        baseline: [{ $match: { d: { $lt: firstStart } } }, { $count: "n" }],
        buckets: [
          { $match: { d: { $gte: firstStart, $lte: endDate } } },
          {
            $group: {
              // startOfWeek Monday so these bucket keys line up with the
              // Monday-aligned bucketStarts() above ($dateTrunc defaults to
              // Sunday, which would miss every point and flatten the series).
              // startOfWeek is only valid for unit "week".
              _id: {
                $dateTrunc:
                  interval === "week"
                    ? { date: "$d", unit: "week", startOfWeek: "monday" }
                    : { date: "$d", unit: TRUNC_UNIT[interval] },
              },
              n: { $sum: 1 },
            },
          },
        ],
      },
    },
  ];

  let baseline = 0;
  const byBucket = new Map<number, number>();
  try {
    const [res] = await coll.aggregate(pipeline).toArray();
    baseline = res?.baseline?.[0]?.n || 0;
    for (const b of res?.buckets || []) {
      byBucket.set(new Date(b._id).getTime(), b.n);
    }
  } catch (err) {
    // A missing collection (or an old Mongo without $dateTrunc) must not take
    // the whole page down — that metric just reports zeroes.
    console.warn(`[analytics/traction] ${def.id} failed:`, (err as Error).message);
  }

  // What happened INSIDE the range — "how many users signed up in the last two
  // days", not the all-time total as of the range end. The cumulative reading
  // barely moved when the range was narrowed, which made the date filter look
  // broken: picking two days still showed every user ever.
  let inRange = 0;
  const points = buckets.map((t) => {
    const n = byBucket.get(t) || 0;
    inRange += n;
    return { t, v: n };
  });
  // The running total is still worth showing beside the range figure, so it
  // rides along rather than being recomputed by a second request.
  return {
    points,
    headline: points.length ? inRange : null,
    total: baseline + inRange,
  };
}

router.get(
  "/analytics/traction",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        rangeStart: z.coerce.number().int(),
        rangeEnd: z.coerce.number().int(),
        interval: z.enum(["hour", "day", "week", "month", "quarter", "year"]).default("month"),
        // Comma-separated metric ids. Lets a single card re-fetch itself on its
        // own range/interval without recomputing the other nine.
        metrics: z.string().optional(),
      });
      const { rangeStart, rangeEnd, interval, metrics } = schema.parse(req.query);
      if (rangeEnd < rangeStart) {
        return res.status(400).json({ error: "rangeEnd before rangeStart" });
      }

      const buckets = bucketStarts(rangeStart, rangeEnd, interval as Interval);
      if (buckets.length === 0) {
        return res.json({ interval, buckets: [], metrics: {} });
      }

      // Employees live in their own collection; to subtract them from the
      // Shoppers set we need their linked user ids up front. Missing/null
      // links are dropped (those employees aren't users).
      const db = mongoose.connection.db;
      const empUserIds = db
        ? (await db.collection("teamforceemployeeprofiles").distinct("userId")).filter(Boolean)
        : [];

      // The same set the Affiliates card counts, as ids, so Shoppers subtracts
      // exactly those people rather than everyone holding a referral code.
      const affiliateUserIds = db
        ? (
            await db
              .collection("users")
              .distinct("referredBy", { referredBy: { $nin: [null, ""] }, profileComplete: true })
          ).filter(Boolean)
        : [];

      const excludedFromShoppers = [...empUserIds, ...affiliateUserIds];

      const wanted = metrics
        ? new Set(metrics.split(",").map((s) => s.trim()).filter(Boolean))
        : null;
      const selected = wanted ? METRICS.filter((m) => wanted.has(m.id)) : METRICS;

      const entries = await Promise.all(
        selected.map(async (def) => {
          const resolved =
            def.id === "shoppers"
              ? { ...def, filter: { ...def.filter, _id: { $nin: excludedFromShoppers } } }
              : def;
          return [def.id, await seriesFor(resolved, buckets, interval as Interval, rangeEnd)] as const;
        }),
      );

      return res.json({
        interval,
        buckets,
        metrics: Object.fromEntries(entries),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query", issues: err.issues });
      }
      console.error("[garage-admin/analytics/traction] error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * Admin → Analytics → Subscriptions. Same contract and bucketing as
 * /analytics/traction — the frontend renders both with the same cards — only
 * the metric set differs, so a card here supports the same per-card
 * range/interval refetch via `?metrics=<id>`.
 */
router.get(
  "/analytics/subscriptions",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        rangeStart: z.coerce.number().int(),
        rangeEnd: z.coerce.number().int(),
        interval: z.enum(["hour", "day", "week", "month", "quarter", "year"]).default("month"),
        metrics: z.string().optional(),
      });
      const { rangeStart, rangeEnd, interval, metrics } = schema.parse(req.query);
      if (rangeEnd < rangeStart) {
        return res.status(400).json({ error: "rangeEnd before rangeStart" });
      }

      const buckets = bucketStarts(rangeStart, rangeEnd, interval as Interval);
      if (buckets.length === 0) {
        return res.json({ interval, buckets: [], metrics: {} });
      }

      const wanted = metrics
        ? new Set(metrics.split(",").map((s) => s.trim()).filter(Boolean))
        : null;
      const selected = wanted
        ? SUBSCRIPTION_METRICS.filter((m) => wanted.has(m.id))
        : SUBSCRIPTION_METRICS;

      const entries = await Promise.all(
        selected.map(
          async (def) =>
            [def.id, await seriesFor(def, buckets, interval as Interval, rangeEnd)] as const,
        ),
      );

      return res.json({ interval, buckets, metrics: Object.fromEntries(entries) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query", issues: err.issues });
      }
      console.error("[garage-admin/analytics/subscriptions] error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  },
);

export default router;
