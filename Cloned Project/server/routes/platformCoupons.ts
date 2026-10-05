import { Router, Response } from "express";
import { z, ZodError } from "zod";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import {
  createPlatformCoupon,
  updatePlatformCoupon,
  deactivatePlatformCoupon,
  activatePlatformCoupon,
  listPlatformCoupons,
  getPlatformCouponById,
  listRedemptionsForCoupon,
} from "../services/platformCoupon";

const router = Router();

const productTypeEnum = z.enum([
  "office_plan",
  "unilevel_plus",
  "third_party_subscription",
  "franchise_program",
  "franchise_territory",
]);
const discountTypeEnum = z.enum(["fixed", "percent"]);

const createSchema = z
  .object({
    code: z.string().min(3).max(20).regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
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
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "percent" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "percent discount must be 1-100",
      });
    }
    if (
      (data.productType === "office_plan" ||
        data.productType === "third_party_subscription" ||
        data.productType === "franchise_program" ||
        data.productType === "franchise_territory") &&
      !data.cycleCount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cycleCount required for subscription coupons",
      });
    }
  });

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  discountValue: z.number().min(1).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  currency: z.enum(["USD", "INR"]).optional(),
  cycleCount: z.number().int().min(1).optional(),
  validUntil: z.string().datetime().optional(),
  maxUsageCount: z.number().int().min(1).optional(),
  maxUsagePerUser: z.number().int().min(1).optional(),
  minOrderAmount: z.number().min(0).optional(),
});

router.get(
  "/",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { productType, status, limit, skip, scope, q } = req.query;
      const result = await listPlatformCoupons({
        productType: productType as any,
        status: status as any,
        limit: limit ? Number(limit) : undefined,
        skip: skip ? Number(skip) : undefined,
        // Admin sees platform-scoped by default; pass ?scope=all to see everything
        scope:
          scope === "all"
            ? undefined
            : ((scope as any) || "platform"),
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

      res.json({ success: true, coupons, total });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const body = createSchema.parse(req.body);
      const adminId = (req.garageAdmin as any)?.id;
      if (!adminId)
        return res.status(401).json({ success: false, error: "Not authenticated" });

      const coupon = await createPlatformCoupon({
        ...body,
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        createdBy: adminId,
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
  }
);

router.get(
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const coupon = await getPlatformCouponById(req.params.id);
      if (!coupon)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, coupon });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.patch(
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const body = updateSchema.parse(req.body);
      const coupon = await updatePlatformCoupon(req.params.id, {
        ...body,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      });
      if (!coupon)
        return res.status(404).json({ success: false, error: "Not found" });
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

router.post(
  "/:id/deactivate",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const coupon = await deactivatePlatformCoupon(req.params.id);
      if (!coupon)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, coupon });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/:id/activate",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const coupon = await activatePlatformCoupon(req.params.id);
      if (!coupon)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, coupon });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.get(
  "/:id/redemptions",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const redemptions = await listRedemptionsForCoupon(req.params.id);
      res.json({ success: true, redemptions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ============ Assignments (admin assigns a platform coupon to users) ============

router.get(
  "/:id/assignments",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { listAssignmentsForCoupon } = await import(
        "../services/couponAssignment"
      );
      const assignments = await listAssignmentsForCoupon(req.params.id, "platform");
      res.json({ success: true, assignments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

const assignSchema = z.object({
  userIds: z.array(z.string()).min(1).max(500),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post(
  "/:id/assignments",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid body", details: parsed.error.issues });
      }
      const adminId = (req.garageAdmin as any)?.id;
      if (!adminId) {
        return res
          .status(401)
          .json({ success: false, error: "Not authenticated" });
      }
      const { assignCoupon } = await import("../services/couponAssignment");

      const results = await Promise.allSettled(
        parsed.data.userIds.map((uid) =>
          assignCoupon({
            userId: uid,
            couponId: req.params.id,
            couponSource: "platform",
            assignedBy: adminId,
            assignedByType: "garage_admin",
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
  "/assignments/:assignmentId",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const adminId = (req.garageAdmin as any)?.id;
      const { revokeAssignment } = await import(
        "../services/couponAssignment"
      );
      const assignment = await revokeAssignment(
        req.params.assignmentId,
        adminId || "system",
        "garage_admin"
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
