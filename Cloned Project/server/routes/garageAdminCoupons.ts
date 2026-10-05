import { Router, Response } from "express";
import { z, ZodError } from "zod";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
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

const ALL_ITEM_TYPES: ApplicableItemType[] = [
  "channel",
  "course",
  "workshop",
  "product",
  "office_plan",
  "office_addon",
];

const router = Router();

// Validation schemas
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
  scope: z.enum(["global", "organization"]),
  orgId: z.string().optional(),
  razorpayOfferId: z.string().optional(),
  applicableTo: z.array(
    z.enum([
      "channel",
      "course",
      "workshop",
      "product",
      "office_plan",
      "office_addon",
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
  razorpayOfferId: z.string().optional(),
  applicableTo: z.array(
    z.enum([
      "channel",
      "course",
      "workshop",
      "product",
      "office_plan",
      "office_addon",
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
  "/available-items",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { types, orgId } = req.query;

      // Parse types from query string (comma-separated)
      let itemTypes: ApplicableItemType[] = ALL_ITEM_TYPES;
      if (types && typeof types === "string") {
        itemTypes = types.split(",").filter((t) =>
          ALL_ITEM_TYPES.includes(t as ApplicableItemType)
        ) as ApplicableItemType[];
      }

      const items = await listItemsByCategory(
        itemTypes,
        orgId as string | undefined,
        false // isFounder = false for garage admin
      );

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

// Create coupon
router.post(
  "/",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const validatedData = createCouponSchema.parse(req.body);

      // Validate orgId is provided if scope is organization
      if (validatedData.scope === "organization" && !validatedData.orgId) {
        return res.status(400).json({
          success: false,
          error: "orgId is required when scope is organization",
        });
      }

      const coupon = await createCoupon({
        ...validatedData,
        applicableTo: validatedData.applicableTo as ApplicableItemType[],
        createdBy: req.garageAdmin!.id,
        createdByType: "garage_admin",
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

// List all coupons
router.get(
  "/",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { scope, orgId, status, skip, limit, q } = req.query;

      const result = await listCoupons({
        scope: scope as "global" | "organization" | undefined,
        orgId: orgId as string | undefined,
        status: status as string | undefined,
        skip: skip ? parseInt(skip as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      // Header search (?q=) — case-insensitive match on code / name / description.
      let coupons = result.coupons;
      let total = result.total;
      const search = String(q || "").trim();
      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        coupons = coupons.filter(
          (c: any) =>
            re.test(c.code || "") ||
            re.test(c.name || "") ||
            re.test(c.description || "")
        );
        total = coupons.length;
      }

      return res.json({
        success: true,
        coupons,
        total,
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
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const coupon = await getCouponById(req.params.id);

      if (!coupon) {
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
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const validatedData = updateCouponSchema.parse(req.body);

      // Get existing coupon to know if it's org-scoped
      const existingCoupon = await getCouponById(req.params.id);
      if (!existingCoupon) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      const coupon = await updateCoupon(
        req.params.id,
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
        existingCoupon.orgId?.toString(),
        false // isFounder = false for garage admin
      );

      if (!coupon) {
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
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const coupon = await deactivateCoupon(req.params.id);

      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

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
  "/:id/analytics",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const coupon = await getCouponById(req.params.id);

      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
      }

      const analytics = await getCouponAnalytics(req.params.id);

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
