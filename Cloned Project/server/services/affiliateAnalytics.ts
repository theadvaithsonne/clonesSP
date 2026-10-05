import { Types } from "mongoose";
import { User } from "../models/user.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { Invoice } from "../models/invoice.model";
import { Organization } from "../models/organization.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";

/**
 * Read each user's lifetime affiliate-wallet earnings, returned as cents
 * (the wallet stores float USD; analytics surfaces use *Cents fields for
 * consistency with Invoice totals). Missing wallet → 0. Range/office/category
 * filters intentionally NOT applied: the wallet is a lifetime ledger and
 * doesn't carry per-period breakdowns. If/when range-scoped earnings become
 * a requirement, fold `WalletTransaction` aggregation in here.
 */
async function readWalletEarningsCents(
  userIds: Types.ObjectId[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;
  const wallets = await AffiliateWallet.find(
    { userId: { $in: userIds } },
    { userId: 1, totalEarnings: 1 }
  ).lean();
  for (const w of wallets as any[]) {
    result.set(String(w.userId), Math.round((w.totalEarnings || 0) * 100));
  }
  return result;
}

// Forward declaration of the subscription shape used by the helper below.
// The full export lives further down with the other public types.
interface _UnilevelPlusSubscriptionInternal {
  hasUnilevelPlus: true;
  amount: number;
  currency: string;
  status: "active";
  source: string | null;
  paymentId: string | null;
  purchasedAt: Date | null;
}

/**
 * Batched lookup of each user's ACTIVE Unilevel Plus purchase. Returns a
 * Map<userId, subscription | null> so callers can stitch the value onto
 * their per-row response. Pulls only the latest active purchase per user
 * (if a user somehow has multiples, the most recent wins by `purchasedAt`).
 *
 * `metadata.source` is surfaced verbatim so the FE can distinguish:
 *   - "unilevel_plus_checkout" → user paid via Razorpay
 *   - "reserve_assignment"    → license was assigned from someone else's reserve
 *   - other / null            → legacy or unknown source
 */
async function readUnilevelPlusSubscriptions(
  userIds: Types.ObjectId[]
): Promise<Map<string, _UnilevelPlusSubscriptionInternal | null>> {
  const result = new Map<string, _UnilevelPlusSubscriptionInternal | null>();
  if (userIds.length === 0) return result;

  const purchases = await UnilevelPlusPurchase.find(
    { userId: { $in: userIds }, status: "active" },
    {
      userId: 1,
      amount: 1,
      currency: 1,
      status: 1,
      paymentId: 1,
      purchasedAt: 1,
      "metadata.source": 1,
    }
  )
    .sort({ purchasedAt: -1 })
    .lean();

  // Many-to-one collapse: first hit per user is the most recent active.
  for (const p of purchases as any[]) {
    const key = String(p.userId);
    if (result.has(key)) continue;
    result.set(key, {
      hasUnilevelPlus: true,
      amount: p.amount || 0,
      currency: p.currency || "USD",
      status: "active",
      source: p.metadata?.source ?? null,
      paymentId: p.paymentId || null,
      purchasedAt: p.purchasedAt || null,
    });
  }
  return result;
}

/**
 * Powers the public XAQI analytics endpoints.
 *
 *   - resolveAffiliate                  → maps the public `affiliateId`
 *                                         handle (e.g. "aff_ti6de6kr") to
 *                                         the underlying User doc.
 *   - getDirectReferralsWithStats       → MODE B: with `affiliateId`. Returns
 *                                         the affiliate's level-1 downline,
 *                                         per-row stats = each downline
 *                                         user's OWN seller activity.
 *   - getLeaderboardReferralsWithStats  → MODE A: no `affiliateId`. Returns
 *                                         every user, per-row stats =
 *                                         sum of sales by THAT user's
 *                                         direct downline (a platform-wide
 *                                         leaderboard of "who has the
 *                                         best-selling direct network").
 *   - getIndirectReferralsWithStats     → level-2 through `maxDepth`,
 *                                         still using the legacy
 *                                         commission-only stats source.
 *                                         Will adopt the new helper in a
 *                                         follow-up.
 *   - listOrganizationCategories        → distinct `Organization.category`
 *                                         values, for the partner UI's
 *                                         filter dropdown.
 *
 * Stats source (Mode A + B): `Invoice` where `status === "paid"`. This
 * natively covers every sellable type (product / course / channel /
 * workshop / service / call / office_plan / unilevel_plus /
 * third_party_subscription / ecommerce_item / bat246_membership) because
 * Invoice is the canonical paid-transaction record. Commission amounts are
 * resolved via the linked `CommissionDistribution` doc.
 *
 * Known gap: recurring `OfficeSubscriptionPayment` renewals don't flow
 * through Invoice and aren't yet counted. The current Garage data treats
 * those as platform-internal revenue, not user-attributable sales, so the
 * gap is acceptable for v1.
 */

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

export type AnalyticsRange = "1d" | "7d" | "30d" | "90d" | "all";

export interface StatsFilters {
  officeId?: string;
  category?: string;
  range?: AnalyticsRange;
}

/**
 * Per-row stats. Legacy field names (totalSalesVolumeCents, salesCount,
 * businessesCount, currency) are preserved unchanged so existing callers of
 * `/affiliate/direct` keep working. New fields are added alongside.
 */
export interface DirectReferralStats {
  totalSalesVolumeCents: number;
  currency: string;
  salesCount: number;
  businessesCount: number;
  // New in v2:
  uniqueCustomers: number;
  uniqueProducts: number;
  commissionsDistributedCents: number;
  commissionsEarnedCents: number;
}

/**
 * Per-row Unilevel Plus snapshot. Surfaces whether the affiliate has an
 * active UP plan and HOW they got it — `source` distinguishes between
 * a real Razorpay-paid purchase ("unilevel_plus_checkout") and a reserve
 * license that was assigned to them by someone else ("reserve_assignment").
 * `null` when the row's user has no active UP purchase.
 */
export interface UnilevelPlusSubscription {
  hasUnilevelPlus: true;
  amount: number;
  currency: string;
  status: "active";
  source: string | null;
  paymentId: string | null;
  purchasedAt: Date | null;
}

export interface DirectReferralRow {
  affiliateId: string | null;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  country: string | null;
  joinedAt: Date | null;
  stats: DirectReferralStats;
  subscription: UnilevelPlusSubscription | null;
}

export interface GetDirectReferralsResult {
  items: DirectReferralRow[];
  total: number;
  mode: "affiliate-downline";
}

/**
 * Mode A row — same shape as the direct row plus `directReferralsCount`
 * so partners can tell at a glance "this user has 12 directs and their
 * combined activity is X".
 */
export interface LeaderboardRow extends DirectReferralRow {
  directReferralsCount: number;
}

export interface GetLeaderboardResult {
  items: LeaderboardRow[];
  total: number;
  mode: "leaderboard";
}

export interface IndirectReferralRow extends DirectReferralRow {
  /** Depth from caller. 2 = my referrals' referrals, 3 = a step deeper, … */
  level: number;
  /**
   * `_id` of the level-1 ancestor (one of caller's direct downline) that
   * originally brought this user into the tree. Null only in degenerate
   * cases (e.g. stale `referredBy` pointing at a deleted user).
   */
  directUplineId: string | null;
}

export interface GetIndirectReferralsResult {
  items: IndirectReferralRow[];
  total: number;
}

// ───────────────────────────────────────────────────────────────────────
// Small helpers
// ───────────────────────────────────────────────────────────────────────

export function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rangeToDate(range?: AnalyticsRange | string): Date | null {
  if (!range || range === "all") return null;
  const days: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
  const n = days[range];
  if (!n) return null;
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * Resolve a category name → list of non-parent orgIds. Used to translate
 * the `category` filter into an `organizationId $in` clause.
 */
async function resolveOrgIdsForCategory(
  category: string
): Promise<Types.ObjectId[]> {
  const rx = new RegExp(`^${escapeRx(category)}$`, "i");
  const orgs = await Organization.find(
    { category: rx, parent: { $ne: true } },
    { _id: 1 }
  ).lean();
  return (orgs as any[]).map((o) => o._id);
}

/**
 * Convert the user-facing `StatsFilters` into Mongo-ready pieces.
 *
 *   - `paidAfter`: `null` = no time filter (range=all or unset).
 *   - `orgIdFilter`:
 *       null  → no org filter at all (every org's invoices match)
 *       []    → caller specified filters that don't match any org →
 *               every stat is 0 (short-circuit at callsites)
 *       […]   → list of orgIds to restrict invoices to
 */
export async function resolveStatsFilters(filters: StatsFilters): Promise<{
  paidAfter: Date | null;
  orgIdFilter: Types.ObjectId[] | null;
}> {
  const paidAfter = rangeToDate(filters.range);
  let orgIdFilter: Types.ObjectId[] | null = null;
  if (filters.category && filters.category.length > 0) {
    orgIdFilter = await resolveOrgIdsForCategory(filters.category);
  }
  if (filters.officeId) {
    const explicit = new Types.ObjectId(filters.officeId);
    orgIdFilter = orgIdFilter
      ? orgIdFilter.filter((id) => id.equals(explicit))
      : [explicit];
  }
  return { paidAfter, orgIdFilter };
}

/**
 * Resolve a public `affiliateId` handle into the owning User document.
 * Returns null if the handle is unknown.
 */
export async function resolveAffiliate(affiliateId: string) {
  return User.findOne({ affiliateId })
    .select("_id affiliateId name email")
    .lean();
}

/**
 * GET /public/analytics/categories — every category in the admin-managed
 * OrgCategory taxonomy. Sourced from the collection now (not from
 * Organization.distinct) so the leaderboard filter matches the org
 * picker exactly. Empty-category orgs simply won't appear in
 * category-filtered leaderboards.
 */
export async function listOrganizationCategories(): Promise<string[]> {
  const { listCategoryNames } = await import("./orgCategory");
  return listCategoryNames();
}

// ───────────────────────────────────────────────────────────────────────
// Zero-stats sentinel
// ───────────────────────────────────────────────────────────────────────

const ZERO_STATS: DirectReferralStats = {
  totalSalesVolumeCents: 0,
  currency: "USD",
  salesCount: 0,
  businessesCount: 0,
  uniqueCustomers: 0,
  uniqueProducts: 0,
  commissionsDistributedCents: 0,
  commissionsEarnedCents: 0,
};

function zeroStats(): DirectReferralStats {
  return { ...ZERO_STATS };
}

// ───────────────────────────────────────────────────────────────────────
// buildSellerStatsMap — keyed by sellerId (Mode B + future indirect)
// ───────────────────────────────────────────────────────────────────────

/**
 * For a batch of sellerIds, return per-seller stats sourced from
 * `Invoice` (status: "paid") + `CommissionDistribution` (commissions
 * earned). Four parallel sub-aggregations:
 *
 *   1. Invoice $group by sellerId → volume, count, distinct orgs/customers
 *   2. Invoice unwind lineItems → distinct (itemType, itemId) → uniqueProducts
 *   3. Invoice $lookup commissionDistributionId → sum totalCommissionAmount
 *      → commissionsDistributed (platform-paid commissions FROM this seller's sales)
 *   4. CommissionDistribution { "commissions.userId" $in sellerIds } → sum
 *      → commissionsEarned (commissions THIS user received as upline)
 *
 * Filters (officeId, category, range) gate sub-queries 1-3. The earned
 * commissions query uses CommissionDistribution.createdAt + .orgId because
 * the CD row carries those independently of Invoice.
 */
export async function buildSellerStatsMap(
  sellerIds: Types.ObjectId[],
  filters: StatsFilters
): Promise<Map<string, DirectReferralStats>> {
  const result = new Map<string, DirectReferralStats>();
  if (sellerIds.length === 0) return result;

  const { paidAfter, orgIdFilter } = await resolveStatsFilters(filters);
  // Filter specified but no matching orgs → every row is zero.
  if (orgIdFilter !== null && orgIdFilter.length === 0) return result;

  const invoiceMatch: any = {
    sellerId: { $in: sellerIds },
    status: "paid",
  };
  if (paidAfter) invoiceMatch.paidAt = { $gte: paidAfter };
  if (orgIdFilter) invoiceMatch.organizationId = { $in: orgIdFilter };

  const [salesAgg, productsAgg, commsDistAgg, commsEarnedBy] =
    await Promise.all([
      // (1) Per-seller volume + count + distinct orgs/customers
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: "$sellerId",
            totalSalesVolumeCents: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
            distinctOrgs: { $addToSet: "$organizationId" },
            distinctCustomers: { $addToSet: "$userId" },
            currency: { $first: "$itemCurrency" },
          },
        },
      ]),
      // (2) Distinct products per seller
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $unwind: "$lineItems" },
        {
          $group: {
            _id: {
              sellerId: "$sellerId",
              itemType: "$lineItems.itemType",
              itemId: "$lineItems.itemId",
            },
          },
        },
        {
          $group: {
            _id: "$_id.sellerId",
            uniqueProducts: { $sum: 1 },
          },
        },
      ]),
      // (3) Commissions distributed (sum CommissionDistribution.totalCommissionAmount via Invoice link)
      Invoice.aggregate([
        {
          $match: {
            ...invoiceMatch,
            commissionDistributionId: { $exists: true, $ne: null },
          },
        },
        {
          $lookup: {
            from: "commissiondistributions",
            localField: "commissionDistributionId",
            foreignField: "_id",
            as: "cd",
            pipeline: [{ $project: { totalCommissionAmount: 1 } }],
          },
        },
        { $unwind: "$cd" },
        {
          $group: {
            _id: "$sellerId",
            commissionsDistributedCents: {
              $sum: "$cd.totalCommissionAmount",
            },
          },
        },
      ]),
      // (4) Commissions earned = lifetime affiliate-wallet earnings.
      //     The wallet is the canonical source — same number the user sees
      //     in their own wallet UI. Lifetime (not range-scoped); see helper.
      readWalletEarningsCents(sellerIds),
    ]);

  // Index the sub-results by sellerId for cheap stitching.
  const productsBy = new Map<string, number>();
  for (const p of productsAgg as any[]) {
    productsBy.set(String(p._id), p.uniqueProducts || 0);
  }
  const commsDistBy = new Map<string, number>();
  for (const c of commsDistAgg as any[]) {
    commsDistBy.set(String(c._id), c.commissionsDistributedCents || 0);
  }

  // Stitch: sellers that have at least one sale appear in salesAgg; sellers
  // that only EARNED commissions still need a row.
  for (const s of salesAgg as any[]) {
    const sid = String(s._id);
    result.set(sid, {
      totalSalesVolumeCents: s.totalSalesVolumeCents || 0,
      currency: s.currency || "USD",
      salesCount: s.salesCount || 0,
      businessesCount: (s.distinctOrgs || []).length,
      uniqueCustomers: (s.distinctCustomers || []).length,
      uniqueProducts: productsBy.get(sid) || 0,
      commissionsDistributedCents: commsDistBy.get(sid) || 0,
      commissionsEarnedCents: commsEarnedBy.get(sid) || 0,
    });
  }
  for (const [sid, earned] of commsEarnedBy) {
    if (!result.has(sid) && earned > 0) {
      result.set(sid, { ...ZERO_STATS, commissionsEarnedCents: earned });
    }
  }

  return result;
}

