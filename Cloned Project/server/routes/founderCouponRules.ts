import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { z, ZodError } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Product } from "../models/product.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { StoreProduct } from "../models/storeProduct.model";
import {
  createCouponRule,
  listCouponRules,
  getCouponRule,
  updateCouponRule,
  deleteCouponRule,
} from "../services/couponRule";

const router = Router({ mergeParams: true });

const PRODUCT_TYPES = [
  "channel",
  "course",
  "workshop",
  "product",
  "service",
  "call",
  "ecommerce",
] as const;

async function requireFounder(req: Request, res: Response, next: NextFunction) {
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
    const membership = (user.organizations as any[] | undefined)?.find(
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
    console.error("[founderCouponRules] requireFounder error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  triggerProductType: z.enum(PRODUCT_TYPES),
  triggerItemId: z.string().min(1),
  triggerQuantity: z.number().int().min(1).default(1),
  rewardCouponId: z.string().min(1),
  rewardQuantity: z.number().int().min(1).default(1),
  recurrence: z.enum(["once", "every"]).default("once"),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  recurrence: z.enum(["once", "every"]).optional(),
  triggerQuantity: z.number().int().min(1).optional(),
  rewardQuantity: z.number().int().min(1).optional(),
});

// =====================================================================
// Hydration: fetch trigger item title + reward coupon for display
// =====================================================================

async function hydrateRule(rule: any, orgId: string): Promise<any> {
  const orgObjId = new Types.ObjectId(orgId);
  let triggerItemTitle = "(deleted)";
  let triggerItemImage: string | undefined;

  switch (rule.triggerProductType) {
    case "channel": {
      const it = await Channel.findOne({ _id: rule.triggerItemId, storeId: orgObjId })
        .select("title coverImage")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).title;
        triggerItemImage = (it as any).coverImage;
      }
      break;
    }
    case "course": {
      const it = await Course.findOne({
        _id: rule.triggerItemId,
        organizationId: orgObjId,
      })
        .select("title coverImage")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).title;
        triggerItemImage = (it as any).coverImage;
      }
      break;
    }
    case "workshop": {
      const it = await Workshop.findOne({
        _id: rule.triggerItemId,
        orgId: orgObjId,
      })
        .select("title thumbnail")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).title;
        triggerItemImage = (it as any).thumbnail;
      }
      break;
    }
    case "product": {
      const it = await Product.findOne({
        _id: rule.triggerItemId,
        organizationId: orgObjId,
      })
        .select("name images")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).name;
        triggerItemImage = Array.isArray((it as any).images)
          ? (it as any).images[0]
          : undefined;
      }
      break;
    }
    case "service": {
      const it = await Service.findOne({
        _id: rule.triggerItemId,
        organizationId: orgObjId,
      })
        .select("title coverImage")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).title;
        triggerItemImage = (it as any).coverImage;
      }
      break;
    }
    case "call": {
      const it = await CallOffering.findOne({
        _id: rule.triggerItemId,
        organizationId: orgObjId,
      })
        .select("title coverImage")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).title;
        triggerItemImage = (it as any).coverImage;
      }
      break;
    }
    case "ecommerce": {
      // Storefront items live in StoreProduct, keyed by `orgId`.
      const it = await StoreProduct.findOne({
        _id: rule.triggerItemId,
        orgId: orgObjId,
      })
        .select("title featuredImage images")
        .lean();
      if (it) {
        triggerItemTitle = (it as any).title;
        triggerItemImage =
          (it as any).featuredImage ||
          (Array.isArray((it as any).images)
            ? (it as any).images[0]?.url
            : undefined);
      }
      break;
    }
  }

  const reward = await PlatformCoupon.findById(rule.rewardCouponId)
    .select("code name discountType discountValue currency")
    .lean();

  return {
    ...rule,
    triggerItemTitle,
    triggerItemImage,
    rewardCoupon: reward
      ? {
          _id: (reward as any)._id,
          code: (reward as any).code,
          name: (reward as any).name,
          discountType: (reward as any).discountType,
          discountValue: (reward as any).discountValue,
          currency: (reward as any).currency,
        }
      : null,
  };
}

// =====================================================================
// Routes
// =====================================================================

// GET /org/:orgId/coupon-rules
router.get(
  "/",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const rules = await listCouponRules(orgId);
      const hydrated = await Promise.all(rules.map((r) => hydrateRule(r, orgId)));
      res.json({ success: true, rules: hydrated });
    } catch (err: any) {
      console.error("[founderCouponRules] list error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /org/:orgId/coupon-rules
router.post(
  "/",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const authReq = req as AuthRequest;
      const body = createSchema.parse(req.body);
      const rule = await createCouponRule({
        scope: "organization",
        orgId,
        name: body.name,
        triggerProductType: body.triggerProductType,
        triggerItemId: body.triggerItemId,
        triggerQuantity: body.triggerQuantity,
        rewardCouponId: body.rewardCouponId,
        rewardQuantity: body.rewardQuantity,
        recurrence: body.recurrence,
        createdBy: authReq.user!.userId,
      });
      const hydrated = await hydrateRule(rule.toObject(), orgId);
      res.status(201).json({ success: true, rule: hydrated });
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

// PATCH /org/:orgId/coupon-rules/:id
router.patch(
  "/:id",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      const body = updateSchema.parse(req.body);
      const rule = await updateCouponRule(id, orgId, body);
      if (!rule) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }
      const hydrated = await hydrateRule(rule.toObject(), orgId);
      res.json({ success: true, rule: hydrated });
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

// DELETE /org/:orgId/coupon-rules/:id
router.delete(
  "/:id",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      const ok = await deleteCouponRule(id, orgId);
      if (!ok) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /org/:orgId/coupon-rules/:id (used for edit hydration)
router.get(
  "/:id",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId, id } = req.params;
      const rule = await getCouponRule(id, orgId);
      if (!rule) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }
      const hydrated = await hydrateRule(rule.toObject(), orgId);
      res.json({ success: true, rule: hydrated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
