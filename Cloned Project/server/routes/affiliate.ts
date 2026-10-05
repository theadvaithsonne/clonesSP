import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { storablePhone } from "../services/twoFactorSms";
import {
  requireUserOrGarageAdmin,
  requireUserOrGarageAdminAsUser,
} from "../middleware/userOrGarageAdmin";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Floor } from "../models/floor.model";
import { Channel } from "../models/channel.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP } from "../services/mailer";
import { signJwt } from "../services/jwt";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { generateAffiliateId } from "../utils/affiliateId";
import crypto from "crypto";
import { AffiliateLink } from "../models/affiliateLink.model";
import { AffiliateClick } from "../models/affiliateClick.model";
import { AffiliateConversion } from "../models/affiliateConversion.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { CombPlan } from "../models/combPlan.model";
import { Product } from "../models/product.model";
import { StoreProduct } from "../models/storeProduct.model";
import { LEGACY_DIGITAL_PRODUCT_FILTER } from "../services/catalogVisibility";
import { Course } from "../models/course.model";
import { Service } from "../models/service.model";
import { Workshop } from "../models/workshop.model";
import { CallOffering } from "../models/callOffering.model";
import {
  getReferrerInfo,
  getReferrerInfoByAffiliateId,
  getSponsorCardByAffiliateId,
  getAffiliateStats,
  getAffiliateNetwork,
  ensureUserHasAffiliateId,
  setReferredBy,
  countAllDescendants,
  isInMyDownline,
} from "../services/affiliate";
import { Types } from "mongoose";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { OFFICE_PLAN_IDS } from "../models/officePlan.model";
import {
  getStoreChannels,
  autoJoinEmployeesChannel,
  addUserToChannel,
} from "../services/channel";

import { linksPageParams, paginateByCategory } from "../services/affiliateLinksPage";

const router = Router();

// Get user's affiliate ID
router.get("/my-affiliate-id", requireUserOrGarageAdminAsUser, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate affiliate ID if not present
    let affiliateId = user.affiliateId;
    if (!affiliateId) {
      affiliateId = await generateAffiliateId();
      user.affiliateId = affiliateId;
      await user.save();
    }

    console.log("✅ User affiliate ID:", affiliateId);

    res.json({
      success: true,
      affiliateId,
      hasAffiliateId: true,
    });
  } catch (error) {
    console.error("💥 Error getting affiliate ID:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get affiliate ID",
      details: (error as Error).message,
    });
  }
});

// ============= Saved Affiliate Links =============
// Per-(user, org, channel) referral links. Mobile + roam-web both call
// these. The URL format mirrors what AffiliatePageNew already builds
// client-side on the dashboard:
//
//   {AFFILIATE_BASE_URL}/{orgSlug}/{channelId}?ref={affiliateId}
//
// Affiliate/referral links are served from the Garage web app. Override with
// the AFFILIATE_BASE_URL env var per environment if needed.
const AFFILIATE_BASE_URL =
  process.env.AFFILIATE_BASE_URL || "https://my.garage.app";

function buildAffiliateUrl(
  orgSlug: string,
  channelId: string,
  affiliateId: string,
): string {
  return `${AFFILIATE_BASE_URL}/${orgSlug}/${channelId}?ref=${affiliateId}`;
}

// ============= Link Click Tracking =============
// Records affiliate-link clicks (server-side from invite-details + a public
// client beacon) and reads back the Links-page stats. See the plan in
// .claude/plans for the full design.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Start of "today" in IST, returned as the UTC instant of IST midnight —
// the project's de-facto day boundary (mirrors services/withdrawal.ts).
function startOfDayIST(): Date {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

const IP_HASH_SALT = process.env.IP_HASH_SALT || "nc-affiliate-click";
function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip + IP_HASH_SALT).digest("hex");
}

const BOT_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|headless|lighthouse|pingdom|prerender/i;
function looksLikeBot(req: any): boolean {
  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOT_UA_RE.test(ua)) return true;
  const purpose = String(
    req.headers["x-purpose"] || req.headers["purpose"] || req.headers["x-moz"] || "",
  ).toLowerCase();
  return purpose.includes("prefetch") || purpose.includes("preview");
}

// Affiliate code → userId cache (LRU + TTL), mirrors contentEngagement.ts.
const affiliateUserCache = new Map<string, { userId: Types.ObjectId | null; expiresAt: number }>();
const AFF_CACHE_TTL_MS = 5 * 60 * 1000;
const AFF_CACHE_MAX = 500;
async function resolveAffiliateUserId(
  affiliateId: string,
): Promise<Types.ObjectId | null> {
  const cached = affiliateUserCache.get(affiliateId);
  if (cached && cached.expiresAt > Date.now()) return cached.userId;
  const user = await User.findOne({ affiliateId }).select("_id").lean();
  const userId = user ? (user._id as Types.ObjectId) : null;
  if (affiliateUserCache.size >= AFF_CACHE_MAX) {
    const k = affiliateUserCache.keys().next().value;
    if (k) affiliateUserCache.delete(k);
  }
  affiliateUserCache.set(affiliateId, { userId, expiresAt: Date.now() + AFF_CACHE_TTL_MS });
  return userId;
}

// In-memory per-session rate limit (20/min), mirrors contentEngagement.ts.
const clickRateLimit = new Map<string, { count: number; resetAt: number }>();
function clickRateOk(key: string): boolean {
  const now = Date.now();
  const e = clickRateLimit.get(key);
  if (!e || e.resetAt <= now) {
    clickRateLimit.set(key, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (e.count >= 20) return false;
  e.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of clickRateLimit) if (e.resetAt <= now) clickRateLimit.delete(k);
}, 5 * 60 * 1000);

