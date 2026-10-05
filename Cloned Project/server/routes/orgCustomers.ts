import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { FranchiseProgram } from "../models/franchiseProgram.model";
import { canAccessOfficeCustomers } from "../utils/officeCustomerAccess";

/**
 * Org-scoped customer roster endpoint.
 *
 * Auth: office founder OR any active franchise owner (System A / System B) in
 * the office's geo chain OR platform admin. See `officeCustomerAccess`.
 */
const router = Router();

// ─── Public routes (registered BEFORE the auth middleware, so they bypass
//     requireAuth). Add anything intended for pre-login browsing here.
router.get("/active", handleActiveOrgs);

router.use(requireAuth);

/**
 * Marketplace item types — everything a real buyer would pay for. Excludes:
 *   - `franchise_program`, `franchise_territory`, `franchise_global` — these
 *     are franchise SALES (someone buying a territory), not marketplace
 *     purchases from the office.
 *   - `office_plan`, `office_addon` — the office's OWN subscription /
 *     conference-room bill; not a customer.
 *   - `store_wallet_topup` — buyer funding their own wallet, not a sale.
 */
const MARKETPLACE_ITEM_TYPES = [
  "product",
  "course",
  "channel",
  "workshop",
  "service",
  "call",
  "ecommerce_item",
  "bat246_membership",
  "third_party_subscription",
  "unilevel_plus",
];

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  lastPurchase: { lastPurchaseAt: -1 },
  totalSpent: { totalSpentCents: -1 },
  invoiceCount: { invoiceCount: -1 },
};

