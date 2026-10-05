import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { Invoice } from "../models/invoice.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { FranchiseCountry } from "../models/franchiseCountry.model";
import { FranchiseTerritory } from "../models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../models/franchiseSubTerritory.model";
import { canAccessEntity, EntityLevel } from "../utils/entityAccess";

/**
 * Entity-scoped detail endpoints for franchise owners (both System A / global
 * and System B / per-office). Given a franchise entity (country / territory /
 * sub-territory), return aggregate data across every office located in that
 * entity's geo.
 *
 *   GET /franchise-entity/:level/:entityId/customers
 *   GET /franchise-entity/:level/:entityId/affiliates
 *
 * Auth: entity's direct or parent-level owner (Garage assignment or legacy
 * catalog ownerEmail) OR platform admin. See `canAccessEntity`.
 */
const router = Router();
router.use(requireAuth);

// ---- Local helpers (duplicated from franchiseApi.ts to avoid modifying a
// security-sensitive file; ~30 lines, stable, self-contained). --------------

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ciExact(value: string): RegExp {
  return new RegExp("^" + escapeRegex(value.trim()) + "$", "i");
}

/**
 * Build a Mongo filter on `Organization` matching every org located inside
 * the given catalog entity. Country match uses org.country name (CI). No
 * chain-integrity enforcement — for entity-scoped analytics we WANT all
 * orgs regardless of whether the sub-chain has downstream owners.
 */
function buildOrgFilterForEntity(
  level: EntityLevel,
  entity: any
): Record<string, any> | null {
  if (!entity) return null;
  if (level === "country") {
    if (!entity.name) return null;
    return { country: ciExact(entity.name) };
  }
  if (level === "territory") {
    if (!entity.country || !entity.name) return null;
    return {
      country: ciExact(entity.country),
      state: ciExact(entity.name),
    };
  }
  // subTerritory: postal-code match wins; fall back to (country, state, city).
  if (!entity.country || !entity.parentTerritory || !entity.name) return null;
  const zipCodes: string[] = Array.isArray(entity.zipCodes) ? entity.zipCodes : [];
  const nameMatch: Record<string, any> = {
    country: ciExact(entity.country),
    state: ciExact(entity.parentTerritory),
    city: ciExact(entity.name),
  };
  if (zipCodes.length > 0) {
    return { $or: [{ postalCode: { $in: zipCodes } }, nameMatch] };
  }
  return nameMatch;
}

async function loadEntityById(
  level: EntityLevel,
  entityId: string
): Promise<any | null> {
  if (level === "country") return FranchiseCountry.findById(entityId).lean();
  if (level === "territory") return FranchiseTerritory.findById(entityId).lean();
  return FranchiseSubTerritory.findById(entityId).lean();
}

/** Same marketplace scope as `/orgs/:officeId/customers`. */
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

const CUSTOMER_SORT: Record<string, Record<string, 1 | -1>> = {
  lastPurchase: { lastPurchaseAt: -1 },
  totalSpent: { totalSpentCents: -1 },
  invoiceCount: { invoiceCount: -1 },
};

const AFFILIATE_SORT: Record<string, Record<string, 1 | -1>> = {
  totalEarned: { totalEarnedCents: -1 },
  salesCount: { salesCount: -1 },
  distinctCustomers: { distinctCustomerCount: -1 },
};

// ---------------------------------------------------------------------------

/**
 * Preflight: parse + auth-gate a request and resolve the list of orgIds
 * that fall in the entity's geo. Returns null on any failure (already
 * responded).
 */
