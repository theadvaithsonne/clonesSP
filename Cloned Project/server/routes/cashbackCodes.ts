// REST routes for the cashback code system (v2: single-product binding).
// Mounted at `/cashback-codes`. All endpoints require `requireAuth`. Mutating
// endpoints additionally run `isEligibleCreator` (UP-activated affiliate with
// ≥1 direct, or the platform super-admin) so only entitled callers can mint
// or modify codes.
//
// The same routes are called from the Garage HQ FE AND the external Garage
// e-commerce platform — both forward the user's Garage JWT (SSO assumption).

import { Router, Request, Response } from "express";
import { z, ZodError } from "zod";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/user.model";
import {
  CASHBACK_PRODUCT_TYPES,
  CashbackProductType,
} from "../models/cashbackCode.model";
import {
  isEligibleCreator,
  createCashbackCode,
  updateCashbackCode,
  setCashbackCodeStatus,
  listCashbackCodesForCreator,
  getCashbackCodeDetail,
  listDistributionsForCode,
  listDistributionsReceivedByUser,
  listEligibleItems,
  listEligibleBuyersForCreator,
  getCashbackSummaryForCreator,
  getAffiliateCashbackForItem,
  getEligibleCashbacksForBuyer,
} from "../services/cashbackCode";

const router = Router();

const productTypeEnum = z.enum(CASHBACK_PRODUCT_TYPES);

const createSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "code must be alphanumeric / _ / -"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  productType: productTypeEnum,
  itemId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "itemId must be a valid ObjectId"),
  ratePct: z.number().gt(0).max(100),
  /**
   * Optional whitelist of buyer userIds. Every entry MUST be a direct
   * downline of the calling creator — service enforces this via
   * filterToDirectDownline. Empty/omitted = any direct downline can use.
   */
  allowedBuyerIds: z
    .array(
      z
        .string()
        .refine((v) => Types.ObjectId.isValid(v), "invalid userId")
    )
    .max(500)
    .optional(),
  cycleCount: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxUsageCount: z.number().int().min(1).optional(),
  maxUsagePerUser: z.number().int().min(1).optional(),
  minOrderAmountCents: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  ratePct: z.number().gt(0).max(100).optional(),
  allowedBuyerIds: z
    .array(
      z
        .string()
        .refine((v) => Types.ObjectId.isValid(v), "invalid userId")
    )
    .max(500)
    .optional(),
  cycleCount: z.number().int().min(1).optional(),
  validUntil: z.string().datetime().optional(),
  maxUsageCount: z.number().int().min(1).optional(),
  maxUsagePerUser: z.number().int().min(1).optional(),
  minOrderAmountCents: z.number().int().min(0).optional(),
});

async function callerEmail(authReq: AuthRequest): Promise<string | undefined> {
  if ((authReq.user as any)?.email) return (authReq.user as any).email;
  const u = await User.findById(authReq.user!.userId).select("email").lean();
  return (u as any)?.email || undefined;
}

