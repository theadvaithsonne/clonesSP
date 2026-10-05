import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAnalyticsKey } from "../middleware/analyticsKey";
import { ok, fail } from "../utils/http";
import {
  resolveAffiliate,
  getDirectReferralsWithStats,
  getLeaderboardReferralsWithStats,
  getIndirectReferralsWithStats,
  listOrganizationCategories,
  type AnalyticsRange,
} from "../services/affiliateAnalytics";
import { getRowDetails } from "../services/affiliateAnalyticsDetail";

/**
 * Public affiliate-network analytics, guarded by the X-API-KEY header
 * matched against `process.env.ANALYTICS_API_KEY` (single shared value).
 *
 * Mount point: /public/analytics
 *
 *   GET /affiliate/direct    → two-mode:
 *                                 • with `affiliateId`: that affiliate's
 *                                   level-1 downline, each row carrying
 *                                   the downline user's OWN seller stats.
 *                                 • without `affiliateId`: platform-wide
 *                                   leaderboard, each row carrying the
 *                                   sum of sales by that user's direct
 *                                   downline.
 *   GET /affiliate/indirect  → level 2 → maxDepth, with `level` +
 *                              `directUplineId` per row.
 *   GET /categories          → distinct `Organization.category` values for
 *                              partner UI filter dropdowns.
 */
const router = Router();

// Every endpoint under this router demands the shared analytics API key.
router.use(requireAnalyticsKey);