/** GET /orgs/:officeId/customers */
router.get(
  "/:officeId/customers",
  async (req: Request, res: Response) => {
    try {
      const { officeId } = req.params;
      const me = (req as any).user as { userId: string };

      if (!officeId || !Types.ObjectId.isValid(officeId)) {
        res.status(400).json({ error: "Valid officeId required" });
        return;
      }

      const auth = await canAccessOfficeCustomers(me.userId, officeId);
      if (!auth.allowed) {
        res.status(403).json({
          error:
            "Forbidden — not the office founder, not a franchise owner in this office's chain, and not the platform admin",
        });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "25", 10) || 25, 100)
      );
      const skip = Math.max(0, parseInt((req.query.skip as string) || "0", 10) || 0);
      const search = (req.query.search as string | undefined)?.trim();
      const fromRaw = req.query.from as string | undefined;
      const toRaw = req.query.to as string | undefined;
      const from = fromRaw ? new Date(fromRaw) : null;
      const to = toRaw ? new Date(toRaw) : null;
      if (fromRaw && (from === null || isNaN(from.getTime()))) {
        res.status(400).json({ error: "Invalid 'from' date" });
        return;
      }
      if (toRaw && (to === null || isNaN(to.getTime()))) {
        res.status(400).json({ error: "Invalid 'to' date" });
        return;
      }
      const sortKey =
        (req.query.sort as string | undefined) || "lastPurchase";
      const sortStage = SORT_MAP[sortKey] || SORT_MAP.lastPurchase;

      const invoiceMatch: any = {
        organizationId: new Types.ObjectId(officeId),
        status: "paid",
        userId: { $ne: null },
        "lineItems.itemType": { $in: MARKETPLACE_ITEM_TYPES },
      };
      if (from || to) {
        invoiceMatch.paidAt = {};
        if (from) invoiceMatch.paidAt.$gte = from;
        if (to) invoiceMatch.paidAt.$lt = to;
      }

      // Mirrors `listCustomers` in services/affiliateAnalyticsDetail.ts.
      // $group by userId → totalSpent + invoiceCount + first/last purchase.
      // $facet gives total count + paginated items in one round-trip.
      const pipeline: any[] = [
        { $match: invoiceMatch },
        {
          $group: {
            _id: "$userId",
            invoiceCount: { $sum: 1 },
            totalSpentCents: { $sum: "$totalAmount" },
            firstPurchaseAt: { $min: "$paidAt" },
            lastPurchaseAt: { $max: "$paidAt" },
            // paymentCurrency reflects what the buyer actually paid in. For a
            // single-currency office all rows agree; for mixed-currency the
            // $last is a rough label — total is a naive sum in mixed units,
            // documented caveat.
            currency: { $last: "$paymentCurrency" },
          },
        },
        {
          $facet: {
            total: [{ $count: "n" }],
            items: [
              { $sort: sortStage },
              { $skip: skip },
              { $limit: limit },
            ],
          },
        },
      ];

      const aggResult = await Invoice.aggregate(pipeline);
      const total = (aggResult?.[0]?.total?.[0]?.n as number) || 0;
      const rows = (aggResult?.[0]?.items || []) as any[];

      // Hydrate user profile in one round-trip.
      const ids = rows.map((r) => r._id).filter(Boolean);
      let users: any[] = [];
      if (ids.length) {
        users = await User.find({ _id: { $in: ids } })
          .select("name email profilePicture")
          .lean();
      }
      const byId = new Map<string, any>(
        users.map((u: any) => [String(u._id), u])
      );

      // Optional search — post-hydration name/email filter. Doing it after
      // the aggregation keeps the pipeline simple; the trade-off is that
      // search shrinks the returned page (does NOT re-paginate). For typical
      // dashboards this is fine — search is usually narrowing an already-
      // small page.
      let items = rows.map((r) => {
        const uid = r._id ? String(r._id) : null;
        const u = uid ? byId.get(uid) : null;
        return {
          userId: uid,
          name: u?.name || null,
          email: u?.email || null,
          profilePicture: u?.profilePicture || null,
          totalSpentCents: r.totalSpentCents || 0,
          currency: r.currency || null,
          invoiceCount: r.invoiceCount || 0,
          firstPurchaseAt: r.firstPurchaseAt || null,
          lastPurchaseAt: r.lastPurchaseAt || null,
        };
      });

      if (search) {
        const needle = search.toLowerCase();
        items = items.filter(
          (i) =>
            (i.name || "").toLowerCase().includes(needle) ||
            (i.email || "").toLowerCase().includes(needle)
        );
      }

      res.json({
        officeId,
        total,
        limit,
        skip,
        sort: sortKey,
        accessGrantedVia: auth.reason,
        customers: items,
      });
    } catch (err: any) {
      console.error("[org-customers] list error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /orgs/active
 *
 * PUBLIC (no auth) — used by pre-login catalog browsing surfaces.
 *
 * Every office whose founder has PAID for the $650/yr franchise program
 * (System B). "Active" = there's a `FranchiseProgram` doc on the office
 * with `status === "active"`. Nothing about the office's Garage/office_plan
 * subscription is checked here — this endpoint answers "who's opted into
 * selling territories through their franchise program", NOT "who has a
 * paid Garage plan".
 *
 * Query params (all optional):
 *   ?limit=50 (max 200)
 *   ?cursor=<orgId>              — pagination on _id descending
 *   ?search=<name>               — case-insensitive contains on org.name
 *   ?country=India               — case-insensitive exact match
 *   ?state=Karnataka             — case-insensitive exact match
 *   ?city=Bengaluru              — case-insensitive exact match
 */
async function handleActiveOrgs(req: Request, res: Response) {
  try {
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
    );
    const cursor = req.query.cursor as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const country = (req.query.country as string | undefined)?.trim();
    const state = (req.query.state as string | undefined)?.trim();
    const city = (req.query.city as string | undefined)?.trim();

    if (cursor && !Types.ObjectId.isValid(cursor)) {
      res.status(400).json({ error: "Invalid cursor" });
      return;
    }

    // Which offices have an ACTIVE FranchiseProgram (founder paid the $650
    // enrollment)? That's the whole filter.
    const programs = await FranchiseProgram.find({ status: "active" })
      .select("officeId founderUserId subscription commissionConfig createdAt")
      .lean<any[]>();
    const programByOfficeId = new Map<string, any>(
      programs.map((p: any) => [String(p.officeId), p]),
    );
    const officeIds = programs.map((p: any) => String(p.officeId));

    if (officeIds.length === 0) {
      res.json({ limit, nextCursor: null, offices: [] });
      return;
    }

    const orgFilter: Record<string, any> = {
      _id: {
        $in: officeIds.map((id) => new Types.ObjectId(id)),
      },
    };
    if (country) orgFilter.country = ciExact(country);
    if (state) orgFilter.state = ciExact(state);
    if (city) orgFilter.city = ciExact(city);
    if (search) orgFilter.name = new RegExp(escapeRegex(search), "i");
    if (cursor) {
      orgFilter._id = {
        ...(orgFilter._id as any),
        $lt: new Types.ObjectId(cursor),
      };
    }

    const rows = await Organization.find(orgFilter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select(
        "name slug icon description country state city postalCode latitude longitude parent createdAt"
      )
      .lean<any[]>();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

    const offices = items.map((o) => {
      const prog = programByOfficeId.get(String(o._id));
      return {
        id: String(o._id),
        name: o.name || null,
        slug: o.slug || null,
        icon: o.icon || null,
        description: o.description || null,
        country: o.country || null,
        state: o.state || null,
        city: o.city || null,
        postalCode: o.postalCode || null,
        latitude: o.latitude ?? null,
        longitude: o.longitude ?? null,
        parentHq: o.parent === true,
        createdAt: o.createdAt,
        franchiseProgram: prog
          ? {
              founderUserId: String(prog.founderUserId),
              enrolledAt: prog.createdAt || null,
              renewsAt: prog.subscription?.expiresAt || null,
              commissionConfig: prog.commissionConfig || null,
            }
          : null,
      };
    });

    res.json({ limit, nextCursor, offices });
  } catch (err) {
    console.error("[orgs/active] list error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

function escapeRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ciExact(v: string): RegExp {
  return new RegExp("^" + escapeRegex(v.trim()) + "$", "i");
}

export default router;