// ───────────────────────────────────────────────────────────────────────
// buildParentAggregateStatsMap — keyed by parent (Mode A)
// ───────────────────────────────────────────────────────────────────────

/**
 * For a batch of PARENT userIds, return per-parent stats aggregated across
 * their level-1 downline's sales activity. Each parent's stats are
 * computed correctly (distinct counts use Mongo `$addToSet`) instead of
 * naively summing per-direct stats — naive summing would double-count an
 * org/customer/product shared across multiple directs.
 *
 * Step 1: pull the directs of the page in one query.
 * Step 2: aggregate Invoice grouped by `seller.referredBy` (= parent).
 * Step 3: aggregate CommissionDistribution similarly for commissions earned.
 */
export async function buildParentAggregateStatsMap(
  parentIds: Types.ObjectId[],
  filters: StatsFilters
): Promise<{
  statsByParent: Map<string, DirectReferralStats>;
  directsByParent: Map<string, Types.ObjectId[]>;
}> {
  const statsByParent = new Map<string, DirectReferralStats>();
  const directsByParent = new Map<string, Types.ObjectId[]>();
  if (parentIds.length === 0) return { statsByParent, directsByParent };

  // Step 1: who are the directs?
  const directs = await User.find(
    { referredBy: { $in: parentIds } },
    { _id: 1, referredBy: 1 }
  ).lean();
  if (directs.length === 0) return { statsByParent, directsByParent };

  for (const d of directs as any[]) {
    const pid = String(d.referredBy);
    if (!directsByParent.has(pid)) directsByParent.set(pid, []);
    directsByParent.get(pid)!.push(d._id);
  }

  const allDirectIds: Types.ObjectId[] = (directs as any[]).map((d) => d._id);

  const { paidAfter, orgIdFilter } = await resolveStatsFilters(filters);
  if (orgIdFilter !== null && orgIdFilter.length === 0) {
    return { statsByParent, directsByParent };
  }

  const invoiceMatch: any = {
    sellerId: { $in: allDirectIds },
    status: "paid",
  };
  if (paidAfter) invoiceMatch.paidAt = { $gte: paidAfter };
  if (orgIdFilter) invoiceMatch.organizationId = { $in: orgIdFilter };

  const sellerLookup = [
    {
      $lookup: {
        from: "users",
        localField: "sellerId",
        foreignField: "_id",
        as: "seller",
        pipeline: [{ $project: { referredBy: 1 } }],
      },
    },
    { $unwind: "$seller" },
    { $match: { "seller.referredBy": { $in: parentIds } } }, // safety filter
  ];

  const [salesAgg, productsAgg, commsDistAgg, commsEarnedBy] =
    await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        ...sellerLookup,
        {
          $group: {
            _id: "$seller.referredBy",
            totalSalesVolumeCents: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
            distinctOrgs: { $addToSet: "$organizationId" },
            distinctCustomers: { $addToSet: "$userId" },
            currency: { $first: "$itemCurrency" },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        ...sellerLookup,
        { $unwind: "$lineItems" },
        {
          $group: {
            _id: {
              parentId: "$seller.referredBy",
              itemType: "$lineItems.itemType",
              itemId: "$lineItems.itemId",
            },
          },
        },
        {
          $group: {
            _id: "$_id.parentId",
            uniqueProducts: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            ...invoiceMatch,
            commissionDistributionId: { $exists: true, $ne: null },
          },
        },
        ...sellerLookup,
        {
          $lookup: {
            from: "commissiondistributions",
            localField: "commissionDistributionId",
            foreignField: "_id",
            as: "cd",
            pipeline: [{ $project: { totalCommissionAmount: 1 } }],
          },
        },
        { $unwind: "$cd" },
        {
          $group: {
            _id: "$seller.referredBy",
            commissionsDistributedCents: {
              $sum: "$cd.totalCommissionAmount",
            },
          },
        },
      ]),
      // commissionsEarnedCents = lifetime affiliate-wallet earnings of the
      // ROW's user. The wallet is the canonical source — same number the
      // user sees in their own wallet UI. Keyed by parentId so the row maps
      // 1:1 to the user the leaderboard line represents.
      readWalletEarningsCents(parentIds),
    ]);

  const productsBy = new Map<string, number>();
  for (const p of productsAgg as any[]) {
    productsBy.set(String(p._id), p.uniqueProducts || 0);
  }
  const commsDistBy = new Map<string, number>();
  for (const c of commsDistAgg as any[]) {
    commsDistBy.set(String(c._id), c.commissionsDistributedCents || 0);
  }

  for (const s of salesAgg as any[]) {
    const pid = String(s._id);
    statsByParent.set(pid, {
      totalSalesVolumeCents: s.totalSalesVolumeCents || 0,
      currency: s.currency || "USD",
      salesCount: s.salesCount || 0,
      businessesCount: (s.distinctOrgs || []).length,
      uniqueCustomers: (s.distinctCustomers || []).length,
      uniqueProducts: productsBy.get(pid) || 0,
      commissionsDistributedCents: commsDistBy.get(pid) || 0,
      commissionsEarnedCents: commsEarnedBy.get(pid) || 0,
    });
  }
  // Parents who have wallet earnings but no recorded sales by their downline
  // (e.g., earnings from indirect / cross-org / legacy payouts) still need
  // a row so the column isn't silently dropped.
  for (const [pid, earned] of commsEarnedBy) {
    if (!statsByParent.has(pid) && earned > 0) {
      statsByParent.set(pid, { ...ZERO_STATS, commissionsEarnedCents: earned });
    }
  }

  return { statsByParent, directsByParent };
}

