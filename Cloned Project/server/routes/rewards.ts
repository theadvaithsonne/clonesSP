import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { CouponAssignment } from "../models/couponAssignment.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { Coupon } from "../models/coupon.model";
import { Organization } from "../models/organization.model";

const router = Router();

/**
 * GET /checkout/my-rewards
 * Returns coupons that have been ASSIGNED to the authenticated user
 * (the user's "Rewards" inbox). Merges PlatformCoupon + legacy Coupon
 * via the CouponAssignment model.
 *
 * Only returns assignments with status="active" AND the underlying coupon
 * still active AND within validity window.
 */
router.get("/my-rewards", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user as { userId: string };
    const userId = user.userId;
    const now = new Date();

    // Auto-expire assignments whose expiresAt has passed
    await CouponAssignment.updateMany(
      {
        userId: new Types.ObjectId(userId),
        status: "active",
        expiresAt: { $lt: now },
      },
      { $set: { status: "expired" } }
    );

    const assignments = await CouponAssignment.find({
      userId: new Types.ObjectId(userId),
      status: "active",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (assignments.length === 0) {
      return res.json({ success: true, rewards: [], total: 0 });
    }

    // Split by source
    const platformIds: Types.ObjectId[] = [];
    const legacyIds: Types.ObjectId[] = [];
    for (const a of assignments) {
      if (a.couponSource === "platform") platformIds.push(a.couponId);
      else legacyIds.push(a.couponId);
    }

    const [platformCoupons, legacyCoupons] = await Promise.all([
      platformIds.length
        ? PlatformCoupon.find({ _id: { $in: platformIds } }).lean()
        : Promise.resolve([]),
      legacyIds.length
        ? Coupon.find({ _id: { $in: legacyIds } }).lean()
        : Promise.resolve([]),
    ]);

    const platformMap = new Map(
      platformCoupons.map((c) => [c._id.toString(), c])
    );
    const legacyMap = new Map(legacyCoupons.map((c) => [c._id.toString(), c]));

    // Collect org IDs for display
    const orgIds = Array.from(
      new Set(
        [...platformCoupons, ...legacyCoupons]
          .filter((c) => c.orgId)
          .map((c) => c.orgId!.toString())
      )
    );
    const orgs = orgIds.length
      ? await Organization.find({ _id: { $in: orgIds } })
          .select("name slug icon")
          .lean()
      : [];
    const orgMap = new Map(orgs.map((o) => [o._id.toString(), o]));

    const rewards = assignments
      .map((a) => {
        const couponId = a.couponId.toString();
        if (a.couponSource === "platform") {
          const c = platformMap.get(couponId);
          if (!c) return null;
          // Filter out assignments for inactive or expired coupons
          if (c.status !== "active") return null;
          if (c.validFrom > now) return null;
          if (c.validUntil && c.validUntil < now) return null;
          const org = c.orgId ? orgMap.get(c.orgId.toString()) : null;
          return {
            assignmentId: a._id.toString(),
            source: "platform" as const,
            _id: c._id.toString(),
            code: c.code,
            name: c.name,
            description: c.description,
            productType: c.productType,
            discountType: c.discountType,
            discountValue: c.discountValue,
            maxDiscountAmount: c.maxDiscountAmount,
            cycleCount: c.cycleCount,
            minOrderAmount: c.minOrderAmount,
            validUntil: c.validUntil,
            scope: c.scope,
            reason: a.reason,
            assignedAt: a.createdAt,
            assignmentExpiresAt: a.expiresAt,
            org: org
              ? {
                  _id: org._id.toString(),
                  name: org.name,
                  slug: org.slug,
                  icon: org.icon,
                }
              : null,
          };
        }
        // legacy
        const c = legacyMap.get(couponId);
        if (!c) return null;
        if (c.status !== "active") return null;
        if (c.validFrom > now) return null;
        if (c.validUntil && c.validUntil < now) return null;
        const org = c.orgId ? orgMap.get(c.orgId.toString()) : null;
        return {
          assignmentId: a._id.toString(),
          source: "legacy" as const,
          _id: c._id.toString(),
          code: c.code,
          name: c.name,
          description: c.description,
          productType: null,
          applicableTo: c.applicableTo,
          discountType: "percent" as const,
          discountValue: c.discountValue,
          maxDiscountAmount: c.maxDiscountAmount,
          cycleCount: undefined,
          minOrderAmount: c.minOrderAmount,
          validUntil: c.validUntil,
          scope: c.scope,
          reason: a.reason,
          assignedAt: a.createdAt,
          assignmentExpiresAt: a.expiresAt,
          org: org
            ? {
                _id: org._id.toString(),
                name: org.name,
                slug: org.slug,
                icon: org.icon,
              }
            : null,
        };
      })
      .filter(Boolean);

    res.json({ success: true, rewards, total: rewards.length });
  } catch (err: any) {
    console.error("[Rewards] list error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