async function preflight(
  req: Request,
  res: Response
): Promise<{
  level: EntityLevel;
  entityId: string;
  entity: any;
  orgIds: Types.ObjectId[];
  accessReason: string;
} | null> {
  const level = req.params.level as EntityLevel;
  const entityId = req.params.entityId;
  const me = (req as any).user as { userId: string };

  if (!["country", "territory", "subTerritory"].includes(level)) {
    res.status(400).json({ error: "Invalid level" });
    return null;
  }
  if (!entityId) {
    res.status(400).json({ error: "entityId required" });
    return null;
  }

  const auth = await canAccessEntity(me.userId, level, entityId);
  if (!auth.allowed) {
    res.status(403).json({
      error:
        "Forbidden — not the entity's owner, not a parent-level owner, and not the platform admin",
    });
    return null;
  }

  const entity = await loadEntityById(level, entityId);
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return null;
  }

  const orgFilter = buildOrgFilterForEntity(level, entity);
  if (!orgFilter) {
    // Malformed catalog doc — treat as "no orgs".
    return {
      level,
      entityId,
      entity,
      orgIds: [],
      accessReason: auth.reason,
    };
  }

  const orgs = await Organization.find(orgFilter)
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();
  return {
    level,
    entityId,
    entity,
    orgIds: orgs.map((o) => o._id),
    accessReason: auth.reason,
  };
}

// ---------------------------------------------------------------------------