// ───────────────────────────────────────────────────────────────────────
// Mode B: with affiliateId (preserved behaviour, extended stats)
// ───────────────────────────────────────────────────────────────────────

// ── Ranking comparator (shared by all three modes) ─────────────────────
// Every mode ranks the WHOLE in-scope field by the requested metric, THEN
// slices the page — so a non-default sort surfaces the true top rows, not
// just a reshuffle of the first page. `revenue` is the default/legacy order.
export type AnalyticsSort =
  | "revenue"
  | "commissions"
  | "sales"
  | "businesses"
  | "newest";

function rankComparator(sort: AnalyticsSort = "revenue") {
  const metric = (s: DirectReferralStats): number =>
    sort === "commissions"
      ? s.commissionsEarnedCents || 0
      : sort === "sales"
        ? s.salesCount || 0
        : sort === "businesses"
          ? s.businessesCount || 0
          : s.totalSalesVolumeCents || 0;
  return (
    a: { stats: DirectReferralStats; createdAt: Date | null },
    b: { stats: DirectReferralStats; createdAt: Date | null }
  ): number => {
    const at = a.createdAt ? a.createdAt.getTime() : 0;
    const bt = b.createdAt ? b.createdAt.getTime() : 0;
    if (sort === "newest") return bt - at;
    const primary = metric(b.stats) - metric(a.stats);
    if (primary !== 0) return primary;
    // Stable secondary: headline revenue, then newest, so equal-metric rows
    // keep a deterministic order across pages.
    const rev =
      (b.stats.totalSalesVolumeCents || 0) - (a.stats.totalSalesVolumeCents || 0);
    if (rev !== 0) return rev;
    return bt - at;
  };
}

