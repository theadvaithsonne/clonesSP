import { Router, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import {
  createPlatformCoupon,
  updatePlatformCoupon,
  deactivatePlatformCoupon,
  activatePlatformCoupon,
  listPlatformCoupons,
  getPlatformCouponById,
  listRedemptionsForCoupon,
} from "../services/platformCoupon";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Product } from "../models/product.model";

/**
 * Determines whether a specific founder-owned item is recurring (i.e. generates
 * scheduled child invoices). This is what `cycleCount` semantically means.
 *
 * For service & call there is no subscription support → always false.
 */
async function isItemRecurring(
  productType: string,
  itemId: string,
  orgId: string
): Promise<boolean> {
  const itemObjId = new Types.ObjectId(itemId);
  const orgObjId = new Types.ObjectId(orgId);
  switch (productType) {
    case "channel": {
      const c = await Channel.findOne({ _id: itemObjId, storeId: orgObjId })
        .select("isSubscription")
        .lean();
      return !!c?.isSubscription;
    }
    case "course": {
      const c = await Course.findOne({ _id: itemObjId, organizationId: orgObjId })
        .select("isSubscription")
        .lean();
      return !!(c as any)?.isSubscription;
    }
    case "workshop": {
      const w = await Workshop.findOne({ _id: itemObjId, orgId: orgObjId })
        .select("isSubscription")
        .lean();
      return !!w?.isSubscription;
    }
    case "product": {
      const p = await Product.findOne({ _id: itemObjId, organizationId: orgObjId })
        .select("isSubscription")
        .lean();
      return !!(p as any)?.isSubscription;
    }
    case "service":
    case "call":
    case "ecommerce":
      // Storefront products are one-time purchases — no subscription billing.
      // Same as service/call: cycleCount is meaningless and coerced away.
      return false;
    default:
      return false;
  }
}

const router = Router({ mergeParams: true });

// Founder-targetable product types (all founder-owned items).
// `ecommerce` covers items in the org's storefront (StoreProduct collection);
// added alongside the original six founder-owned types.
const FOUNDER_PRODUCT_TYPES = [
  "channel",
  "course",
  "workshop",
  "product",
  "service",
  "call",
  "ecommerce",
] as const;

const productTypeEnum = z.enum(FOUNDER_PRODUCT_TYPES);
const discountTypeEnum = z.enum(["fixed", "percent"]);

const createSchema = z
  .object({
    code: z.string().min(3).max(20).regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    // Optional banner / cover image URL — caller uploads to their CDN
    // and stores the link. We don't validate the format beyond a length
    // ceiling so storefronts can choose whatever URL shape they want.
    media: z.string().url().max(2048).optional(),
    productType: productTypeEnum,
    discountType: discountTypeEnum,
    discountValue: z.number().min(1),
    maxDiscountAmount: z.number().min(0).optional(),
    currency: z.enum(["USD", "INR"]).optional(),
    cycleCount: z.number().int().min(1).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    maxUsageCount: z.number().int().min(1).optional(),
    maxUsagePerUser: z.number().int().min(1).optional(),
    minOrderAmount: z.number().min(0).optional(),
    specificItemIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "percent" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "percent discount must be 1-100",
      });
    }
    // Note: cycleCount required-ness is enforced post-parse against the
    // selected item's `isSubscription` flag (see POST handler below).
  });

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  // Pass an empty string ("") to clear the media link, a URL to set it,
  // or omit the field to leave it as-is.
  media: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  discountValue: z.number().min(1).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  currency: z.enum(["USD", "INR"]).optional(),
  cycleCount: z.number().int().min(1).optional(),
  validUntil: z.string().datetime().optional(),
  maxUsageCount: z.number().int().min(1).optional(),
  maxUsagePerUser: z.number().int().min(1).optional(),
  minOrderAmount: z.number().min(0).optional(),
});

