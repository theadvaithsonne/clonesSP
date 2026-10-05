// Founder-scoped CRUD + picker helpers for
// `StoreCouponCommission` — cascading coupon rewards on store
// (`ecommerce_item`) sales, paid up the buyer's upline chain.
// Mounted at /org/:orgId/store-commissions.
//
// Auth: requireAuth + requireFounder (mirrors founderCouponRules.ts).

import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { z, ZodError } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { StoreProduct } from "../models/storeProduct.model";
import { MAX_STORE_COMMISSION_LEVELS } from "../models/storeCouponCommission.model";
import {
  createStoreCommission,
  listStoreCommissions,
  getStoreCommission,
  updateStoreCommission,
  deleteStoreCommission,
  listAvailableUnlimitedCoupons,
  listOrgStoreProducts,
} from "../services/storeCouponCommission";

const router = Router({ mergeParams: true });

async function requireFounder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authReq = req as AuthRequest;
    const { orgId } = req.params;
    const userId = authReq.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (!orgId || !Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ success: false, error: "Invalid orgId" });
    }
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }
    const membership = (user.organizations as any[] | undefined)?.find(
      (m: any) => m.organization.toString() === orgId && hasFounderAccess(m),
    );
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You must be a founder of this organization",
      });
    }
    next();
  } catch (err) {
    console.error("[founderStoreCommissions] requireFounder error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

const levelSchema = z.object({
  level: z.number().int().min(1).max(MAX_STORE_COMMISSION_LEVELS),
  couponId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
});

// Cap superRefine — capCount MUST accompany capType === "per_pair_capped"
// and be a positive integer. Reused between create and update.
function capSuperRefine(
  val: { capType?: string; capCount?: number },
  ctx: z.RefinementCtx,
) {
  if (val.capType === "per_pair_capped") {
    if (typeof val.capCount !== "number" || val.capCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capCount"],
        message:
          "capCount is required and must be at least 1 when capType is 'per_pair_capped'",
      });
    }
  }
}

const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    // null / omitted = wildcard (any store product on this org)
    triggerItemId: z.string().min(1).nullable().optional(),
    levels: z.array(levelSchema).min(1).max(MAX_STORE_COMMISSION_LEVELS),
    // Distribution cap. Absent = "perpetual" (same as every legacy rule).
    capType: z.enum(["perpetual", "per_pair_capped"]).optional(),
    capCount: z.number().int().min(1).max(100).optional(),
  })
  .superRefine(capSuperRefine);

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    triggerItemId: z.string().min(1).nullable().optional(),
    levels: z
      .array(levelSchema)
      .min(1)
      .max(MAX_STORE_COMMISSION_LEVELS)
      .optional(),
    isActive: z.boolean().optional(),
    capType: z.enum(["perpetual", "per_pair_capped"]).optional(),
    capCount: z.number().int().min(1).max(100).optional(),
  })
  .superRefine(capSuperRefine);

// ─── Hydration for list/get ────────────────────────────────────────
// Level rows carry a couponId; hydrate the coupon's code + name +
// discount summary so the FE can render "L1 → SAVE10 (10% off)" without
// N extra fetches. Trigger item similarly gets its title.