export async function getDirectReferralsWithStats(params: {
  parentUserId: string;
  country?: string;
  officeId?: string;
  category?: string;
  range?: AnalyticsRange;
  sort?: AnalyticsSort;
  limit: number;
  offset: number;
}): Promise<GetDirectReferralsResult> {
  const {
    parentUserId,
    country,
    officeId,
    category,
    range,
    sort,
    limit,
    offset,
  } = params;

  // `country` filters the user list (rows); office/category/range filter
  // the stats. This matches the locked decision (country = row scope, the
  // others = sales scope).
  const filter: any = { referredBy: new Types.ObjectId(parentUserId) };
  if (country && country.length > 0) {
    filter.country = new RegExp(`^${escapeRx(country)}$`, "i");
  }

  // Rank the WHOLE direct field by the requested metric, THEN slice — so a
  // non-revenue sort surfaces true top rows, not a reshuffle of page 1.
  // A person's level-1 directs are bounded, so all-stats is cheap.
  const allDirects = await User.find(filter).select("_id createdAt").lean();
  const total = allDirects.length;
  if (total === 0) {
    return { items: [], total: 0, mode: "affiliate-downline" };
  }
  const allIds = (allDirects as any[]).map((u) => u._id);
  const statsForRank = await buildSellerStatsMap(allIds, {
    officeId,
    category,
    range,
  });
  const ranked = (allDirects as any[])
    .map((u) => ({
      userId: u._id,
      createdAt: u.createdAt || null,
      stats: statsForRank.get(String(u._id)) || zeroStats(),
    }))
    .sort(rankComparator(sort));

  const pageSlice = ranked.slice(offset, offset + limit);
  if (pageSlice.length === 0) {
    return { items: [], total, mode: "affiliate-downline" };
  }
  const pageIds = pageSlice.map((r) => r.userId);
  const [pageUsers, subsByUser] = await Promise.all([
    User.find({ _id: { $in: pageIds } })
      .select("affiliateId name email phone profilePicture country createdAt")
      .lean(),
    readUnilevelPlusSubscriptions(pageIds),
  ]);
  const userById = new Map(
    (pageUsers as any[]).map((u) => [String(u._id), u])
  );

  const items: DirectReferralRow[] = pageSlice.map((r) => {
    const uid = String(r.userId);
    const u: any = userById.get(uid) || {};
    return {
      affiliateId: u.affiliateId || null,
      userId: uid,
      name: u.name || null,
      email: u.email || null,
      phone: u.phone || null,
      profilePicture: u.profilePicture || null,
      country: u.country || null,
      joinedAt: u.createdAt || null,
      stats: r.stats,
      subscription: subsByUser.get(uid) ?? null,
    };
  });

  return { items, total, mode: "affiliate-downline" };
}