// ──────────────────────────────────────────────────────────────────────
// POST /cashback-codes — create
// ──────────────────────────────────────────────────────────────────────

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const body = createSchema.parse(req.body);

    const email = await callerEmail(authReq);
    const elig = await isEligibleCreator(authReq.user!.userId, email);
    if (!elig.eligible) {
      return res.status(403).json({
        success: false,
        error: "Not eligible to create cashback codes",
        reason: elig.reason,
      });
    }

    const code = await createCashbackCode({
      code: body.code.toUpperCase(),
      name: body.name,
      description: body.description,
      creatorId: authReq.user!.userId,
      productType: body.productType,
      itemId: body.itemId,
      ratePct: body.ratePct,
      allowedBuyerIds: body.allowedBuyerIds,
      cycleCount: body.cycleCount,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      maxUsageCount: body.maxUsageCount,
      maxUsagePerUser: body.maxUsagePerUser,
      minOrderAmountCents: body.minOrderAmountCents,
    });
    res.status(201).json({ success: true, code });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid body",
        details: err.issues,
      });
    }
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, error: "Code already exists" });
    }
    if (err?.message === "code_already_used_by_platform_coupon") {
      return res.status(409).json({
        success: false,
        error: "Code is already used by a platform coupon",
      });
    }
    if (err?.message === "bound_item_not_found_or_inactive") {
      return res
        .status(400)
        .json({ success: false, error: "Selected product not found" });
    }
    if (err?.message === "no_commission_plan") {
      return res.status(400).json({
        success: false,
        error: "This product has no commission — nothing to convert to cashback",
        reason: "no_commission_plan",
      });
    }
    if (err?.message === "rate_exceeds_commission") {
      return res.status(400).json({
        success: false,
        error: "Cashback rate can't exceed your direct commission on this item",
        reason: "rate_exceeds_commission",
      });
    }
    console.error("[cashbackCodes] create error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes — list mine
// ──────────────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { status, productType, itemId, limit, skip } = req.query;
    const result = await listCashbackCodesForCreator({
      creatorId: authReq.user!.userId,
      status: typeof status === "string" ? status : undefined,
      productType:
        typeof productType === "string" ? productType : undefined,
      // Narrow to one product → the drawer's "Existing Offers For This Product".
      itemId: typeof itemId === "string" ? itemId : undefined,
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/me/summary — creator-side summary strip numbers
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/me/summary",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const summary = await getCashbackSummaryForCreator(
        authReq.user!.userId
      );
      res.json({ success: true, ...summary });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/me/received — buyer-side history
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/me/received",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { limit, skip } = req.query;
      const result = await listDistributionsReceivedByUser({
        buyerId: authReq.user!.userId,
        limit: limit ? Number(limit) : undefined,
        skip: skip ? Number(skip) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/eligible-for-buyer?productIds=a,b,c&productType=product
//
// Buyer-facing preview: "which of these products can I earn cashback on
// right now, and how much would I get?". Uses the caller's own JWT — no
// buyerId query param is accepted so one buyer can't peek at another's
// eligible codes.
//
// Response shape:
//   {
//     success, upline: { userId, name, email, profilePicture } | null,
//     items: [
//       { productId, productType, found, productTitle, productPrice,
//         productCurrency, productImage,
//         matches: [{ codeId, code, name, ratePct, cashbackAmountUsd,
//                     level1AmountUsd, creator, level=1, ... }] }
//     ]
//   }
//
// Empty `matches` per item = product exists but no cashback applies.
// `found: false` = productId doesn't resolve (deleted / archived / not
// this productType).
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/eligible-for-buyer",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const schema = z.object({
        productIds: z
          .string()
          .min(1, "productIds is required (comma-separated list)"),
        productType: productTypeEnum.default("product"),
      });
      const { productIds: raw, productType } = schema.parse(req.query);
      const productIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (productIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "productIds is empty" });
      }
      if (productIds.length > 100) {
        return res
          .status(400)
          .json({ success: false, error: "at most 100 productIds per request" });
      }

      const result = await getEligibleCashbacksForBuyer({
        buyerId: authReq.user!.userId,
        productType,
        productIds,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, error: err.issues[0]?.message ?? "Invalid query" });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/eligible-items?productType=channel&orgId=...
