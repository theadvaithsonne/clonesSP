import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { TerritoryWallet } from "../models/territoryWallet.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { FranchiseCountry } from "../models/franchiseCountry.model";
import { FranchiseTerritory } from "../models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../models/franchiseSubTerritory.model";
import { Invoice } from "../models/invoice.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { FranchiseGlobalAssignment } from "../models/franchiseGlobalAssignment.model";
import { FranchiseTerritoryAssignment } from "../models/franchiseTerritoryAssignment.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { requireFranchiseApiKey } from "../middleware/franchiseApiAuth";

/**
 * Public API for the franchise app (roam-admin-prod) to read territory
 * commission wallets and transaction history for the people it represents.
 *
 * Auth: X-Franchise-API-Key header (shared secret).
 * All endpoints are GET, read-only.
 */
const router = Router();
router.use(requireFranchiseApiKey);

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadUserByEmail(email: string): Promise<{ _id: Types.ObjectId; email: string; name?: string } | null> {
  const escapedEmail = escapeRegex(email);
  return User.findOne({
    email: new RegExp("^" + escapedEmail + "$", "i"),
  })
    .select("_id email name")
    .lean<{ _id: Types.ObjectId; email: string; name?: string }>();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Wallet payload — returns the AUTHORITATIVE wallet figures (both global
 * and founder-program earnings combined).
 *
 * History: this used to subtract founder-program credits from the balance
 * because the endpoint powered roam-admin's global view, which needed to
 * ignore per-office franchise programs. That subtraction was hiding
 * legitimate earnings from franchise vault UIs — e.g. a territory owner
 * assigned under Chamak's per-office program would see $0 here despite
 * having a real balance in their TerritoryWallet. As of 2026-07-18 the
 * endpoint returns the true total (matches what the owner sees on their
 * own dashboard). If a caller specifically needs "global only", add a
 * ?source=global query param on top of this.
 */
async function walletPayload(
  user: { _id: Types.ObjectId; email: string; name?: string },
  wallet: any | null
) {
  return {
    userId: String(user._id),
    email: user.email,
    name: user.name || null,
    balance: round2(Math.max(0, wallet?.balance ?? 0)),
    currency: wallet?.currency ?? "USD",
    isActive: wallet?.isActive ?? true,
    totalEarnings: round2(Math.max(0, wallet?.totalEarnings ?? 0)),
    totalWithdrawn: round2(Math.max(0, wallet?.totalWithdrawn ?? 0)),
    lastTransactionAt: wallet?.lastTransactionAt ?? null,
  };
}

/** GET /franchise-api/wallets/by-email/:email */
router.get(
  "/wallets/by-email/:email",
  async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.params.email || "");
      if (!email) {
        res.status(400).json({ error: "Missing email" });
        return;
      }
      const user = await loadUserByEmail(email);
      if (!user) {
        res
          .status(404)
          .json({ error: "No Garage user with that email", email });
        return;
      }
      const wallet = await TerritoryWallet.findOne({ userId: user._id }).lean();
      res.json(await walletPayload(user, wallet));
    } catch (err: any) {
      console.error("[franchise-api] by-email wallet error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** GET /franchise-api/wallets/by-user/:userId */
router.get(
  "/wallets/by-user/:userId",
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      if (!Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: "Invalid userId" });
        return;
      }
      const user = await User.findById(userId)
        .select("_id email name")
        .lean<{ _id: Types.ObjectId; email: string; name?: string }>();
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const wallet = await TerritoryWallet.findOne({ userId: user._id }).lean();
      res.json(await walletPayload(user, wallet));
    } catch (err: any) {
      console.error("[franchise-api] by-user wallet error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** GET /franchise-api/wallets/by-email/:email/transactions */
router.get(
  "/wallets/by-email/:email/transactions",
  async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.params.email || "");
      if (!email) {
        res.status(400).json({ error: "Missing email" });
        return;
      }
      const user = await loadUserByEmail(email);
      if (!user) {
        res.status(404).json({ error: "No Garage user with that email" });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
      );
      const cursor = req.query.cursor as string | undefined;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;

      // Return ALL sources — global (Shorupan platform-fee) AND
      // founder_program (per-office franchise) rows together, so the
      // vault UI shows the owner's full transaction history. Previously
      // this filtered out `source: "founder_program"` for a defunct
      // roam-admin global-only view; that hid legitimate earnings and
      // was flipped in the same 2026-07-18 change as walletPayload above.
      const filter: any = {
        userId: user._id,
      };
      if (entityType) {
        if (!["country", "territory", "subTerritory"].includes(entityType)) {
          res.status(400).json({ error: "Invalid entityType" });
          return;
        }
        filter.entityType = entityType;
      }
      if (entityId) filter.entityId = entityId;
      if (cursor) {
        if (!Types.ObjectId.isValid(cursor)) {
          res.status(400).json({ error: "Invalid cursor" });
          return;
        }
        filter._id = { $lt: new Types.ObjectId(cursor) };
      }

      const rows = await TerritoryWalletTransaction.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

      res.json({
        transactions: items.map((r) => ({
          id: String(r._id),
          // "global" = System A (Shorupan platform-fee split),
          // "founder_program" = System B (per-office franchise). Legacy
          // rows have no source field; treat null/missing as "global".
          source: r.source ?? "global",
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          description: r.description,
          status: r.status,
          balanceBefore: r.balanceBefore,
          balanceAfter: r.balanceAfter,
          entityType: r.entityType,
          entityId: r.entityId,
          entityName: r.entityName,
          originalSliceLevel: r.originalSliceLevel,
          relatedSplitPercentage: r.relatedSplitPercentage,
          relatedSaleAmount: r.relatedSaleAmount,
          relatedPlatformFeeAmount: r.relatedPlatformFeeAmount,
          relatedPlatformFeePercentage: r.relatedPlatformFeePercentage,
          relatedOrgId: r.relatedOrgId ? String(r.relatedOrgId) : null,
          relatedCommissionDistributionId: r.relatedCommissionDistributionId
            ? String(r.relatedCommissionDistributionId)
            : null,
          relatedPaymentId: r.relatedPaymentId || null,
          relatedItemType: r.relatedItemType || null,
          relatedItemId: r.relatedItemId ? String(r.relatedItemId) : null,
          relatedItemName: r.relatedItemName || null,
          createdAt: r.createdAt,
        })),
        nextCursor,
      });
    } catch (err: any) {
      console.error("[franchise-api] transactions error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** GET /franchise-api/entities/:entityType/:entityId/summary */
router.get(
  "/entities/:entityType/:entityId/summary",
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      if (!["country", "territory", "subTerritory"].includes(entityType)) {
        res.status(400).json({ error: "Invalid entityType" });
        return;
      }
      if (!entityId) {
        res.status(400).json({ error: "Missing entityId" });
        return;
      }

      // GLOBAL view only — exclude founder-program rows (legacy rows lack the
      // field, so use $ne rather than == global).
      const baseFilter = {
        entityType,
        entityId,
        source: { $ne: "founder_program" },
      };
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [agg, agg30] = await Promise.all([
        TerritoryWalletTransaction.aggregate([
          { $match: { ...baseFilter, type: "credit" } },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
              count: { $sum: 1 },
              latestCurrency: { $last: "$currency" },
            },
          },
        ]),
        TerritoryWalletTransaction.aggregate([
          {
            $match: { ...baseFilter, type: "credit", createdAt: { $gte: since30 } },
          },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
      ]);

      const total = agg[0]?.total ?? 0;
      const count = agg[0]?.count ?? 0;
      const currency = agg[0]?.latestCurrency ?? "USD";

      res.json({
        entityType,
        entityId,
        totalCommissions: Math.round(total * 100) / 100,
        transactionCount: count,
        last30Days: {
          total: Math.round((agg30[0]?.total ?? 0) * 100) / 100,
          count: agg30[0]?.count ?? 0,
        },
        currency,
      });
    } catch (err: any) {
      console.error("[franchise-api] entity summary error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// =========================================================================
// Offices (organizations) lookup
// =========================================================================

type EntityType = "country" | "territory" | "subTerritory";

function ciExact(value: string): RegExp {
  return new RegExp("^" + escapeRegex(value.trim()) + "$", "i");
}

function officePayload(o: any) {
  return {
    id: String(o._id),
    name: o.name || null,
    slug: o.slug || null,
    icon: o.icon || null,
    country: o.country || null,
    state: o.state || null,
    city: o.city || null,
    postalCode: o.postalCode || null,
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
    createdAt: o.createdAt,
  };
}

/**
 * Build a Mongo filter for a SINGLE leaf entity. This is the lowest-level
 * matching primitive — used after `findLeavesUnder` has decomposed an entity
 * down to its leaves.
 *
 *   - country leaf:      org.country (CI) matches country.name
 *   - territory leaf:    org.country + org.state (CI) match
 *   - subTerritory leaf: org.postalCode ∈ sub.zipCodes  OR  (country+state+city) (CI) match
 */
function buildOrgFilterForLeaf(
  leafType: EntityType,
  leaf: any
): Record<string, any> | null {
  if (!leaf) return null;

  if (leafType === "country") {
    if (!leaf.name) return null;
    return { country: ciExact(leaf.name) };
  }

  if (leafType === "territory") {
    if (!leaf.country || !leaf.name) return null;
    return {
      country: ciExact(leaf.country),
      state: ciExact(leaf.name),
    };
  }

  // subTerritory
  if (!leaf.country || !leaf.parentTerritory || !leaf.name) return null;
  const zipCodes: string[] = Array.isArray(leaf.zipCodes) ? leaf.zipCodes : [];
  const nameMatch: Record<string, any> = {
    country: ciExact(leaf.country),
    state: ciExact(leaf.parentTerritory),
    city: ciExact(leaf.name),
  };
  if (zipCodes.length > 0) {
    return { $or: [{ postalCode: { $in: zipCodes } }, nameMatch] };
  }
  return nameMatch;
}

/**
 * Compute the "leaf entities" an owner can claim under a given franchise
 * entity.
 *
 * The franchise hierarchy is Country → Territory → SubTerritory. An owner
 * at any level covers every office located inside that level's geo —
 * matching the CASCADE-UP commission rule where unassigned sub-chains
 * bubble their slice up to the nearest owner above them.
 *
 *   - subTerritory: the sub-territory itself.
 *   - territory:    the territory itself (matches by country + state).
 *   - country:      the country itself (matches by country).
 *
 * Historical note: an earlier version enforced "chain integrity" — a
 * country owner only saw orgs in sub-territories where BOTH the parent
 * territory AND the sub-territory had their own ownerEmail set. That was
 * removed in 2026-07 when the commission distributor was changed to
 * cascade unassigned slices UP. A country owner earns from EVERY sale in
 * their country when the sub-chain is unowned, so they should also SEE
 * those offices.
 */
async function findLeavesUnder(
  entityType: EntityType,
  entity: any
): Promise<Array<{ type: EntityType; entity: any }>> {
  // Under the cascade-up rule an owner at level L covers everything in L's
  // geo, regardless of which downstream levels are assigned. Return the
  // entity itself as its own leaf at all three levels.
  return [{ type: entityType, entity }];
}

/** Build a single Mongo filter from a list of leaves (OR'd together). */
function buildOrgFilterFromLeaves(
  leaves: Array<{ type: EntityType; entity: any }>
): Record<string, any> | null {
  const branches: Record<string, any>[] = [];
  for (const leaf of leaves) {
    const f = buildOrgFilterForLeaf(leaf.type, leaf.entity);
    if (f) branches.push(f);
  }
  if (branches.length === 0) return null;
  if (branches.length === 1) return branches[0];
  return { $or: branches };
}

/** Local match check (no DB hit) — used for tagging matchedAt in by-email. */
function orgMatchesLeaf(
  org: any,
  leaf: any,
  leafType: EntityType
): boolean {
  if (leafType === "subTerritory") {
    if (
      org.postalCode &&
      Array.isArray(leaf.zipCodes) &&
      leaf.zipCodes.includes(org.postalCode)
    ) {
      return true;
    }
    return !!(
      org.country &&
      org.state &&
      org.city &&
      leaf.country &&
      leaf.parentTerritory &&
      leaf.name &&
      org.country.trim().toLowerCase() === leaf.country.trim().toLowerCase() &&
      org.state.trim().toLowerCase() ===
        leaf.parentTerritory.trim().toLowerCase() &&
      org.city.trim().toLowerCase() === leaf.name.trim().toLowerCase()
    );
  }
  if (leafType === "territory") {
    return !!(
      leaf.country &&
      leaf.name &&
      org.country &&
      org.state &&
      org.country.trim().toLowerCase() === leaf.country.trim().toLowerCase() &&
      org.state.trim().toLowerCase() === leaf.name.trim().toLowerCase()
    );
  }
  // country leaf
  return !!(
    leaf.name &&
    org.country &&
    org.country.trim().toLowerCase() === leaf.name.trim().toLowerCase()
  );
}

async function loadEntityById(
  entityType: EntityType,
  entityId: string
): Promise<any | null> {
  if (entityType === "country") {
    return FranchiseCountry.findById(entityId).lean();
  }
  if (entityType === "territory") {
    return FranchiseTerritory.findById(entityId).lean();
  }
  return FranchiseSubTerritory.findById(entityId).lean();
}

/** GET /franchise-api/entities/:entityType/:entityId/offices */
router.get(
  "/entities/:entityType/:entityId/offices",
  async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType as EntityType;
      const entityId = req.params.entityId;

      if (!["country", "territory", "subTerritory"].includes(entityType)) {
        res.status(400).json({ error: "Invalid entityType" });
        return;
      }
      if (!entityId) {
        res.status(400).json({ error: "Missing entityId" });
        return;
      }

      const entity = await loadEntityById(entityType, entityId);
      if (!entity) {
        res.status(404).json({ error: "Entity not found", entityType, entityId });
        return;
      }

      // Leaf-based visibility: orgs that fall in this entity's leaf descendants.
      // For a territory with sub-territories, leaves = sub-territories only.
      // For a territory without sub-territories, leaf = the territory itself.
      // Same recursion for countries.
      const leaves = await findLeavesUnder(entityType, entity);
      const filter = buildOrgFilterFromLeaves(leaves);
      if (!filter) {
        res.json({
          entity: shapeEntity(entityType, entity),
          offices: [],
          nextCursor: null,
        });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
      );
      const cursor = req.query.cursor as string | undefined;

      const query: Record<string, any> = { ...filter };
      if (cursor) {
        if (!Types.ObjectId.isValid(cursor)) {
          res.status(400).json({ error: "Invalid cursor" });
          return;
        }
        query._id = { $lt: new Types.ObjectId(cursor) };
      }

      const rows = await Organization.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .select(
          "name slug icon country state city postalCode latitude longitude createdAt"
        )
        .lean();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        entity: shapeEntity(entityType, entity),
        offices: items.map(officePayload),
        nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      });
    } catch (err: any) {
      console.error("[franchise-api] entity offices error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

function shapeEntity(entityType: EntityType, e: any) {
  if (entityType === "country") {
    return {
      type: "country",
      id: String(e._id),
      name: e.name,
      region: e.region || null,
      status: e.status || null,
      ownerEmail: e.ownerEmail || null,
    };
  }
  if (entityType === "territory") {
    return {
      type: "territory",
      id: String(e._id),
      name: e.name,
      country: e.country,
      region: e.region || null,
      status: e.status || null,
      ownerEmail: e.ownerEmail || null,
      parentId: e.parentId || null,
    };
  }
  return {
    type: "subTerritory",
    id: String(e._id),
    name: e.name,
    country: e.country,
    parentTerritory: e.parentTerritory,
    region: e.region || null,
    status: e.status || null,
    ownerEmail: e.ownerEmail || null,
    parentId: e.parentId || null,
    zipCodesCount: Array.isArray(e.zipCodes) ? e.zipCodes.length : 0,
  };
}

/**
 * GET /franchise-api/owners/by-email/:email/entities
 *
 * Lists every franchise entity (country / territory / sub-territory) whose
 * ownerEmail matches the given email (case-insensitive).
 */
router.get(
  "/owners/by-email/:email/entities",
  async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.params.email || "");
      if (!email) {
        res.status(400).json({ error: "Missing email" });
        return;
      }

      const emailRegex = ciExact(email);

      const [countries, territories, subs] = await Promise.all([
        FranchiseCountry.find({ ownerEmail: emailRegex })
          .select("_id name region status ownerEmail")
          .lean(),
        FranchiseTerritory.find({ ownerEmail: emailRegex })
          .select("_id name country region status ownerEmail parentId")
          .lean(),
        FranchiseSubTerritory.find({ ownerEmail: emailRegex })
          .select(
            "_id name country parentTerritory region status ownerEmail parentId zipCodes"
          )
          .lean(),
      ]);

      res.json({
        email,
        countries: countries.map((c) => shapeEntity("country", c)),
        territories: territories.map((t) => shapeEntity("territory", t)),
        subTerritories: subs.map((s) => shapeEntity("subTerritory", s)),
        totalCount: countries.length + territories.length + subs.length,
      });
    } catch (err: any) {
      console.error("[franchise-api] owner entities error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-api/businesses
 *
 * Flexible, paginated business list for the GaragePay "Businesses" table. Filter
 * by any combination of country / territory / sub-territory — or none, in which
 * case it returns businesses across EVERY country. Filtering + pagination are
 * server-side (cursor on _id desc) so it scales to thousands of businesses; a
 * page never loads more than `limit` rows.
 *
 * Query:
 *   ?country=<catalog name>    restrict to a country (Organizations whose
 *                              `country` matches, case-insensitive)
 *   ?territoryId=<catalog _id> restrict to a territory (implies its country)
 *   ?subId=<catalog _id>       restrict to a sub-territory (implies country+territory)
 *   ?limit=1..200 (default 20) &cursor=<lastOfficeId>
 * The most-specific of sub/territory/country wins. The drawer's filter LISTS are
 * served by the /scope/* endpoints, not this one.
 *
 * Each row: founder (reverse membership), territory/sub owner (ASSIGNMENT-FIRST:
 * active FranchiseTerritoryAssignment → FranchiseGlobalAssignment by geoEntityId,
 * else legacy catalog ownerEmail), and Volume/Fees/Earnings. `totals` cover the
 * whole filtered set (guarded for scale). `scope` echoes the resolved filter.
 *
 * Auth: X-Franchise-API-Key (router-level middleware).
 */
router.get(
  "/businesses",
  async (req: Request, res: Response) => {
    try {
      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "20", 10) || 20, 200)
      );
      const countryName = ((req.query.country as string) || "").trim();
      const territoryId = ((req.query.territoryId as string) || "").trim();
      const subId = ((req.query.subId as string) || "").trim();
      // Optional: scope the per-business `earningsUsd` column to a specific
      // viewer. Without it, earnings = total commission that flowed OUT of
      // the business's sales to all owners combined. With it, earnings =
      // only the credits that landed on this user's TerritoryWallet — so
      // the summed column matches dashboard/garagepay-stats.myTotalEarningsUsd.
      const forUserEmailRaw = ((req.query.forUserEmail as string) || "").trim();

      // Resolve the most-specific scope → an Organization filter. Territory/sub
      // reuse the same leaf→org matcher (`buildOrgFilterForLeaf`) as the offices
      // endpoint (postalCode ∈ zipCodes, else country+state+city name).
      let baseFilter: Record<string, any> = {};
      const scope: {
        country: { id: string | null; name: string | null } | null;
        territory: { id: string | null; name: string | null } | null;
        sub: { id: string | null; name: string | null } | null;
      } = { country: null, territory: null, sub: null };

      if (subId) {
        const sub: any = await FranchiseSubTerritory.findById(subId).lean();
        if (!sub) { res.status(404).json({ error: "Sub-territory not found" }); return; }
        baseFilter = buildOrgFilterForLeaf("subTerritory", sub) || {};
        scope.sub = { id: String(sub._id), name: sub.name || null };
        scope.territory = sub.parentTerritory ? { id: null, name: sub.parentTerritory } : null;
        scope.country = sub.country ? { id: null, name: sub.country } : null;
      } else if (territoryId) {
        const terr: any = await FranchiseTerritory.findById(territoryId).lean();
        if (!terr) { res.status(404).json({ error: "Territory not found" }); return; }
        baseFilter = buildOrgFilterForLeaf("territory", terr) || {};
        scope.territory = { id: String(terr._id), name: terr.name || null };
        scope.country = terr.country ? { id: null, name: terr.country } : null;
      } else if (countryName) {
        baseFilter = { country: ciExact(countryName) };
        scope.country = { id: null, name: countryName };
      }
      // else: no filter → all businesses across every country.

      // ── Whole-scope money map + server-side sort + page slice ────────────
      // Sorting by any money column needs every business's totals BEFORE we can
      // pick a page, so compute the GaragePay wallet rollup for the whole scope
      // once and reuse it for the rows, the sort, and the footer. Guarded for
      // scale: beyond SCOPE_CAP we fall back to name/_id sort + per-page money.
      const SCOPE_CAP = 10000;
      const businessesCount = await Organization.countDocuments(baseFilter);

      const ORG_FIELDS = "name slug icon country state city postalCode createdAt";
      const orderKeyExpr = {
        $ifNull: ["$relatedCommissionDistributionId", { $ifNull: ["$relatedPaymentId", "$_id"] }],
      };
      const walletScopeExpr = (ids: any[]) => ({
        $or: [{ relatedOrgId: { $in: ids } }, { franchiseOfficeId: { $in: ids } }],
      });

      // Optional viewer scope: forUserEmail restricts the money columns to the
      // slices that landed on this user's wallet, so the summed Earnings match
      // dashboard/garagepay-stats.myTotalEarningsUsd.
      let viewerUserId: Types.ObjectId | null = null;
      if (forUserEmailRaw) {
        const escaped = normalizeEmail(forUserEmailRaw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const u = await User.findOne({ email: new RegExp("^" + escaped + "$", "i") })
          .select("_id")
          .lean<{ _id: Types.ObjectId }>();
        if (u) viewerUserId = u._id;
      }

      const volByOrg = new Map<string, number>();
      const feeByOrg = new Map<string, number>();
      const earnByOrg = new Map<string, number>();
      const txByOrg = new Map<string, number>();
      // Per-order dedup (one sale spawns up to 3 slice rows sub/terr/country):
      // $max sale/fee once per order, $sum credit slices for earnings. Scoped
      // to the viewer's userId when forUserEmail was passed.
      const loadWalletMoney = async (ids: any[]) => {
        if (!ids.length) return;
        const match: any = walletScopeExpr(ids);
        if (viewerUserId) match.userId = viewerUserId;
        // Scope to the GLOBAL platform-fee split. Founder-program credits
        // (`source: "founder_program"`) come out of the SELLER-GROSS, not the
        // platform fee, so they can exceed the fee — mixing them into the
        // same rollup breaks the `earnings ≤ fees` invariant this report is
        // built on. Legacy rows written before the `source` field existed
        // read as global (they came from the original platform-fee split).
        match.source = { $ne: "founder_program" };
        const agg = await TerritoryWalletTransaction.aggregate([
          { $match: match },
          { $addFields: { _org: { $ifNull: ["$relatedOrgId", "$franchiseOfficeId"] }, _order: orderKeyExpr } },
          { $group: { _id: { org: "$_org", order: "$_order" }, sale: { $max: "$relatedSaleAmount" }, fee: { $max: "$relatedPlatformFeeAmount" }, comm: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] } } } },
          { $group: { _id: "$_id.org", volume: { $sum: { $ifNull: ["$sale", 0] } }, fees: { $sum: { $ifNull: ["$fee", 0] } }, earnings: { $sum: "$comm" }, tx: { $sum: 1 } } },
        ]);
        for (const g of agg as any[]) {
          const id = String(g._id);
          volByOrg.set(id, round2(g.volume || 0));
          feeByOrg.set(id, round2(g.fees || 0));
          earnByOrg.set(id, round2(g.earnings || 0));
          txByOrg.set(id, g.tx || 0);
        }
      };

      const SORT_FIELDS = new Set(["name", "volume", "fees", "earnings"]);
      const sortByRaw = String(req.query.sortBy || "name");
      const sortBy = SORT_FIELDS.has(sortByRaw) ? sortByRaw : "name";
      const sortDir = String(req.query.sortOrder) === "desc" ? -1 : 1;
      const page = Math.max(0, parseInt((req.query.page as string) || "0", 10) || 0);
      const totalPages = Math.max(1, Math.ceil(businessesCount / limit));
      const moneyTotalsAvailable = businessesCount > 0 && businessesCount <= SCOPE_CAP;

      let pageOffices: any[] = [];
      if (moneyTotalsAvailable) {
        // Whole scope in memory: money map for all, sort, then slice the page.
        const allOffices = await Organization.find(baseFilter).select(ORG_FIELDS).lean();
        await loadWalletMoney(allOffices.map((o: any) => o._id));
        const metric = (o: any) => {
          const id = String(o._id);
          if (sortBy === "volume") return volByOrg.get(id) ?? 0;
          if (sortBy === "fees") return feeByOrg.get(id) ?? 0;
          if (sortBy === "earnings") return earnByOrg.get(id) ?? 0;
          return 0;
        };
        allOffices.sort((a: any, b: any) => {
          let cmp = sortBy === "name"
            ? String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
            : metric(a) - metric(b);
          if (cmp === 0) cmp = String(a._id).localeCompare(String(b._id)); // stable tiebreak
          return cmp * sortDir;
        });
        pageOffices = allOffices.slice(page * limit, page * limit + limit);
      } else if (businessesCount > SCOPE_CAP) {
        // Too large to money-sort in memory: name/_id sort via Mongo, money for
        // the page only, money totals left null (scale guard).
        const sortSpec: any = sortBy === "name" ? { name: sortDir } : { _id: sortDir };
        pageOffices = await Organization.find(baseFilter)
          .sort(sortSpec)
          .skip(page * limit)
          .limit(limit)
          .select(ORG_FIELDS)
          .lean();
        await loadWalletMoney(pageOffices.map((o: any) => o._id));
      }

      const officeIds = pageOffices.map((o: any) => o._id);
      const officeIdSet = new Set(officeIds.map((id: any) => String(id)));

      // Footer money totals — sum the whole-scope map (null beyond the cap).
      const totals: {
        businesses: number;
        volumeUsd: number | null;
        feesUsd: number | null;
        earningsUsd: number | null;
      } = {
        businesses: businessesCount,
        volumeUsd: businessesCount > SCOPE_CAP ? null : 0,
        feesUsd: businessesCount > SCOPE_CAP ? null : 0,
        earningsUsd: businessesCount > SCOPE_CAP ? null : 0,
      };
      if (moneyTotalsAvailable) {
        let v = 0, f = 0, e = 0;
        for (const x of volByOrg.values()) v += x;
        for (const x of feeByOrg.values()) f += x;
        for (const x of earnByOrg.values()) e += x;
        totals.volumeUsd = round2(v);
        totals.feesUsd = round2(f);
        totals.earningsUsd = round2(e);
      }

      const personFromUser = (u: any | undefined | null) =>
        u
          ? {
              userId: String(u._id),
              name: u.name || null,
              email: u.email || null,
              phone: u.phone || null,
              country: u.country || null,
              avatar: u.profilePicture || null,
            }
          : null;

      // Resolve the selected COUNTRY's owner for the scope pill
      // ("India | Parajit Dave"): assignment-first (active country-level
      // FranchiseGlobalAssignment) then the catalog country's owner.
      if (scope.country?.name) {
        const cdoc: any = await FranchiseCountry.findOne({
          name: ciExact(scope.country.name),
        })
          .select("name ownerEmail countryOwner")
          .lean();
        if (cdoc) {
          scope.country.id = String(cdoc._id);
          const gAssign: any = await FranchiseGlobalAssignment.findOne({
            geoLevel: "country",
            geoEntityId: String(cdoc._id),
            status: "active",
          })
            .select("ownerUserId ownerEmail")
            .lean();
          const ownerEmail =
            gAssign?.ownerEmail || cdoc.ownerEmail || cdoc.countryOwner?.email || null;
          let ownerUser: any = null;
          if (gAssign?.ownerUserId) {
            ownerUser = await User.findById(gAssign.ownerUserId)
              .select("name email phone country profilePicture")
              .lean();
          }
          if (!ownerUser && ownerEmail) {
            ownerUser = await User.findOne({
              email: new RegExp("^" + escapeRegex(normalizeEmail(ownerEmail)) + "$", "i"),
            })
              .select("name email phone country profilePicture")
              .lean();
          }
          (scope.country as any).owner = ownerUser
            ? personFromUser(ownerUser)
            : ownerEmail
              ? { userId: null, name: cdoc.countryOwner?.name || null, email: ownerEmail, phone: null, country: null, avatar: null }
              : null;
        }
      }

      if (officeIds.length === 0) {
        res.json({
          scope,
          businesses: [],
          totals,
          page,
          limit,
          total: businessesCount,
          totalPages,
          forUserEmail: viewerUserId ? normalizeEmail(forUserEmailRaw) : null,
        });
        return;
      }

      // ── Founders (reverse membership: User.organizations[].role='founder') ─
      // The org has no reliable founder pointer; the founder is the User whose
      // membership for that org is role "founder" (100% populated, has phone).
      const founderUsers = await User.find({
        organizations: {
          $elemMatch: { organization: { $in: officeIds }, role: "founder" },
        },
      })
        .select("name email phone country profilePicture organizations")
        .lean();
      const founderByOrg = new Map<string, any>();
      for (const u of founderUsers as any[]) {
        for (const m of u.organizations || []) {
          if (
            m.role === "founder" &&
            m.organization &&
            officeIdSet.has(String(m.organization)) &&
            !founderByOrg.has(String(m.organization))
          ) {
            founderByOrg.set(String(m.organization), u);
          }
        }
      }

      // ── Territory / Sub-Territory owners (ASSIGNMENT-FIRST) ──────────────
      // Ownership lives in the assignment collections (keyed by geoEntityId =
      // catalog string _id), not the legacy catalog ownerEmail. Load the catalog
      // only for the DISTINCT countries present in this page of offices, so the
      // global (unfiltered) view never pulls all ~3k territories at once.
      const pageCountryRegexes = [
        ...new Set(pageOffices.map((o: any) => (o.country || "").trim()).filter(Boolean)),
      ].map((c) => ciExact(c as string));
      const [territories, subs] = pageCountryRegexes.length
        ? await Promise.all([
            FranchiseTerritory.find({ country: { $in: pageCountryRegexes } })
              .select("name country region ownerEmail")
              .lean(),
            FranchiseSubTerritory.find({ country: { $in: pageCountryRegexes } })
              .select("name country parentTerritory region ownerEmail zipCodes")
              .lean(),
          ])
        : [[] as any[], [] as any[]];
      const allGeoIds = [
        ...territories.map((t: any) => String(t._id)),
        ...subs.map((s: any) => String(s._id)),
      ];

      // Active assignments → ownerByGeo (territory-assignment wins over global).
      const ownerByGeo = new Map<string, { ownerUserId?: any; ownerEmail?: string }>();
      if (allGeoIds.length) {
        const [tAssigns, gAssigns] = await Promise.all([
          FranchiseTerritoryAssignment.find({ status: "active", geoEntityId: { $in: allGeoIds } })
            .select("geoLevel geoEntityId ownerUserId ownerEmail")
            .lean(),
          FranchiseGlobalAssignment.find({ status: "active", geoEntityId: { $in: allGeoIds } })
            .select("geoLevel geoEntityId ownerUserId ownerEmail")
            .lean(),
        ]);
        for (const a of gAssigns as any[])
          if (a.geoEntityId) ownerByGeo.set(String(a.geoEntityId), { ownerUserId: a.ownerUserId, ownerEmail: a.ownerEmail });
        for (const a of tAssigns as any[])
          if (a.geoEntityId) ownerByGeo.set(String(a.geoEntityId), { ownerUserId: a.ownerUserId, ownerEmail: a.ownerEmail });
      }

      // Resolve owner Users: by id (assignment) + by email (assignment/catalog fallback).
      const ownerUserIdSet = new Set<string>();
      const ownerEmailSet = new Set<string>();
      for (const a of ownerByGeo.values()) {
        if (a.ownerUserId) ownerUserIdSet.add(String(a.ownerUserId));
        else if (a.ownerEmail) ownerEmailSet.add(normalizeEmail(a.ownerEmail));
      }
      for (const t of territories as any[])
        if (!ownerByGeo.has(String(t._id)) && t.ownerEmail) ownerEmailSet.add(normalizeEmail(t.ownerEmail));
      for (const s of subs as any[])
        if (!ownerByGeo.has(String(s._id)) && s.ownerEmail) ownerEmailSet.add(normalizeEmail(s.ownerEmail));

      const [ownerUsersById, ownerUsersByEmail] = await Promise.all([
        ownerUserIdSet.size
          ? User.find({ _id: { $in: [...ownerUserIdSet] } })
              .select("name email phone country profilePicture")
              .lean()
          : [],
        ownerEmailSet.size
          ? User.find({
              email: { $in: [...ownerEmailSet].map((e) => new RegExp("^" + escapeRegex(e) + "$", "i")) },
            })
              .select("name email phone country profilePicture")
              .lean()
          : [],
      ]);
      const ownerUserById = new Map((ownerUsersById as any[]).map((u) => [String(u._id), u]));
      const ownerUserByEmail = new Map((ownerUsersByEmail as any[]).map((u) => [normalizeEmail(u.email || ""), u]));

      // owner person for a catalog leaf: assignment (id → email) then catalog email.
      const ownerForLeaf = (leaf: any | null) => {
        if (!leaf) return null;
        const geo = String(leaf._id);
        const a = ownerByGeo.get(geo);
        let u: any = null;
        if (a?.ownerUserId) u = ownerUserById.get(String(a.ownerUserId));
        if (!u && a?.ownerEmail) u = ownerUserByEmail.get(normalizeEmail(a.ownerEmail));
        if (!u && leaf.ownerEmail) u = ownerUserByEmail.get(normalizeEmail(leaf.ownerEmail));
        const fallbackEmail = a?.ownerEmail || leaf.ownerEmail || null;
        if (!u && !fallbackEmail) return null;
        const base = personFromUser(u) ?? {
          userId: null, name: null, email: fallbackEmail, phone: null, country: null, avatar: null,
        };
        return { ...base, email: base.email ?? fallbackEmail, entity: { id: geo, name: leaf.name || null } };
      };

      // Match each page office to its catalog leaf (for the row owner cells).
      const matchByOffice = new Map<string, { terr: any | null; sub: any | null }>();
      for (const o of pageOffices as any[]) {
        const sub = subs.find((s: any) => orgMatchesLeaf(o, s, "subTerritory")) || null;
        const terr = territories.find((t: any) => orgMatchesLeaf(o, t, "territory")) || null;
        matchByOffice.set(String(o._id), { terr, sub });
      }

      // ── Assemble rows ────────────────────────────────────────────────────
      const businesses: any[] = [];
      for (const o of pageOffices as any[]) {
        const org = String(o._id);
        const volumeUsd = volByOrg.get(org) ?? 0;
        const feesUsd = feeByOrg.get(org) ?? 0;
        const earningsUsd = earnByOrg.get(org) ?? 0;
        const m = matchByOffice.get(org) ?? { terr: null, sub: null };
        businesses.push({
          id: org,
          name: o.name || null,
          icon: o.icon || null,
          location: {
            city: o.city || null,
            state: o.state || null,
            country: o.country || null,
            postalCode: o.postalCode || null,
          },
          founder: personFromUser(founderByOrg.get(org)),
          // Matched catalog leaf refs (present even when the leaf has no owner) —
          // let the frontend scope-filter by geoEntityId independent of ownership.
          territory: m.terr ? { id: String(m.terr._id), name: m.terr.name || null } : null,
          subTerritory: m.sub ? { id: String(m.sub._id), name: m.sub.name || null } : null,
          territoryOwner: ownerForLeaf(m.terr),
          subTerritoryOwner: ownerForLeaf(m.sub),
          volumeUsd,
          feesUsd,
          earningsUsd,
          transactions: txByOrg.get(org) ?? 0,
        });
      }

      res.json({
        scope,
        businesses,
        totals,
        page,
        limit,
        total: businessesCount,
        totalPages,
        // Echo the viewer filter so the FE can label the earnings column
        // ("My earnings" vs "Total earnings distributed"). Null when no
        // forUserEmail was passed.
        forUserEmail: viewerUserId ? normalizeEmail(forUserEmailRaw) : null,
      });
    } catch (err: any) {
      console.error("[franchise-api] country businesses error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// =========================================================================
// Scope catalog (drawer filter lists) — paginated + searchable + owner-enriched
// =========================================================================

/** Resolve the franchisee owner for a set of catalog leaves (territories or
 *  sub-territories) — ASSIGNMENT-FIRST (active FranchiseTerritory/GlobalAssignment
 *  by geoEntityId), else the legacy catalog ownerEmail. Returns a per-leaf lookup. */
async function resolveOwnersFor(
  leaves: any[]
): Promise<(leaf: any) => any | null> {
  const geoIds = leaves.map((l) => String(l._id));
  const ownerByGeo = new Map<string, { ownerUserId?: any; ownerEmail?: string }>();
  if (geoIds.length) {
    const [tA, gA] = await Promise.all([
      FranchiseTerritoryAssignment.find({ status: "active", geoEntityId: { $in: geoIds } })
        .select("geoEntityId ownerUserId ownerEmail")
        .lean(),
      FranchiseGlobalAssignment.find({ status: "active", geoEntityId: { $in: geoIds } })
        .select("geoEntityId ownerUserId ownerEmail")
        .lean(),
    ]);
    for (const a of gA as any[])
      if (a.geoEntityId) ownerByGeo.set(String(a.geoEntityId), { ownerUserId: a.ownerUserId, ownerEmail: a.ownerEmail });
    for (const a of tA as any[])
      if (a.geoEntityId) ownerByGeo.set(String(a.geoEntityId), { ownerUserId: a.ownerUserId, ownerEmail: a.ownerEmail });
  }
  const idSet = new Set<string>();
  const emailSet = new Set<string>();
  for (const a of ownerByGeo.values()) {
    if (a.ownerUserId) idSet.add(String(a.ownerUserId));
    else if (a.ownerEmail) emailSet.add(normalizeEmail(a.ownerEmail));
  }
  for (const l of leaves)
    if (!ownerByGeo.has(String(l._id)) && l.ownerEmail) emailSet.add(normalizeEmail(l.ownerEmail));

  const [byId, byEmail] = await Promise.all([
    idSet.size
      ? User.find({ _id: { $in: [...idSet] } }).select("name email phone country profilePicture").lean()
      : [],
    emailSet.size
      ? User.find({ email: { $in: [...emailSet].map((e) => new RegExp("^" + escapeRegex(e) + "$", "i")) } })
          .select("name email phone country profilePicture")
          .lean()
      : [],
  ]);
  const userById = new Map((byId as any[]).map((u) => [String(u._id), u]));
  const userByEmail = new Map((byEmail as any[]).map((u) => [normalizeEmail(u.email || ""), u]));
  const person = (u: any) =>
    u
      ? {
          userId: String(u._id),
          name: u.name || null,
          email: u.email || null,
          phone: u.phone || null,
          country: u.country || null,
          avatar: u.profilePicture || null,
        }
      : null;

  return (leaf: any) => {
    const a = ownerByGeo.get(String(leaf._id));
    let u: any = null;
    if (a?.ownerUserId) u = userById.get(String(a.ownerUserId));
    if (!u && a?.ownerEmail) u = userByEmail.get(normalizeEmail(a.ownerEmail));
    if (!u && leaf.ownerEmail) u = userByEmail.get(normalizeEmail(leaf.ownerEmail));
    const fallbackEmail = a?.ownerEmail || leaf.ownerEmail || null;
    if (!u && !fallbackEmail) return null;
    const base = person(u) ?? {
      userId: null, name: null, email: fallbackEmail, phone: null, country: null, avatar: null,
    };
    return { ...base, email: base.email ?? fallbackEmail };
  };
}

const pageOf = (q: any, def = 20) => {
  const limit = Math.max(1, Math.min(parseInt(String(q.limit ?? def), 10) || def, 100));
  const page = Math.max(1, parseInt(String(q.page ?? 1), 10) || 1);
  return { limit, page, skip: (page - 1) * limit };
};
const nameRe = (q: string) =>
  q ? new RegExp(escapeRegex(q.trim()), "i") : null;

/**
 * GET /franchise-api/scope/countries?q=&page=&limit=
 * All franchise countries for the "By Country" filter — searchable, ordered by
 * business count (active markets first). Each row carries business + territory
 * counts. Catalog is small (~200) so it's sorted/paged in memory.
 */
router.get("/scope/countries", async (req: Request, res: Response) => {
  try {
    const { limit, page, skip } = pageOf(req.query);
    const q = (req.query.q as string) || "";

    const [countries, orgAgg, terrAgg] = await Promise.all([
      FranchiseCountry.find(q ? { name: nameRe(q)! } : {})
        .select("name")
        .lean<any[]>(),
      Organization.aggregate([
        { $match: { country: { $type: "string", $ne: "" } } },
        { $group: { _id: { $toLower: "$country" }, n: { $sum: 1 } } },
      ]),
      FranchiseTerritory.aggregate([
        { $match: { country: { $type: "string", $ne: "" } } },
        { $group: { _id: { $toLower: "$country" }, n: { $sum: 1 } } },
      ]),
    ]);
    const bizByName = new Map((orgAgg as any[]).map((g) => [g._id, g.n]));
    const terrByName = new Map((terrAgg as any[]).map((g) => [g._id, g.n]));

    const enriched = countries
      .map((c: any) => ({
        id: String(c._id),
        name: c.name || null,
        businessCount: bizByName.get(String(c.name || "").toLowerCase()) || 0,
        territoryCount: terrByName.get(String(c.name || "").toLowerCase()) || 0,
      }))
      .sort(
        (a, b) =>
          b.businessCount - a.businessCount ||
          (a.name || "").localeCompare(b.name || "")
      );

    res.json({
      items: enriched.slice(skip, skip + limit),
      total: enriched.length,
      page,
      limit,
      hasMore: skip + limit < enriched.length,
    });
  } catch (err: any) {
    console.error("[franchise-api] scope/countries error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-api/scope/territories?country=&q=&page=&limit=
 * Territories for the "By Territory" filter. Scoped to a country when `country`
 * is given, else ALL territories. Searchable, paginated, owner-enriched.
 */
router.get("/scope/territories", async (req: Request, res: Response) => {
  try {
    const { limit, page, skip } = pageOf(req.query);
    const country = ((req.query.country as string) || "").trim();
    const q = (req.query.q as string) || "";
    const filter: Record<string, any> = {};
    if (country) filter.country = ciExact(country);
    if (q) filter.name = nameRe(q)!;

    const [rows, total] = await Promise.all([
      FranchiseTerritory.find(filter)
        .select("name country region ownerEmail")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean<any[]>(),
      FranchiseTerritory.countDocuments(filter),
    ]);
    const ownerFor = await resolveOwnersFor(rows);

    res.json({
      items: rows.map((t) => ({
        id: String(t._id),
        name: t.name || null,
        country: t.country || null,
        owner: ownerFor(t),
      })),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    });
  } catch (err: any) {
    console.error("[franchise-api] scope/territories error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-api/scope/sub-territories?country=&territory=&q=&page=&limit=
 * Sub-territories for the "By Sub Territory" filter. Scoped by `country` and/or
 * `territory` (parent territory NAME) when given, else ALL. Owner-enriched.
 */
router.get("/scope/sub-territories", async (req: Request, res: Response) => {
  try {
    const { limit, page, skip } = pageOf(req.query);
    const country = ((req.query.country as string) || "").trim();
    const territory = ((req.query.territory as string) || "").trim();
    const q = (req.query.q as string) || "";
    const filter: Record<string, any> = {};
    if (country) filter.country = ciExact(country);
    if (territory) filter.parentTerritory = ciExact(territory);
    if (q) filter.name = nameRe(q)!;

    const [rows, total] = await Promise.all([
      FranchiseSubTerritory.find(filter)
        .select("name country parentTerritory region ownerEmail")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean<any[]>(),
      FranchiseSubTerritory.countDocuments(filter),
    ]);
    const ownerFor = await resolveOwnersFor(rows);

    res.json({
      items: rows.map((s) => ({
        id: String(s._id),
        name: s.name || null,
        country: s.country || null,
        parentTerritory: s.parentTerritory || null,
        owner: ownerFor(s),
      })),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    });
  } catch (err: any) {
    console.error("[franchise-api] scope/sub-territories error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-api/owners/by-email/:email/offices
 *
 * Returns every office that falls under ANY entity owned by this email.
 * Each office is tagged with the most-specific entity it matched (sub →
 * territory → country), so the franchise UI can group by region.
 *
 * Implementation: pre-compute owned entities, build one merged $or, paginate
 * over Organizations, then post-process to tag each result.
 */
router.get(
  "/owners/by-email/:email/offices",
  async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.params.email || "");
      if (!email) {
        res.status(400).json({ error: "Missing email" });
        return;
      }

      const emailRegex = ciExact(email);

      const [countries, territories, subs] = await Promise.all([
        FranchiseCountry.find({ ownerEmail: emailRegex })
          .select("_id name")
          .lean(),
        FranchiseTerritory.find({ ownerEmail: emailRegex })
          .select("_id name country")
          .lean(),
        FranchiseSubTerritory.find({ ownerEmail: emailRegex })
          .select("_id name country parentTerritory zipCodes")
          .lean(),
      ]);

      if (
        countries.length === 0 &&
        territories.length === 0 &&
        subs.length === 0
      ) {
        res.json({ email, offices: [], nextCursor: null });
        return;
      }

      // For each owned entity, compute its leaves (the most granular layer of
      // its scope). An org "belongs to" the owned entity if it matches any of
      // that entity's leaves. matchedAt is tagged to the most-specific owned
      // entity that contains the match.
      const subLeaves: Array<{ owner: any; leaves: any[] }> = [];
      for (const s of subs) {
        const leaves = await findLeavesUnder("subTerritory", s);
        subLeaves.push({ owner: s, leaves: leaves.map((l) => l.entity) });
      }
      const terLeaves: Array<{ owner: any; leaves: any[]; leafTypes: EntityType[] }> = [];
      for (const t of territories) {
        const leaves = await findLeavesUnder("territory", t);
        terLeaves.push({
          owner: t,
          leaves: leaves.map((l) => l.entity),
          leafTypes: leaves.map((l) => l.type),
        });
      }
      const couLeaves: Array<{ owner: any; leaves: any[]; leafTypes: EntityType[] }> = [];
      for (const c of countries) {
        const leaves = await findLeavesUnder("country", c);
        couLeaves.push({
          owner: c,
          leaves: leaves.map((l) => l.entity),
          leafTypes: leaves.map((l) => l.type),
        });
      }

      const orBranches: Record<string, any>[] = [];
      for (const s of subLeaves) {
        const f = buildOrgFilterFromLeaves(
          s.leaves.map((l) => ({ type: "subTerritory" as const, entity: l }))
        );
        if (f) orBranches.push(f);
      }
      for (const t of terLeaves) {
        const f = buildOrgFilterFromLeaves(
          t.leaves.map((l, i) => ({ type: t.leafTypes[i], entity: l }))
        );
        if (f) orBranches.push(f);
      }
      for (const c of couLeaves) {
        const f = buildOrgFilterFromLeaves(
          c.leaves.map((l, i) => ({ type: c.leafTypes[i], entity: l }))
        );
        if (f) orBranches.push(f);
      }

      if (orBranches.length === 0) {
        res.json({ email, offices: [], nextCursor: null });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
      );
      const cursor = req.query.cursor as string | undefined;

      const query: Record<string, any> = {
        $or: orBranches,
      };
      if (cursor) {
        if (!Types.ObjectId.isValid(cursor)) {
          res.status(400).json({ error: "Invalid cursor" });
          return;
        }
        query._id = { $lt: new Types.ObjectId(cursor) };
      }

      const rows = await Organization.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .select(
          "name slug icon country state city postalCode latitude longitude createdAt"
        )
        .lean();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      // Tag each office with its most-specific owned-entity match.
      // Sub-territories (directly owned) → territories owned (via their leaves)
      // → countries owned (via their leaves).
      const tagged = items.map((o) => {
        const out: any = officePayload(o);

        // 1. Owned sub-territories first
        for (const s of subLeaves) {
          for (const leaf of s.leaves) {
            if (orgMatchesLeaf(o, leaf, "subTerritory")) {
              out.matchedAt = {
                entityType: "subTerritory",
                entityId: String(s.owner._id),
                entityName: s.owner.name,
              };
              return out;
            }
          }
        }

        // 2. Owned territories (via their leaves — sub-territories OR self)
        for (const t of terLeaves) {
          for (let i = 0; i < t.leaves.length; i++) {
            if (orgMatchesLeaf(o, t.leaves[i], t.leafTypes[i])) {
              out.matchedAt = {
                entityType: "territory",
                entityId: String(t.owner._id),
                entityName: t.owner.name,
              };
              return out;
            }
          }
        }

        // 3. Owned countries (via their leaves)
        for (const c of couLeaves) {
          for (let i = 0; i < c.leaves.length; i++) {
            if (orgMatchesLeaf(o, c.leaves[i], c.leafTypes[i])) {
              out.matchedAt = {
                entityType: "country",
                entityId: String(c.owner._id),
                entityName: c.owner.name,
              };
              return out;
            }
          }
        }

        // Shouldn't happen since the $or guaranteed at least one match.
        out.matchedAt = null;
        return out;
      });

      res.json({
        email,
        offices: tagged,
        nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      });
    } catch (err: any) {
      console.error("[franchise-api] owner offices error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// =========================================================================
// GaragePay dashboard — aggregate stats for the franchisor admin panel.
//
// Two endpoints, both API-key-authenticated (via the router.use above):
//
//   GET /franchise-api/dashboard/countries
//     → sidebar: countries with ≥1 office, each with (office, user) counts.
//       Cheap: two aggregations grouping by `Organization.country` and
//       `User.country`. Returns everything in one shot (~200 countries max).
//
//   GET /franchise-api/dashboard/summary?entityType=country&entityId=<id>
//     → main panel: user/business/affiliate/founder/shopper + payment
//       stats. If entityType+entityId omitted → global (platform-wide).
//       Currently supports entityType="country" only; territory/subTerritory
//       would need a mapping step (org→city→territory) that isn't 1:1
//       today. Guarded with 400 for other types.
//
// Scoping rule when a country is passed:
//   - "Users" / role-counts scoped by `User.country` (case-insensitive).
//   - "Businesses" (offices) scoped by `Organization.country`.
//   - Payments scoped by the BUYER's country (invoice.userId → user.country).
//     This mirrors "Canada tile shows what Canadian buyers spent" — the most
//     intuitive read for a country dashboard.
//
// Currency: sums in USD. Non-USD paid invoices are converted at a fixed
// approx rate (INR→USD via `convertCurrency`). Cross-currency accuracy is
// good-enough for a dashboard, not accounting-grade.
//
// "Fees" today = sum of GST + Apple's 30% cut on iOS invoices. Real payment-
// gateway fees (Razorpay/Stripe) are NOT stored on our invoices — they come
// from the gateway's own reports. Documented on the response with a
// `feesUsdIncludes` breakdown so consumers know what's counted.
// =========================================================================

/** Round to 2dp for money display. */
function usdRound(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Convert a smallest-unit amount in an arbitrary currency to USD dollars.
 * Best-effort — uses `services/currency` when non-USD; falls back to a
 * fixed INR rate if the service errors. Called from an aggregation loop
 * so we accept a per-call cost.
 */
async function toUsdDollars(smallestUnitAmount: number, currency: string): Promise<number> {
  const cur = (currency || "USD").toUpperCase();
  if (cur === "USD") return smallestUnitAmount / 100;
  try {
    const { convertToUsd } = await import("../utils/exchangeRate");
    // convertToUsd expects the human-decimal amount, so divide by 100 first.
    const { usdAmount } = await convertToUsd(smallestUnitAmount / 100, cur);
    return usdAmount;
  } catch {
    // Approx fallback so the dashboard doesn't 500 if the FX helper is
    // unavailable or the currency isn't supported. 83 INR per USD ~= 2026 rate.
    const rate = cur === "INR" ? 1 / 83 : 1;
    return (smallestUnitAmount / 100) * rate;
  }
}

/**
 * Sum an array of `{amount, currency}` rows to a single USD figure. Each
 * currency is converted once (batched by grouping) — avoids one FX call per row.
 */
async function sumInUsd(
  perCurrency: Array<{ amount: number; currency: string }>,
): Promise<number> {
  const byCurrency = new Map<string, number>();
  for (const row of perCurrency) {
    const cur = (row.currency || "USD").toUpperCase();
    byCurrency.set(cur, (byCurrency.get(cur) || 0) + (row.amount || 0));
  }
  let total = 0;
  for (const [cur, sum] of byCurrency.entries()) {
    total += await toUsdDollars(sum, cur);
  }
  return usdRound(total);
}

router.get("/dashboard/countries", async (_req: Request, res: Response) => {
  try {
    // One aggregation per collection, group by lowercased country to
    // dedupe "India"/"india". Cheap for our scale (<200 countries).
    const [officeGroups, userGroups] = await Promise.all([
      Organization.aggregate([
        { $match: { country: { $type: "string", $ne: "" } } },
        {
          $group: {
            _id: { $toLower: "$country" },
            displayName: { $first: "$country" },
            offices: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        { $match: { country: { $type: "string", $ne: "" } } },
        {
          $group: {
            _id: { $toLower: "$country" },
            displayName: { $first: "$country" },
            users: { $sum: 1 },
          },
        },
      ]),
    ]);

    const merged = new Map<
      string,
      { key: string; name: string; offices: number; users: number }
    >();
    for (const g of officeGroups as any[]) {
      merged.set(g._id, {
        key: g._id,
        name: g.displayName || g._id,
        offices: g.offices || 0,
        users: 0,
      });
    }
    for (const g of userGroups as any[]) {
      const row = merged.get(g._id);
      if (row) {
        row.users = g.users || 0;
        if (!row.name && g.displayName) row.name = g.displayName;
      } else {
        merged.set(g._id, {
          key: g._id,
          name: g.displayName || g._id,
          offices: 0,
          users: g.users || 0,
        });
      }
    }

    // Sort by offices desc (most active first), then alphabetical.
    const countries = Array.from(merged.values())
      .sort(
        (a, b) => b.offices - a.offices || a.name.localeCompare(b.name),
      )
      .map((c) => ({
        name: c.name,
        offices: c.offices,
        users: c.users,
      }));

    res.json({ countries });
  } catch (err: any) {
    console.error("[franchise-api] dashboard/countries error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/dashboard/summary", async (req: Request, res: Response) => {
  try {
    const entityType = (req.query.entityType as string | undefined)?.trim();
    const entityId = (req.query.entityId as string | undefined)?.trim();

    if (entityType && !["country", "territory", "subTerritory"].includes(entityType)) {
      res.status(400).json({
        error: "entityType must be one of: country, territory, subTerritory",
      });
      return;
    }
    if (entityType && !entityId) {
      res.status(400).json({ error: "entityId is required when entityType is set" });
      return;
    }

    // Resolve the FULL catalog doc (need name/country/parentTerritory/
    // zipCodes for the leaf matcher below). Handles String vs ObjectId
    // _id mixed shapes via the shared helper.
    let scopeEntity: any = null;
    let entityBlock: {
      type: "global" | "country" | "territory" | "subTerritory";
      id?: string;
      name?: string;
    };
    if (entityType && entityId) {
      scopeEntity = await loadCatalogEntity(entityType as EntityType, entityId);
      if (!scopeEntity?.name) {
        res.status(404).json({ error: `${entityType} not found in catalog` });
        return;
      }
      entityBlock = {
        type: entityType as EntityType,
        id: String(scopeEntity._id),
        name: scopeEntity.name,
      };
    } else {
      entityBlock = { type: "global" };
    }

    // Geo filter for users / orgs — same leaf-matcher used elsewhere.
    // subTerritory: postalCode ∈ zipCodes OR country+state+city.
    // territory:    country + state.
    // country:      country only.
    const scopeFilter =
      entityType && entityId
        ? buildOrgFilterForLeaf(entityType as EntityType, scopeEntity)
        : null;
    const userFilter: any = scopeFilter ? { ...scopeFilter } : {};
    const orgFilter: any = scopeFilter ? { ...scopeFilter } : {};

    // CD-attribution scope for money + shoppers. Every credit paid to a
    // franchisee is tagged with (entityType, entityId) at distribution
    // time (via resolveLeafFromAddress on the buyer's checkout-time
    // address). We hold the scoped CD ids and their distinct buyer ids —
    // used by the payment aggregation (via CD.saleAmount / platformFeeAmount
    // directly, since Invoice.paymentId doesn't line up with CD.paymentId)
    // and by the shoppers count.
    let scopedCdIds: Types.ObjectId[] | null = null;
    let scopedBuyerIds: Types.ObjectId[] | null = null;
    if (entityType && entityId) {
      scopedCdIds = ((await TerritoryWalletTransaction.distinct(
        "relatedCommissionDistributionId",
        { entityType, entityId, type: "credit", status: "completed" },
      )) as any as Types.ObjectId[]).filter(Boolean);
      const cdBuyers = await CommissionDistribution.find({
        _id: { $in: scopedCdIds },
      })
        .select("customerId")
        .lean<Array<{ customerId?: Types.ObjectId }>>();
      scopedBuyerIds = Array.from(
        new Set(cdBuyers.map((c) => c.customerId).filter(Boolean).map((id) => String(id))),
      ).map((s) => new Types.ObjectId(s));
    }

    // ── General stats ────────────────────────────────────────────────
    const [
      users,
      businesses,
      founders,
      affiliates,
      // "Shoppers" = users who paid at least one invoice. Computed via
      // distinct userId on paid invoices (scoped to buyer country).
      shoppersAgg,
    ] = await Promise.all([
      User.countDocuments(userFilter),
      Organization.countDocuments(orgFilter),
      User.countDocuments({
        ...userFilter,
        "organizations.role": "founder",
      }),
      User.countDocuments({
        ...userFilter,
        affiliateId: { $exists: true, $ne: null },
      }),
      (async () => {
        // Scoped: shoppers = distinct buyers who paid an invoice that
        // produced a commission attributed to this entity. Global: distinct
        // buyers who paid any invoice.
        if (scopedBuyerIds) return scopedBuyerIds.length;
        const rows = await Invoice.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: "$userId" } },
          { $count: "n" },
        ]);
        return rows[0]?.n || 0;
      })(),
    ]);

    // ── Payment stats ────────────────────────────────────────────────
    // Scoped: aggregate Invoices filtered by userId ∈ scopedBuyerIds
    // (buyers who paid a commission attributed to this entity). This is
    // a proxy — includes every invoice by those buyers, not just the ones
    // producing commissions here — because Invoice.paymentId doesn't line
    // up with CD.paymentId (CD uses a compound "razorpayId_itemId" key).
    // Global: no filter, all invoices.
    const paidMatch: any = { status: "paid" };
    if (scopedBuyerIds) paidMatch.userId = { $in: scopedBuyerIds };

    // Platform's $650 floor per franchise sale (System A + B). Every dollar
    // of a franchise invoice up to $650 lands in Shorupan's platform wallet —
    // it's real platform revenue, so it counts as a "fee" in this rollup.
    // Franchise invoices are always USD-denominated; the floor is USD cents.
    const FRANCHISE_ITEM_TYPES = ["franchise_territory", "franchise_global"];
    const FRANCHISE_FLOOR_USD_CENTS = 65000;
    const isFranchiseInvoiceExpr = {
      $anyElementTrue: {
        $map: {
          input: { $ifNull: ["$lineItems", []] },
          as: "li",
          in: { $in: ["$$li.itemType", FRANCHISE_ITEM_TYPES] },
        },
      },
    };
    const franchiseFloorSum = {
      $sum: {
        $cond: [
          isFranchiseInvoiceExpr,
          { $min: ["$totalAmount", FRANCHISE_FLOOR_USD_CENTS] },
          0,
        ],
      },
    };

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [allTimeAgg, last30Agg] = await Promise.all([
      Invoice.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: "$itemCurrency",
            volume: { $sum: "$totalAmount" }, // smallest-unit
            gst: { $sum: { $ifNull: ["$gst.amount", 0] } },
            appleFee: { $sum: { $ifNull: ["$metadata.appleFee.amount", 0] } },
            franchiseFloor: franchiseFloorSum,
            transactions: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { ...paidMatch, paidAt: { $gte: since30 } } },
        {
          $group: {
            _id: "$itemCurrency",
            volume: { $sum: "$totalAmount" },
            gst: { $sum: { $ifNull: ["$gst.amount", 0] } },
            appleFee: { $sum: { $ifNull: ["$metadata.appleFee.amount", 0] } },
            franchiseFloor: franchiseFloorSum,
            transactions: { $sum: 1 },
          },
        },
      ]),
    ]);

    const volumeUsdAll = await sumInUsd(
      (allTimeAgg as any[]).map((g) => ({
        amount: g.volume || 0,
        currency: g._id || "USD",
      })),
    );
    const feesUsdAll = await sumInUsd(
      (allTimeAgg as any[]).flatMap((g) => [
        { amount: g.gst || 0, currency: g._id || "USD" },
        { amount: g.appleFee || 0, currency: g._id || "USD" },
        { amount: g.franchiseFloor || 0, currency: "USD" },
      ]),
    );
    const txAll = (allTimeAgg as any[]).reduce(
      (s, g) => s + (g.transactions || 0),
      0,
    );
    const volumeUsd30 = await sumInUsd(
      (last30Agg as any[]).map((g) => ({
        amount: g.volume || 0,
        currency: g._id || "USD",
      })),
    );
    const feesUsd30 = await sumInUsd(
      (last30Agg as any[]).flatMap((g) => [
        { amount: g.gst || 0, currency: g._id || "USD" },
        { amount: g.appleFee || 0, currency: g._id || "USD" },
        { amount: g.franchiseFloor || 0, currency: "USD" },
      ]),
    );
    const tx30 = (last30Agg as any[]).reduce(
      (s, g) => s + (g.transactions || 0),
      0,
    );

    res.json({
      entity: entityBlock,
      general: {
        users,
        businesses,
        affiliates,
        founders,
        shoppers: shoppersAgg,
      },
      payments: {
        volumeUsd: volumeUsdAll,
        transactions: txAll,
        feesUsd: feesUsdAll,
        // Doc breakdown so consumers know what's counted. Real gateway
        // (Razorpay / Stripe) fees are NOT here — those come from the
        // gateway's own settlement reports.
        feesUsdIncludes: ["gst", "appleFee", "franchisePlatformFloor"],
        last30Days: {
          volumeUsd: volumeUsd30,
          transactions: tx30,
          feesUsd: feesUsd30,
        },
      },
    });
  } catch (err: any) {
    console.error("[franchise-api] dashboard/summary error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-api/dashboard/garagepay-stats
 *
 * Slimmer scoped stats endpoint powering the GaragePay franchisor dashboard's
 * top-of-page cards ("Transactional Volume", "# Of Businesses", "GaragePay
 * Fees", "My Total Earnings"). Same numeric formulas as /dashboard/summary,
 * but supports THREE scope levels (country / territory / subTerritory) and
 * adds a per-user earnings figure.
 *
 * Sub-territory responses ALSO include a `transactions[]` array (top 20
 * recent paid invoices from buyers in that city) — sub-territories are small
 * enough that showing the raw transaction feed is useful, and the aggregates
 * alone at that granularity aren't very informative.
 *
 * Auth: X-Franchise-API-Key (inherited from router-level middleware).
 *
 * Query params:
 *   ?entityType=country|territory|subTerritory|global   (default: global)
 *   ?entityId=<catalog _id>                             (required unless global)
 *   ?forUserEmail=<email>                               (optional; enables myTotalEarningsUsd)
 *
 * Scope → filter map:
 *   country      → Organization.country matches FranchiseCountry.name
 *   territory    → Organization.state   matches FranchiseTerritory.name
 *   subTerritory → Organization.city    matches FranchiseSubTerritory.name
 *
 * `myTotalEarningsUsd` sums TerritoryWalletTransaction credits where
 * (entityType, entityId) exactly matches the requested scope — this captures
 * the owner's direct slice PLUS any cascaded slices that landed on their wallet
 * (cascaded rows carry the owner's entityType/entityId per the wallet-tx model
 * doc comment). Requires forUserEmail; null otherwise. Skipped when scope=global
 * (earnings aren't defined without an entity).
 */
router.get(
  "/dashboard/garagepay-stats",
  async (req: Request, res: Response) => {
    try {
      const entityType = (req.query.entityType as string | undefined)?.trim() || "global";
      const entityId = (req.query.entityId as string | undefined)?.trim();
      const forUserEmail = (req.query.forUserEmail as string | undefined)?.trim();

      if (!["country", "territory", "subTerritory", "global"].includes(entityType)) {
        res.status(400).json({
          error: "entityType must be one of: country, territory, subTerritory, global",
        });
        return;
      }
      if (entityType !== "global" && !entityId) {
        res.status(400).json({ error: "entityId is required when entityType is not global" });
        return;
      }

      // ── Resolve scope from catalog ──────────────────────────────────
      let scopeEntity: any = null;
      let scopeBlock: { type: string; id?: string; name?: string };

      if (entityType === "global") {
        scopeBlock = { type: "global" };
      } else {
        // Load the FULL catalog doc — we need country/parentTerritory/
        // zipCodes for the leaf matcher below, not just `name`.
        // loadCatalogEntity already handles the String-vs-ObjectId `_id`
        // mixed-type mismatch across mirrored collections.
        scopeEntity = await loadCatalogEntity(
          entityType as EntityType,
          entityId!,
        );
        if (!scopeEntity?.name) {
          res.status(404).json({ error: `${entityType} not found in catalog` });
          return;
        }
        scopeBlock = {
          type: entityType,
          id: entityId!,
          name: scopeEntity.name,
        };
      }

      // ── Build the org / user filter using the leaf matcher ──────────
      // Previously used a naive `orgFilter[{country|state|city}] = name`
      // block, which returned ZERO buyers/orgs for sub-territories
      // (Organization.city text rarely matches sub-territory names —
      // sellers type "Bengaluru" but the sub-territory is "Bengaluru
      // Rural"). Now uses buildOrgFilterForLeaf which matches subTerr by
      // postalCode ∈ zipCodes OR the full country+state+city triple, and
      // territories by country+state. Country still matches by name.
      const scopeFilter =
        entityType !== "global"
          ? buildOrgFilterForLeaf(entityType as EntityType, scopeEntity)
          : null;
      const orgFilter: any = scopeFilter ? { ...scopeFilter } : {};
      const userFilter: any = scopeFilter ? { ...scopeFilter } : {};

      // Buyer-ids-in-scope for invoice aggregations.
      let buyerIdsInScope: Types.ObjectId[] | null = null;
      if (scopeFilter) {
        const buyers = await User.find(userFilter)
          .select("_id")
          .lean<Array<{ _id: Types.ObjectId }>>();
        buyerIdsInScope = buyers.map((u) => u._id);
      }

      // ── Pre-compute CD scope once — reused by invoice + payout math ──
      // Scope the metrics via TWT.entityType/entityId attribution rather
      // than the buyer's current profile geo. A buyer whose User.postalCode
      // / city has moved out of the sub-territory (or was resolved via a
      // checkout-time address snapshot that differs from their saved
      // profile) still counts as long as the commission distributor
      // originally attributed the payout to this entity.
      let scopedCdIds: Types.ObjectId[] | null = null;
      let scopedPaymentIds: string[] | null = null;
      if (entityType !== "global" && entityId) {
        scopedCdIds = (await TerritoryWalletTransaction.distinct(
          "relatedCommissionDistributionId",
          { entityType, entityId, type: "credit", status: "completed" },
        )) as any as Types.ObjectId[];
        scopedCdIds = (scopedCdIds || []).filter(Boolean);
        scopedPaymentIds = (
          await CommissionDistribution.find({ _id: { $in: scopedCdIds } })
            .select("paymentId")
            .lean<Array<{ paymentId?: string | null }>>()
        )
          .map((cd) => cd.paymentId)
          .filter((p): p is string => !!p);
      }

      // ── Payment aggregation (volume + fees + franchise floor) ───────
      // Scoped queries use CD.customerId → Invoice.userId. This is a proxy
      // (every invoice by these buyers, not JUST the ones producing
      // commissions here) but it's necessary because CD.paymentId is a
      // compound "razorpayId_itemId" that doesn't line up with
      // Invoice.razorpayPaymentId. Global scope: no filter, all invoices.
      let scopedBuyerIds: Types.ObjectId[] | null = null;
      if (scopedCdIds) {
        const cdBuyers = await CommissionDistribution.find({
          _id: { $in: scopedCdIds },
        })
          .select("customerId")
          .lean<Array<{ customerId?: Types.ObjectId }>>();
        scopedBuyerIds = Array.from(
          new Set(
            cdBuyers
              .map((c) => c.customerId)
              .filter(Boolean)
              .map((id) => String(id)),
          ),
        ).map((s) => new Types.ObjectId(s));
      }
      const paidMatch: any = { status: "paid" };
      if (scopedBuyerIds) paidMatch.userId = { $in: scopedBuyerIds };

      // Same franchise-floor helper as /dashboard/summary. $650 per franchise
      // sale goes to the platform — real revenue, counted as a "fee".
      const FRANCHISE_ITEM_TYPES = ["franchise_territory", "franchise_global"];
      const FRANCHISE_FLOOR_USD_CENTS = 65000;
      const isFranchiseInvoiceExpr = {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$lineItems", []] },
            as: "li",
            in: { $in: ["$$li.itemType", FRANCHISE_ITEM_TYPES] },
          },
        },
      };

      // ── Total-sales-volume breakdown (2026-08-03) ────────────────────
      // Two figures for the /garagepay landing:
      //   INCLUDING garage products = every paid invoice EXCEPT wallet
      //     top-ups (top-ups are users pre-loading their own funds, not
      //     new commerce).
      //   EXCLUDING garage products = only third-party seller-org sales;
      //     drops the Garage-owned SKUs below.
      // Classification is by itemType (fixed list) per product decision.
      // A multi-line invoice counts as "Garage" if ANY line's itemType
      // is in the Garage set — matches the $anyElementTrue pattern the
      // franchise-floor helper above already uses.
      const GARAGE_HQ_ITEM_TYPES = [
        "unilevel_plus",
        "third_party_subscription",
        "office_plan",
        "office_addon",
        "franchise_global",
      ];
      const WALLET_TOPUP_ITEM_TYPE = "store_wallet_topup";
      const isGarageInvoiceExpr = {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$lineItems", []] },
            as: "li",
            in: { $in: ["$$li.itemType", GARAGE_HQ_ITEM_TYPES] },
          },
        },
      };
      const isWalletTopupInvoiceExpr = {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$lineItems", []] },
            as: "li",
            in: { $eq: ["$$li.itemType", WALLET_TOPUP_ITEM_TYPE] },
          },
        },
      };

      // Per-SKU breakdown predicates for the 4 additional fields.
      // Each returns true if ANY line-item's itemType is in the given set.
      const anyLineIsExpr = (types: string[]) => ({
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$lineItems", []] },
            as: "li",
            in: { $in: ["$$li.itemType", types] },
          },
        },
      });
      // office_plan = base office subscription. office_addon = extra
      // conference-room subscriptions ($5/room). Both are office-side
      // recurring bills → grouped under "office subscription".
      const OFFICE_SUB_TYPES = ["office_plan", "office_addon"];
      // Matches the earlier "Garage franchise" decision: only franchise_global
      // (platform-level territory sales). franchise_program + franchise_territory
      // are per-office franchise programs and are excluded from this figure.
      const FRANCHISEE_SUB_TYPES = ["franchise_global"];

      const paidAgg = await Invoice.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: "$itemCurrency",
            volume: { $sum: "$totalAmount" },
            gst: { $sum: { $ifNull: ["$gst.amount", 0] } },
            appleFee: { $sum: { $ifNull: ["$metadata.appleFee.amount", 0] } },
            franchiseFloor: {
              $sum: {
                $cond: [
                  isFranchiseInvoiceExpr,
                  { $min: ["$totalAmount", FRANCHISE_FLOOR_USD_CENTS] },
                  0,
                ],
              },
            },
            salesInclGarage: {
              $sum: {
                $cond: [isWalletTopupInvoiceExpr, 0, "$totalAmount"],
              },
            },
            salesExclGarage: {
              $sum: {
                $cond: [
                  { $or: [isWalletTopupInvoiceExpr, isGarageInvoiceExpr] },
                  0,
                  "$totalAmount",
                ],
              },
            },
            // Garage-only sales — invoices whose primary line-item is a
            // Garage SKU (and not a wallet top-up). Independent accumulator
            // instead of `incl − excl` in JS so the value is exact per
            // currency group before FX conversion.
            salesGarageOnly: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      isGarageInvoiceExpr,
                      { $not: [isWalletTopupInvoiceExpr] },
                    ],
                  },
                  "$totalAmount",
                  0,
                ],
              },
            },
            // Per-SKU breakdowns (sum to salesGarageOnly, modulo FX rounding).
            salesUnilevel: {
              $sum: {
                $cond: [anyLineIsExpr(["unilevel_plus"]), "$totalAmount", 0],
              },
            },
            salesNetworkChain: {
              $sum: {
                $cond: [
                  anyLineIsExpr(["third_party_subscription"]),
                  "$totalAmount",
                  0,
                ],
              },
            },
            salesOfficeSub: {
              $sum: {
                $cond: [anyLineIsExpr(OFFICE_SUB_TYPES), "$totalAmount", 0],
              },
            },
            salesFranchiseeSub: {
              $sum: {
                $cond: [anyLineIsExpr(FRANCHISEE_SUB_TYPES), "$totalAmount", 0],
              },
            },
            // Count of paid invoices that make up salesInclGarage
            // (i.e. every paid invoice except wallet top-ups).
            txCountInclGarage: {
              $sum: {
                $cond: [isWalletTopupInvoiceExpr, 0, 1],
              },
            },
          },
        },
      ]);

      // Small helper to build a per-currency sum-in-USD from one accumulator.
      const sumField = (field: string) =>
        sumInUsd(
          (paidAgg as any[]).map((g) => ({
            amount: g[field] || 0,
            currency: g._id || "USD",
          })),
        );

      const [
        businessesCount,
        transactionalVolumeUsd,
        garagePayFeesUsd,
        totalSalesVolumeIncludingGarageProductsUsd,
        totalSalesVolumeExcludingGarageProductsUsd,
        totalGarageProductsSalesVolumeUsd,
        totalUnilevelSalesVolumeUsd,
        totalNetworkChainSalesVolumeUsd,
        totalOfficeSubscriptionSalesVolumeUsd,
        totalFranchiseeSubscriptionSalesVolumeUsd,
      ] = await Promise.all([
        Organization.countDocuments(orgFilter),
        sumField("volume"),
        sumInUsd(
          (paidAgg as any[]).flatMap((g) => [
            { amount: g.gst || 0, currency: g._id || "USD" },
            { amount: g.appleFee || 0, currency: g._id || "USD" },
            { amount: g.franchiseFloor || 0, currency: "USD" },
          ]),
        ),
        sumField("salesInclGarage"),
        sumField("salesExclGarage"),
        sumField("salesGarageOnly"),
        sumField("salesUnilevel"),
        sumField("salesNetworkChain"),
        sumField("salesOfficeSub"),
        sumField("salesFranchiseeSub"),
      ]);

      // Two more derived fields — cheap computations off the same paidAgg.
      // totalTransactions: sum of the count accumulator across every
      //   currency group (# of paid invoices excluding wallet top-ups).
      // total5PercentFeesUsd: platform's 5% cut of every sale, computed
      //   as 5% × totalSalesVolumeIncludingGarageProductsUsd. Not read
      //   from CommissionDistribution.platformFeeAmount so per-org fee
      //   overrides don't distort the "at 5%" narrative the FE card
      //   displays. If a truer number is needed, add a separate
      //   `totalPlatformFeesActualUsd` that sums the CD field.
      const totalTransactions = (paidAgg as any[]).reduce(
        (n, g) => n + (g.txCountInclGarage || 0),
        0,
      );
      const total5PercentFeesUsd = round2(
        totalSalesVolumeIncludingGarageProductsUsd * 0.05,
      );

      // ── My Total Earnings (optional, entity-scoped only) ────────────
      let myTotalEarningsUsd: number | null = null;
      if (forUserEmail && entityType !== "global") {
        const emailNorm = forUserEmail.toLowerCase();
        const user = await User.findOne({
          email: new RegExp("^" + escapeRegex(emailNorm) + "$", "i"),
        })
          .select("_id")
          .lean<{ _id: Types.ObjectId }>();
        if (user) {
          const earnAgg = await TerritoryWalletTransaction.aggregate([
            {
              $match: {
                userId: user._id,
                entityType,
                entityId: entityId!,
                type: "credit",
                status: "completed",
              },
            },
            {
              $group: {
                _id: "$currency",
                total: { $sum: "$amount" },
              },
            },
          ]);
          // TerritoryWalletTransaction.amount is stored in DOLLARS (not
          // smallest-unit cents) per its schema comment, so pass 1.0-scale
          // rows through the same USD converter directly.
          myTotalEarningsUsd = 0;
          for (const row of earnAgg as any[]) {
            const cur = (row._id || "USD").toUpperCase();
            if (cur === "USD") {
              myTotalEarningsUsd += Number(row.total) || 0;
            } else {
              // Non-USD wallet rows are uncommon — convert via cents helper
              // by re-scaling to smallest unit temporarily.
              const cents = Math.round((Number(row.total) || 0) * 100);
              myTotalEarningsUsd += await toUsdDollars(cents, cur);
            }
          }
          myTotalEarningsUsd = round2(myTotalEarningsUsd);
        } else {
          myTotalEarningsUsd = 0; // user not found — no earnings, but stat is defined
        }
      }

      // ── Franchisee payouts (scope-aware) ─────────────────────────────
      // Every credit on TerritoryWalletTransaction is a payout to a
      // franchise owner (sub-territory / territory / country slice, either
      // System A "global" or System B "founder_program"). We compute two
      // pairs of figures:
      //   ALL-LEVELS  → totalPaidOutToGarageFranchiseesUsd +
      //                 transactionsWithGarageFranchiseePayout
      //   COUNTRY ONLY → totalPaidOutToCountryFranchiseesUsd +
      //                  transactionsWithCountryFranchiseePayout
      //     (entityType === "country" — payments to whoever owns a country
      //      catalog entity; includes cascaded-up rows from unowned lower
      //      levels since those still land on the country owner's wallet.)
      //
      // Scope filter: aggregate ALL TWT rows for CDs that produced a
      // payout on this entity. Captures every geo-level (sub + territory
      // + country) payout for each such purchase — the "cascade-up
      // breakdown" the FE uses. Global scope → no CD filter.
      // `scopedCdIds` was already computed above (reused).
      const baseCredMatch: Record<string, any> = {
        type: "credit",
        status: "completed",
      };
      if (scopedCdIds) {
        baseCredMatch.relatedCommissionDistributionId = { $in: scopedCdIds };
      }
      const runPayoutFacet = async (extraMatch: Record<string, any> = {}) => {
        const agg = await TerritoryWalletTransaction.aggregate([
          { $match: { ...baseCredMatch, ...extraMatch } },
          {
            $facet: {
              totalsByCurrency: [
                { $group: { _id: "$currency", total: { $sum: "$amount" } } },
              ],
              distinctOrders: [
                {
                  $group: {
                    _id: {
                      $ifNull: [
                        "$relatedCommissionDistributionId",
                        { $ifNull: ["$relatedPaymentId", "$_id"] },
                      ],
                    },
                  },
                },
                { $count: "n" },
              ],
            },
          },
        ]);
        const facet = (agg as any[])[0] || {};
        let totalUsd = 0;
        for (const row of (facet.totalsByCurrency ?? []) as any[]) {
          const cur = (row._id || "USD").toUpperCase();
          if (cur === "USD") totalUsd += Number(row.total) || 0;
          else {
            const cents = Math.round((Number(row.total) || 0) * 100);
            totalUsd += await toUsdDollars(cents, cur);
          }
        }
        return {
          totalUsd: round2(totalUsd),
          orderCount: (facet.distinctOrders ?? [])[0]?.n || 0,
        };
      };

      const allPayouts = await runPayoutFacet();
      const countryPayouts = await runPayoutFacet({ entityType: "country" });
      const territoryPayouts = await runPayoutFacet({ entityType: "territory" });
      const subTerritoryPayouts = await runPayoutFacet({
        entityType: "subTerritory",
      });
      const totalPaidOutToGarageFranchiseesUsd = allPayouts.totalUsd;
      const transactionsWithGarageFranchiseePayout = allPayouts.orderCount;
      const totalPaidOutToCountryFranchiseesUsd = countryPayouts.totalUsd;
      const transactionsWithCountryFranchiseePayout = countryPayouts.orderCount;
      const totalPaidOutToTerritoryFranchiseesUsd = territoryPayouts.totalUsd;
      const transactionsWithTerritoryFranchiseePayout =
        territoryPayouts.orderCount;
      const totalPaidOutToSubTerritoryFranchiseesUsd =
        subTerritoryPayouts.totalUsd;
      const transactionsWithSubTerritoryFranchiseePayout =
        subTerritoryPayouts.orderCount;

      // ── Sub-territory transactions list (top 20 recent) ─────────────
      // Uses the same CD-attribution scope as the money aggregations
      // above, so buyers with moved profiles still appear.
      let transactions: any[] | undefined;
      if (entityType === "subTerritory" && scopedPaymentIds) {
        const rows = await Invoice.find({
          status: "paid",
          paymentId: { $in: scopedPaymentIds },
        })
          .sort({ paidAt: -1 })
          .limit(20)
          .select(
            "_id invoiceNumber userId totalAmount itemCurrency paidAt lineItems",
          )
          .lean<any[]>();
        const buyerLookup = rows.length
          ? await User.find({ _id: { $in: rows.map((r) => r.userId) } })
              .select("_id email name")
              .lean<any[]>()
          : [];
        const buyerById = new Map(
          buyerLookup.map((u: any) => [String(u._id), u]),
        );
        transactions = await Promise.all(
          rows.map(async (r: any) => {
            const buyer = buyerById.get(String(r.userId));
            const cur = r.itemCurrency || "USD";
            const amountUsd = await toUsdDollars(r.totalAmount || 0, cur);
            return {
              invoiceId: String(r._id),
              invoiceNumber: r.invoiceNumber || null,
              buyerEmail: buyer?.email || null,
              buyerName: buyer?.name || null,
              amountUsd: round2(amountUsd),
              itemName: r.lineItems?.[0]?.itemName || null,
              itemType: r.lineItems?.[0]?.itemType || null,
              paidAt: r.paidAt || null,
            };
          }),
        );
      }

      const body: any = {
        scope: scopeBlock,
        stats: {
          transactionalVolumeUsd,
          businessesCount,
          garagePayFeesUsd,
          myTotalEarningsUsd,
          feesUsdIncludes: ["gst", "appleFee", "franchisePlatformFloor"],
          // Three split-out totals for the /garagepay landing (2026-08-03).
          // All respect the current scope (buyer country/state/city).
          //   including = every paid invoice minus store_wallet_topup
          //   excluding = same minus Garage-owned SKUs (unilevel_plus,
          //     third_party_subscription, office_plan, office_addon,
          //     franchise_global)
          //   garage-only = just the Garage-owned SKUs, so
          //     including = excluding + garage-only (within FX rounding).
          totalSalesVolumeIncludingGarageProductsUsd,
          totalSalesVolumeExcludingGarageProductsUsd,
          totalGarageProductsSalesVolumeUsd,
          // Per-SKU breakdowns — together sum to totalGarageProductsSalesVolumeUsd
          // (within FX-rounding noise). Values are always present, respect
          // the current scope filter.
          totalUnilevelSalesVolumeUsd,
          totalNetworkChainSalesVolumeUsd,          // third_party_subscription
          totalOfficeSubscriptionSalesVolumeUsd,    // office_plan + office_addon
          totalFranchiseeSubscriptionSalesVolumeUsd, // franchise_global
          // Count of paid invoices behind totalSalesVolumeIncludingGarageProductsUsd
          // (excludes wallet top-ups, same scope filter).
          totalTransactions,
          // 5% × totalSalesVolumeIncludingGarageProductsUsd — the fixed
          // platform-cut narrative for the /garagepay landing card.
          total5PercentFeesUsd,
          // Sum of TerritoryWalletTransaction credit amounts (all
          // franchisee slice payouts — sub / territory / country, both
          // System A + founder-program). Scope-filtered via the buyer's
          // CommissionDistribution.customerId.
          totalPaidOutToGarageFranchiseesUsd,
          // Distinct order count that produced at least one franchisee
          // credit — keyed by relatedCommissionDistributionId (or
          // relatedPaymentId, or row _id) to dedupe the 3 geo-slice rows
          // that a single sale writes into one order.
          transactionsWithGarageFranchiseePayout,
          // COUNTRY-ONLY variants — same math but restricted to
          // entityType === "country" (payments landing on country
          // franchisees; includes cascaded-up rows).
          totalPaidOutToCountryFranchiseesUsd,
          transactionsWithCountryFranchiseePayout,
          // TERRITORY-ONLY variants — entityType === "territory".
          totalPaidOutToTerritoryFranchiseesUsd,
          transactionsWithTerritoryFranchiseePayout,
          // SUB-TERRITORY-ONLY variants — entityType === "subTerritory".
          totalPaidOutToSubTerritoryFranchiseesUsd,
          transactionsWithSubTerritoryFranchiseePayout,
        },
      };
      if (transactions) body.transactions = transactions;
      res.json(body);
    } catch (err: any) {
      console.error("[franchise-api] dashboard/garagepay-stats error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * Load a franchise catalog row tolerating BOTH `_id` shapes (String and
 * ObjectId rows coexist in these collections — see franchiseCatalogSync.ts).
 * Returns the raw doc (needs `country` / `parentTerritory` / `zipCodes` for
 * the org-geo filter), not just the name.
 */
/**
 * Strip IEEE-754 noise (0.07800000000000001 → 0.078) while KEEPING sub-cent
 * precision — territory slices are exact percentages of the platform fee and
 * are routinely worth fractions of a cent.
 */
function exactMoney(n: number): number {
  return Math.round((Number(n) || 0) * 1e6) / 1e6;
}

async function loadCatalogEntity(
  entityType: EntityType,
  entityId: string,
): Promise<any | null> {
  const Model: any =
    entityType === "country"
      ? FranchiseCountry
      : entityType === "territory"
        ? FranchiseTerritory
        : FranchiseSubTerritory;
  let row: any = await Model.findById(entityId).lean();
  if (!row && /^[0-9a-fA-F]{24}$/.test(entityId)) {
    row = await Model.collection.findOne({ _id: new Types.ObjectId(entityId) });
  }
  return row || null;
}

/**
 * GET /franchise-api/dashboard/franchise-wallet/transactions
 *
 * The "Recent Transactions" feed for the franchise vault / GaragePay dashboard.
 * Same underlying rows as `/wallets/by-email/:email/transactions`, but
 * (a) scopable to a country / territory / sub-territory by WHERE THE SALE
 * HAPPENED, and (b) enriched with the full commission math for the purchase
 * order that produced each row (order total → platform fee → this owner's
 * slice), plus the buyer and the selling office.
 *
 * Auth: X-Franchise-API-Key (router-level middleware).
 *
 * Query params
 *   forUserEmail | email  wallet owner to scope to. Optional — omit for the
 *                         platform-wide feed in that geo (every owner's rows).
 *   entityType            country | territory | subTerritory | global (default global)
 *   entityId              catalog _id — required unless entityType=global
 *   matchBy               any (default) | location | attribution
 *   source                all (default) | global | founder_program
 *   type                  credit | debit | withdrawal (default: all)
 *   status                completed | pending | failed | reversed (default: all)
 *   from, to              ISO dates filtering on createdAt (inclusive)
 *   limit                 1..200 (default 50)
 *   cursor                _id of the last row from the previous page
 *   includeSummary        "true" → adds a `summary` block for the WHOLE
 *                         filtered set (not just the current page)
 *
 * How the geo filter works (`matchBy`)
 *   - `attribution` — rows whose (entityType, entityId) IS the requested
 *     entity. That is "money that landed on this entity's owner", and it's the
 *     only way to catch buyer-driven sub-territory slices (the global split
 *     resolves the sub slice from the BUYER's pincode but doesn't store the
 *     buyer on the row).
 *   - `location` — rows whose SELLING OFFICE sits inside the requested geo
 *     (relatedOrgId / franchiseOfficeId ∈ offices matching country / country+
 *     state / country+state+city-or-zip). This is what surfaces a
 *     sub-territory-attributed row when you ask for its parent territory.
 *   - `any` (default) — the union of both, i.e. "every commission row this
 *     geo produced or received".
 *
 * Money: every field is USD dollars. Commission distribution converts the sale
 * to USD before splitting and TerritoryWallet rows are USD-only, so no FX
 * conversion happens here (unlike /dashboard/summary, which reads raw invoices
 * in smallest units).
 *
 * Commission base differs by source and is labelled per row:
 *   - global          → splitPercentage is a % of the PLATFORM FEE (15/5/5).
 *   - founder_program → splitPercentage is a % of the SALE PRINCIPAL, capped
 *     by the selling office's gross.
 * `effectivePercentOfOrder` is always amount ÷ order total, so the two are
 * comparable in one list.
 */
router.get(
  "/dashboard/franchise-wallet/transactions",
  async (req: Request, res: Response) => {
    try {
      const entityType =
        (req.query.entityType as string | undefined)?.trim() || "global";
      const entityId = (req.query.entityId as string | undefined)?.trim();
      const emailRaw = (
        (req.query.forUserEmail ?? req.query.email) as string | undefined
      )?.trim();
      const matchBy = (
        (req.query.matchBy as string | undefined)?.trim() || "any"
      ).toLowerCase();
      const source = (
        (req.query.source as string | undefined)?.trim() || "all"
      ).toLowerCase();
      const type = (req.query.type as string | undefined)?.trim();
      const status = (req.query.status as string | undefined)?.trim();
      const fromRaw = (req.query.from as string | undefined)?.trim();
      const toRaw = (req.query.to as string | undefined)?.trim();
      const includeSummary = String(req.query.includeSummary) === "true";
      const cursor = (req.query.cursor as string | undefined)?.trim();
      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
      );

      // ── Validate ────────────────────────────────────────────────────
      if (
        !["country", "territory", "subTerritory", "global"].includes(entityType)
      ) {
        res.status(400).json({
          error:
            "entityType must be one of: country, territory, subTerritory, global",
        });
        return;
      }
      if (entityType !== "global" && !entityId) {
        res
          .status(400)
          .json({ error: "entityId is required when entityType is not global" });
        return;
      }
      if (!["any", "location", "attribution"].includes(matchBy)) {
        res
          .status(400)
          .json({ error: "matchBy must be one of: any, location, attribution" });
        return;
      }
      if (!["all", "global", "founder_program"].includes(source)) {
        res
          .status(400)
          .json({ error: "source must be one of: all, global, founder_program" });
        return;
      }
      if (type && !["credit", "debit", "withdrawal"].includes(type)) {
        res
          .status(400)
          .json({ error: "type must be one of: credit, debit, withdrawal" });
        return;
      }
      if (
        status &&
        !["completed", "pending", "failed", "reversed"].includes(status)
      ) {
        res.status(400).json({
          error: "status must be one of: completed, pending, failed, reversed",
        });
        return;
      }
      const from = fromRaw ? new Date(fromRaw) : null;
      const to = toRaw ? new Date(toRaw) : null;
      if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
        res.status(400).json({ error: "from / to must be valid ISO dates" });
        return;
      }
      if (cursor && !Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }

      // ── Wallet owner (optional) ─────────────────────────────────────
      let owner: { _id: Types.ObjectId; email: string; name?: string } | null =
        null;
      if (emailRaw) {
        owner = await loadUserByEmail(normalizeEmail(emailRaw));
        if (!owner) {
          res
            .status(404)
            .json({ error: "No Garage user with that email", email: emailRaw });
          return;
        }
      }

      // ── Geo scope → offices in scope ────────────────────────────────
      let scopeBlock: any = { type: "global" };
      let officeIdsInScope: Types.ObjectId[] | null = null;
      let scopeEntity: any = null;
      if (entityType !== "global") {
        scopeEntity = await loadCatalogEntity(
          entityType as EntityType,
          entityId!,
        );
        if (!scopeEntity) {
          res.status(404).json({ error: `${entityType} not found in catalog` });
          return;
        }
        scopeBlock = shapeEntity(entityType as EntityType, scopeEntity);

        if (matchBy !== "attribution") {
          const orgFilter = buildOrgFilterForLeaf(
            entityType as EntityType,
            scopeEntity,
          );
          const offices = orgFilter
            ? await Organization.find(orgFilter)
                .select("_id")
                .lean<Array<{ _id: Types.ObjectId }>>()
            : [];
          officeIdsInScope = offices.map((o) => o._id);
        }
      }

      // ── Build the transaction filter ────────────────────────────────
      const baseFilter: Record<string, any> = {};
      if (owner) baseFilter.userId = owner._id;
      if (source !== "all") {
        // Legacy rows predate the `source` field — they're global money, so
        // "global" must mean "not founder_program" rather than == "global".
        baseFilter.source =
          source === "global" ? { $ne: "founder_program" } : "founder_program";
      }
      if (type) baseFilter.type = type;
      if (status) baseFilter.status = status;
      if (from || to) {
        baseFilter.createdAt = {};
        if (from) baseFilter.createdAt.$gte = from;
        if (to) baseFilter.createdAt.$lte = to;
      }

      let emptyScope = false;
      if (entityType !== "global") {
        const branches: Record<string, any>[] = [];
        if (matchBy === "attribution" || matchBy === "any") {
          branches.push({ entityType, entityId });
        }
        if (
          (matchBy === "location" || matchBy === "any") &&
          officeIdsInScope &&
          officeIdsInScope.length > 0
        ) {
          branches.push({ relatedOrgId: { $in: officeIdsInScope } });
          branches.push({ franchiseOfficeId: { $in: officeIdsInScope } });
        }
        if (branches.length === 0) {
          // matchBy=location with zero offices in the geo → nothing can match.
          emptyScope = true;
        } else {
          baseFilter.$or = branches;
        }
      }

      if (emptyScope) {
        res.json({
          scope: scopeBlock,
          filters: {
            forUserEmail: owner?.email ?? null,
            matchBy,
            source,
            type: type ?? null,
            status: status ?? null,
            from: from ?? null,
            to: to ?? null,
          },
          officesInScope: 0,
          transactions: [],
          nextCursor: null,
          summary: includeSummary
            ? {
                transactionCount: 0,
                orderCount: 0,
                customerCount: 0,
                officeCount: 0,
                affiliatesCount: 0,
                totalCommissionUsd: 0,
                totalDebitedUsd: 0,
                totalOrderVolumeUsd: 0,
                totalPlatformFeeUsd: 0,
                bySliceLevel: [],
                bySource: [],
              }
            : undefined,
        });
        return;
      }

      // ── Page of rows ────────────────────────────────────────────────
      const pageFilter: Record<string, any> = { ...baseFilter };
      if (cursor) pageFilter._id = { $lt: new Types.ObjectId(cursor) };

      const rows = await TerritoryWalletTransaction.find(pageFilter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean<any[]>();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

      // ── Enrichment: office, buyer, wallet owner ─────────────────────
      const officeIds = Array.from(
        new Set(
          items
            .map((r) => r.relatedOrgId || r.franchiseOfficeId)
            .filter(Boolean)
            .map((id: any) => String(id)),
        ),
      );
      const distIds = Array.from(
        new Set(
          items
            .map((r) => r.relatedCommissionDistributionId)
            .filter(Boolean)
            .map((id: any) => String(id)),
        ),
      );
      const ownerIds = owner
        ? []
        : Array.from(new Set(items.map((r) => String(r.userId))));

      const [officeRows, distRows] = await Promise.all([
        officeIds.length
          ? Organization.find({ _id: { $in: officeIds } })
              .select("name slug icon country state city postalCode")
              .lean<any[]>()
          : Promise.resolve([]),
        distIds.length
          ? CommissionDistribution.find({ _id: { $in: distIds } })
              .select("customerId sellerId orgId saleAmount platformFeeAmount")
              .lean<any[]>()
          : Promise.resolve([]),
      ]);

      const officeById = new Map(officeRows.map((o) => [String(o._id), o]));
      const distById = new Map(distRows.map((d) => [String(d._id), d]));

      // Buyers: founder-program rows carry `buyerUserId` directly; global rows
      // don't store the buyer, so fall back to the distribution's customerId.
      const buyerIds = new Set<string>();
      for (const r of items) {
        if (r.buyerUserId) buyerIds.add(String(r.buyerUserId));
        else if (r.relatedCommissionDistributionId) {
          const d = distById.get(String(r.relatedCommissionDistributionId));
          if (d?.customerId) buyerIds.add(String(d.customerId));
        }
      }

      const [buyerRows, ownerRows] = await Promise.all([
        buyerIds.size
          ? User.find({ _id: { $in: Array.from(buyerIds) } })
              .select("name email profilePicture country state city postalCode")
              .lean<any[]>()
          : Promise.resolve([]),
        ownerIds.length
          ? User.find({ _id: { $in: ownerIds } })
              .select("name email profilePicture")
              .lean<any[]>()
          : Promise.resolve([]),
      ]);
      const userById = new Map(
        [...buyerRows, ...ownerRows].map((u) => [String(u._id), u]),
      );

      const transactions = items.map((r) => {
        const officeId = r.relatedOrgId || r.franchiseOfficeId;
        const office = officeId ? officeById.get(String(officeId)) : null;
        const dist = r.relatedCommissionDistributionId
          ? distById.get(String(r.relatedCommissionDistributionId))
          : null;
        const buyerId = r.buyerUserId || dist?.customerId || null;
        const buyer = buyerId ? userById.get(String(buyerId)) : null;
        const walletOwner = owner ?? userById.get(String(r.userId)) ?? null;

        // Order total: prefer the value snapshotted on the wallet row, fall
        // back to the distribution (older rows may predate the field).
        const orderTotal =
          typeof r.relatedSaleAmount === "number"
            ? r.relatedSaleAmount
            : typeof dist?.saleAmount === "number"
              ? dist.saleAmount
              : null;
        const platformFee =
          typeof r.relatedPlatformFeeAmount === "number"
            ? r.relatedPlatformFeeAmount
            : typeof dist?.platformFeeAmount === "number"
              ? dist.platformFeeAmount
              : null;
        const amount = Number(r.amount) || 0;
        const isFounderProgram = r.source === "founder_program";

        return {
          id: String(r._id),
          createdAt: r.createdAt,
          // "global" = System A (Shorupan platform-fee split); legacy rows
          // have no source and read as global.
          source: r.source ?? "global",
          type: r.type,
          status: r.status,
          // Raw, NOT rounded — territory slices are stored at the exact
          // percentage of the platform fee and are routinely sub-cent (a $0.40
          // sale pays the country owner $0.001). Rounding here would show $0.00
          // and make the feed disagree with the wallet balance. Round at display.
          amount: exactMoney(amount),
          currency: r.currency || "USD",
          balanceBefore: exactMoney(r.balanceBefore),
          balanceAfter: exactMoney(r.balanceAfter),
          description: r.description,

          // Who earned it (only interesting on the platform-wide feed).
          walletOwner: walletOwner
            ? {
                id: String(walletOwner._id),
                name: walletOwner.name || null,
                email: walletOwner.email || null,
              }
            : null,

          // Where the money landed vs. which slice paid it.
          attribution: {
            entityType: r.entityType,
            entityId: r.entityId,
            entityName: r.entityName || null,
            originalSliceLevel: r.originalSliceLevel,
            cascaded: r.originalSliceLevel !== r.entityType,
          },

          // Commission math on the total purchase order.
          commission: {
            orderTotalUsd: orderTotal === null ? null : round2(orderTotal),
            platformFeeUsd: platformFee === null ? null : round2(platformFee),
            platformFeePercentage: r.relatedPlatformFeePercentage ?? null,
            splitPercentage: r.relatedSplitPercentage ?? null,
            // What splitPercentage is a percentage OF.
            splitBase: isFounderProgram ? "sale_principal" : "platform_fee",
            amountUsd: exactMoney(amount),
            effectivePercentOfOrder:
              orderTotal && orderTotal > 0
                ? Math.round((amount / orderTotal) * 10000) / 100
                : null,
          },

          // The purchase order itself.
          order: {
            paymentId: r.relatedPaymentId || null,
            itemType: r.relatedItemType || null,
            itemId: r.relatedItemId ? String(r.relatedItemId) : null,
            itemName: r.relatedItemName || null,
            commissionDistributionId: r.relatedCommissionDistributionId
              ? String(r.relatedCommissionDistributionId)
              : null,
          },

          // Selling office — also the geo that drove the territory / country
          // slices (those resolve from the BUSINESS pincode).
          office: office
            ? {
                id: String(office._id),
                name: office.name || null,
                slug: office.slug || null,
                icon: office.icon || null,
                country: office.country || null,
                state: office.state || null,
                city: office.city || null,
                postalCode: office.postalCode || null,
              }
            : null,

          buyer: buyer
            ? {
                id: String(buyer._id),
                name: buyer.name || null,
                email: buyer.email || null,
                profilePicture: buyer.profilePicture || null,
                country: buyer.country || null,
                state: buyer.state || null,
                city: buyer.city || null,
                postalCode: buyer.postalCode || null,
              }
            : null,

          franchiseProgramId: r.franchiseProgramId
            ? String(r.franchiseProgramId)
            : null,
        };
      });

      // ── Summary over the WHOLE filtered set (optional) ───────────────
      let summary: any;
      if (includeSummary) {
        // Order volume is deduped by distribution/payment: one sale produces up
        // to three wallet rows (sub + territory + country), so summing
        // relatedSaleAmount row-by-row would multiply-count the same order.
        const orderKey = {
          $ifNull: [
            "$relatedCommissionDistributionId",
            { $ifNull: ["$relatedPaymentId", "$_id"] },
          ],
        };
        const [facet] = await TerritoryWalletTransaction.aggregate([
          { $match: baseFilter },
          {
            $facet: {
              totals: [
                {
                  $group: {
                    _id: "$type",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                  },
                },
              ],
              orders: [
                {
                  $group: {
                    _id: orderKey,
                    orderTotal: { $max: "$relatedSaleAmount" },
                    platformFee: { $max: "$relatedPlatformFeeAmount" },
                  },
                },
                {
                  $group: {
                    _id: null,
                    orderCount: { $sum: 1 },
                    orderVolume: { $sum: { $ifNull: ["$orderTotal", 0] } },
                    platformFees: { $sum: { $ifNull: ["$platformFee", 0] } },
                  },
                },
              ],
              bySliceLevel: [
                {
                  $group: {
                    _id: "$originalSliceLevel",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                  },
                },
              ],
              bySource: [
                {
                  $group: {
                    _id: { $ifNull: ["$source", "global"] },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                  },
                },
              ],
              // Distinct buyers that appear on a wallet row directly. Global
              // (System-A) rows don't carry `buyerUserId` — those are picked
              // up via `distsNeedingBuyer` below.
              distinctBuyerIds: [
                { $match: { buyerUserId: { $ne: null } } },
                { $group: { _id: "$buyerUserId" } },
              ],
              // Rows that lack `buyerUserId` — their buyer lives on the
              // linked CommissionDistribution. Resolved in a post-facet lookup.
              distsNeedingBuyer: [
                {
                  $match: {
                    buyerUserId: null,
                    relatedCommissionDistributionId: { $ne: null },
                  },
                },
                { $group: { _id: "$relatedCommissionDistributionId" } },
              ],
              // Distinct selling offices across the whole filtered set. Rows
              // may carry either `relatedOrgId` (System A) or
              // `franchiseOfficeId` (founder programs) — coalesce.
              distinctOfficeIds: [
                {
                  $group: {
                    _id: {
                      $ifNull: ["$relatedOrgId", "$franchiseOfficeId"],
                    },
                  },
                },
                { $match: { _id: { $ne: null } } },
              ],
            },
          },
        ]);

        const totals = (facet?.totals ?? []) as any[];
        const credits = totals.find((t) => t._id === "credit");
        const debited = totals
          .filter((t) => t._id === "debit" || t._id === "withdrawal")
          .reduce((s, t) => s + (t.total || 0), 0);
        const orders = (facet?.orders ?? [])[0] as any;

        // Resolve customer count = distinct buyers across ALL filtered rows.
        // Union of:
        //   (a) buyerUserId directly on the row (founder-program rows)
        //   (b) CommissionDistribution.customerId for global rows that only
        //       carry a distribution ref.
        const directBuyerIds = new Set<string>(
          (facet?.distinctBuyerIds ?? [])
            .map((g: any) => (g._id ? String(g._id) : null))
            .filter(Boolean) as string[],
        );
        const distIdsForBuyerLookup = (facet?.distsNeedingBuyer ?? [])
          .map((g: any) => g._id)
          .filter(Boolean);
        if (distIdsForBuyerLookup.length) {
          const rows = await CommissionDistribution.find({
            _id: { $in: distIdsForBuyerLookup },
          })
            .select("customerId")
            .lean<Array<{ customerId?: any }>>();
          for (const d of rows) {
            if (d.customerId) directBuyerIds.add(String(d.customerId));
          }
        }
        const customerCount = directBuyerIds.size;
        const officeCount = (facet?.distinctOfficeIds ?? []).length;

        // ── Affiliates in scope — anyone who ever bought a Unilevel Plus
        // license AND lives in the requested geo (matched by
        // User.city|state|country against the catalog entity's name).
        // "Ever bought" means any status: active | expired | refunded.
        // Global scope → count distinct UP purchasers platform-wide.
        let affiliatesCount = 0;
        {
          let scopedUserIds: Types.ObjectId[] | null = null;
          if (scopeEntity && entityType !== "global") {
            const geoField =
              entityType === "country"
                ? "country"
                : entityType === "territory"
                  ? "state"
                  : "city";
            const geoName = scopeEntity.name;
            if (geoName) {
              const scopedUsers = await User.find({
                [geoField]: ciExact(String(geoName)),
              })
                .select("_id")
                .lean<Array<{ _id: Types.ObjectId }>>();
              scopedUserIds = scopedUsers.map((u) => u._id);
            } else {
              scopedUserIds = [];
            }
          }
          if (scopedUserIds && scopedUserIds.length === 0) {
            affiliatesCount = 0;
          } else {
            const upMatch: any = {};
            if (scopedUserIds) upMatch.userId = { $in: scopedUserIds };
            const distinct = await UnilevelPlusPurchase.aggregate([
              { $match: upMatch },
              { $group: { _id: "$userId" } },
              { $count: "n" },
            ]);
            affiliatesCount = distinct[0]?.n || 0;
          }
        }

        summary = {
          transactionCount: totals.reduce((s, t) => s + (t.count || 0), 0),
          orderCount: orders?.orderCount || 0,
          // Distinct BUYERS across the whole filtered set — every unique
          // customer whose purchase produced a commission row that landed
          // (or was attributed) to this scope.
          customerCount,
          // Distinct SELLING OFFICES across the whole filtered set — every
          // unique business whose sale produced a matched row.
          officeCount,
          // Distinct AFFILIATES in the geo scope — every user in the
          // requested country / state / city (or platform-wide when
          // scope=global) who has EVER purchased a Unilevel Plus license,
          // regardless of current status (active / expired / refunded).
          // Independent of the transaction filter above.
          affiliatesCount,
          totalCommissionUsd: exactMoney(credits?.total || 0),
          totalDebitedUsd: exactMoney(debited),
          totalOrderVolumeUsd: round2(orders?.orderVolume || 0),
          totalPlatformFeeUsd: round2(orders?.platformFees || 0),
          bySliceLevel: ((facet?.bySliceLevel ?? []) as any[]).map((g) => ({
            level: g._id,
            totalUsd: exactMoney(g.total || 0),
            count: g.count || 0,
          })),
          bySource: ((facet?.bySource ?? []) as any[]).map((g) => ({
            source: g._id,
            totalUsd: exactMoney(g.total || 0),
            count: g.count || 0,
          })),
        };
      }

      res.json({
        scope: scopeBlock,
        filters: {
          forUserEmail: owner?.email ?? null,
          matchBy,
          source,
          type: type ?? null,
          status: status ?? null,
          from: from ?? null,
          to: to ?? null,
        },
        officesInScope: officeIdsInScope ? officeIdsInScope.length : null,
        transactions,
        nextCursor,
        summary,
      });
    } catch (err: any) {
      console.error(
        "[franchise-api] dashboard/franchise-wallet/transactions error:",
        err,
      );
      res.status(500).json({ error: "Internal error" });
    }
  },
);

// ===========================================================================
// GET /franchise-api/franchisees/earnings-table
//
// Grouped-by-user, per-entity earnings + processing-volume table for the
// franchise dashboard. System A only. Three time buckets per entity: previous
// calendar year, current calendar year, all-time. Optional filters: country
// (which country the franchisee's entity is in) and personEmail (single user).
// Response shape is 2D — outer array = users, inner `entities` = array of
// each user's owned assignments (always an array even when the user owns one).
// ===========================================================================

/**
 * Count unowned descendants under a given catalog entity — the "Overriding
 * N Unsold Territories" number on the FE card. Country row counts unowned
 * territories PLUS unowned sub-territories under that country. Territory row
 * counts unowned sub-territories under that territory. Sub-territory row is
 * always 0. Results are cached per (level, id) within a single request via
 * the caller-supplied Map.
 */
async function countUnsoldDescendants(
  geoLevel: "country" | "territory" | "subTerritory",
  geoEntityName: string | null | undefined,
  geoEntityId: string,
  cache: Map<string, number>,
): Promise<number> {
  if (geoLevel === "subTerritory") return 0;
  const cacheKey = `${geoLevel}:${geoEntityId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (!geoEntityName) {
    cache.set(cacheKey, 0);
    return 0;
  }

  const nameRegex = ciExact(geoEntityName);
  let descendantIds: string[] = [];
  if (geoLevel === "country") {
    const [terrs, subs] = await Promise.all([
      FranchiseTerritory.find({ country: nameRegex }).select("_id").lean<any[]>(),
      FranchiseSubTerritory.find({ country: nameRegex })
        .select("_id")
        .lean<any[]>(),
    ]);
    descendantIds = [
      ...terrs.map((t) => String(t._id)),
      ...subs.map((s) => String(s._id)),
    ];
  } else {
    // territory
    const subs = await FranchiseSubTerritory.find({
      parentTerritory: nameRegex,
    })
      .select("_id")
      .lean<any[]>();
    descendantIds = subs.map((s) => String(s._id));
  }
  if (descendantIds.length === 0) {
    cache.set(cacheKey, 0);
    return 0;
  }
  // `listed` counts as OWNED (the entity has been sold and the current
  // owner has put it back up for resale — it's not an unsold catalog slot).
  const owned = await FranchiseGlobalAssignment.find({
    geoEntityId: { $in: descendantIds },
    status: { $in: ["active", "paused_lapsed", "listed"] },
  })
    .select("geoEntityId")
    .lean<any[]>();
  const ownedSet = new Set(owned.map((o) => String(o.geoEntityId)));
  const unsold = descendantIds.filter((id) => !ownedSet.has(id)).length;
  cache.set(cacheKey, unsold);
  return unsold;
}

/**
 * Priority-order buyout price surfacing. Mirrors the FE column semantics:
 * a pending resale mechanism wins over the raw `priceUSD` field (which for
 * an active row is the original purchase price, not a re-listing).
 */
function resolveBuyoutPrice(a: any): {
  amountUSD: number;
  source: "resaleOffer" | "directedSale" | "reassignment" | "listing";
} | null {
  if (a.pendingResaleOffer?.agreedPriceUSD) {
    return {
      amountUSD: a.pendingResaleOffer.agreedPriceUSD,
      source: "resaleOffer",
    };
  }
  if (a.pendingDirectedSale?.priceUSD) {
    return {
      amountUSD: a.pendingDirectedSale.priceUSD,
      source: "directedSale",
    };
  }
  if (a.pendingReassignment?.resalePriceUSD) {
    return {
      amountUSD: a.pendingReassignment.resalePriceUSD,
      source: "reassignment",
    };
  }
  if (a.status === "listed") {
    // Prefer the resale-ask field; fall back to priceUSD for legacy
    // rows that pre-date the listedPriceUSD split.
    const listPrice =
      typeof a.listedPriceUSD === "number"
        ? a.listedPriceUSD
        : typeof a.priceUSD === "number"
          ? a.priceUSD
          : null;
    if (listPrice != null) {
      return { amountUSD: listPrice, source: "listing" };
    }
  }
  return null;
}

router.get(
  "/franchisees/earnings-table",
  async (req: Request, res: Response) => {
    try {
      const countryRaw = (req.query.country as string | undefined)?.trim();
      const personEmailRaw = (req.query.personEmail as string | undefined)?.trim();
      const yearRaw = req.query.year as string | undefined;
      const year =
        yearRaw && /^\d{4}$/.test(yearRaw)
          ? Number(yearRaw)
          : new Date().getUTCFullYear();

      // Resolve personEmail → userId if provided.
      let personUserId: Types.ObjectId | null = null;
      let resolvedPersonEmail: string | null = null;
      if (personEmailRaw) {
        const normalized = normalizeEmail(personEmailRaw);
        const person = await loadUserByEmail(normalized);
        if (!person) {
          res.json({
            franchisees: [],
            meta: {
              year,
              buckets: [String(year - 1), String(year), "allTime"],
              filters: {
                country: countryRaw || null,
                personEmail: normalized,
              },
              warning: "No Garage user found for personEmail",
            },
          });
          return;
        }
        personUserId = person._id;
        resolvedPersonEmail = person.email;
      }

      // Enumerate active/paused System A assignments in scope.
      const assignFilter: any = {
        status: { $in: ["active", "paused_lapsed"] },
        ownerUserId: { $ne: null },
      };
      if (countryRaw) assignFilter.geoCountry = ciExact(countryRaw);
      if (personUserId) assignFilter.ownerUserId = personUserId;

      const assignments = await FranchiseGlobalAssignment.find(assignFilter)
        .sort({ ownerUserId: 1, geoLevel: 1, geoEntityName: 1 })
        .lean<any[]>();

      if (assignments.length === 0) {
        res.json({
          franchisees: [],
          meta: {
            year,
            buckets: [String(year - 1), String(year), "allTime"],
            filters: {
              country: countryRaw || null,
              personEmail: resolvedPersonEmail,
            },
          },
        });
        return;
      }

      // Hydrate all owner users in one round-trip.
      const ownerIds = Array.from(
        new Set(assignments.map((a) => String(a.ownerUserId))),
      ).map((s) => new Types.ObjectId(s));
      const users = await User.find({ _id: { $in: ownerIds } })
        .select("name email phone country profilePicture")
        .lean<any[]>();
      const userById = new Map<string, any>(
        users.map((u) => [String(u._id), u]),
      );

      // Time bucket boundaries (UTC calendar years).
      const startPrev = new Date(Date.UTC(year - 1, 0, 1));
      const startCurr = new Date(Date.UTC(year, 0, 1));
      const startNext = new Date(Date.UTC(year + 1, 0, 1));

      // Per-entity aggregation. Runs concurrently up to a cap so we don't
      // stampede the connection pool on tables with hundreds of franchisees.
      const CONCURRENCY = 20;
      const unsoldCache = new Map<string, number>();

      // Aggregate one (userId, entityType, entityId) triple across all three
      // buckets in a single $facet query.
      const aggregateEntity = async (a: any) => {
        const baseMatch = {
          userId: a.ownerUserId,
          entityType: a.geoLevel,
          entityId: a.geoEntityId,
          type: "credit",
          status: "completed",
          source: { $ne: "founder_program" },
        };

        // Dedup by relatedCommissionDistributionId for sale/fee sums (same
        // sale writes up to 3 TWT rows across levels; sums must be per-CD).
        // Fallback to _id when relatedCommissionDistributionId is missing so
        // the row still contributes exactly once.
        const buildFacet = (dateMatch: Record<string, any> | null) => {
          const stages: any[] = [];
          if (dateMatch) stages.push({ $match: dateMatch });
          stages.push(
            {
              $group: {
                _id: {
                  $ifNull: ["$relatedCommissionDistributionId", "$_id"],
                },
                saleAmount: { $first: "$relatedSaleAmount" },
                platformFee: { $first: "$relatedPlatformFeeAmount" },
              },
            },
            {
              $group: {
                _id: null,
                processingVolume: { $sum: { $ifNull: ["$saleAmount", 0] } },
                fees: { $sum: { $ifNull: ["$platformFee", 0] } },
                transactions: { $sum: 1 },
              },
            },
          );
          return stages;
        };

        const buildEarnings = (dateMatch: Record<string, any> | null) => {
          const stages: any[] = [];
          if (dateMatch) stages.push({ $match: dateMatch });
          stages.push({
            $group: {
              _id: "$currency",
              total: { $sum: "$amount" },
            },
          });
          return stages;
        };

        const prevRange = { createdAt: { $gte: startPrev, $lt: startCurr } };
        const currRange = { createdAt: { $gte: startCurr, $lt: startNext } };

        const agg = await TerritoryWalletTransaction.aggregate([
          { $match: baseMatch },
          {
            $facet: {
              prevStats: buildFacet(prevRange),
              currStats: buildFacet(currRange),
              allStats: buildFacet(null),
              prevEarnings: buildEarnings(prevRange),
              currEarnings: buildEarnings(currRange),
              allEarnings: buildEarnings(null),
            },
          },
        ]);
        const facet = (agg as any[])[0] || {};

        const shapeStats = (
          statsArr: any[] | undefined,
          earningsArr: any[] | undefined,
        ) => {
          const s = statsArr?.[0] || {
            processingVolume: 0,
            fees: 0,
            transactions: 0,
          };
          // Sum earnings by currency and convert non-USD to USD.
          let earningsUSD = 0;
          for (const row of earningsArr || []) {
            const cur = String(row._id || "USD").toUpperCase();
            const amt = Number(row.total) || 0;
            if (cur === "USD") earningsUSD += amt;
            else earningsUSD += amt; // TWT.amount is dollars regardless of nominal currency; treat as USD for parity with the rest of the endpoint
          }
          return {
            processingVolumeUSD: round2(Number(s.processingVolume) || 0),
            feesUSD: round2(Number(s.fees) || 0),
            earningsUSD: round2(earningsUSD),
            transactions: Number(s.transactions) || 0,
          };
        };

        const unsold = await countUnsoldDescendants(
          a.geoLevel,
          a.geoEntityName,
          a.geoEntityId,
          unsoldCache,
        );

        return {
          assignmentId: String(a._id),
          geoLevel: a.geoLevel,
          geoEntityId: a.geoEntityId,
          geoEntityName: a.geoEntityName ?? null,
          geoCountry: a.geoCountry ?? null,
          geoParentTerritory: a.geoParentTerritory ?? null,
          status: a.status,
          acquisitionType: a.acquisitionType || "original",
          buyoutPrice: resolveBuyoutPrice(a),
          overridingUnsoldCount: unsold,
          stats: {
            [String(year - 1)]: shapeStats(facet.prevStats, facet.prevEarnings),
            [String(year)]: shapeStats(facet.currStats, facet.currEarnings),
            allTime: shapeStats(facet.allStats, facet.allEarnings),
          },
          ownerUserId: String(a.ownerUserId),
        };
      };

      const entityRows: any[] = [];
      for (let i = 0; i < assignments.length; i += CONCURRENCY) {
        const slice = assignments.slice(i, i + CONCURRENCY);
        const results = await Promise.all(slice.map(aggregateEntity));
        entityRows.push(...results);
      }

      // Group by owner user preserving stable order (assignments were sorted
      // by ownerUserId already, so first-seen preserves that ordering).
      const byOwner = new Map<string, { user: any; entities: any[] }>();
      for (const row of entityRows) {
        const ownerId = row.ownerUserId;
        if (!byOwner.has(ownerId)) {
          const u = userById.get(ownerId);
          byOwner.set(ownerId, {
            user: u
              ? {
                  userId: ownerId,
                  name: u.name || null,
                  email: u.email || null,
                  phone: u.phone || null,
                  country: u.country || null,
                  avatar: u.profilePicture || null,
                }
              : { userId: ownerId, name: null, email: null, phone: null, country: null, avatar: null },
            entities: [],
          });
        }
        // Strip the ownerUserId echo from each row payload — it's now on `user`.
        const { ownerUserId, ...cleaned } = row;
        byOwner.get(ownerId)!.entities.push(cleaned);
      }

      // Header summary bar — reflects the SAME filter scope as the rows.
      //   franchisees      = count of entities in scope (each assignment)
      //   franchiseOwners  = distinct users owning at least one in scope
      //   marketCapUSD     = sum of buyout prices for rows currently for sale
      //                      (any resale mechanism set); excludes non-listed
      //   totalFeesAllTimeUSD = sum of all-time platform-fee totals across
      //                      every entity row (the "Total Fees All Time" pill)
      let marketCapUSD = 0;
      let totalFeesAllTimeUSD = 0;
      for (const row of entityRows) {
        if (row.buyoutPrice?.amountUSD) marketCapUSD += row.buyoutPrice.amountUSD;
        totalFeesAllTimeUSD += row.stats.allTime.feesUSD || 0;
      }

      res.json({
        summary: {
          franchisees: entityRows.length,
          franchiseOwners: byOwner.size,
          marketCapUSD: round2(marketCapUSD),
          totalFeesAllTimeUSD: round2(totalFeesAllTimeUSD),
        },
        franchisees: Array.from(byOwner.values()),
        meta: {
          year,
          buckets: [String(year - 1), String(year), "allTime"],
          filters: {
            country: countryRaw || null,
            personEmail: resolvedPersonEmail,
          },
        },
      });
    } catch (err: any) {
      console.error(
        "[franchise-api] franchisees/earnings-table error:",
        err,
      );
      res.status(500).json({ error: "Internal error" });
    }
  },
);

// ===========================================================================
// GET /franchise-api/customers/purchase-history
//
// 2D grouping: outer array = customers whose purchases produced a System A
// commission, inner array = each buyer's list of purchases with buyer +
// upline + seller org + product + priceUSD + feesUSD + earningsUSD.
//
// Filters: entityType + entityId (geo scope), personEmail (franchisee scope),
// cursor + limit (max 200). No time buckets. Global by default.
// ===========================================================================

router.get(
  "/customers/purchase-history",
  async (req: Request, res: Response) => {
    try {
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const personEmailRaw = (req.query.personEmail as string | undefined)?.trim();
      const cursorRaw = (req.query.cursor as string | undefined)?.trim();
      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
      );

      // Validate entity filter (both must be present together).
      if ((entityType && !entityId) || (!entityType && entityId)) {
        res.status(400).json({
          error: "entityType and entityId must be provided together",
        });
        return;
      }
      if (
        entityType &&
        !["country", "territory", "subTerritory"].includes(entityType)
      ) {
        res.status(400).json({ error: "Invalid entityType" });
        return;
      }

      // Resolve personEmail → userId.
      let personUserId: Types.ObjectId | null = null;
      let resolvedPersonEmail: string | null = null;
      if (personEmailRaw) {
        const normalized = normalizeEmail(personEmailRaw);
        const person = await loadUserByEmail(normalized);
        if (!person) {
          res.json({
            customers: [],
            nextCursor: null,
            limit,
            filters: {
              entityType: entityType || null,
              entityId: entityId || null,
              personEmail: normalized,
            },
            warning: "No Garage user found for personEmail",
          });
          return;
        }
        personUserId = person._id;
        resolvedPersonEmail = person.email;
      }

      // Cursor is a buyer userId (ObjectId string).
      if (cursorRaw && !Types.ObjectId.isValid(cursorRaw)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }

      // Build TWT filter — System A only (mirror franchiseApi.ts:2612).
      const twtFilter: any = {
        type: "credit",
        status: "completed",
        source: { $ne: "founder_program" },
      };
      if (entityType && entityId) {
        twtFilter.entityType = entityType;
        twtFilter.entityId = entityId;
      }
      if (personUserId) twtFilter.userId = personUserId;

      // Aggregate: dedup by relatedCommissionDistributionId — a single sale
      // writes up to 3 TWT rows across sub/territory/country slices. earnings
      // sums across the slices matching the filter; sale/fee/item are
      // identical across the rows for the same CD so $first is safe.
      const purchases = await TerritoryWalletTransaction.aggregate([
        { $match: twtFilter },
        {
          $group: {
            _id: "$relatedCommissionDistributionId",
            earningsUSD: { $sum: "$amount" },
            saleAmount: { $first: "$relatedSaleAmount" },
            platformFee: { $first: "$relatedPlatformFeeAmount" },
            itemType: { $first: "$relatedItemType" },
            itemId: { $first: "$relatedItemId" },
            itemName: { $first: "$relatedItemName" },
            sellerOrgId: { $first: "$relatedOrgId" },
            paymentId: { $first: "$relatedPaymentId" },
            createdAt: { $min: "$createdAt" },
          },
        },
        { $match: { _id: { $ne: null } } },
      ]);

      if (purchases.length === 0) {
        res.json({
          customers: [],
          nextCursor: null,
          limit,
          filters: {
            entityType: entityType || null,
            entityId: entityId || null,
            personEmail: resolvedPersonEmail,
          },
        });
        return;
      }

      // Batch-fetch CDs for customer identity.
      const cdIds = purchases.map((p: any) => p._id);
      const cds = await CommissionDistribution.find({
        _id: { $in: cdIds },
      })
        .select("_id customerId createdAt")
        .lean<any[]>();
      const cdMap = new Map<string, any>(
        cds.map((cd: any) => [String(cd._id), cd]),
      );

      // Attach customerId + paidAt to each purchase row (from CD).
      for (const p of purchases) {
        const cd = cdMap.get(String(p._id));
        (p as any).customerId = cd?.customerId || null;
        (p as any).paidAt = cd?.createdAt || p.createdAt;
      }

      // Group by customerId. Drop purchases with no resolvable buyer.
      const byCustomer = new Map<string, any[]>();
      for (const p of purchases) {
        const cid = (p as any).customerId;
        if (!cid) continue;
        const key = String(cid);
        const arr = byCustomer.get(key);
        if (arr) arr.push(p);
        else byCustomer.set(key, [p]);
      }

      // Sort customer ids DESC (stable, ObjectId monotonicity ≈ recency)
      // and apply cursor pagination.
      const sortedCustomerIds = Array.from(byCustomer.keys()).sort((a, b) =>
        b.localeCompare(a),
      );
      const startIdx = cursorRaw
        ? sortedCustomerIds.findIndex((id) => id < cursorRaw)
        : 0;
      const effectiveStart = startIdx < 0 ? sortedCustomerIds.length : startIdx;
      const pageCustomerIds = sortedCustomerIds.slice(
        effectiveStart,
        effectiveStart + limit + 1,
      );
      const hasMore = pageCustomerIds.length > limit;
      const pageIds = hasMore ? pageCustomerIds.slice(0, limit) : pageCustomerIds;

      // Hydrate: buyers + uplines + seller orgs, all in parallel.
      const pageObjectIds = pageIds.map((s) => new Types.ObjectId(s));
      const buyers = await User.find({ _id: { $in: pageObjectIds } })
        .select(
          "_id name email phone profilePicture country state city postalCode referredBy",
        )
        .lean<any[]>();
      const buyerMap = new Map<string, any>(
        buyers.map((u: any) => [String(u._id), u]),
      );

      const uplineIds = Array.from(
        new Set(
          buyers
            .map((b: any) => b.referredBy)
            .filter((id: any) => id)
            .map((id: any) => String(id)),
        ),
      ).map((s) => new Types.ObjectId(s));
      const [uplines, orgs] = await Promise.all([
        uplineIds.length
          ? User.find({ _id: { $in: uplineIds } })
              .select("_id name email phone profilePicture")
              .lean<any[]>()
          : Promise.resolve([]),
        (async () => {
          const sellerOrgIds = Array.from(
            new Set(
              pageIds.flatMap((cid) =>
                (byCustomer.get(cid) || [])
                  .map((p: any) => p.sellerOrgId)
                  .filter((id: any) => id)
                  .map((id: any) => String(id)),
              ),
            ),
          ).map((s) => new Types.ObjectId(s));
          if (!sellerOrgIds.length) return [];
          return Organization.find({ _id: { $in: sellerOrgIds } })
            .select("_id name slug icon country state city")
            .lean<any[]>();
        })(),
      ]);
      const uplineMap = new Map<string, any>(
        uplines.map((u: any) => [String(u._id), u]),
      );
      const orgMap = new Map<string, any>(
        orgs.map((o: any) => [String(o._id), o]),
      );

      const shapeUser = (u: any) =>
        u
          ? {
              userId: String(u._id),
              name: u.name || null,
              email: u.email || null,
              phone: u.phone || null,
              profilePicture: u.profilePicture || null,
            }
          : null;

      const shapeSeller = (o: any) =>
        o
          ? {
              orgId: String(o._id),
              name: o.name || null,
              slug: o.slug || null,
              icon: o.icon || null,
              country: o.country || null,
              state: o.state || null,
              city: o.city || null,
            }
          : null;

      const customers = pageIds.map((cid) => {
        const buyer = buyerMap.get(cid);
        const upline =
          buyer?.referredBy ? shapeUser(uplineMap.get(String(buyer.referredBy))) : null;
        const rawPurchases = (byCustomer.get(cid) || []).sort((a: any, b: any) => {
          const at = a.paidAt ? new Date(a.paidAt).getTime() : 0;
          const bt = b.paidAt ? new Date(b.paidAt).getTime() : 0;
          return bt - at; // newest purchase first
        });
        return {
          buyer: buyer
            ? {
                ...shapeUser(buyer),
                country: buyer.country || null,
                state: buyer.state || null,
                city: buyer.city || null,
                postalCode: buyer.postalCode || null,
              }
            : { userId: cid, name: null, email: null, phone: null, profilePicture: null, country: null, state: null, city: null, postalCode: null },
          upline,
          purchases: rawPurchases.map((p: any) => ({
            commissionDistributionId: String(p._id),
            paidAt: p.paidAt || null,
            seller: p.sellerOrgId
              ? shapeSeller(orgMap.get(String(p.sellerOrgId)))
              : null,
            product: {
              itemType: p.itemType || null,
              itemId: p.itemId ? String(p.itemId) : null,
              itemName: p.itemName || null,
            },
            priceUSD: round2(Number(p.saleAmount) || 0),
            feesUSD: round2(Number(p.platformFee) || 0),
            earningsUSD: round2(Number(p.earningsUSD) || 0),
          })),
        };
      });

      res.json({
        customers,
        nextCursor: hasMore ? pageIds[pageIds.length - 1] : null,
        limit,
        filters: {
          entityType: entityType || null,
          entityId: entityId || null,
          personEmail: resolvedPersonEmail,
        },
      });
    } catch (err: any) {
      console.error(
        "[franchise-api] customers/purchase-history error:",
        err,
      );
      res.status(500).json({ error: "Internal error" });
    }
  },
);

// ===========================================================================
// GET /franchise-api/sub-territories/:subTerritoryId/affiliates
//
// Per-sub-territory affiliates table. Row = every user in that sub-territory
// with an active $25 UnilevelPlus (User.typeFlags.oneNetworkActivated).
// Column math is scoped to buyers in the row-affiliate's downline who ALSO
// live in the sub-territory, and to invoices for non-platform SKUs
// (products/courses/workshops/channels/services/calls/ecommerce_item —
// excludes office subs, third-party subs, unilevel plus, franchise packages,
// bat246 memberships, wallet top-ups).
// ===========================================================================

router.get(
  "/sub-territories/:subTerritoryId/affiliates",
  async (req: Request, res: Response) => {
    try {
      const NON_PLATFORM_ITEM_TYPES = [
        "product",
        "course",
        "channel",
        "service",
        "call",
        "workshop",
        "ecommerce_item",
      ];

      const { subTerritoryId } = req.params;
      const personEmailRaw = (req.query.personEmail as string | undefined)?.trim();
      const cursorRaw = (req.query.cursor as string | undefined)?.trim();
      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
      );

      // Load the sub-territory catalog doc via the existing helper that
      // handles the String vs ObjectId _id mismatch on mirrored collections.
      const sub: any = await loadCatalogEntity("subTerritory", subTerritoryId);
      if (!sub) {
        res.status(404).json({ error: "Sub-territory not found" });
        return;
      }

      // Franchisee context (optional — display only, does NOT filter rows or math).
      let resolvedPersonEmail: string | null = null;
      if (personEmailRaw) {
        const normalized = normalizeEmail(personEmailRaw);
        const person = await loadUserByEmail(normalized);
        resolvedPersonEmail = person ? person.email : null;
      }

      if (cursorRaw && !Types.ObjectId.isValid(cursorRaw)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }

      // Reused zip-or-name matcher — same predicate resolveLeafFromAddress uses.
      const subTerritoryUserFilter: any = buildOrgFilterForLeaf(
        "subTerritory",
        sub,
      );

      // Load affiliates in the sub-territory (denormalized flag; no UP join).
      const affiliateFilter: any = {
        ...subTerritoryUserFilter,
        "typeFlags.oneNetworkActivated": true,
      };
      if (cursorRaw) affiliateFilter._id = { $lt: new Types.ObjectId(cursorRaw) };

      const affiliates = await User.find(affiliateFilter)
        .select(
          "_id name email phone profilePicture country state city postalCode referredBy typeFlags rank1 rank2 directsCount downlineCount",
        )
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean<any[]>();

      const hasMore = affiliates.length > limit;
      const pageAffiliates = hasMore ? affiliates.slice(0, limit) : affiliates;

      if (pageAffiliates.length === 0) {
        res.json({
          affiliates: [],
          nextCursor: null,
          limit,
          subTerritory: {
            id: String(sub._id),
            name: sub.name || null,
            country: sub.country || null,
            parentTerritory: sub.parentTerritory || null,
          },
          filters: { personEmail: resolvedPersonEmail },
        });
        return;
      }

      // Batch-hydrate uplines in one round-trip.
      const uplineIds = Array.from(
        new Set(
          pageAffiliates
            .map((a) => a.referredBy)
            .filter(Boolean)
            .map((id: any) => String(id)),
        ),
      ).map((s) => new Types.ObjectId(s));
      const uplines = uplineIds.length
        ? await User.find({ _id: { $in: uplineIds } })
            .select("_id name email phone profilePicture")
            .lean<any[]>()
        : [];
      const uplineMap = new Map<string, any>(uplines.map((u) => [String(u._id), u]));

      // Per-affiliate stat computation. Capped concurrency at 20 to keep the
      // connection pool healthy (matches earnings-table endpoint pattern).
      const CONCURRENCY = 20;

      const computeStats = async (aff: any) => {
        // 1. Downline members WHO live in the same sub-territory.
        const downlineInScope = await User.find({
          ancestors: aff._id,
          ...subTerritoryUserFilter,
        })
          .select("_id")
          .lean<any[]>();

        if (downlineInScope.length === 0) {
          return {
            customers: 0,
            purchases: 0,
            volumeUSD: 0,
            feesUSD: 0,
            earningsUSD: 0,
          };
        }
        const downlineIds = downlineInScope.map((d) => d._id);

        // 2. Non-platform-SKU paid invoices by those downline buyers.
        const invAgg = await Invoice.aggregate([
          {
            $match: {
              userId: { $in: downlineIds },
              status: "paid",
              "lineItems.itemType": { $in: NON_PLATFORM_ITEM_TYPES },
            },
          },
          {
            $group: {
              _id: null,
              purchases: { $sum: 1 },
              uniqueBuyers: { $addToSet: "$userId" },
              // Push { currency, amount } rows so sumInUsd can currency-convert.
              // Invoice.totalAmount is stored in itemCurrency's smallest unit.
              volumePerCurrency: {
                $push: {
                  currency: "$itemCurrency",
                  amount: "$totalAmount",
                },
              },
              // paymentIds needed to join CommissionDistribution for the
              // earnings sum.
              paymentIds: { $addToSet: "$paymentId" },
            },
          },
        ]);

        const stats = invAgg[0] || {
          purchases: 0,
          uniqueBuyers: [],
          volumePerCurrency: [],
          paymentIds: [],
        };

        const customers = (stats.uniqueBuyers || []).length;
        const purchases = stats.purchases || 0;
        const volumeUSD = await sumInUsd(stats.volumePerCurrency || []);
        // Fee = 5% of volume (matches franchiseApi.ts:2152 convention — reads
        // the same "at 5%" narrative rather than joining CD.platformFeeAmount).
        const feesUSD = round2(volumeUSD * 0.05);

        // 3. Earnings — sum WT.amount where walletType=affiliate, userId=aff,
        //    metadata.distributionId ∈ CDs from those invoices. Skip when
        //    no invoices or no paymentIds.
        let earningsUSD = 0;
        const paymentIds = (stats.paymentIds || []).filter((p: any) => !!p);
        if (paymentIds.length > 0) {
          const cds = await CommissionDistribution.find({
            paymentId: { $in: paymentIds },
          })
            .select("_id")
            .lean<any[]>();
          const distIds = cds.map((c) => c._id);
          if (distIds.length > 0) {
            const earnAgg = await WalletTransaction.aggregate([
              {
                $match: {
                  walletType: "affiliate",
                  userId: aff._id,
                  type: "credit",
                  status: "completed",
                  "metadata.distributionId": { $in: distIds },
                },
              },
              {
                $group: {
                  _id: "$currency",
                  total: { $sum: "$amount" },
                },
              },
            ]);
            // WT amounts are stored in their own currency's smallest unit for
            // wallet writes; but the affiliate wallet is USD-denominated and
            // amounts are in dollars. Treat as USD directly (matches existing
            // franchiseApi.ts:2263 pattern for territorial payouts).
            for (const row of earnAgg as any[]) {
              const cur = String(row._id || "USD").toUpperCase();
              if (cur === "USD") earningsUSD += Number(row.total) || 0;
              else {
                // Non-USD affiliate WT rows are rare but safe-convert.
                const cents = Math.round((Number(row.total) || 0) * 100);
                earningsUSD += await toUsdDollars(cents, cur);
              }
            }
            earningsUSD = round2(earningsUSD);
          }
        }

        // Safety check — earnings should never exceed the 5% platform fee.
        if (earningsUSD > feesUSD + 0.01) {
          console.warn(
            `[affiliates-table][violation] affiliate ${aff._id} earningsUSD=${earningsUSD} > feesUSD=${feesUSD} in sub-territory ${subTerritoryId}`,
          );
        }

        return { customers, purchases, volumeUSD, feesUSD, earningsUSD };
      };

      const rows: any[] = [];
      for (let i = 0; i < pageAffiliates.length; i += CONCURRENCY) {
        const slice = pageAffiliates.slice(i, i + CONCURRENCY);
        const results = await Promise.all(slice.map((a) => computeStats(a)));
        for (let j = 0; j < slice.length; j++) {
          const aff = slice[j];
          const stats = results[j];
          const upline = aff.referredBy
            ? uplineMap.get(String(aff.referredBy))
            : null;
          rows.push({
            user: {
              userId: String(aff._id),
              name: aff.name || null,
              email: aff.email || null,
              phone: aff.phone || null,
              profilePicture: aff.profilePicture || null,
              country: aff.country || null,
              state: aff.state || null,
              city: aff.city || null,
              postalCode: aff.postalCode || null,
            },
            upline: upline
              ? {
                  userId: String(upline._id),
                  name: upline.name || null,
                  email: upline.email || null,
                  phone: upline.phone || null,
                  profilePicture: upline.profilePicture || null,
                }
              : null,
            customers: stats.customers,
            purchases: stats.purchases,
            volumeUSD: stats.volumeUSD,
            feesUSD: stats.feesUSD,
            earningsUSD: stats.earningsUSD,
            licenses: {
              oneNetworkActivated: !!aff.typeFlags?.oneNetworkActivated,
              networkChainsSub: !!aff.typeFlags?.networkChainsSub,
              founderSub: !!aff.typeFlags?.founderSub,
            },
            rank: {
              rank1: aff.rank1 ?? null,
              rank2: aff.rank2 ?? null,
            },
            directsCount: aff.directsCount ?? 0,
            downlineCount: aff.downlineCount ?? 0,
          });
        }
      }

      res.json({
        affiliates: rows,
        nextCursor: hasMore ? String(pageAffiliates[pageAffiliates.length - 1]._id) : null,
        limit,
        subTerritory: {
          id: String(sub._id),
          name: sub.name || null,
          country: sub.country || null,
          parentTerritory: sub.parentTerritory || null,
        },
        filters: { personEmail: resolvedPersonEmail },
      });
    } catch (err: any) {
      console.error(
        "[franchise-api] sub-territories/:id/affiliates error:",
        err,
      );
      res.status(500).json({ error: "Internal error" });
    }
  },
);

export default router;