// ───────────────────────────────────────────────────────────────────────
// Mode A: no affiliateId — platform-wide leaderboard
// ───────────────────────────────────────────────────────────────────────

export async function getLeaderboardReferralsWithStats(params: {
  country?: string;
  officeId?: string;
  category?: string;
  range?: AnalyticsRange;
  sort?: AnalyticsSort;
  limit: number;
  offset: number;
}): Promise<GetLeaderboardResult> {
  const { country, officeId, category, range, sort, limit, offset } = params;

  // Org/country scope is applied to the USER list (rows of the leaderboard).
  const userFilter: any = {};
  if (officeId) {
    userFilter["organizations.organization"] = new Types.ObjectId(officeId);
  }
  if (country && country.length > 0) {
    userFilter.country = new RegExp(`^${escapeRx(country)}$`, "i");
  }

  // ── 1. Rank the WHOLE field, then page. ───────────────────────────
  // The previous implementation paged users by createdAt first and
  // computed stats only for the visible 200 rows — which meant a top
  // performer who happened to sign up earlier than the cutoff never
  // surfaced. Fix: pull every user in scope (just _id + createdAt for
  // the secondary sort), compute downline-aggregate stats for all of
  // them in one go, sort by revenue desc, THEN slice the requested page.
  //
  // Cost: one extra User.find returning {_id, createdAt} for every
  // member of the org (≈ a few KB per 1000 users — cheap). The stats
  // aggregations dominate runtime either way; their cost scales with
  // the number of paid invoices in scope, not the number of users.
  const allUsers = await User.find(userFilter)
    .select("_id createdAt")
    .lean();
  const total = allUsers.length;
  if (total === 0) {
    return { items: [], total: 0, mode: "leaderboard" };
  }
  const allIds = (allUsers as any[]).map((u) => u._id);

  const { statsByParent, directsByParent } = await buildParentAggregateStatsMap(
    allIds,
    { officeId, category, range }
  );

  // ── 2. Compose the ranked list. ───────────────────────────────────
  // Sort priority:
  //   1. totalSalesVolumeCents (the headline "network revenue" metric)
  //   2. commissionsEarnedCents (wallet earnings — surfaces strong
  //                              earners whose downline volume happens
  //                              to be small but lifetime payouts large)
  //   3. createdAt desc (deterministic tiebreaker; matches the prior
  //                      sort so all-zero rows preserve their order)
  type Ranked = {
    userId: Types.ObjectId;
    createdAt: Date | null;
    stats: DirectReferralStats;
    directs: Types.ObjectId[];
  };
  const ranked: Ranked[] = (allUsers as any[]).map((u) => {
    const uid = String(u._id);
    return {
      userId: u._id,
      createdAt: u.createdAt || null,
      stats: statsByParent.get(uid) || zeroStats(),
      directs: directsByParent.get(uid) || [],
    };
  });
  ranked.sort(rankComparator(sort));

  // ── 3. Slice the page, then hydrate user fields + UP subscriptions for
  //       just those rows. Both lookups in parallel — bounded by limit.
  const pageSlice = ranked.slice(offset, offset + limit);
  if (pageSlice.length === 0) {
    return { items: [], total, mode: "leaderboard" };
  }
  const pageIds = pageSlice.map((r) => r.userId);
  const [pageUsers, subsByUser] = await Promise.all([
    User.find({ _id: { $in: pageIds } })
      .select("affiliateId name email phone profilePicture country createdAt")
      .lean(),
    readUnilevelPlusSubscriptions(pageIds),
  ]);
  const userById = new Map<string, any>();
  for (const u of pageUsers as any[]) userById.set(String(u._id), u);

  const items: LeaderboardRow[] = pageSlice.map((r) => {
    const uid = String(r.userId);
    const u = userById.get(uid) || {};
    return {
      affiliateId: u.affiliateId || null,
      userId: uid,
      name: u.name || null,
      email: u.email || null,
      phone: u.phone || null,
      profilePicture: u.profilePicture || null,
      country: u.country || null,
      joinedAt: u.createdAt || null,
      directReferralsCount: r.directs.length,
      stats: r.stats,
      subscription: subsByUser.get(uid) ?? null,
    };
  });

  return { items, total, mode: "leaderboard" };
}