async function hydrateRule(rule: any) {
  const couponIds = (rule.levels || [])
    .map((l: any) => l.couponId)
    .filter(Boolean);
  const coupons = couponIds.length
    ? await PlatformCoupon.find({ _id: { $in: couponIds } })
        .select("_id code name discountType discountValue currency maxUsageCount maxUsagePerUser status")
        .lean<any[]>()
    : [];
  const byId = new Map(coupons.map((c) => [String(c._id), c]));
  const levels = (rule.levels || []).map((l: any) => {
    const c = byId.get(String(l.couponId));
    return {
      level: l.level,
      couponId: String(l.couponId),
      quantity: l.quantity,
      coupon: c
        ? {
            code: c.code,
            name: c.name,
            discountType: c.discountType,
            discountValue: c.discountValue,
            currency: c.currency,
            // If a founder capped this coupon after wiring it in, flag
            // it — evaluator will skip it and this tells the founder why.
            isCapped:
              (c.maxUsageCount ?? 0) > 0 || (c.maxUsagePerUser ?? 0) > 0,
            status: c.status,
          }
        : null,
    };
  });
  let trigger: any = null;
  if (rule.triggerItemId) {
    const p = await StoreProduct.findById(rule.triggerItemId)
      .select("_id title images")
      .lean<any>();
    trigger = p
      ? {
          _id: String(p._id),
          title: p.title,
          image: p.images?.[0]?.url || null,
        }
      : null;
  }
  return {
    _id: String(rule._id),
    orgId: String(rule.orgId),
    name: rule.name,
    triggerItemId: rule.triggerItemId ? String(rule.triggerItemId) : null,
    triggerItem: trigger, // hydrated
    isWildcard: !rule.triggerItemId,
    levels,
    isActive: rule.isActive,
    effectiveFrom: rule.effectiveFrom,
    // Missing on legacy docs — surface "perpetual" so the FE never has
    // to special-case undefined.
    capType: rule.capType || "perpetual",
    capCount: rule.capCount ?? null,
    createdBy: String(rule.createdBy),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

// ─── Routes ────────────────────────────────────────────────────────

// GET /org/:orgId/store-commissions
router.get("/", requireAuth, requireFounder, async (req, res) => {
  try {
    const { orgId } = req.params;
    const rules = await listStoreCommissions(orgId);
    const hydrated = await Promise.all(rules.map((r) => hydrateRule(r)));
    res.json({ success: true, rules: hydrated });
  } catch (err: any) {
    console.error("[founderStoreCommissions] list:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /org/:orgId/store-commissions/available-coupons
// Coupons eligible for cascade use — unlimited PlatformCoupons only.
// If empty, FE renders the "create an unlimited coupon first" empty state.
router.get(
  "/available-coupons",
  requireAuth,
  requireFounder,
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const coupons = await listAvailableUnlimitedCoupons(orgId);
      res.json({ success: true, coupons });
    } catch (err: any) {
      console.error("[founderStoreCommissions] available-coupons:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// GET /org/:orgId/store-commissions/available-store-products
// Trigger picker: this org's active store products.
router.get(
  "/available-store-products",
  requireAuth,
  requireFounder,
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const products = await listOrgStoreProducts(orgId);
      res.json({ success: true, products });
    } catch (err: any) {
      console.error(
        "[founderStoreCommissions] available-store-products:",
        err,
      );
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// POST /org/:orgId/store-commissions
router.post("/", requireAuth, requireFounder, async (req, res) => {
  try {
    const { orgId } = req.params;
    const authReq = req as AuthRequest;
    const body = createSchema.parse(req.body);
    const rule = await createStoreCommission({
      orgId,
      name: body.name,
      triggerItemId: body.triggerItemId ?? undefined,
      levels: body.levels,
      createdBy: authReq.user!.userId,
      capType: body.capType,
      capCount: body.capCount,
    });
    const hydrated = await hydrateRule(rule.toObject());
    res.status(201).json({ success: true, rule: hydrated });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid body", details: err.issues });
    }
    console.error("[founderStoreCommissions] create:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /org/:orgId/store-commissions/:id
router.get("/:id", requireAuth, requireFounder, async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const rule = await getStoreCommission(id, orgId);
    if (!rule) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }
    const hydrated = await hydrateRule(rule);
    res.json({ success: true, rule: hydrated });
  } catch (err: any) {
    console.error("[founderStoreCommissions] get:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /org/:orgId/store-commissions/:id
router.patch("/:id", requireAuth, requireFounder, async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const body = updateSchema.parse(req.body);
    const rule = await updateStoreCommission(id, orgId, {
      name: body.name,
      triggerItemId: body.triggerItemId,
      levels: body.levels,
      isActive: body.isActive,
      capType: body.capType,
      capCount: body.capCount,
    });
    if (!rule) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }
    const hydrated = await hydrateRule(rule);
    res.json({ success: true, rule: hydrated });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid body", details: err.issues });
    }
    console.error("[founderStoreCommissions] update:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /org/:orgId/store-commissions/:id
router.delete("/:id", requireAuth, requireFounder, async (req, res) => {
  try {
    const { orgId, id } = req.params;
    const ok = await deleteStoreCommission(id, orgId);
    if (!ok) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("[founderStoreCommissions] delete:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