// Middleware: verify founder role for :orgId
async function requireFounder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authReq = req as AuthRequest;
    const { orgId } = req.params;
    const userId = authReq.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }
    const membership = user.organizations?.find(
      (m: any) => m.organization.toString() === orgId && hasFounderAccess(m)
    );
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You must be a founder of this organization",
      });
    }
    next();
  } catch (err) {
    console.error("[founderPlatformCoupons] requireFounder error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// Helper: verify coupon belongs to this org
async function ensureCouponBelongsToOrg(
  couponId: string,
  orgId: string,
  res: Response
): Promise<boolean> {
  const coupon = await PlatformCoupon.findById(couponId);
  if (!coupon) {
    res.status(404).json({ success: false, error: "Coupon not found" });
    return false;
  }
  if (coupon.scope !== "organization" || coupon.orgId?.toString() !== orgId) {
    res.status(403).json({
      success: false,
      error: "Coupon does not belong to this organization",
    });
    return false;
  }
  return true;
}

// GET /org/:orgId/platform-coupons
router.get("/", requireAuth, requireFounder, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { productType, status, limit, skip } = req.query;
    const result = await listPlatformCoupons({
      productType: productType as any,
      status: status as any,
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
      scope: "organization",
      orgId,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /org/:orgId/platform-coupons
router.post("/", requireAuth, requireFounder, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const body = createSchema.parse(req.body);
    const authReq = req as AuthRequest;

    // New founder flow: coupon is always tied to a specific item. Look up the
    // item to determine if cycleCount is required (recurring items only).
    const itemIds = body.specificItemIds || [];
    if (itemIds.length === 1) {
      const recurring = await isItemRecurring(body.productType, itemIds[0], orgId);
      if (recurring && !body.cycleCount) {
        return res.status(400).json({
          success: false,
          error: "cycleCount required for subscription items",
        });
      }
      if (!recurring && body.cycleCount && body.cycleCount > 1) {
        // One-time items can't span multiple cycles — coerce to undefined so
        // the redemption defaults to 1 cycle.
        body.cycleCount = undefined;
      }
    }

    const coupon = await createPlatformCoupon({
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      createdBy: authReq.user!.userId,
      createdByType: "founder",
      scope: "organization",
      orgId,
    });
    res.status(201).json({ success: true, coupon });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid body", details: err.issues });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /org/:orgId/platform-coupons/:id
router.get(
  "/:id",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const coupon = await getPlatformCouponById(id);
      res.json({ success: true, coupon });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /org/:orgId/platform-coupons/:id
router.patch(
  "/:id",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const body = updateSchema.parse(req.body);
      const coupon = await updatePlatformCoupon(id, {
        ...body,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      });
      if (!coupon) return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, coupon });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid body", details: err.issues });
      }
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

// POST /org/:orgId/platform-coupons/:id/deactivate
router.post(
  "/:id/deactivate",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const coupon = await deactivatePlatformCoupon(id);
      res.json({ success: true, coupon });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /org/:orgId/platform-coupons/:id/activate
router.post(
  "/:id/activate",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const coupon = await activatePlatformCoupon(id);
      res.json({ success: true, coupon });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /org/:orgId/platform-coupons/:id/redemptions
router.get(
  "/:id/redemptions",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const redemptions = await listRedemptionsForCoupon(id);
      res.json({ success: true, redemptions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ============ Assignments (founder assigns their org's coupon to users) ============

router.get(
  "/:id/assignments",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const { listAssignmentsForCoupon } = await import(
        "../services/couponAssignment"
      );
      const assignments = await listAssignmentsForCoupon(id, "platform");
      res.json({ success: true, assignments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

const founderAssignSchema = z.object({
  userIds: z.array(z.string()).min(1).max(500),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post(
  "/:id/assignments",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const parsed = founderAssignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid body", details: parsed.error.issues });
      }
      const authReq = req as AuthRequest;
      const { assignCoupon } = await import("../services/couponAssignment");

      const results = await Promise.allSettled(
        parsed.data.userIds.map((uid) =>
          assignCoupon({
            userId: uid,
            couponId: id,
            couponSource: "platform",
            assignedBy: authReq.user!.userId,
            assignedByType: "founder",
            assignerOrgId: orgId,
            reason: parsed.data.reason,
            expiresAt: parsed.data.expiresAt
              ? new Date(parsed.data.expiresAt)
              : undefined,
          })
        )
      );

      const assigned = results.filter((r) => r.status === "fulfilled").length;
      const failed = results
        .map((r, i) =>
          r.status === "rejected"
            ? {
                userId: parsed.data.userIds[i],
                error: (r.reason as Error).message,
              }
            : null
        )
        .filter(Boolean);
      res.json({ success: true, assigned, failed });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.delete(
  "/:id/assignments/:assignmentId",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      if (!(await ensureCouponBelongsToOrg(id, orgId, res))) return;
      const authReq = req as AuthRequest;
      const { revokeAssignment } = await import(
        "../services/couponAssignment"
      );
      const assignment = await revokeAssignment(
        req.params.assignmentId,
        authReq.user!.userId,
        "founder",
        orgId
      );
      if (!assignment)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, assignment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

export default router;