// ───────────────────────────────────────────────────────────────────────
// Legacy: still used by getIndirectReferralsWithStats below
// ───────────────────────────────────────────────────────────────────────

/**
 * Original commission-only stats helper. Kept for the indirect endpoint
 * pending its own migration to `buildSellerStatsMap`.
 */
async function buildAffiliateStatsMap(
  userIds: Types.ObjectId[]
): Promise<Map<string, DirectReferralStats>> {
  const result = new Map<string, DirectReferralStats>();
  if (userIds.length === 0) return result;

  const statsAgg = await CommissionDistribution.aggregate([
    {
      $match: {
        "commissions.userId": { $in: userIds },
        status: "completed",
      },
    },
    {
      $project: {
        saleAmount: 1,
        orgId: 1,
        currency: 1,
        relevantCommissions: {
          $filter: {
            input: "$commissions",
            as: "c",
            cond: { $in: ["$$c.userId", userIds] },
          },
        },
      },
    },
    { $unwind: "$relevantCommissions" },
    {
      $group: {
        _id: { userId: "$relevantCommissions.userId", saleId: "$_id" },
        saleAmount: { $first: "$saleAmount" },
        orgId: { $first: "$orgId" },
        currency: { $first: "$currency" },
      },
    },
    {
      $group: {
        _id: "$_id.userId",
        totalSalesVolumeCents: { $sum: "$saleAmount" },
        salesCount: { $sum: 1 },
        distinctOrgs: { $addToSet: "$orgId" },
        currency: { $first: "$currency" },
      },
    },
    {
      $project: {
        _id: 1,
        totalSalesVolumeCents: 1,
        salesCount: 1,
        businessesCount: { $size: "$distinctOrgs" },
        currency: 1,
      },
    },
  ]);

  for (const s of statsAgg as any[]) {
    result.set(String(s._id), {
      ...ZERO_STATS,
      totalSalesVolumeCents: s.totalSalesVolumeCents || 0,
      currency: s.currency || "USD",
      salesCount: s.salesCount || 0,
      businessesCount: s.businessesCount || 0,
    });
  }
  return result;
}