// → populate the product picker in the create form
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/eligible-items",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      // productType is OPTIONAL now: omitted → ALL cashback types merged (the
      // grid default); present → narrow to that type. Only reject an explicitly
      // invalid value.
      const productType = req.query.productType as string | undefined;
      // orgId is OPTIONAL: omitted → list across ALL offices (default);
      // present → narrow to that office. `q` filters by product name.
      const orgId = req.query.orgId as string | undefined;
      const q = req.query.q as string | undefined;
      if (
        productType &&
        !CASHBACK_PRODUCT_TYPES.includes(productType as CashbackProductType)
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid productType" });
      }
      // Eligibility check up front — saves the FE a round-trip if the caller
      // can't actually mint codes anyway.
      const email = await callerEmail(authReq);
      const elig = await isEligibleCreator(authReq.user!.userId, email);
      if (!elig.eligible) {
        return res.status(403).json({
          success: false,
          error: "Not eligible to create cashback codes",
          reason: elig.reason,
        });
      }
      const scopedOrgId =
        orgId && Types.ObjectId.isValid(orgId) ? orgId : undefined;
      // Cashback eligibility is affiliate-based (item carries a direct commission
      // and is paid), NOT org membership — so the list is no longer scoped to the
      // caller's own offices. `orgId` stays an OPTIONAL office filter for the UI.
      const items = await listEligibleItems({
        orgId: scopedOrgId,
        productType: productType
          ? (productType as CashbackProductType)
          : undefined,
        q: q?.trim() || undefined,
        creatorId: authReq.user!.userId,
      });
      res.json({ success: true, items, total: items.length });
    } catch (err: any) {
      console.error("[cashbackCodes] eligible-items error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/eligible-buyers
// → populate the optional user whitelist (creator's direct downline)
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/eligible-buyers",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const email = await callerEmail(authReq);
      const elig = await isEligibleCreator(authReq.user!.userId, email);
      if (!elig.eligible) {
        return res.status(403).json({
          success: false,
          error: "Not eligible to create cashback codes",
          reason: elig.reason,
        });
      }
      const buyers = await listEligibleBuyersForCreator(
        authReq.user!.userId
      );
      res.json({ success: true, buyers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/for-affiliate
//   ?affiliateId=<ref>&productType=<type>&itemId=<id>&buyerId=<optional>
// PUBLIC (no auth) — does this affiliate offer cashback on this item? Powers
// the storefront "invited by X" box; shown to logged-out visitors too. Returns
// { cashback: null } (200) when there's nothing to surface. MUST stay above the
// `/:id` route so it isn't captured as an id.
// ──────────────────────────────────────────────────────────────────────

router.get("/for-affiliate", async (req: Request, res: Response) => {
  try {
    const affiliateId =
      typeof req.query.affiliateId === "string"
        ? req.query.affiliateId.trim()
        : "";
    const productType = req.query.productType as string | undefined;
    const itemId = req.query.itemId as string | undefined;
    const buyerId =
      typeof req.query.buyerId === "string" ? req.query.buyerId : undefined;

    if (!affiliateId) {
      return res
        .status(400)
        .json({ success: false, error: "affiliateId is required" });
    }
    if (
      !productType ||
      !CASHBACK_PRODUCT_TYPES.includes(productType as CashbackProductType)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid productType" });
    }
    if (!itemId || !Types.ObjectId.isValid(itemId)) {
      return res
        .status(400)
        .json({ success: false, error: "Valid itemId is required" });
    }

    const cashback = await getAffiliateCashbackForItem({
      affiliateId,
      productType: productType as CashbackProductType,
      itemId,
      buyerId,
    });
    res.json({ success: true, cashback });
  } catch (err: any) {
    console.error("[cashbackCodes] for-affiliate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/:id — fetch one (creator only)
// ──────────────────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const code = await getCashbackCodeDetail(req.params.id, authReq.user!.userId);
    if (!code) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.json({ success: true, code });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// PATCH /cashback-codes/:id
// ──────────────────────────────────────────────────────────────────────

router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const body = updateSchema.parse(req.body);
    const email = await callerEmail(authReq);
    const elig = await isEligibleCreator(authReq.user!.userId, email);
    if (!elig.eligible) {
      return res
        .status(403)
        .json({ success: false, error: "Not eligible", reason: elig.reason });
    }
    const code = await updateCashbackCode(
      req.params.id,
      authReq.user!.userId,
      {
        ...body,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      }
    );
    if (!code) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.json({ success: true, code });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid body", details: err.issues });
    }
    if (err?.message === "no_commission_plan") {
      return res.status(400).json({
        success: false,
        error: "This product has no commission — nothing to convert to cashback",
        reason: "no_commission_plan",
      });
    }
    if (err?.message === "rate_exceeds_commission") {
      return res.status(400).json({
        success: false,
        error: "Cashback rate can't exceed your direct commission on this item",
        reason: "rate_exceeds_commission",
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /cashback-codes/:id/deactivate, /activate
// ──────────────────────────────────────────────────────────────────────

router.post(
  "/:id/deactivate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const code = await setCashbackCodeStatus(
        req.params.id,
        authReq.user!.userId,
        "inactive"
      );
      if (!code)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/:id/activate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const code = await setCashbackCodeStatus(
        req.params.id,
        authReq.user!.userId,
        "active"
      );
      if (!code)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /cashback-codes/:id/distributions — analytics for the creator
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/:id/distributions",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { limit, skip } = req.query;
      const result = await listDistributionsForCode({
        codeId: req.params.id,
        creatorId: authReq.user!.userId,
        limit: limit ? Number(limit) : undefined,
        skip: skip ? Number(skip) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export { CASHBACK_PRODUCT_TYPES };

export default router;
