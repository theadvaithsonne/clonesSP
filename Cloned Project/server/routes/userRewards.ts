import { Router, Response } from "express";
import { Types } from "mongoose";
import { z, ZodError } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { CouponAssignment } from "../models/couponAssignment.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { transferAssignment } from "../services/couponAssignment";
import {
  PendingGiftError,
  approvePendingGift,
  cancelPendingGift,
  createPendingGift,
  listIncomingPending,
  listOutgoingPending,
  rejectPendingGift,
  searchRecipientEligibility,
} from "../services/pendingCouponGift";

const router = Router();

/**
 * GET /me/rewards?status=active|used|revoked
 * List the current user's coupon assignments with populated coupon + assigner.
 */
router.get("/", requireAuth, async (req, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user.userId;
    const status = req.query.status as string | undefined;

    const query: any = { userId: new Types.ObjectId(userId) };
    if (status && ["active", "used", "revoked", "expired"].includes(status)) {
      query.status = status;
    }

    const assignments = await CouponAssignment.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Hydrate coupons (platform only — legacy is rarely used here)
    const platformIds = assignments
      .filter((a) => a.couponSource === "platform")
      .map((a) => a.couponId);
    const coupons = platformIds.length
      ? await PlatformCoupon.find({ _id: { $in: platformIds } }).lean()
      : [];
    const couponMap = new Map(coupons.map((c: any) => [c._id.toString(), c]));

    // Hydrate assigner identity
    const userIdsToFetch = new Set<string>();
    const orgIdsToFetch = new Set<string>();
    for (const a of assignments) {
      if (a.assignedByType === "user" || a.assignedByType === "garage_admin" || a.assignedByType === "founder") {
        if (a.giftedFromUserId) userIdsToFetch.add(a.giftedFromUserId.toString());
        else if (a.assignedBy) userIdsToFetch.add(a.assignedBy.toString());
      }
      if (a.assignerOrgId) orgIdsToFetch.add(a.assignerOrgId.toString());
    }
    const [users, orgs] = await Promise.all([
      userIdsToFetch.size
        ? User.find({ _id: { $in: Array.from(userIdsToFetch) } })
            .select("name email profilePicture")
            .lean()
        : Promise.resolve([]),
      orgIdsToFetch.size
        ? Organization.find({ _id: { $in: Array.from(orgIdsToFetch) } })
            .select("name")
            .lean()
        : Promise.resolve([]),
    ]);
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    const orgMap = new Map(orgs.map((o: any) => [o._id.toString(), o]));

    const enriched = assignments.map((a) => {
      const coupon = couponMap.get(a.couponId.toString()) as any;
      const senderId = a.giftedFromUserId?.toString() || a.assignedBy?.toString();
      const sender = senderId ? userMap.get(senderId) : null;
      const org = a.assignerOrgId ? orgMap.get(a.assignerOrgId.toString()) : null;

      const assignerLabel =
        a.assignedByType === "user"
          ? (sender as any)?.name || (sender as any)?.email || "A friend"
          : a.assignedByType === "founder"
            ? (org as any)?.name || "Founder"
            : a.assignedByType === "system"
              ? "Garage"
              : "Garage Admin";

      return {
        _id: a._id,
        status: a.status,
        couponSource: a.couponSource,
        couponCode: a.couponCode,
        coupon: coupon
          ? {
              _id: coupon._id,
              code: coupon.code,
              name: coupon.name,
              description: coupon.description,
              productType: coupon.productType,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              maxDiscountAmount: coupon.maxDiscountAmount,
              currency: coupon.currency || "USD",
              cycleCount: coupon.cycleCount,
              validUntil: coupon.validUntil,
              status: coupon.status,
            }
          : null,
        assignedByType: a.assignedByType,
        assigner: {
          label: assignerLabel,
          userId: senderId,
          name: (sender as any)?.name,
          email: (sender as any)?.email,
          profilePicture: (sender as any)?.profilePicture,
          orgId: a.assignerOrgId,
          orgName: (org as any)?.name,
        },
        reason: a.reason,
        giftMessage: a.giftMessage,
        availableUses: typeof a.availableUses === "number" ? a.availableUses : 1,
        expiresAt: a.expiresAt,
        redeemedAt: a.redeemedAt,
        revokedAt: a.revokedAt,
        createdAt: a.createdAt,
      };
    });

    res.json({ success: true, rewards: enriched });
  } catch (err: any) {
    console.error("[userRewards] list error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const giftSchema = z.object({
  recipientEmail: z.string().email(),
  message: z.string().max(280).optional(),
  // When > 0, switches into the paid-offer flow (creates a PendingCouponGift
  // that requires recipient approval + wallet transfer). When absent/0, the
  // existing instant free-gift path runs.
  priceUsd: z.number().positive().optional(),
  // Required when priceUsd is set — the sender's current org context (which
  // store wallet the transfer settles into).
  orgId: z.string().optional(),
});

/**
 * POST /me/rewards/:id/gift
 *
 * Two paths, branching on body shape:
 *
 * - **Free gift (no priceUsd)**: existing behaviour — instantly revoke
 *   sender's assignment, create a fresh active row for the recipient.
 *
 * - **Paid offer (priceUsd > 0)**: create a `PendingCouponGift` row,
 *   lock the sender's assignment, notify the recipient. No money or
 *   coupon moves yet — the recipient must approve.
 */
router.post("/:id/gift", requireAuth, async (req, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user.userId;
    const { id } = req.params;
    const parsed = giftSchema.parse(req.body);

    // Paid path
    if (parsed.priceUsd && parsed.priceUsd > 0) {
      if (!parsed.orgId) {
        return res.status(400).json({
          success: false,
          error: "orgId is required for paid offers",
        });
      }
      const offer = await createPendingGift({
        fromUserId: userId,
        fromAssignmentId: id,
        toEmail: parsed.recipientEmail,
        priceUsd: parsed.priceUsd,
        message: parsed.message,
        orgId: parsed.orgId,
      });
      return res.json({
        success: true,
        mode: "paid",
        offer: {
          _id: offer._id,
          priceUsd: offer.priceUsd,
          status: offer.status,
          createdAt: offer.createdAt,
        },
      });
    }

    // Free path (unchanged)
    const normalizedEmail = parsed.recipientEmail.trim().toLowerCase();
    const recipient = await User.findOne({ email: normalizedEmail })
      .select("_id email name")
      .lean();
    if (!recipient) {
      return res
        .status(400)
        .json({ success: false, error: "No Garage user with that email" });
    }
    if ((recipient as any)._id.toString() === userId) {
      return res
        .status(400)
        .json({ success: false, error: "You cannot gift to yourself" });
    }

    const newAssignment = await transferAssignment({
      fromAssignmentId: id,
      fromUserId: userId,
      toUserId: (recipient as any)._id.toString(),
      message: parsed.message,
    });

    res.json({
      success: true,
      mode: "free",
      assignment: {
        _id: newAssignment._id,
        recipientEmail: (recipient as any).email,
        recipientName: (recipient as any).name,
      },
    });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid body", details: err.issues });
    }
    if (err instanceof PendingGiftError) {
      return res
        .status(err.status)
        .json({ success: false, error: err.message, code: err.code });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────
// Pending paid-gift offers
// ───────────────────────────────────────────────────────────────────────

/**
 * GET /me/coupon-offers/incoming
 * GET /me/coupon-offers/outgoing
 *
 * Lists pending offers (with hydrated coupon + counterparty info) for the
 * current user's inbox (incoming) or outbox (outgoing).
 */
async function listAndHydrate(
  offers: any[],
  counterpartyField: "fromUserId" | "toUserId"
) {
  if (offers.length === 0) return [];

  const platformIds = offers
    .filter((o) => o.couponSource === "platform")
    .map((o) => o.couponId);
  const userIds = offers.map((o) => o[counterpartyField]);

  const [coupons, users] = await Promise.all([
    platformIds.length
      ? PlatformCoupon.find({ _id: { $in: platformIds } }).lean()
      : Promise.resolve([]),
    User.find({ _id: { $in: userIds } })
      .select("_id name email profilePicture")
      .lean(),
  ]);
  const couponMap = new Map(coupons.map((c: any) => [c._id.toString(), c]));
  const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

  return offers.map((o) => {
    const c = couponMap.get(o.couponId.toString()) as any;
    const cp = userMap.get(o[counterpartyField].toString()) as any;
    return {
      _id: o._id,
      status: o.status,
      priceUsd: o.priceUsd,
      message: o.message,
      orgId: o.orgId,
      couponSource: o.couponSource,
      couponCode: o.couponCode,
      coupon: c
        ? {
            _id: c._id,
            code: c.code,
            name: c.name,
            description: c.description,
            productType: c.productType,
            discountType: c.discountType,
            discountValue: c.discountValue,
            maxDiscountAmount: c.maxDiscountAmount,
            currency: c.currency || "USD",
            cycleCount: c.cycleCount,
            validUntil: c.validUntil,
          }
        : null,
      counterparty: cp
        ? {
            _id: cp._id,
            name: cp.name,
            email: cp.email,
            profilePicture: cp.profilePicture,
          }
        : null,
      createdAt: o.createdAt,
    };
  });
}

router.get("/offers/incoming", requireAuth, async (req, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const offers = await listIncomingPending(authReq.user.userId);
    const enriched = await listAndHydrate(offers, "fromUserId");
    res.json({ success: true, offers: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/offers/outgoing", requireAuth, async (req, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const offers = await listOutgoingPending(authReq.user.userId);
    const enriched = await listAndHydrate(offers, "toUserId");
    res.json({ success: true, offers: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(
  "/offers/:id/approve",
  requireAuth,
  async (req, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const offer = await approvePendingGift(req.params.id, authReq.user.userId);
      res.json({ success: true, offer });
    } catch (err: any) {
      if (err instanceof PendingGiftError) {
        return res
          .status(err.status)
          .json({ success: false, error: err.message, code: err.code });
      }
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/offers/:id/reject",
  requireAuth,
  async (req, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const offer = await rejectPendingGift(req.params.id, authReq.user.userId);
      res.json({ success: true, offer });
    } catch (err: any) {
      if (err instanceof PendingGiftError) {
        return res
          .status(err.status)
          .json({ success: false, error: err.message, code: err.code });
      }
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/offers/:id/cancel",
  requireAuth,
  async (req, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const offer = await cancelPendingGift(req.params.id, authReq.user.userId);
      res.json({ success: true, offer });
    } catch (err: any) {
      if (err instanceof PendingGiftError) {
        return res
          .status(err.status)
          .json({ success: false, error: err.message, code: err.code });
      }
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /me/coupon-offers/recipient-eligibility
 *
 * Query params: priceUsd (number), orgId (sender's current org), q (search
 * string for email or name).
 *
 * Returns up to 20 candidates with their store wallet balance + an `eligible`
 * flag the picker uses to disable rows that can't afford the offer.
 */
const eligSchema = z.object({
  priceUsd: z.coerce.number().positive(),
  orgId: z.string(),
  q: z.string().min(2).max(120),
});

router.get(
  "/offers/recipient-eligibility",
  requireAuth,
  async (req, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = eligSchema.parse(req.query);
      const rows = await searchRecipientEligibility(
        authReq.user.userId,
        parsed.orgId,
        parsed.priceUsd,
        parsed.q
      );
      res.json({ success: true, candidates: rows });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid query", details: err.issues });
      }
      if (err instanceof PendingGiftError) {
        return res
          .status(err.status)
          .json({ success: false, error: err.message, code: err.code });
      }
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

export default router;
