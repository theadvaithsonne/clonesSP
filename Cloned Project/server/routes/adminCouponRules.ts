import { Router, Response } from "express";
import { Types } from "mongoose";
import { z, ZodError } from "zod";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import {
  createCouponRule,
  listCouponRules,
  getCouponRule,
  updateCouponRule,
  deleteCouponRule,
} from "../services/couponRule";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { OfficePlan } from "../models/officePlan.model";
import { UnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";

const router = Router();

const ADMIN_PRODUCT_TYPES = [
  "office_plan",
  "unilevel_plus",
  "third_party_subscription",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  triggerProductType: z.enum(ADMIN_PRODUCT_TYPES),
  // Optional — when missing, the rule is a wildcard over the productType.
  triggerItemId: z.string().min(1).optional(),
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
// Hydration: trigger item title + reward coupon summary for display
// =====================================================================

async function hydrateRule(rule: any): Promise<any> {
  let triggerItemTitle = "(deleted)";
  const triggerItemImage: string | undefined = undefined;
  const isWildcard = !rule.triggerItemId;

  if (isWildcard) {
    triggerItemTitle =
      rule.triggerProductType === "third_party_subscription"
        ? "Third-Party Subscription"
        : "(deleted)";
  } else {
    switch (rule.triggerProductType) {
      case "office_plan": {
        const it = await OfficePlan.findById(rule.triggerItemId)
          .select("name")
          .lean();
        if (it) triggerItemTitle = (it as any).name;
        break;
      }
      case "unilevel_plus": {
        const it = await UnilevelPlusPlan.findById(rule.triggerItemId)
          .select("name")
          .lean();
        if (it) triggerItemTitle = (it as any).name;
        break;
      }
      case "third_party_subscription": {
        const it = await ThirdPartyClient.findById(rule.triggerItemId)
          .select("name productConfig")
          .lean();
        if (it) {
          triggerItemTitle = `${(it as any).name} — ${(it as any).productConfig?.productCode || "subscription"}`;
        }
        break;
      }
    }
  }

  const reward = await PlatformCoupon.findById(rule.rewardCouponId)
    .select("code name discountType discountValue currency")
    .lean();

  return {
    ...rule,
    triggerItemTitle,
    triggerItemImage,
    isWildcard,
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

// GET /garage-admin/coupon-rules
router.get(
  "/",
  requireGarageAdminAuth,
  async (_req: GarageAdminRequest, res: Response) => {
    try {
      const rules = await listCouponRules(null);
      const hydrated = await Promise.all(rules.map((r) => hydrateRule(r)));
      res.json({ success: true, rules: hydrated });
    } catch (err: any) {
      console.error("[adminCouponRules] list error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /garage-admin/coupon-rules
router.post(
  "/",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const adminId = (req.garageAdmin as any)?.id;
      if (!adminId) {
        return res
          .status(401)
          .json({ success: false, error: "Not authenticated" });
      }
      const body = createSchema.parse(req.body);
      const rule = await createCouponRule({
        scope: "platform",
        name: body.name,
        triggerProductType: body.triggerProductType,
        triggerItemId: body.triggerItemId,
        triggerQuantity: body.triggerQuantity,
        rewardCouponId: body.rewardCouponId,
        rewardQuantity: body.rewardQuantity,
        recurrence: body.recurrence,
        createdBy: adminId,
      });
      const hydrated = await hydrateRule(rule.toObject());
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

// GET /garage-admin/coupon-rules/:id
router.get(
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const rule = await getCouponRule(req.params.id, null);
      if (!rule) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }
      const hydrated = await hydrateRule(rule.toObject());
      res.json({ success: true, rule: hydrated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /garage-admin/coupon-rules/:id
router.patch(
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const body = updateSchema.parse(req.body);
      const rule = await updateCouponRule(req.params.id, null, body);
      if (!rule) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }
      const hydrated = await hydrateRule(rule.toObject());
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

// DELETE /garage-admin/coupon-rules/:id
router.delete(
  "/:id",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const ok = await deleteCouponRule(req.params.id, null);
      if (!ok) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;

// =====================================================================
// Items picker — separate router mounted at /garage-admin/coupon-rule-items
// =====================================================================

export const adminCouponRuleItemsRouter = Router();

interface AdminEligibleItem {
  _id: string;
  productType: "office_plan" | "unilevel_plus" | "third_party_subscription";
  title: string;
  price: number;
  currency: string;
  isRecurring: boolean;
  recurringDetail?: string;
  image?: string;
}

/**
 * GET /garage-admin/coupon-rule-items/all
 * Unified picker source: returns every platform-level sellable that an
 * admin rule can trigger on.
 *
 *   office_plan              → all OfficePlan records (subscriptions)
 *   unilevel_plus            → all UnilevelPlusPlan records (per-license)
 *   third_party_subscription → all ThirdPartyClient records (subscriptions)
 */
adminCouponRuleItemsRouter.get(
  "/all",
  requireGarageAdminAuth,
  async (_req: GarageAdminRequest, res: Response) => {
    try {
      const collected: AdminEligibleItem[] = [];

      const [plans, unilevelPlans, clients] = await Promise.all([
        OfficePlan.find({})
          .select("name slug totalAmount currency period")
          .sort({ updatedAt: -1 })
          .lean(),
        UnilevelPlusPlan.find({})
          .select("name productPrice")
          .sort({ updatedAt: -1 })
          .lean(),
        ThirdPartyClient.find({ isActive: { $ne: false } })
          .select("name productConfig")
          .sort({ updatedAt: -1 })
          .lean(),
      ]);

      // Third-Party Subscription — represented as a single picker entry
      // regardless of how many partner records exist. Internally this is a
      // wildcard rule (no specific triggerItemId) so it fires on any partner's
      // invoice. Visually it's just a normal item in the dropdown.
      collected.push({
        _id: "*third_party_subscription",
        productType: "third_party_subscription",
        title: "Third-Party Subscription",
        price: 0,
        currency: "USD",
        isRecurring: true,
      });

      for (const p of plans) {
        const period = (p as any).period || "monthly";
        collected.push({
          _id: (p as any)._id.toString(),
          productType: "office_plan",
          title: (p as any).name,
          price: (p as any).totalAmount ?? 0,
          currency: (p as any).currency || "USD",
          isRecurring: true,
          recurringDetail: `Subscription · ${period}`,
        });
      }
      for (const p of unilevelPlans) {
        collected.push({
          _id: (p as any)._id.toString(),
          productType: "unilevel_plus",
          title: (p as any).name,
          price: ((p as any).productPrice ?? 0) * 100, // dollars → cents
          currency: "USD",
          isRecurring: false,
        });
      }
      // Per-client entries are only useful when there are multiple
      // third-party partners — the admin can then target one specifically.
      // With 0 or 1 client, the generic "Third-Party Subscription" wildcard
      // above already covers the only partner, so listing the specific entry
      // alongside it just confuses admins (looks like a duplicate).
      // Once a second partner is onboarded, both specific entries appear and
      // the wildcard makes sense again.
      if (clients.length > 1) {
        for (const c of clients) {
          const cfg = (c as any).productConfig;
          collected.push({
            _id: (c as any)._id.toString(),
            productType: "third_party_subscription",
            title: `${(c as any).name} — ${cfg?.productCode || "subscription"}`,
            price: cfg?.totalAmount ?? 0,
            currency: "USD",
            isRecurring: true,
            recurringDetail: cfg?.recurringPeriod
              ? `Subscription · ${cfg.recurringPeriod}`
              : "Subscription",
          });
        }
      }

      res.json({ success: true, items: collected });
    } catch (err: any) {
      console.error("[adminCouponRuleItems] all error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);