/** GET /franchise-entity/:level/:entityId/customers */
router.get(
  "/:level/:entityId/customers",
  async (req: Request, res: Response) => {
    try {
      const pre = await preflight(req, res);
      if (!pre) return;
      const { level, entityId, entity, orgIds, accessReason } = pre;

      if (orgIds.length === 0) {
        res.json({
          level,
          entityId,
          entityName: entity.name || null,
          total: 0,
          limit: 25,
          skip: 0,
          orgsInEntity: 0,
          accessGrantedVia: accessReason,
          customers: [],
        });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "25", 10) || 25, 100)
      );
      const skip = Math.max(
        0,
        parseInt((req.query.skip as string) || "0", 10) || 0
      );
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
      const sortStage = CUSTOMER_SORT[sortKey] || CUSTOMER_SORT.lastPurchase;

      const invoiceMatch: any = {
        organizationId: { $in: orgIds },
        status: "paid",
        userId: { $ne: null },
        "lineItems.itemType": { $in: MARKETPLACE_ITEM_TYPES },
      };
      if (from || to) {
        invoiceMatch.paidAt = {};
        if (from) invoiceMatch.paidAt.$gte = from;
        if (to) invoiceMatch.paidAt.$lt = to;
      }

      const pipeline: any[] = [
        { $match: invoiceMatch },
        {
          $group: {
            _id: "$userId",
            invoiceCount: { $sum: 1 },
            totalSpentCents: { $sum: "$totalAmount" },
            firstPurchaseAt: { $min: "$paidAt" },
            lastPurchaseAt: { $max: "$paidAt" },
            distinctOrgs: { $addToSet: "$organizationId" },
            currency: { $last: "$paymentCurrency" },
          },
        },
        {
          $facet: {
            total: [{ $count: "n" }],
            items: [{ $sort: sortStage }, { $skip: skip }, { $limit: limit }],
          },
        },
      ];

      const agg = await Invoice.aggregate(pipeline);
      const total = (agg?.[0]?.total?.[0]?.n as number) || 0;
      const rows = (agg?.[0]?.items || []) as any[];

      const ids = rows.map((r) => r._id).filter(Boolean);
      const users = ids.length
        ? await User.find({ _id: { $in: ids } })
            .select("name email profilePicture")
            .lean()
        : [];
      const byId = new Map<string, any>(
        (users as any[]).map((u) => [String(u._id), u])
      );

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
          distinctOrgsBought: (r.distinctOrgs || []).filter(Boolean).length,
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
        level,
        entityId,
        entityName: entity.name || null,
        total,
        limit,
        skip,
        orgsInEntity: orgIds.length,
        sort: sortKey,
        accessGrantedVia: accessReason,
        customers: items,
      });
    } catch (err: any) {
      console.error("[franchise-entity] customers error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ---------------------------------------------------------------------------

/**
 * GET /franchise-entity/:level/:entityId/affiliates
 *
 * "Affiliate in an entity" = any user who has EARNED an affiliate commission
 * from a paid sale at an office located in the entity's geo. Sourced from
 * CommissionDistribution.commissions[] (indexed on {"commissions.userId",
 * createdAt}). Returns per-affiliate rollup: totalEarned, salesCount,
 * distinctCustomers, first/last earn.
 */
router.get(
  "/:level/:entityId/affiliates",
  async (req: Request, res: Response) => {
    try {
      const pre = await preflight(req, res);
      if (!pre) return;
      const { level, entityId, entity, orgIds, accessReason } = pre;

      if (orgIds.length === 0) {
        res.json({
          level,
          entityId,
          entityName: entity.name || null,
          total: 0,
          limit: 25,
          skip: 0,
          orgsInEntity: 0,
          accessGrantedVia: accessReason,
          affiliates: [],
        });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "25", 10) || 25, 100)
      );
      const skip = Math.max(
        0,
        parseInt((req.query.skip as string) || "0", 10) || 0
      );
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
        (req.query.sort as string | undefined) || "totalEarned";
      const sortStage = AFFILIATE_SORT[sortKey] || AFFILIATE_SORT.totalEarned;

      const distMatch: any = {
        orgId: { $in: orgIds },
        status: "completed",
      };
      if (from || to) {
        distMatch.createdAt = {};
        if (from) distMatch.createdAt.$gte = from;
        if (to) distMatch.createdAt.$lt = to;
      }

      // Unwind commissions[] to per-affiliate rows, group by userId.
      // Amount fields on CommissionDistribution.commissions are in the item's
      // native currency smallest unit (matches `saleAmount * pct/100`); the
      // distribution stamps the currency at the row level, so we surface it
      // via $last for the affiliate's most-recent earning currency.
      const pipeline: any[] = [
        { $match: distMatch },
        { $unwind: "$commissions" },
        {
          $group: {
            _id: "$commissions.userId",
            totalEarnedCents: { $sum: "$commissions.amount" },
            salesCount: { $sum: 1 },
            distinctCustomers: { $addToSet: "$customerId" },
            distinctOrgs: { $addToSet: "$orgId" },
            firstEarnAt: { $min: "$createdAt" },
            lastEarnAt: { $max: "$createdAt" },
            currency: { $last: "$currency" },
          },
        },
        {
          $addFields: {
            distinctCustomerCount: { $size: "$distinctCustomers" },
            distinctOrgsCount: { $size: "$distinctOrgs" },
          },
        },
        {
          $facet: {
            total: [{ $count: "n" }],
            items: [{ $sort: sortStage }, { $skip: skip }, { $limit: limit }],
          },
        },
      ];

      const agg = await CommissionDistribution.aggregate(pipeline);
      const total = (agg?.[0]?.total?.[0]?.n as number) || 0;
      const rows = (agg?.[0]?.items || []) as any[];

      const ids = rows.map((r) => r._id).filter(Boolean);
      const users = ids.length
        ? await User.find({ _id: { $in: ids } })
            .select("name email profilePicture affiliateId")
            .lean()
        : [];
      const byId = new Map<string, any>(
        (users as any[]).map((u) => [String(u._id), u])
      );

      let items = rows.map((r) => {
        const uid = r._id ? String(r._id) : null;
        const u = uid ? byId.get(uid) : null;
        return {
          userId: uid,
          name: u?.name || null,
          email: u?.email || null,
          profilePicture: u?.profilePicture || null,
          affiliateId: u?.affiliateId || null,
          totalEarnedCents: r.totalEarnedCents || 0,
          currency: r.currency || null,
          salesCount: r.salesCount || 0,
          distinctCustomerCount: r.distinctCustomerCount || 0,
          distinctOrgsCount: r.distinctOrgsCount || 0,
          firstEarnAt: r.firstEarnAt || null,
          lastEarnAt: r.lastEarnAt || null,
        };
      });

      if (search) {
        const needle = search.toLowerCase();
        items = items.filter(
          (i) =>
            (i.name || "").toLowerCase().includes(needle) ||
            (i.email || "").toLowerCase().includes(needle) ||
            (i.affiliateId || "").toLowerCase().includes(needle)
        );
      }

      res.json({
        level,
        entityId,
        entityName: entity.name || null,
        total,
        limit,
        skip,
        orgsInEntity: orgIds.length,
        sort: sortKey,
        accessGrantedVia: accessReason,
        affiliates: items,
      });
    } catch (err: any) {
      console.error("[franchise-entity] affiliates error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ---------------------------------------------------------------------------

/**
 * GET /franchise-entity/:level/:entityId/stats
 *
 * Total transactional value at every office in the entity's geo, plus
 * headline counts. "Transactional value" = sum of paid invoice totals
 * across MARKETPLACE items (same scope as the /customers endpoint —
 * franchise sales + self-billing excluded).
 *
 * Also breaks down by itemType so a territory owner can see e.g. "$8k in
 * workshops vs $2k in products".
 *
 * Optional `from` / `to` ISO date bounds filter on `paidAt`.
 */
router.get(
  "/:level/:entityId/stats",
  async (req: Request, res: Response) => {
    try {
      const pre = await preflight(req, res);
      if (!pre) return;
      const { level, entityId, entity, orgIds, accessReason } = pre;

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

      if (orgIds.length === 0) {
        res.json({
          level,
          entityId,
          entityName: entity.name || null,
          orgsInEntity: 0,
          accessGrantedVia: accessReason,
          totals: {
            grossTransactionalValueCents: 0,
            paidInvoiceCount: 0,
            uniqueCustomerCount: 0,
            currency: null,
          },
          byItemType: [],
        });
        return;
      }

      const invoiceMatch: any = {
        organizationId: { $in: orgIds },
        status: "paid",
        userId: { $ne: null },
        "lineItems.itemType": { $in: MARKETPLACE_ITEM_TYPES },
      };
      if (from || to) {
        invoiceMatch.paidAt = {};
        if (from) invoiceMatch.paidAt.$gte = from;
        if (to) invoiceMatch.paidAt.$lt = to;
      }

      // Single aggregation with two $facets:
      //   totals — one row summing everything
      //   byItemType — per-itemType breakdown ($unwind lineItems to attribute)
      const pipeline: any[] = [
        { $match: invoiceMatch },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  grossTransactionalValueCents: { $sum: "$totalAmount" },
                  paidInvoiceCount: { $sum: 1 },
                  uniqueCustomers: { $addToSet: "$userId" },
                  currency: { $last: "$paymentCurrency" },
                },
              },
              {
                $project: {
                  _id: 0,
                  grossTransactionalValueCents: 1,
                  paidInvoiceCount: 1,
                  uniqueCustomerCount: { $size: "$uniqueCustomers" },
                  currency: 1,
                },
              },
            ],
            byItemType: [
              { $unwind: "$lineItems" },
              {
                $match: {
                  "lineItems.itemType": { $in: MARKETPLACE_ITEM_TYPES },
                },
              },
              {
                $group: {
                  _id: "$lineItems.itemType",
                  // totalPrice = unitPrice * quantity on the line item (native
                  // item currency smallest unit). Fallback to unitPrice for
                  // rows created without totalPrice stamped.
                  valueCents: {
                    $sum: {
                      $ifNull: ["$lineItems.totalPrice", "$lineItems.unitPrice"],
                    },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { valueCents: -1 } },
            ],
          },
        },
      ];

      const agg = await Invoice.aggregate(pipeline);
      const totalsRow = (agg?.[0]?.totals?.[0] as any) || {
        grossTransactionalValueCents: 0,
        paidInvoiceCount: 0,
        uniqueCustomerCount: 0,
        currency: null,
      };
      const byItemType = ((agg?.[0]?.byItemType as any[]) || []).map((r) => ({
        itemType: r._id,
        valueCents: r.valueCents || 0,
        count: r.count || 0,
      }));

      res.json({
        level,
        entityId,
        entityName: entity.name || null,
        orgsInEntity: orgIds.length,
        accessGrantedVia: accessReason,
        range: {
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
        },
        totals: totalsRow,
        byItemType,
      });
    } catch (err: any) {
      console.error("[franchise-entity] stats error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

export default router;