// `affiliateId` is now OPTIONAL — its presence picks the mode. New filter
// params (`category`, `range`) are accepted in both modes.
const directQuerySchema = z.object({
  affiliateId: z
    .string()
    .regex(/^aff_[a-z0-9]+$/i, "Invalid affiliateId format (expected aff_xxxxxx)")
    .optional(),
  country: z.string().max(120).optional(),
  officeId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "officeId must be a valid ObjectId")
    .optional(),
  category: z.string().max(120).optional(),
  range: z
    .enum(["1d", "7d", "30d", "90d", "all"])
    .optional()
    .default("all"),
  // Server-side ranking metric — the whole in-scope field is ranked by this
  // BEFORE paging, so a non-default sort surfaces true top rows.
  sort: z
    .enum(["revenue", "commissions", "sales", "businesses", "newest"])
    .optional()
    .default("revenue"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /public/analytics/affiliate/direct
 *
 * Two modes (branches on `affiliateId` presence):
 *
 *   • with `affiliateId`  → returns that affiliate's level-1 downline.
 *                           Per-row stats = the downline user's OWN seller
 *                           activity (sales they made, commissions earned).
 *                           This is the existing behaviour, with extended
 *                           stat fields.
 *
 *   • without `affiliateId` → returns every user as a leaderboard row.
 *                             Per-row stats = the sum of sales by THAT
 *                             user's direct downline. Lets partners
 *                             discover "who has the best-performing direct
 *                             network on the platform".
 *
 * Stats source: `Invoice (status: paid)` for sales metrics +
 * `CommissionDistribution` for commissions earned. Filterable by country
 * (rows), office, org category, and time range (sales).
 */
router.get("/affiliate/direct", async (req, res) => {
  try {
    const parsed = directQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      // Zod v4 exposes the issue list as `.issues` (renamed from `.errors`).
      // Guard against either name so older callers still produce a useful msg.
      const issues =
        (parsed.error as any).issues || (parsed.error as any).errors || [];
      return res
        .status(400)
        .json(fail(issues[0]?.message || "Invalid query parameters"));
    }

    const { affiliateId, country, officeId, category, range, sort, limit, offset } =
      parsed.data;

    // Light cache hint, applied in both modes. 60s — short enough that
    // fresh sales surface quickly, long enough to absorb dashboard
    // hot-loops. `private` since the body varies by X-API-KEY.
    res.setHeader("Cache-Control", "private, max-age=60");

    // ── Mode B: with affiliateId → affiliate-downline ──────────────────
    if (affiliateId) {
      const affiliate = await resolveAffiliate(affiliateId);
      if (!affiliate) {
        return res
          .status(404)
          .json(fail(`No affiliate found for ${affiliateId}`));
      }

      const { items, total, mode } = await getDirectReferralsWithStats({
        parentUserId: String(affiliate._id),
        country,
        officeId,
        category,
        range: range as AnalyticsRange,
        sort: sort as any,
        limit,
        offset,
      });

      const hasMore = offset + items.length < total;
      const nextOffset = hasMore ? offset + items.length : null;

      return res.json(
        ok({
          mode,
          affiliate: {
            affiliateId: (affiliate as any).affiliateId,
            name: (affiliate as any).name || null,
            email: (affiliate as any).email || null,
          },
          directReferralsCount: total,
          items,
          // Pagination cursor — partner clients walk the list by passing
          // back `nextOffset` until `hasMore` is false. `limit` echoes
          // back the actual page size used (capped server-side at 200).
          pagination: { limit, offset, total, hasMore, nextOffset },
          // Top-level fields kept for backwards-compat with the initial
          // /affiliate/direct contract.
          limit,
          offset,
          total,
        })
      );
    }

    // ── Mode A: no affiliateId → leaderboard ───────────────────────────
    const { items, total, mode } = await getLeaderboardReferralsWithStats({
      country,
      officeId,
      category,
      range: range as AnalyticsRange,
      sort: sort as any,
      limit,
      offset,
    });

    const hasMore = offset + items.length < total;
    const nextOffset = hasMore ? offset + items.length : null;

    return res.json(
      ok({
        mode,
        // `affiliate` is null in leaderboard mode — the response isn't
        // scoped to one affiliate's view.
        affiliate: null,
        items,
        pagination: { limit, offset, total, hasMore, nextOffset },
        limit,
        offset,
        total,
      })
    );
  } catch (error: any) {
    console.error("[publicAnalytics] /affiliate/direct error:", error);
    return res
      .status(500)
      .json(fail(error?.message || "Failed to fetch direct referrals"));
  }
});

/**
 * GET /public/analytics/categories
 *
 * Distinct, non-empty `Organization.category` values across non-parent
 * orgs. Used to populate the partner UI's category-filter dropdown. Cached
 * for 5 minutes — categories change rarely.
 */
router.get("/categories", async (_req, res) => {
  try {
    const categories = await listOrganizationCategories();
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json(ok({ categories, count: categories.length }));
  } catch (error: any) {
    console.error("[publicAnalytics] /categories error:", error);
    return res
      .status(500)
      .json(fail(error?.message || "Failed to fetch categories"));
  }
});

// ───────────────────────────────────────────────────────────────────────
// Indirect (level 2 → maxDepth)
// ───────────────────────────────────────────────────────────────────────

const indirectQuerySchema = z.object({
  affiliateId: z
    .string()
    .regex(/^aff_[a-z0-9]+$/i, "Invalid affiliateId format (expected aff_xxxxxx)"),
  country: z.string().max(120).optional(),
  officeId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "officeId must be a valid ObjectId")
    .optional(),
  // Caller-facing level (≥ 2). Upper bound is checked AGAIN at runtime
  // against the request's maxDepth — Zod can't see two fields at once.
  level: z.coerce.number().int().min(2).max(16).optional(),
  // Hard ceiling 15 bounds worst-case $graphLookup work. Default 10 covers
  // the vast majority of real-world networks.
  maxDepth: z.coerce.number().int().min(2).max(15).optional().default(10),
  sort: z
    .enum(["revenue", "commissions", "sales", "businesses", "newest"])
    .optional()
    .default("revenue"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /public/analytics/affiliate/indirect
 *
 * Returns every user beneath level 1 in the caller's downline tree, down to
 * `maxDepth`. Each row carries `level` (2+) and `directUplineId` (the
 * level-1 ancestor who originally brought that user in). Filterable by
 * country, office, and (optionally) a single specific `level`. Paginated.
 */
router.get("/affiliate/indirect", async (req, res) => {
  try {
    const parsed = indirectQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issues =
        (parsed.error as any).issues || (parsed.error as any).errors || [];
      return res
        .status(400)
        .json(fail(issues[0]?.message || "Invalid query parameters"));
    }

    const { affiliateId, country, officeId, level, maxDepth, sort, limit, offset } =
      parsed.data;

    // Cross-field guard Zod can't express: a requested `level` must be
    // within the depth we'll actually traverse, otherwise the response
    // would silently always be empty.
    if (level !== undefined && level > maxDepth) {
      return res
        .status(400)
        .json(
          fail(`level (${level}) cannot exceed maxDepth (${maxDepth})`)
        );
    }

    const affiliate = await resolveAffiliate(affiliateId);
    if (!affiliate) {
      return res
        .status(404)
        .json(fail(`No affiliate found for ${affiliateId}`));
    }

    const { items, total } = await getIndirectReferralsWithStats({
      parentUserId: String(affiliate._id),
      country,
      officeId,
      level,
      maxDepth,
      sort: sort as any,
      limit,
      offset,
    });

    const hasMore = offset + items.length < total;
    const nextOffset = hasMore ? offset + items.length : null;

    // Same cache shape as direct — varies by X-API-KEY (private), 60s.
    res.setHeader("Cache-Control", "private, max-age=60");

    return res.json(
      ok({
        affiliate: {
          affiliateId: (affiliate as any).affiliateId,
          name: (affiliate as any).name || null,
          email: (affiliate as any).email || null,
        },
        indirectReferralsCount: total,
        maxDepth,
        items,
        pagination: {
          limit,
          offset,
          total,
          hasMore,
          nextOffset,
        },
        limit,
        offset,
        total,
      })
    );
  } catch (error: any) {
    console.error("[publicAnalytics] /affiliate/indirect error:", error);
    return res
      .status(500)
      .json(fail(error?.message || "Failed to fetch indirect referrals"));
  }
});

// ───────────────────────────────────────────────────────────────────────
// Per-row drill-down — items behind a /affiliate/direct row's counts
// ───────────────────────────────────────────────────────────────────────

const detailQuerySchema = z.object({
  detail: z.enum(["transactions", "products", "customers", "businesses"]),
  // Which semantic the caller used to render the row this drill-down opens.
  // - "leaderboard"        ← /affiliate/direct WITHOUT affiliateId (the row's
  //                           user is the parent; stats = downline aggregate).
  // - "affiliate-downline" ← /affiliate/direct WITH affiliateId (the row's
  //                           user is the seller themselves).
  mode: z
    .enum(["leaderboard", "affiliate-downline"])
    .optional()
    .default("leaderboard"),
  country: z.string().max(120).optional(),
  officeId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "officeId must be a valid ObjectId")
    .optional(),
  category: z.string().max(120).optional(),
  range: z
    .enum(["1d", "7d", "30d", "90d", "all"])
    .optional()
    .default("all"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /public/analytics/affiliate/:userId/details
 *
 * Drill-down for any single row returned by /affiliate/direct. The `detail`
 * param picks one of four lists; each list's `pagination.total` is
 * deterministically equal to the matching count in the row's `stats`:
 *
 *   detail=transactions  ↔ stats.salesCount
 *   detail=products      ↔ stats.uniqueProducts
 *   detail=customers     ↔ stats.uniqueCustomers
 *   detail=businesses    ↔ stats.businessesCount
 *
 * The response also carries the row's full `stats` block so the FE can render
 * a consistent panel header without an extra round-trip to /affiliate/direct.
 *
 * Filters (officeId, category, range, country) must match those used on the
 * /affiliate/direct call that produced the row — otherwise the counts will
 * legitimately diverge.
 */
router.get("/affiliate/:userId/details", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json(fail("Invalid userId"));
    }

    const parsed = detailQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issues =
        (parsed.error as any).issues || (parsed.error as any).errors || [];
      return res
        .status(400)
        .json(fail(issues[0]?.message || "Invalid query parameters"));
    }
    const { detail, mode, country, officeId, category, range, limit, offset } =
      parsed.data;

    // Match the same cache hint as /affiliate/direct so a tight modal-open
    // loop doesn't hammer the DB. Private since the body varies by X-API-KEY.
    res.setHeader("Cache-Control", "private, max-age=60");

    const result = await getRowDetails({
      userId,
      mode,
      detail,
      filters: {
        officeId,
        category,
        range: range as AnalyticsRange,
        country,
      },
      limit,
      offset,
    });

    if (!result.user) {
      return res.status(404).json(fail(`No user found for ${userId}`));
    }

    return res.json(ok(result));
  } catch (error: any) {
    console.error("[publicAnalytics] /affiliate/:userId/details error:", error);
    return res
      .status(500)
      .json(fail(error?.message || "Failed to fetch drill-down details"));
  }
});

export default router;