// ───────────────────────────────────────────────────────────────────────
// Indirect (level 2 → maxDepth) — unchanged for now
// ───────────────────────────────────────────────────────────────────────

interface GraphRow {
  _id: Types.ObjectId;
  affiliateId?: string;
  name?: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
  country?: string;
  createdAt?: Date;
  referredBy?: Types.ObjectId;
  depth: number;
}

export async function getIndirectReferralsWithStats(params: {
  parentUserId: string;
  country?: string;
  officeId?: string;
  level?: number;
  maxDepth: number;
  sort?: AnalyticsSort;
  limit: number;
  offset: number;
}): Promise<GetIndirectReferralsResult> {
  const {
    parentUserId,
    country,
    officeId,
    level,
    maxDepth,
    sort,
    limit,
    offset,
  } = params;

  const graphMaxDepth = Math.max(1, maxDepth - 1);

  const pipeline: any[] = [
    { $match: { _id: new Types.ObjectId(parentUserId) } },
    {
      $graphLookup: {
        from: "users",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "referredBy",
        as: "downline",
        maxDepth: graphMaxDepth,
        depthField: "depth",
      },
    },
    { $unwind: "$downline" },
    { $match: { "downline.depth": { $gte: 1 } } },
  ];

  if (country && country.length > 0) {
    pipeline.push({
      $match: {
        "downline.country": new RegExp(`^${escapeRx(country)}$`, "i"),
      },
    });
  }
  if (officeId) {
    pipeline.push({
      $match: {
        "downline.organizations.organization": new Types.ObjectId(officeId),
      },
    });
  }
  if (level !== undefined) {
    pipeline.push({ $match: { "downline.depth": level - 1 } });
  }

  pipeline.push(
    {
      $sort: {
        "downline.depth": 1,
        "downline.createdAt": -1,
        "downline._id": -1,
      },
    },
    {
      $project: {
        _id: "$downline._id",
        affiliateId: "$downline.affiliateId",
        name: "$downline.name",
        email: "$downline.email",
        phone: "$downline.phone",
        profilePicture: "$downline.profilePicture",
        country: "$downline.country",
        createdAt: "$downline.createdAt",
        referredBy: "$downline.referredBy",
        depth: "$downline.depth",
      },
    }
  );

  const fullList: GraphRow[] = await User.aggregate(pipeline, {
    allowDiskUse: true,
  });

  const directUplineMap = new Map<string, string>();
  for (const row of fullList) {
    if (row.depth === 1) {
      if (row.referredBy) {
        directUplineMap.set(String(row._id), String(row.referredBy));
      }
    } else {
      const parentKey = row.referredBy ? String(row.referredBy) : null;
      const parentDirect = parentKey
        ? directUplineMap.get(parentKey)
        : undefined;
      if (parentDirect) {
        directUplineMap.set(String(row._id), parentDirect);
      }
    }
  }

  const total = fullList.length;
  if (total === 0) return { items: [], total: 0 };

  // Rank the WHOLE subtree by the requested metric, THEN slice — so a
  // non-default sort surfaces true top rows, not a reshuffle of page 1.
  // Stats are computed for every row in scope (same accepted cost pattern
  // as the platform leaderboard).
  const statsByUser = await buildAffiliateStatsMap(
    fullList.map((r) => r._id)
  );
  const ranked = fullList
    .map((r) => ({
      row: r,
      createdAt: r.createdAt || null,
      stats: statsByUser.get(String(r._id)) || zeroStats(),
    }))
    .sort(rankComparator(sort));

  const page = ranked.slice(offset, offset + limit);
  if (page.length === 0) return { items: [], total };

  const pageIds = page.map((p) => p.row._id);
  const subsByUser = await readUnilevelPlusSubscriptions(pageIds);

  const items: IndirectReferralRow[] = page.map((p) => {
    const r = p.row;
    const uid = String(r._id);
    return {
      affiliateId: r.affiliateId || null,
      userId: uid,
      name: r.name || null,
      email: r.email || null,
      phone: r.phone || null,
      profilePicture: r.profilePicture || null,
      country: r.country || null,
      joinedAt: r.createdAt || null,
      level: r.depth + 1,
      directUplineId: directUplineMap.get(uid) || null,
      stats: p.stats,
      subscription: subsByUser.get(uid) ?? null,
    };
  });

  return { items, total };
}