// Resolve the selling org for a tracked event. Storefront URLs carry only
// itemType+itemId (no slug), so fall back to the item's active CombPlan. Offices
// pass orgSlug (/hq/{slug}). Cached briefly to avoid a lookup per beacon.
const orgIdCache = new Map<string, { orgId: Types.ObjectId | null; expiresAt: number }>();
async function resolveTrackingOrgId(
  orgSlug?: string | null,
  itemType?: string | null,
  itemId?: string | null,
): Promise<Types.ObjectId | null> {
  if (orgSlug) {
    const org = await Organization.findOne({ "store.slug": orgSlug })
      .select("_id")
      .lean()
      .catch(() => null);
    if (org) return org._id as Types.ObjectId;
    if (Types.ObjectId.isValid(orgSlug)) return new Types.ObjectId(orgSlug);
    return null;
  }
  if (!itemType || !itemId || !Types.ObjectId.isValid(itemId)) return null;
  const key = `${itemType}:${itemId}`;
  const cached = orgIdCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.orgId;
  const plan = await CombPlan.findOne({
    itemType,
    itemId: new Types.ObjectId(itemId),
    isActive: true,
  })
    .select("orgId")
    .lean()
    .catch(() => null);
  const orgId = plan?.orgId ? (plan.orgId as Types.ObjectId) : null;
  if (orgIdCache.size >= 1000) {
    const k = orgIdCache.keys().next().value;
    if (k) orgIdCache.delete(k);
  }
  orgIdCache.set(key, { orgId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return orgId;
}

// Idempotent click insert. Fire-and-forget from callers — never throws.
async function recordClick(input: {
  sessionId: string;
  affiliateId: string;
  orgId?: Types.ObjectId | null;
  itemType?:
    | "channel"
    | "product"
    | "office"
    | "store"
    | "course"
    | "workshop"
    | "service"
    | "call"
    | "unknown";
  itemId?: string | null;
  itemName?: string;
  visitorId?: string | null;
  userId?: Types.ObjectId | null;
  ipHash?: string | null;
  userAgent?: string;
  referrerUrl?: string;
  isBot?: boolean;
}): Promise<void> {
  try {
    const affiliateUserId = await resolveAffiliateUserId(input.affiliateId);
    // new:false → returns the prior doc, or null when newly inserted. We only
    // bump the per-link counter on a genuinely new (deduped) click.
    const prior = await AffiliateClick.findOneAndUpdate(
      { sessionId: input.sessionId, itemId: input.itemId ?? null },
      {
        $setOnInsert: {
          sessionId: input.sessionId,
          affiliateId: input.affiliateId,
          affiliateUserId,
          orgId: input.orgId ?? null,
          itemType: input.itemType ?? "unknown",
          itemId: input.itemId ?? null,
          itemName: input.itemName ?? "",
          visitorId: input.visitorId ?? null,
          userId: input.userId ?? null,
          ipHash: input.ipHash ?? null,
          userAgent: input.userAgent ?? "",
          referrerUrl: input.referrerUrl ?? "",
          isBot: input.isBot ?? false,
        },
      },
      { upsert: true, new: false },
    );

    const isNewClick = prior === null;
    if (
      isNewClick &&
      !input.isBot &&
      affiliateUserId &&
      input.orgId &&
      input.itemId &&
      Types.ObjectId.isValid(input.itemId)
    ) {
      // Bump the saved link's denormalized click counter (no-op if the
      // affiliate never persisted a link for this item).
      await AffiliateLink.updateOne(
        {
          userId: affiliateUserId,
          orgId: input.orgId,
          itemId: new Types.ObjectId(input.itemId),
        },
        { $inc: { clickCount: 1 }, $set: { lastClickedAt: new Date() } },
      ).catch(() => {});
    }
  } catch (err: any) {
    if (err?.code === 11000) return; // dedup race — already recorded
    console.error("recordClick failed:", err?.message || err);
  }
}

/**
 * GET /affiliate/links?orgId=<orgId>
 * List the authenticated user's saved affiliate links for one org.
 */
router.get("/links", requireUserOrGarageAdminAsUser, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const links = await AffiliateLink.find({
      userId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json({ success: true, links });
  } catch (error) {
    console.error("Error listing affiliate links:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list affiliate links",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /affiliate/links
 * Body: { orgId, channelId }
 * Idempotent: returns the existing link if one already exists for this
 * (user, org, channel) triple — same shape as a fresh create. Caller
 * never has to worry about race-with-self.
 */
router.post("/links", requireUserOrGarageAdminAsUser, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    // Generalized: any sellable item. `channelId` is accepted as a legacy
    // alias for { itemType: "channel", itemId: channelId }.
    const body = z
      .object({
        orgId: z.string(),
        itemType: z
          .enum(["channel", "product", "office", "course", "service", "workshop", "call"])
          .optional(),
        itemId: z.string().optional(),
        channelId: z.string().optional(),
      })
      .parse(req.body);

    const itemType = body.itemType ?? "channel";
    const itemIdStr = body.itemId ?? body.channelId;
    if (!itemIdStr || !Types.ObjectId.isValid(itemIdStr)) {
      return res
        .status(400)
        .json({ success: false, error: "Valid itemId (or channelId) is required" });
    }

    const userIdObj = new Types.ObjectId(me.userId);
    const orgIdObj = new Types.ObjectId(body.orgId);
    const itemIdObj = new Types.ObjectId(itemIdStr);

    // Idempotent fast-path: return existing link if any.
    const existing = await AffiliateLink.findOne({
      userId: userIdObj,
      orgId: orgIdObj,
      itemType,
      itemId: itemIdObj,
    });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
      }
      return res.json({ success: true, link: existing });
    }

    const org = await Organization.findById(orgIdObj).lean();
    if (!org) {
      return res
        .status(404)
        .json({ success: false, error: "Organization not found" });
    }

    // Channels get a stronger ownership check (they live in a collection we
    // can verify); products/offices are trusted from the catalog the FE shows.
    if (itemType === "channel") {
      const channel = await Channel.findById(itemIdObj).lean();
      if (!channel) {
        return res
          .status(404)
          .json({ success: false, error: "Channel not found" });
      }
      if ((channel as any).storeId?.toString() !== body.orgId) {
        return res.status(400).json({
          success: false,
          error: "Channel does not belong to this org",
        });
      }
    }

    const orgSlug = (org as any).slug || org._id.toString();

    // Get-or-create the user's affiliate ID.
    const user = await User.findById(userIdObj);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    let affiliateId = user.affiliateId;
    if (!affiliateId) {
      affiliateId = await generateAffiliateId();
      user.affiliateId = affiliateId;
      await user.save();
    }

    const affiliateUrl = buildAffiliateUrl(orgSlug, itemIdStr, affiliateId);

    const link = await AffiliateLink.create({
      userId: userIdObj,
      orgId: orgIdObj,
      itemType,
      itemId: itemIdObj,
      // keep channelId populated for channel rows (back-compat consumers)
      channelId: itemType === "channel" ? itemIdObj : undefined,
      affiliateId,
      affiliateUrl,
      isActive: true,
    });

    res.json({ success: true, link });
  } catch (error) {
    // Duplicate-key race on the unique (user, org, itemType, itemId) index —
    // re-fetch the winner so both callers see the same shape.
    if ((error as any)?.code === 11000) {
      const me = (req as any).user as { userId: string };
      const b = req.body || {};
      const itemIdStr = b.itemId ?? b.channelId;
      if (itemIdStr && Types.ObjectId.isValid(itemIdStr)) {
        const existing = await AffiliateLink.findOne({
          userId: new Types.ObjectId(me.userId),
          orgId: new Types.ObjectId(b.orgId),
          itemType: b.itemType ?? "channel",
          itemId: new Types.ObjectId(itemIdStr),
        });
        if (existing) return res.json({ success: true, link: existing });
      }
    }
    console.error("Error creating affiliate link:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create affiliate link",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /affiliate/click  (public)
 * Client beacon from the my.garage.app landing page. Fire-and-forget — always
 * 202 so the beacon never blocks navigation. Idempotent on (sessionId, itemId).
 */
router.post("/click", async (req, res) => {
  const parsed = z
    .object({
      sessionId: z.string().min(6).max(80),
      affiliateId: z.string().min(1).max(80),
      orgSlug: z.string().max(200).optional(),
      itemId: z.string().max(80).nullish(),
      itemType: z
        .enum([
          "channel",
          "product",
          "office",
          "store",
          "course",
          "workshop",
          "service",
          "call",
          "unknown",
        ])
        .optional(),
      itemName: z.string().max(300).optional(),
      visitorId: z.string().max(80).nullish(),
      userId: z.string().optional(),
      referrerUrl: z.string().max(2000).optional(),
    })
    .safeParse(req.body);

  // Bad payloads are silently accepted (202) so the beacon stays fire-and-forget.
  if (!parsed.success) return res.status(202).json({ success: true });
  const data = parsed.data;

  if (!clickRateOk(data.sessionId)) {
    return res.status(202).json({ success: true });
  }

  // Resolve org by store.slug (office) else via the item's active CombPlan.
  const orgId = await resolveTrackingOrgId(
    data.orgSlug,
    data.itemType,
    data.itemId,
  );

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  void recordClick({
    sessionId: data.sessionId,
    affiliateId: data.affiliateId,
    orgId,
    itemType: data.itemType ?? "unknown",
    itemId: data.itemId ?? null,
    itemName: data.itemName ?? "",
    visitorId: data.visitorId ?? null,
    userId: data.userId && Types.ObjectId.isValid(data.userId)
      ? new Types.ObjectId(data.userId)
      : null,
    ipHash: hashIp(ip),
    userAgent: String(req.headers["user-agent"] || ""),
    referrerUrl: data.referrerUrl ?? "",
    isBot: looksLikeBot(req),
  });

  return res.status(202).json({ success: true });
});

/**
 * POST /affiliate/conversion  (public)
 * Storefront reports a completed purchase made under an affiliate ref. Analytics
 * ONLY — payout stays on the referredBy / CombPlan pipeline. Fire-and-forget
 * (always 202). Idempotent on orderId; also flips the originating click's
 * `converted` flag for funnel linkage.
 */
router.post("/conversion", async (req, res) => {
  const parsed = z
    .object({
      affiliateId: z.string().min(1).max(80),
      itemType: z.enum([
        "channel",
        "product",
        "office",
        "course",
        "workshop",
        "service",
        "call",
      ]),
      itemId: z.string().max(80).nullish(),
      orgSlug: z.string().max(200).optional(),
      sessionId: z.string().max(80).nullish(),
      visitorId: z.string().max(80).nullish(),
      orderId: z.string().max(120).nullish(),
      amount: z.coerce.number().nonnegative().optional(),
      currency: z.string().max(10).optional(),
      itemName: z.string().max(300).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(202).json({ success: true });
  const data = parsed.data;

  const rlKey = data.orderId || data.sessionId || data.affiliateId;
  if (!clickRateOk(rlKey)) return res.status(202).json({ success: true });

  try {
    const affiliateUserId = await resolveAffiliateUserId(data.affiliateId);
    const orgId = await resolveTrackingOrgId(
      data.orgSlug,
      data.itemType,
      data.itemId,
    );

    // Idempotent: dedup on orderId when present, else on (affiliate, item, session).
    const filter = data.orderId
      ? { orderId: data.orderId }
      : {
          affiliateId: data.affiliateId,
          itemType: data.itemType,
          itemId: data.itemId ?? null,
          sessionId: data.sessionId ?? null,
        };
    await AffiliateConversion.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          affiliateId: data.affiliateId,
          affiliateUserId,
          orgId,
          itemType: data.itemType,
          itemId: data.itemId ?? null,
          itemName: data.itemName ?? "",
          sessionId: data.sessionId ?? null,
          visitorId: data.visitorId ?? null,
          orderId: data.orderId ?? null,
          amount: data.amount ?? 0,
          currency: data.currency ?? "USD",
        },
      },
      { upsert: true, new: false },
    ).catch((e: any) => {
      if (e?.code !== 11000) throw e; // dup orderId race — already recorded
    });

    // Best-effort funnel linkage: mark the originating click converted.
    if (data.itemId) {
      const clickFilter: Record<string, unknown> | null = data.sessionId
        ? { sessionId: data.sessionId, itemId: data.itemId }
        : affiliateUserId && data.visitorId
          ? { affiliateUserId, visitorId: data.visitorId, itemId: data.itemId }
          : null;
      if (clickFilter) {
        await AffiliateClick.findOneAndUpdate(
          { ...clickFilter, converted: false },
          { $set: { converted: true, convertedAt: new Date() } },
          { sort: { createdAt: -1 } },
        ).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error("recordConversion failed:", err?.message || err);
  }

  return res.status(202).json({ success: true });
});

/**
 * GET /affiliate/links/stats?orgId=<orgId>  (auth)
 * Powers the 1Network Links page stat cards:
 *  - totalLinks: saved affiliate links for this user/org
 *  - clicksToday: non-bot clicks attributed to this affiliate since IST midnight
 *  - topConvertingProduct: the item this affiliate has earned the most sales on
 */
router.get("/links/stats", requireUserOrGarageAdminAsUser, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    // orgId is accepted for API compat but no longer needed — all three stats
    // are user-scoped (links across all orgs, clicks by affiliate, sales by user).
    z.object({ orgId: z.string().optional() }).parse(req.query);
    const userIdObj = new Types.ObjectId(me.userId);

    const dayStart = startOfDayIST();
    const [totalLinks, clicksToday, conversionsToday, totalConversions, topAgg] =
      await Promise.all([
        // Total links the user has generated across ALL orgs (the catalog is
        // cross-org), not just the currently-selected one.
        AffiliateLink.countDocuments({ userId: userIdObj, isActive: true }),
        AffiliateClick.countDocuments({
          affiliateUserId: userIdObj,
          isBot: false,
          createdAt: { $gte: dayStart },
        }),
        AffiliateConversion.countDocuments({
          affiliateUserId: userIdObj,
          createdAt: { $gte: dayStart },
        }),
        AffiliateConversion.countDocuments({ affiliateUserId: userIdObj }),
        CommissionDistribution.aggregate([
          { $match: { "commissions.userId": userIdObj, status: "completed" } },
          {
            $group: {
              _id: { itemType: "$itemType", itemId: "$itemId" },
              name: { $first: "$itemName" },
              conversions: { $sum: 1 },
              revenue: { $sum: "$saleAmount" },
            },
          },
          { $sort: { conversions: -1, revenue: -1 } },
          { $limit: 1 },
        ]),
      ]);

    const top = topAgg[0];
    const topConvertingProduct = top
      ? {
          itemId: top._id?.itemId?.toString() ?? null,
          itemType: top._id?.itemType ?? null,
          name: top.name || "Unknown",
          conversions: top.conversions,
        }
      : null;

    res.json({
      success: true,
      stats: {
        totalLinks,
        clicksToday,
        conversionsToday,
        totalConversions,
        topConvertingProduct,
      },
    });
  } catch (error) {
    console.error("Error fetching link stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch link stats",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /affiliate/offices?kind=&q=&page=&limit=  (auth)
 * All organizations (HQs) as "offices" to promote. Each links to /hq/{slug}.
 * Lightweight: one lean projected query (no founder/member rollups).
 *
 * Paged, because the Links page renders a card with an image per office and
 * used to receive every one of them at once. `counts` carries all three kinds
 * regardless of the `kind` filter — they are the tab badges.
 */
router.get("/offices", requireUserOrGarageAdmin, async (req, res) => {
  try {
    const orgs = await Organization.find({})
      .select(
        "name slug store.slug store.name store.icon store.coverPhoto icon coverPhoto colored_logo category country",
      )
      .lean();

    // Per-org rollups, one aggregate per source, keyed by org-id string.
    // Members = users with a membership in the org; Offers = live catalog items
    // this org sells across the six catalog collections.
    const countBy = async (
      Model: any,
      field: string,
      gate: Record<string, unknown>,
    ): Promise<Map<string, number>> => {
      const rows = await Model.aggregate([
        { $match: gate },
        { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      ]);
      const m = new Map<string, number>();
      for (const r of rows) if (r._id) m.set(String(r._id), r.n);
      return m;
    };

    const [members, ...offerMaps] = await Promise.all([
      User.aggregate([
        { $unwind: "$organizations" },
        { $group: { _id: "$organizations.organization", n: { $sum: 1 } } },
      ]).then((rows: any[]) => {
        const m = new Map<string, number>();
        for (const r of rows) if (r._id) m.set(String(r._id), r.n);
        return m;
      }),
      countBy(Product, "organizationId", { status: "active" }),
      countBy(Channel, "storeId", { isActive: true }),
      countBy(Course, "organizationId", { status: "published" }),
      countBy(StoreProduct, "orgId", { status: "active" }),
      countBy(Workshop, "orgId", { isActive: true }),
      countBy(CallOffering, "organizationId", { status: "published" }),
    ]);
    const offersFor = (id: string) =>
      offerMaps.reduce((sum, m) => sum + (m.get(id) ?? 0), 0);

    // Storefront stores (owned by garage-store-backend, on the same Mongo). A
    // store's presence marks the org as a STOREFRONT rather than a digital
    // office; `storeKind` ("online"/"offline") splits e-commerce from offline.
    // Read the raw collection since the typed mirror doesn't project storeKind.
    const mongoose = (await import("mongoose")).default;
    const storeRows = await mongoose.connection
      .collection("stores")
      .find({ isActive: true })
      .project({ _id: 0, orgId: 1, slug: 1, storeKind: 1 })
      .toArray();
    const storeByOrg = new Map<string, { slug?: string; storeKind?: string }>();
    for (const s of storeRows as any[]) {
      if (s.orgId) {
        storeByOrg.set(String(s.orgId), { slug: s.slug, storeKind: s.storeKind });
      }
    }

    const offices = orgs
      .map((o: any) => {
        const id = o._id.toString();
        const store = storeByOrg.get(id);
        // Three kinds: `office` = a digital office (no storefront); `ecommerce`
        // and `offline` = a storefront, split by storeKind. Offices link to
        // /hq/{orgSlug}; stores link to /store/{storeSlug}.
        const kind: "office" | "ecommerce" | "offline" = store
          ? store.storeKind === "offline"
            ? "offline"
            : "ecommerce"
          : "office";
        const slug = store ? store.slug || o.store?.slug || o.slug : o.slug;
        if (!slug) return null;
        // Two distinct images: `logo` (the small avatar/badge) and `coverPhoto`
        // (the large card banner). `image` is kept for existing consumers.
        const logo = o.store?.icon || o.icon || o.colored_logo || undefined;
        const coverPhoto = o.store?.coverPhoto || o.coverPhoto || undefined;
        return {
          id,
          name: o.store?.name || o.name || "Office",
          slug,
          kind,
          image: o.icon || o.coverPhoto || undefined,
          logo,
          coverPhoto,
          memberCount: members.get(id) ?? 0,
          offerCount: offersFor(id),
          industry: o.category || undefined,
          country: o.country || undefined,
        };
      })
      .filter(Boolean) as any[];
    const paging = linksPageParams(req.query);
    const { items, ...rest } = paginateByCategory(offices, {
      categoryOf: (o) => o.kind,
      keyOf: (o) => o.id,
      nameOf: (o) => o.name,
      category: typeof req.query.kind === "string" ? req.query.kind : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      ...(paging ?? {}),
    });
    // Kept as `offices` — the key this route has always returned.
    res.json({ success: true, offices: items, ...rest });
  } catch (error) {
    console.error("Error listing offices:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list offices",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /affiliate/catalog  (auth)
 * The affiliate-ELIGIBLE catalog: every item with an active commission plan
 * (CombPlan), across all orgs — i.e. exactly what a user can earn on. Each
 * entry carries its own orgSlug so the FE can build the link regardless of the
 * viewer's current org. Items are resolved across products + storeproducts +
 * channels + courses + services + workshops.
 */
router.get("/catalog", requireUserOrGarageAdmin, async (req, res) => {
  try {
    const now = new Date();
    // Item-driven catalog: query each type for GENUINELY-ACTIVE items using the
    // same predicates the storefront uses (mirrors services/sellables.ts ->
    // listOrgSellables), so the links catalog matches exactly what's purchasable.
    // Archived / draft / unpublished / past items are excluded, and active items
    // appear whether or not a commission plan points at them. Channels
    // (communities) ARE included as their own digital link items. CombPlan is a
    // LEFT JOIN used ONLY to attach the direct (level-1) commission % — its
    // absence never hides an item.
    const [products, storeProducts, courses, services, workshops, calls, channels, plans] =
      await Promise.all([
        // Legacy `products` now backs DIGITAL offerings only (physical goods
        // moved to `storeproducts`). Physical docs left here are migration
        // orphans that 404 on garage.app/product/:id, so keep digital only —
        // they link to /digital/product/:id, which resolves. See catalogVisibility.
        Product.find({ status: "active", ...LEGACY_DIGITAL_PRODUCT_FILTER })
          .select("name price currency images isDigital deliveryMethod organizationId")
          .lean(),
        StoreProduct.find({ status: "active" })
          .select("title name price compareAtPrice currency images orgId hasVariants")
          .lean(),
        Course.find({ status: "published" })
          .select("title price currency coverImage organizationId")
          .lean(),
        Service.find({ status: "active" })
          .select("title price totalPrice currency coverImage organizationId")
          .lean(),
        Workshop.find({
          isActive: true,
          $or: [
            { date: { $gte: now } },
            { isRecurring: true, isRecurrenceActive: true },
          ],
        })
          .select("title price currency thumbnail coverImage orgId")
          .lean(),
        CallOffering.find({ status: "published" })
          .select("title pricePerCall currency coverImage organizationId")
          .lean(),
        // Communities — active channels, linkable as /digital/channel/{id}. The
        // owning org is `storeId` (ref Organization).
        Channel.find({ isActive: true })
          .select("title price currency coverImage storeId isFree isSubscription subscriptionPeriod")
          .lean(),
        CombPlan.find({ isActive: true }).select("itemType itemId levels").lean(),
      ]);

    // A StoreProduct being status:"active" is NOT enough for the storefront to
    // render it — garage.app/product/<id> 404s ("product not found") unless the
    // product's org has an ACTIVE store doc. Join `stores` by orgId (no Store
    // model imported here, matching sellables.ts) and keep only storeproducts
    // whose org has a store with a slug AND isActive:true.
    const mongoose = (await import("mongoose")).default;
    const spOrgIds = Array.from(
      new Set((storeProducts as any[]).map((sp) => String(sp.orgId))),
    )
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    const activeStoreOrgs = new Set<string>();
    if (spOrgIds.length > 0) {
      const storeDocs = await mongoose.connection
        .collection("stores")
        .find({ orgId: { $in: spOrgIds }, isActive: true })
        .project({ _id: 0, orgId: 1, slug: 1 })
        .toArray();
      for (const s of storeDocs as any[]) {
        if (s.slug) activeStoreOrgs.add(String(s.orgId));
      }
    }
    const sellableStoreProducts = (storeProducts as any[]).filter((sp) =>
      activeStoreOrgs.has(String(sp.orgId)),
    );

    // Variant products (hasVariants) store their real per-variant prices in
    // `productvariants`, not the top-level `price` (which is a stale nominal
    // base). Pull the MINIMUM-price variant per product so the card shows the
    // actual discounted price ("from $X") + its compareAt strikethrough,
    // matching the storefront. One query for all variant products.
    const variantProductIds = sellableStoreProducts
      .filter((sp) => sp.hasVariants)
      .map((sp) => sp._id);
    const minVariantByProduct = new Map<
      string,
      { price: number; compareAtPrice?: number }
    >();
    if (variantProductIds.length > 0) {
      const variants = await mongoose.connection
        .collection("productvariants")
        .find({ productId: { $in: variantProductIds } })
        .project({ productId: 1, price: 1, compareAtPrice: 1 })
        .toArray();
      for (const v of variants as any[]) {
        if (typeof v.price !== "number") continue;
        const key = String(v.productId);
        const cur = minVariantByProduct.get(key);
        if (!cur || v.price < cur.price) {
          minVariantByProduct.set(key, {
            price: v.price,
            compareAtPrice: v.compareAtPrice,
          });
        }
      }
    }

    // Direct (level-1) commission % by `${itemType}:${itemId}` (0 when no plan).
    const commissionByItem = new Map<string, number>();
    for (const p of plans as any[]) {
      const itemId = (p.itemId as Types.ObjectId)?.toString();
      if (!itemId) continue;
      const direct = Array.isArray(p.levels)
        ? p.levels.find((l: any) => l.level === 1)?.percentage ?? 0
        : 0;
      commissionByItem.set(`${p.itemType}:${itemId}`, direct);
    }

    // Load every selling org (for link slug + seller display name) in one query.
    const orgIdStr = (v: any) => (v ? String(v) : "");
    const orgIdSet = new Set<string>();
    for (const p of products as any[]) orgIdSet.add(orgIdStr(p.organizationId));
    for (const s of sellableStoreProducts as any[]) orgIdSet.add(orgIdStr(s.orgId));
    for (const c of courses as any[]) orgIdSet.add(orgIdStr(c.organizationId));
    for (const s of services as any[]) orgIdSet.add(orgIdStr(s.organizationId));
    for (const w of workshops as any[]) orgIdSet.add(orgIdStr(w.orgId));
    for (const c of calls as any[]) orgIdSet.add(orgIdStr(c.organizationId));
    for (const ch of channels as any[]) orgIdSet.add(orgIdStr(ch.storeId));
    orgIdSet.delete("");
    const orgs = await Organization.find({
      _id: { $in: [...orgIdSet].map((s) => new Types.ObjectId(s)) },
    })
      .select("slug store.slug name store.name")
      .lean();
    const slugByOrg = new Map<string, string>();
    const nameByOrg = new Map<string, string>();
    for (const o of orgs as any[]) {
      const id = o._id.toString();
      slugByOrg.set(id, o.store?.slug || o.slug || id);
      nameByOrg.set(id, o.store?.name || o.name || "");
    }

    const items: any[] = [];
    const push = (
      itemType: string,
      itemId: string,
      org: string,
      category: string,
      name: string,
      price: number,
      currency: string | undefined,
      image: string | undefined,
      // Original ("was") price, shown struck-through when > price. hasVariants
      // makes the card render "from $price" (price is the cheapest variant).
      compareAtPrice?: number,
      hasVariants?: boolean,
      // Subscription cadence (recurring items like channels/communities).
      period?: string,
    ) => {
      const orgSlug = slugByOrg.get(org);
      if (!orgSlug) return; // can't build a link without a resolvable slug
      items.push({
        itemType,
        itemId,
        category,
        name: name || "Untitled",
        price: price ?? 0,
        currency: currency || "USD",
        image,
        orgId: org,
        orgSlug,
        sellerName: nameByOrg.get(org) || undefined,
        commissionPct: commissionByItem.get(`${itemType}:${itemId}`) ?? 0,
        compareAtPrice:
          typeof compareAtPrice === "number" && compareAtPrice > (price ?? 0)
            ? compareAtPrice
            : undefined,
        hasVariants: hasVariants || undefined,
        period,
      });
    };

    for (const d of products as any[]) {
      const digital = d.isDigital || d.deliveryMethod === "digital";
      push("product", d._id.toString(), orgIdStr(d.organizationId),
        digital ? "digital" : "physical", d.name,
        d.price ?? 0, d.currency, d.images?.[0]);
    }
    for (const sp of sellableStoreProducts as any[]) {
      // Variant products price off the cheapest variant (discounted price +
      // its compareAt); non-variant products use their own price/compareAt.
      const mv = sp.hasVariants
        ? minVariantByProduct.get(sp._id.toString())
        : undefined;
      const price = mv ? mv.price : sp.price ?? 0;
      const compareAt = mv ? mv.compareAtPrice : sp.compareAtPrice;
      push("product", sp._id.toString(), orgIdStr(sp.orgId), "physical",
        sp.title || sp.name, price, sp.currency, sp.images?.[0]?.url,
        compareAt, !!sp.hasVariants);
    }
    for (const c of courses as any[]) {
      push("course", c._id.toString(), orgIdStr(c.organizationId), "digital",
        c.title, c.price ?? 0, c.currency, c.coverImage);
    }
    for (const s of services as any[]) {
      push("service", s._id.toString(), orgIdStr(s.organizationId), "digital",
        s.title, s.totalPrice ?? s.price ?? 0, s.currency, s.coverImage);
    }
    for (const w of workshops as any[]) {
      push("workshop", w._id.toString(), orgIdStr(w.orgId), "digital",
        w.title, w.price ?? 0, w.currency, w.thumbnail || w.coverImage);
    }
    for (const c of calls as any[]) {
      push("call", c._id.toString(), orgIdStr(c.organizationId), "digital",
        c.title, c.pricePerCall ?? 0, c.currency, c.coverImage);
    }
    for (const ch of channels as any[]) {
      // Communities — free channels show price 0; subscriptions carry a period.
      push("channel", ch._id.toString(), orgIdStr(ch.storeId), "digital",
        ch.title, ch.isFree ? 0 : ch.price ?? 0,
        ch.currency, ch.coverImage, undefined, undefined,
        ch.isSubscription ? ch.subscriptionPeriod : undefined);
    }

    const paging = linksPageParams(req.query);
    const paged = paginateByCategory(items, {
      categoryOf: (i) => i.category,
      keyOf: (i) => String(i.itemId),
      nameOf: (i) => i.name,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      ...(paging ?? {}),
    });
    res.json({ success: true, ...paged });
  } catch (error) {
    console.error("Error building affiliate catalog:", error);
    res.status(500).json({
      success: false,
      error: "Failed to build affiliate catalog",
      details: (error as Error).message,
    });
  }
});

// Get referrer info by affiliate ID, or directly by userId (now uses local DB)
router.get("/referrer-info", async (req, res) => {
  const schema = z.object({
    affiliateId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    // `light=1` — the sponsor card only (id, name, avatar, code): no email and
    // no stats. The full response's stats cost a 50-deep $graphLookup over the
    // sponsor's entire downline, and this endpoint is called on every referred
    // user's first app launch just to say "<name> invited you". Only defined
    // for the affiliateId form; the userId form is a back-office lookup that
    // wants the numbers.
    light: z.string().optional(),
  });

  try {
    const { affiliateId, userId, light } = schema.parse(req.query);

    if (!affiliateId && !userId) {
      return res.status(400).json({ success: false, error: "affiliateId or userId is required" });
    }

    if (affiliateId && (light === "1" || light === "true")) {
      // Returns null for a malformed code as well as an unknown one, so a
      // junk affiliate id in a link reads as "no such sponsor", not an error.
      const sponsor = await getSponsorCardByAffiliateId(affiliateId);
      if (!sponsor) {
        return res.status(404).json({
          success: false,
          error: "Referrer not found",
        });
      }
      return res.json({
        success: true,
        referrer: sponsor,
      });
    }

    const referrerInfo = userId
      ? await getReferrerInfo(userId)
      : await getReferrerInfoByAffiliateId(affiliateId!);

    if (!referrerInfo) {
      return res.status(404).json({
        success: false,
        error: "Referrer not found",
      });
    }

    res.json({
      success: true,
      referrer: referrerInfo,
    });
  } catch (error) {
    console.error("💥 Error fetching referrer info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch referrer info",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /affiliate/my-referrer
 *
 * Who referred the SIGNED-IN user, and whether that attribution is locked.
 * `referredBySource === "affiliate"` means they arrived through an affiliate
 * link (?ref=aff_…) — that referrer is not self-serviceable. Anything else
 * (the founder_default placeholder, or nothing yet) stays changeable during
 * onboarding. Complete Profile reads this to decide between a locked row
 * and the referrer picker.
 */
router.get("/my-referrer", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const meDoc = await User.findById(me.userId)
      .select("referredBy referredBySource")
      .populate("referredBy", "name email profilePicture affiliateId")
      .lean<any>();
    if (!meDoc) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const r = meDoc.referredBy as any;
    const source = meDoc.referredBySource || null;
    res.json({
      success: true,
      referrer: r
        ? {
            id: String(r._id),
            name: r.name || "",
            email: r.email || "",
            profilePicture: r.profilePicture || "",
            affiliateId: r.affiliateId || "",
          }
        : null,
      source,
      locked: source === "affiliate" && !!r,
    });
  } catch (error) {
    console.error("Error fetching my referrer:", error);
    res.status(500).json({ success: false, error: "Failed to fetch referrer" });
  }
});

/**
 * POST /affiliate/change-referrer
 *
 * Founder-facing "who referred me" self-service. Called from the
 * ProfilePopover onboarding section. Gated so the user can only change
 * their referrer while `profileComplete === false` — once they mark the
 * profile complete, the referrer is locked in.
 *
 * Validates in order:
 *   1. `email` shape
 *   2. profile is still incomplete (else 403)
 *   3. target email exists as a Garage user (else 404)
 *   4. target is not self (else 400)
 *   5. target is not in current user's downline, transitively, via
 *      `isInMyDownline` — prevents creating a cycle in the affiliate
 *      graph (else 400)
 *   6. update: `User.findByIdAndUpdate(me, { referredBy: target._id })`
 */
router.post("/change-referrer", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { email } = z
      .object({
        email: z.string().trim().min(1).email("Please enter a valid email"),
      })
      .parse(req.body);

    const meDoc = await User.findById(me.userId)
      .select("_id email profileComplete referredBy referredBySource")
      .lean<{
        _id: Types.ObjectId;
        email?: string;
        profileComplete?: boolean;
        referredBy?: Types.ObjectId;
        referredBySource?: string;
      }>();
    if (!meDoc) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }
    if (meDoc.profileComplete === true) {
      return res.status(403).json({
        success: false,
        error:
          "Your profile is already complete — the referrer can no longer be changed.",
      });
    }
    // An affiliate-link attribution is not self-serviceable: the person whose
    // ?ref= link brought this user in keeps the credit ("first affiliate
    // wins", same rule the attribution service enforces on upgrades).
    if (meDoc.referredBySource === "affiliate" && meDoc.referredBy) {
      return res.status(403).json({
        success: false,
        error:
          "You joined through an affiliate link — your referrer can't be changed.",
      });
    }

    const target = await User.findOne({
      email: email.toLowerCase().trim(),
    })
      .select("_id name email profilePicture affiliateId")
      .lean<{
        _id: Types.ObjectId;
        name?: string;
        email?: string;
        profilePicture?: string;
        affiliateId?: string;
      }>();
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "That user isn't on Garage yet.",
      });
    }

    if (String(target._id) === String(meDoc._id)) {
      return res.status(400).json({
        success: false,
        error: "You can't set yourself as your referrer.",
      });
    }

    const cycles = await isInMyDownline(
      String(meDoc._id),
      String(target._id),
    );
    if (cycles) {
      return res.status(400).json({
        success: false,
        error:
          "Can't set your referrer to someone in your own downline — that would create a loop.",
      });
    }

    await User.findByIdAndUpdate(meDoc._id, { referredBy: target._id });

    // Move them in the denormalized downline tree too — the downline table,
    // leaderboard and rank walks read `ancestors`, not `referredBy`, so without
    // this the member kept showing under the sponsor they had BEFORE (usually
    // the founder default). Same helper the attribution upgrade uses; it
    // handles "had no parent" as well, and never throws.
    void import("../services/downlineTree").then(({ reparentUnderNewReferrer }) =>
      reparentUnderNewReferrer(meDoc._id),
    );

    // Swap the upline in their support chat, if they already have one.
    void import("../services/supportChat").then(({ syncSupportUpline }) =>
      syncSupportUpline(meDoc._id),
    );

    res.json({
      success: true,
      referrer: {
        id: String(target._id),
        name: target.name || "",
        email: target.email || "",
        profilePicture: target.profilePicture || "",
        affiliateId: target.affiliateId || undefined,
      },
    });
  } catch (error) {
    console.error("Error changing referrer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change referrer",
      details: (error as Error).message,
    });
  }
});

// Get organization invite details by slug and affiliate ID
router.get("/invite-details", async (req, res) => {
  const schema = z.object({
    orgSlug: z.string().min(1),
    affiliateId: z.string().min(1),
    channelId: z.string().optional(),
    // Client click identity (optional). When present, the click is keyed on
    // the client sessionId (stable across reloads) and carries the visitorId
    // for unique-visitor counts — otherwise we fall back to a synthetic id.
    cs: z.string().max(80).optional(),
    cv: z.string().max(80).optional(),
  });

  try {
    const { orgSlug, affiliateId, channelId, cs, cv } = schema.parse(req.query);

    console.log(
      "🔍 Fetching invite details for org slug:",
      orgSlug,
      "affiliate:",
      affiliateId,
      "channelId:",
      channelId
    );

    // Find organization by store.slug
    const organization = await Organization.findOne({
      "store.slug": orgSlug,
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Fetch affiliate user info from local DB
    const affiliateUser = await User.findOne({ affiliateId })
      .select("name email profilePicture affiliateId")
      .lean();

    // Fetch channel details if channelId is provided
    let channelData = null;
    if (channelId) {
      const channel = await Channel.findById(channelId).lean();
      if (channel) {
        channelData = {
          _id: channel._id,
          title: channel.title,
          description: channel.description,
          coverImage: channel.coverImage,
          price: channel.price,
          currency: channel.currency,
          isFree: channel.isFree,
          isSubscription: channel.isSubscription,
          subscriptionPeriod: channel.subscriptionPeriod,
        };
      }
    }

    // Fire-and-forget click record (server-side safety net — survives
    // adblockers/no-JS). Synthetic sessionId dedups reloads within the hour.
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "";
    const ua = String(req.headers["user-agent"] || "");
    const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
    const clickItemId = channelId || null;
    // Prefer the client's stable sessionId when supplied (one doc per landing
    // session, JS or not); otherwise a synthetic id dedups reloads within the hour.
    const synthSession = crypto
      .createHash("sha256")
      .update(`${ip}|${ua}|${clickItemId ?? "org"}|${affiliateId}|${hourBucket}`)
      .digest("hex");
    void recordClick({
      sessionId: cs || synthSession,
      affiliateId,
      orgId: organization._id as Types.ObjectId,
      itemType: channelId ? "channel" : "unknown",
      itemId: clickItemId,
      itemName: channelData?.title || "",
      visitorId: cv ?? null,
      ipHash: hashIp(ip),
      userAgent: ua,
      referrerUrl: String(req.headers["referer"] || req.headers["referrer"] || ""),
      isBot: looksLikeBot(req),
    });

    res.json({
      success: true,
      organization: {
        _id: organization._id,
        name: organization.name,
        description: organization.description,
        headingText: organization.headingText,
        subHeadingText: organization.subHeadingText,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        location: organization.location,
        city: organization.city,
        state: organization.state,
        country: organization.country,
        store: organization.store,
      },
      affiliate: affiliateUser
        ? {
            name: affiliateUser.name || "Someone",
            email: affiliateUser.email,
            profilePicture: affiliateUser.profilePicture,
            affiliateCode: affiliateUser.affiliateId,
          }
        : {
            name: "Someone",
            email: null,
          },
      channel: channelData,
    });
  } catch (error) {
    console.error("💥 Error fetching invite details:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch invite details",
      details: (error as Error).message,
    });
  }
});

// Get organization channels (now uses local DB)
router.get("/org-channels/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: "Store ID is required",
      });
    }

    console.log("📺 Fetching channels for store:", storeId);

    const channels = await getStoreChannels(storeId);

    console.log("✅ Channels fetched successfully:", channels.length);

    res.json({
      success: true,
      channels,
    });
  } catch (error) {
    console.error("💥 Error fetching org channels:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organization channels",
      details: (error as Error).message,
    });
  }
});

// Request OTP for affiliate invite
router.post("/request-otp", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    orgSlug: z.string().min(1),
  });

  try {
    const { email, orgSlug } = schema.parse(req.body);
    const E = email.trim().toLowerCase();

    console.log("📧 Requesting OTP for affiliate invite:", E, "org:", orgSlug);

    // Find organization by store.slug
    const organization = await Organization.findOne({
      "store.slug": orgSlug,
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // Create OTP and store orgId
    const code = await createOtp(
      E,
      "affiliate-invite",
      organization._id.toString()
    );

    // Send OTP email
    await sendMail(
      E,
      `Your OTP for ${organization.name}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to ${organization.name}!</h2>
          <p>Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      `Your OTP code is: ${code}\n\nThis code will expire in 10 minutes.`,
      EMAIL_FROM_OTP
    );

    console.log("✅ OTP sent successfully to:", E);

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("💥 Error requesting OTP:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send OTP",
      details: (error as Error).message,
    });
  }
});

// Check if user exists and needs profile completion
router.post("/check-user", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
  });

  try {
    const { email, code } = schema.parse(req.body);
    const E = email.trim().toLowerCase();

    console.log("🔍 Checking user for affiliate invite:", E);

    // Just check if OTP exists and is valid (don't delete it)
    const { OtpCode } = await import("../models/otpcode.model");
    const row = await OtpCode.findOne({
      email: E,
      code,
      purpose: "affiliate-invite",
    });

    if (!row) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired OTP",
      });
    }

    if (row.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: "OTP has expired",
      });
    }

    const orgIdString = row.orgId?.toString();
    if (!orgIdString) {
      return res.status(400).json({
        success: false,
        error: "Invalid OTP data",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: E });

    // Check if user is already a member of this organization
    if (user) {
      const existingMembership = user.organizations?.find(
        (membership: any) => membership.organization.toString() === orgIdString
      );

      if (existingMembership) {
        return res.status(400).json({
          success: false,
          error: "You are already a member of this organization",
          needsProfile: false,
        });
      }
    }

    res.json({
      success: true,
      needsProfile: !user || !user.name || !user.phone,
      user: user
        ? {
            email: user.email,
            name: user.name,
            phone: user.phone,
          }
        : null,
    });
  } catch (error) {
    console.error("💥 Error checking user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check user",
      details: (error as Error).message,
    });
  }
});

// Accept affiliate invite (now uses local DB instead of EarnGPT)
router.post("/accept-invite", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
    orgSlug: z.string().min(1),
    channelId: z.string().min(1).optional(), // Optional for paid channels (payment flow handles channel join)
    affiliateId: z.string().min(1),
    name: z.string().optional(),
    phone: z.string().optional(),
  });

  try {
    const { email, code, orgSlug, channelId, affiliateId, name, phone } =
      schema.parse(req.body);
    const E = email.trim().toLowerCase();

    console.log("🎯 Accepting affiliate invite:", {
      email: E,
      orgSlug,
      channelId,
      affiliateId,
    });

    // Verify OTP
    const orgIdString = await verifyOtp(E, code, "affiliate-invite");
    if (!orgIdString) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired OTP",
      });
    }

    // Find organization by store.slug and verify it matches OTP orgId
    const organization = await Organization.findOne({
      "store.slug": orgSlug,
    });

    if (!organization || organization._id.toString() !== orgIdString) {
      return res.status(400).json({
        success: false,
        error: "Organization not found or mismatch",
      });
    }

    const orgId = organization._id;

    // Find or create user
    let user = await User.findOne({ email: E });

    if (!user) {
      // Look up the referrer by their affiliate ID to get their user ID
      const referrer = await User.findOne({ affiliateId }).select("_id").lean();

      // Create new user with affiliate ID
      const newAffiliateId = await generateAffiliateId();
      user = await User.create({
        email: E,
        name: name || "",
        // Normalized so a later phone login finds THIS row instead of
        // creating a duplicate account (see storablePhone).
        phone: storablePhone(phone) ?? "",
        organization: orgId,
        isVerified: true,
        guest: true, // Users joining via affiliate links are guests
        affiliateId: newAffiliateId,
        referredBy: referrer?._id, // The user ID of who referred them
      });
      console.log("✅ Created new user:", user._id);

      // Check if the target org is GARAGE HQ (parent org)
      const isJoiningGarageHQ = organization.parent === true;

      // Add to GARAGE HQ only if NOT already joining GARAGE HQ directly
      if (!isJoiningGarageHQ) {
        await addUserToGarageHQ(user._id.toString());
        // Send welcome email for the org they joined (fire-and-forget)
        sendWelcomeEmail(user._id.toString(), orgId.toString()).catch((err) =>
          console.error("[WelcomeEmail] Failed:", err)
        );
        // Refresh user to get updated organizations array
        user = await User.findById(user._id);
        if (!user) {
          return res.status(500).json({
            success: false,
            error: "Failed to refresh user data",
          });
        }
      } else {
        // Joining GARAGE HQ directly — send parent-only welcome email
        sendWelcomeEmail(user._id.toString(), null).catch((err) =>
          console.error("[WelcomeEmail] Failed:", err)
        );
      }
    } else {
      // Check if already a member
      const existingMembership = user.organizations?.find(
        (membership: any) =>
          membership.organization.toString() === orgId.toString()
      );

      if (existingMembership) {
        return res.status(400).json({
          success: false,
          error: "You are already a member of this organization",
        });
      }

      // Update user details if provided
      if (name && !user.name) user.name = name;
      if (phone && !user.phone) user.phone = storablePhone(phone) ?? phone;
      user.isVerified = true;

      // Ensure user has affiliate ID
      if (!user.affiliateId) {
        user.affiliateId = await generateAffiliateId();
      }

      // Set referredBy if not already set — route through the upgrade-aware
      // attribution service so we also fire the "onboarded X" notification
      // to the affiliate and can upgrade a founder_default placeholder.
      if (affiliateId) {
        try {
          const { setReferredByAffiliateId } = await import(
            "../services/affiliate"
          );
          await setReferredByAffiliateId(
            user._id.toString(),
            affiliateId,
            orgId ? orgId.toString() : undefined,
          );
        } catch (attrErr) {
          console.error("Affiliate attribution failed:", attrErr);
        }
      }
    }

    // Get first floor for this organization
    const defaultFloor = await Floor.findOne({ orgId })
      .sort({ level: 1 })
      .lean();
    const defaultFloorId = defaultFloor?._id;

    console.log("🏢 Default floor for org:", defaultFloorId);

    // Check again if already a member (handles race conditions and new user cases)
    user.organizations = user.organizations || [];
    const alreadyMember = user.organizations.some(
      (membership: any) =>
        membership.organization.toString() === orgId.toString()
    );

    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        error: "You are already a member of this organization",
      });
    }

    // Add organization membership
    user.organizations.push({
      organization: orgId,
      role: "stakeholder",
      floorId: defaultFloorId,
      joinedAt: new Date(),
      guest: true,
    });

    // Update legacy fields for backward compatibility
    user.organization = orgId;
    (user as any).role = "stakeholder";

    await user.save();
    console.log("✅ User saved with new organization membership");

    // Add user to the specified channel (only if channelId provided - paid channels handle this after payment)
    if (channelId) {
      try {
        await addUserToChannel(
          user._id.toString(),
          channelId,
          orgId.toString()
        );
        console.log("✅ Added user to channel:", channelId);
      } catch (channelError) {
        console.error("⚠️ Could not add user to channel:", channelError);
        // Continue even if channel join fails - they're still added to org
      }
    } else {
      console.log("ℹ️ No channelId provided - skipping channel join (paid channel flow)");
    }

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId: orgId.toString(),
      name: user.name,
      email: user.email,
    });

    console.log("✅ Affiliate invite accepted successfully");

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        affiliateId: user.affiliateId,
      },
      orgId: orgId.toString(),
    });
  } catch (error) {
    console.error("💥 Error accepting affiliate invite:", error);
    res.status(500).json({
      success: false,
      error: "Failed to accept invite",
      details: (error as Error).message,
    });
  }
});

// Get affiliate stats (authenticated)
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const user = await User.findById(me.userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const stats = await getAffiliateStats(me.userId);

    res.json({
      success: true,
      stats,
      affiliateId: user.affiliateId,
    });
  } catch (error) {
    console.error("💥 Error fetching affiliate stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch affiliate stats",
      details: (error as Error).message,
    });
  }
});

// Get affiliate network tree (authenticated)
router.get("/network", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const user = await User.findById(me.userId)
      .select("name email profilePicture affiliateId")
      .lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const network = await getAffiliateNetwork(me.userId);

    res.json({
      success: true,
      network,
      affiliateId: user.affiliateId,
      currentUser: {
        name: user.name,
        email: user.email,
        avatar: user.profilePicture || "",
      },
    });
  } catch (error) {
    console.error("💥 Error fetching affiliate network:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch affiliate network",
      details: (error as Error).message,
    });
  }
});

// Get direct children of a specific user (for globe visualization)
router.get("/direct-children/:userId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    const { userId } = req.params;
    const { page = "1", limit = "50", search = "", orgId } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      orgId?: string;
    };

    // Use orgId from query param if provided, otherwise fall back to JWT orgId
    const targetOrgId = orgId ? String(orgId) : me.orgId;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Build query with optional search
    // Exclude the user themselves from their own children list
    const baseQuery: any = {
      referredBy: new Types.ObjectId(userId),
      _id: { $ne: new Types.ObjectId(userId) },
    };

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      baseQuery.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { city: searchRegex },
        { country: searchRegex },
      ];
    }

    // Find direct children of the specified user (sorted by newest first)
    const [directChildren, totalCount] = await Promise.all([
      User.find(baseQuery)
        .select(
          "_id name email profilePicture affiliateId isVerified createdAt organizations city state country latitude longitude guest"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(baseQuery),
    ]);

    // Batch count direct referrals + check paid status + office subscriptions for all children
    const childIds = directChildren.map((c) => c._id);
    const [referralCounts, paidPurchases, officeSubscriptions] = childIds.length > 0
      ? await Promise.all([
          User.aggregate([
            { $match: { referredBy: { $in: childIds } } },
            { $group: { _id: "$referredBy", count: { $sum: 1 } } },
          ]),
          UnilevelPlusPurchase.find({ userId: { $in: childIds }, status: "active" })
            .select("userId")
            .lean(),
          OfficeSubscription.find({
            founderId: { $in: childIds },
            status: { $in: ["active", "trial"] },
          })
            .select("founderId planId")
            .lean(),
        ])
      : [[], [], []];
    const countMap = new Map<string, number>(
      referralCounts.map((e: any) => [e._id.toString(), e.count])
    );
    const paidSet = new Set(
      paidPurchases.map((p: any) => p.userId.toString())
    );
    const officePlanMap = new Map<string, Set<string>>();
    for (const sub of officeSubscriptions) {
      const fid = (sub as any).founderId.toString();
      if (!officePlanMap.has(fid)) officePlanMap.set(fid, new Set());
      officePlanMap.get(fid)!.add((sub as any).planId.toString());
    }

    const childrenWithCounts = directChildren.map((child) => {
      const directReferralCount = countMap.get(child._id.toString()) || 0;

      // Determine user type based on the specific organization
      const isFounder = (child as any).organizations?.some(
        (m: any) =>
          hasFounderAccess(m) &&
          m.organization?.toString() === targetOrgId
      );

      return {
        id: child._id.toString(),
        name: child.name || "Unknown",
        email: child.email,
        avatar: child.profilePicture || "",
        affiliateId: child.affiliateId,
        joinedAt: child.createdAt,
        status: child.isVerified ? "active" : "inactive",
        userType: isFounder ? "founder" : "stakeholder",
        guest: (child as any).guest === true,
        isPaidFounder: paidSet.has(child._id.toString()),
        purchases: {
          unilevelPlus: paidSet.has(child._id.toString()),
          basicPlan: officePlanMap.get(child._id.toString())?.has(OFFICE_PLAN_IDS.basic) ?? false,
          proPlan: officePlanMap.get(child._id.toString())?.has(OFFICE_PLAN_IDS.pro) ?? false,
        },
        directReferrals: directReferralCount,
        hasChildren: directReferralCount > 0,
        location: {
          city: child.city,
          state: child.state,
          country: child.country,
          latitude: child.latitude,
          longitude: child.longitude,
        },
      };
    });

    res.json({
      success: true,
      userId,
      children: childrenWithCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: pageNum * limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("💥 Error fetching direct children:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch direct children",
      details: (error as Error).message,
    });
  }
});

// Get user info for globe display (specific user or "me")
// Reachable from the garage admin panel too (which has no user session), so
// accept either a user JWT or a garage-admin token.
router.get("/user-info/:userId", requireUserOrGarageAdmin, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    const { userId } = req.params;
    const { orgId } = req.query;

    // Use orgId from query param if provided, otherwise fall back to JWT orgId
    const targetOrgId = orgId ? String(orgId) : me.orgId;

    // Handle "me" as a special case
    const targetUserId = userId === "me" ? me.userId : userId;

    const user = await User.findById(targetUserId)
      .select(
        "_id name email profilePicture affiliateId isVerified createdAt organizations city state country latitude longitude referredBy phone guest"
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get referral counts + paid status + office subscriptions
    const [directReferralCount, totalDescendantCount, paidPurchase, officeSubs] = await Promise.all([
      User.countDocuments({ referredBy: new Types.ObjectId(targetUserId) }),
      countAllDescendants(targetUserId),
      UnilevelPlusPurchase.findOne({ userId: new Types.ObjectId(targetUserId), status: "active" })
        .select("_id")
        .lean(),
      OfficeSubscription.find({
        founderId: new Types.ObjectId(targetUserId),
        status: { $in: ["active", "trial"] },
      })
        .select("planId")
        .lean(),
    ]);
    const activePlanIds = new Set(officeSubs.map((s: any) => s.planId.toString()));

    // Determine user type based on the specific organization
    const isFounder = (user as any).organizations?.some(
      (m: any) =>
        hasFounderAccess(m) &&
        m.organization?.toString() === targetOrgId
    );

    // Get referrer info if exists
    let referrer = null;
    if (user.referredBy) {
      const referrerUser = await User.findById(user.referredBy)
        .select("_id name email profilePicture phone country")
        .lean();
      if (referrerUser) {
        referrer = {
          id: referrerUser._id.toString(),
          name: referrerUser.name || "Unknown",
          avatar: referrerUser.profilePicture || "",
          email: (referrerUser as any).email || "",
          phone: (referrerUser as any).phone || "",
          // The referrer's OWN country — the profile page used to fall back to
          // the viewed member's country when the phone had no usable dial code.
          country: (referrerUser as any).country || "",
        };
      }
    }

    // Count how many organizations the user has joined
    const officesJoined = (user as any).organizations?.length || 0;

    // Fetch organization details for each office the user joined
    const orgIds = ((user as any).organizations || []).map(
      (m: any) => m.organization
    );
    const orgs = orgIds.length > 0
      ? await Organization.find({ _id: { $in: orgIds } })
          .select("_id name icon slug store.slug")
          .lean()
      : [];

    const orgMap = new Map(orgs.map((o) => [o._id.toString(), o]));
    const offices = ((user as any).organizations || []).map((m: any) => {
      const org = orgMap.get(m.organization?.toString());
      return {
        orgId: m.organization?.toString(),
        name: (org as any)?.name || "Unknown",
        icon: (org as any)?.icon || "",
        slug: (org as any)?.slug || (org as any)?.store?.slug || "",
        role: m.role,
        guest: m.guest === true,
        joinedAt: m.joinedAt,
      };
    });

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name || "Unknown",
        email: user.email,
        phone: (user as any).phone || "",
        avatar: user.profilePicture || "",
        affiliateId: user.affiliateId,
        joinedAt: user.createdAt,
        status: user.isVerified ? "active" : "inactive",
        userType: isFounder ? "founder" : "stakeholder",
        guest: (user as any).guest === true,
        isPaidFounder: !!paidPurchase,
        purchases: {
          unilevelPlus: !!paidPurchase,
          basicPlan: activePlanIds.has(OFFICE_PLAN_IDS.basic),
          proPlan: activePlanIds.has(OFFICE_PLAN_IDS.pro),
        },
        directReferrals: directReferralCount,
        totalReferrals: totalDescendantCount,
        officesJoined,
        offices,
        referrer,
        location: {
          city: user.city,
          state: user.state,
          country: user.country,
          latitude: user.latitude,
          longitude: user.longitude,
        },
      },
    });
  } catch (error) {
    console.error("💥 Error fetching user info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user info",
      details: (error as Error).message,
    });
  }
});

// Search entire downline tree by exact email and return navigation path
router.get("/search-downline-by-email/:userId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    const { userId } = req.params;
    const { email, orgId } = req.query as { email?: string; orgId?: string };

    // Use orgId from query param if provided, otherwise fall back to JWT orgId
    const targetOrgId = orgId ? String(orgId) : me.orgId;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const searchEmail = email.trim().toLowerCase();

    // Find the target user by exact email
    const targetUser = await User.findOne({ email: searchEmail })
      .select("_id name email profilePicture affiliateId isVerified createdAt organizations city state country latitude longitude referredBy")
      .lean();

    if (!targetUser) {
      return res.json({
        success: true,
        found: false,
        message: "No user found with this email",
      });
    }

    const targetId = targetUser._id.toString();

    // Check if the target is the root user themselves
    if (targetId === userId) {
      return res.json({
        success: true,
        found: true,
        isSelf: true,
        message: "This is your own profile",
      });
    }

    // Walk up the referredBy chain from target to root to build the path
    const path: string[] = [targetId];
    const visited = new Set<string>([targetId]);
    let currentId = targetUser.referredBy?.toString();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      path.unshift(currentId);

      if (currentId === userId) {
        // We've reached the root user - this person is in our downline
        break;
      }

      const parentUser = await User.findById(currentId)
        .select("_id referredBy")
        .lean();

      if (!parentUser) break;
      currentId = parentUser.referredBy?.toString();
    }

    // Check if the path starts with the root user
    if (path[0] !== userId) {
      return res.json({
        success: true,
        found: false,
        message: "This user is not in your network",
      });
    }

    // Build user info for each node in the path
    const pathUserIds = path;
    const pathObjectIds = pathUserIds.map((id) => new Types.ObjectId(id));

    // Batch queries for paid status and office subscriptions
    const [pathPaidPurchases, pathOfficeSubs] = await Promise.all([
      UnilevelPlusPurchase.find({ userId: { $in: pathObjectIds }, status: "active" })
        .select("userId")
        .lean(),
      OfficeSubscription.find({
        founderId: { $in: pathObjectIds },
        status: { $in: ["active", "trial"] },
      })
        .select("founderId planId")
        .lean(),
    ]);
    const pathPaidSet = new Set(pathPaidPurchases.map((p: any) => p.userId.toString()));
    const pathOfficePlanMap = new Map<string, Set<string>>();
    for (const sub of pathOfficeSubs) {
      const fid = (sub as any).founderId.toString();
      if (!pathOfficePlanMap.has(fid)) pathOfficePlanMap.set(fid, new Set());
      pathOfficePlanMap.get(fid)!.add((sub as any).planId.toString());
    }

    const pathUsers = await Promise.all(
      pathUserIds.map(async (id) => {
        const user = await User.findById(id)
          .select("_id name email profilePicture affiliateId isVerified createdAt organizations city state country latitude longitude referredBy")
          .lean();

        if (!user) return null;

        const directReferralCount = await User.countDocuments({
          referredBy: new Types.ObjectId(id),
        });

        // Determine user type based on the specific organization
        const isFounder = (user as any).organizations?.some(
          (m: any) =>
            hasFounderAccess(m) &&
            m.organization?.toString() === targetOrgId
        );

        const uid = user._id.toString();
        return {
          id: uid,
          name: user.name || "Unknown",
          email: user.email,
          avatar: user.profilePicture || "",
          affiliateId: user.affiliateId,
          joinedAt: user.createdAt,
          status: user.isVerified ? "active" : "inactive",
          userType: isFounder ? "founder" : "stakeholder",
          isPaidFounder: pathPaidSet.has(uid),
          purchases: {
            unilevelPlus: pathPaidSet.has(uid),
            basicPlan: pathOfficePlanMap.get(uid)?.has(OFFICE_PLAN_IDS.basic) ?? false,
            proPlan: pathOfficePlanMap.get(uid)?.has(OFFICE_PLAN_IDS.pro) ?? false,
          },
          directReferrals: directReferralCount,
          hasChildren: directReferralCount > 0,
          location: {
            city: user.city,
            state: user.state,
            country: user.country,
            latitude: user.latitude,
            longitude: user.longitude,
          },
        };
      })
    );

    const validPathUsers = pathUsers.filter(Boolean);

    res.json({
      success: true,
      found: true,
      isSelf: false,
      // Path from root user down to the found user
      navigationPath: validPathUsers,
      targetUser: validPathUsers[validPathUsers.length - 1],
    });
  } catch (error) {
    console.error("💥 Error searching downline by email:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search downline",
      details: (error as Error).message,
    });
  }
});

export default router;
