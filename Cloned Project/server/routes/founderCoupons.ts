import { Router, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import {
  createCoupon,
  updateCoupon,
  deactivateCoupon,
  getCouponById,
  listCoupons,
  getCouponAnalytics,
  listItemsByCategory,
} from "../services/coupon";
import { ApplicableItemType } from "../models/coupon.model";

const FOUNDER_ITEM_TYPES: ApplicableItemType[] = ["channel", "course", "workshop", "product", "event_ticket"];

const router = Router();

// Middleware to verify founder role for the organization
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

    // Check if user is a founder (or has fullAccess) of the specified organization
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
  } catch (error) {
    console.error("Error in requireFounder middleware:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

// Validation schemas - founders cannot create subscription coupons (no razorpayOfferId)
const createCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric with optional _ or -"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  discountValue: z.number().min(1).max(100),
  maxDiscountAmount: z.number().min(0).optional(),
  applicableTo: z.array(
    z.enum([
      "channel",
      "course",
      "workshop",
      "product",
      "event_ticket",
    ])
  ).min(1),
  specificItemIds: z.array(z.string()).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxUsageCount: z.number().min(1).optional(),
  maxUsagePerUser: z.number().min(1).optional(),
  minOrderAmount: z.number().min(0).optional(),
});

const updateCouponSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  discountValue: z.number().min(1).max(100).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  applicableTo: z.array(
    z.enum([
      "channel",
      "course",
      "workshop",
      "product",
      "event_ticket",
    ])
  ).min(1).optional(),
  specificItemIds: z.array(z.string()).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  maxUsageCount: z.number().min(1).optional(),
  maxUsagePerUser: z.number().min(1).optional(),
  minOrderAmount: z.number().min(0).optional(),
});

// List available items for coupon targeting
router.get(
  "/:orgId/coupons/available-items",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { types } = req.query;

      // Parse types from query string (comma-separated)
      let itemTypes: ApplicableItemType[] = FOUNDER_ITEM_TYPES;
      if (types && typeof types === "string") {
        itemTypes = types.split(",").filter((t) =>
          FOUNDER_ITEM_TYPES.includes(t as ApplicableItemType)
        ) as ApplicableItemType[];
      }

      const items = await listItemsByCategory(itemTypes, orgId, true);

      return res.json({
        success: true,
        items,
      });
    } catch (error) {
      console.error("Error listing available items:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

// Create coupon for organization
router.post(
  "/:orgId/coupons",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { orgId } = req.params;
      const validatedData = createCouponSchema.parse(req.body);

      const coupon = await createCoupon({
        ...validatedData,
        applicableTo: validatedData.applicableTo as ApplicableItemType[],
        scope: "organization",
        orgId,
        createdBy: authReq.user.userId,
        createdByType: "founder",
        validFrom: validatedData.validFrom
          ? new Date(validatedData.validFrom)
          : undefined,
        validUntil: validatedData.validUntil
          ? new Date(validatedData.validUntil)
          : undefined,
      });

      return res.status(201).json({
        success: true,
        coupon,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: error.issues,
        });
      }
      console.error("Error creating coupon:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

// List organization coupons
router.get(
  "/:orgId/coupons",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { status, skip, limit } = req.query;

      const result = await listCoupons({
        scope: "organization",
        orgId,
        status: status as string | undefined,
        skip: skip ? parseInt(skip as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Error listing coupons:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

// Get coupon by ID
router.get(
  "/:orgId/coupons/:couponId",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, couponId } = req.params;

      const coupon = await getCouponById(couponId);

      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      // Verify coupon belongs to this organization
      if (coupon.orgId?.toString() !== orgId) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      return res.json({
        success: true,
        coupon,
      });
    } catch (error) {
      console.error("Error getting coupon:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

// Update coupon
router.patch(
  "/:orgId/coupons/:couponId",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, couponId } = req.params;
      const validatedData = updateCouponSchema.parse(req.body);

      // First verify the coupon belongs to this organization
      const existingCoupon = await getCouponById(couponId);
      if (!existingCoupon || existingCoupon.orgId?.toString() !== orgId) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      const coupon = await updateCoupon(
        couponId,
        {
          ...validatedData,
          applicableTo: validatedData.applicableTo as ApplicableItemType[] | undefined,
          validFrom: validatedData.validFrom
            ? new Date(validatedData.validFrom)
            : undefined,
          validUntil: validatedData.validUntil
            ? new Date(validatedData.validUntil)
            : undefined,
        },
        orgId,
        true // isFounder
      );

      return res.json({
        success: true,
        coupon,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: error.issues,
        });
      }
      console.error("Error updating coupon:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

// Deactivate coupon
router.delete(
  "/:orgId/coupons/:couponId",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, couponId } = req.params;

      // First verify the coupon belongs to this organization
      const existingCoupon = await getCouponById(couponId);
      if (!existingCoupon || existingCoupon.orgId?.toString() !== orgId) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      const coupon = await deactivateCoupon(couponId);

      return res.json({
        success: true,
        message: "Coupon deactivated",
        coupon,
      });
    } catch (error) {
      console.error("Error deactivating coupon:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

// Get coupon analytics
router.get(
  "/:orgId/coupons/:couponId/analytics",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, couponId } = req.params;

      const coupon = await getCouponById(couponId);

      if (!coupon || coupon.orgId?.toString() !== orgId) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      const analytics = await getCouponAnalytics(couponId);

      return res.json({
        success: true,
        coupon,
        analytics,
      });
    } catch (error) {
      console.error("Error getting coupon analytics:", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

export default router;
