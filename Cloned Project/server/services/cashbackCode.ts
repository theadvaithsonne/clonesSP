// Cashback code service — orchestrates the affiliate-funded rebate flow.
// Per the v2 product decision: each CashbackCode is bound to ONE specific
// product (productType + itemId), carries a single ratePct, and optionally
// restricts which of the creator's direct downline can use it via
// `allowedBuyerIds`.
//
// Phases:
//   1. createCashbackCode / list / get / update / set status
//      → creator-facing CRUD. Open to any user (the isEligibleCreator gate —
//         formerly UP + ≥1 direct downline — was removed 2026-07-16).
//
//   2. resolveEligibleItem(productType, itemId, orgId?)
//      → look up the sellable item to (a) verify it exists at create-time
//         and (b) derive its seller org for the storeWallet credit later.
//
//   3. validateCouponOrCashback(code, ...)
//      → checkout entry point. Tries PlatformCoupon first; falls back to
//         CashbackCode. Mutually exclusive.
//
//   4. executeCashback(invoice)
//      → post-paid hook. Finds the cart line that matches the code's bound
//         (productType, itemId), reads the actual level-1 percentage off
//         the CommissionDistribution for that line, caps the configured
//         ratePct against it, transfers AffiliateWallet → StoreWallet.

import mongoose, { Types } from "mongoose";
import {
  CashbackCode,
  ICashbackCode,
  CashbackProductType,
} from "../models/cashbackCode.model";
import { CashbackDistribution } from "../models/cashbackDistribution.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import {
  validatePlatformCoupon,
  PlatformCouponValidationResult,
} from "./platformCoupon";
import {
  LEGACY_DIGITAL_PRODUCT_FILTER,
  orgIdsWithActiveStore,
} from "./catalogVisibility";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ──────────────────────────────────────────────────────────────────────
// Item-type mapping
// ──────────────────────────────────────────────────────────────────────

export function mapItemTypeToCashbackType(
  itemType: string
): CashbackProductType | null {
  switch (itemType) {
    case "product":
      return "product";
    case "channel":
      return "channel";
    case "course":
      return "course";
    case "workshop":
      return "workshop";
    case "service":
      return "service";
    case "call":
      return "call";
    case "ecommerce_item":
      return "ecommerce";
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Item resolution — per cashback productType, look up the canonical
// collection and derive its seller org. Powers the eligible-items route
// AND is reused at code-create time to (a) validate the item exists and
// (b) derive the orgId for the future StoreWallet credit.
// ──────────────────────────────────────────────────────────────────────

export interface ResolvedItem {
  itemId: string;
  productType: CashbackProductType;
  orgId: string;
  title: string;
  price: number;
  currency: string;
  image?: string;
  /** Seller org name — populated by listEligibleItems (esp. all-offices mode). */
  orgName?: string;
  /** Seller org icon/logo URL — for the "Sold By" chip on the cashback grid. */
  orgIcon?: string;
  /** Level-1 (direct-referrer) commission % from the item's active CombPlan;
   *  `null` when the item has no commission plan (renders as "–" in the grid). */
  commissionPct?: number | null;
  /** `commissionPct` applied to `price` (same currency units, 2-dp); `null`
   *  when there is no plan. This is the "direct commission" the affiliate can
   *  convert to cashback. */
  commissionAmount?: number | null;
  /** How many cashback offers the caller has already minted for THIS item —
   *  powers the drawer's "Existing Offers For This Product" badge. */
  myOfferCount?: number;
  /** True when the item bills on a recurring cycle (subscription channels/
   *  courses/products, recurring workshops). Drives the form's "Billing Type"
   *  and gates "Maximum cycles" (only meaningful for recurring items). */
  isRecurring?: boolean;
  /** Billing period for recurring items ("weekly" | "monthly" | ...); absent
   *  for one-time items. */
  billingPeriod?: string;
}

export async function resolveEligibleItem(
  productType: CashbackProductType,
  itemId: string
): Promise<ResolvedItem | null> {
  const id = new Types.ObjectId(itemId);
  switch (productType) {
    case "channel": {
      const { Channel } = await import("../models/channel.model");
      const it = await Channel.findById(id)
        .select("title price currency coverImage storeId isActive")
        .lean();
      if (!it || (it as any).isActive === false) return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).storeId),
        title: (it as any).title,
        price: (it as any).price ?? 0,
        currency: (it as any).currency || "USD",
        image: (it as any).coverImage,
      };
    }
    case "course": {
      const { Course } = await import("../models/course.model");
      const it = await Course.findById(id)
        .select("title price currency coverImage organizationId status")
        .lean();
      if (!it || (it as any).status === "archived") return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).organizationId),
        title: (it as any).title,
        price: (it as any).price ?? 0,
        currency: (it as any).currency || "USD",
        image: (it as any).coverImage,
      };
    }
    case "workshop": {
      const { Workshop } = await import("../models/workshop.model");
      const it = await Workshop.findById(id)
        .select("title price currency thumbnail orgId isActive")
        .lean();
      if (!it || (it as any).isActive === false) return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).orgId),
        title: (it as any).title,
        price: (it as any).price ?? 0,
        currency: (it as any).currency || "USD",
        image: (it as any).thumbnail,
      };
    }
    case "product": {
      const { Product } = await import("../models/product.model");
      const it = await Product.findById(id)
        .select("name price currency images organizationId status")
        .lean();
      if (!it || (it as any).status === "archived") return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).organizationId),
        title: (it as any).name,
        price: (it as any).price ?? 0,
        currency: (it as any).currency || "USD",
        image: Array.isArray((it as any).images)
          ? (it as any).images[0]
          : undefined,
      };
    }
    case "service": {
      const { Service } = await import("../models/service.model");
      const it = await Service.findById(id)
        .select("title price currency coverImage organizationId status")
        .lean();
      if (!it || (it as any).status === "archived") return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).organizationId),
        title: (it as any).title,
        price: (it as any).price ?? 0,
        currency: (it as any).currency || "USD",
        image: (it as any).coverImage,
      };
    }
    case "call": {
      const { CallOffering } = await import("../models/callOffering.model");
      const it = await CallOffering.findById(id)
        .select("title pricePerCall currency coverImage organizationId status")
        .lean();
      if (!it || (it as any).status === "archived") return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).organizationId),
        title: (it as any).title,
        price: (it as any).pricePerCall ?? 0,
        currency: (it as any).currency || "USD",
        image: (it as any).coverImage,
      };
    }
    case "ecommerce": {
      const { StoreProduct } = await import("../models/storeProduct.model");
      const it = await StoreProduct.findById(id)
        .select("title price currency featuredImage images orgId status")
        .lean();
      if (!it || (it as any).status !== "active") return null;
      return {
        itemId: String((it as any)._id),
        productType,
        orgId: String((it as any).orgId),
        title: (it as any).title,
        price: (it as any).price ?? 0,
        currency: (it as any).currency || "USD",
        image:
          (it as any).featuredImage ||
          (Array.isArray((it as any).images)
            ? (it as any).images[0]?.url
            : undefined),
      };
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Eligibility — who can MINT a code
// ──────────────────────────────────────────────────────────────────────

export type EligibilityCheck =
  | { eligible: true }
  | { eligible: false; reason: string };

export async function isEligibleCreator(
  _userId: string,
  _email?: string
): Promise<EligibilityCheck> {
  // Eligibility gate REMOVED (2026-07-16): the cashback page is open to any user.
  // Previously required an active Unilevel-Plus purchase AND ≥1 direct downline
  // (super-admins bypassed) — that restriction is no longer wanted. Kept as an
  // always-eligible shim so the route + redemption call sites don't change.
  return { eligible: true };
}

/**
 * For each candidate userId, confirm it's the creator's direct downline.
 * Used at code-create time to validate `allowedBuyerIds`.
 */
export async function filterToDirectDownline(
  creatorId: string,
  candidateIds: string[]
): Promise<{ valid: string[]; invalid: string[] }> {
  if (candidateIds.length === 0) return { valid: [], invalid: [] };
  const objIds = candidateIds.map((i) => new Types.ObjectId(i));
  const found = await User.find(
    {
      _id: { $in: objIds },
      referredBy: new Types.ObjectId(creatorId),
    },
    { _id: 1 }
  ).lean();
  const valid = new Set(found.map((u: any) => String(u._id)));
  const invalid = candidateIds.filter((i) => !valid.has(i));
  return { valid: [...valid], invalid };
}

// ──────────────────────────────────────────────────────────────────────
// Validation — checkout-time
// ──────────────────────────────────────────────────────────────────────

export interface CashbackValidationInput {
  code: string;
  buyerId: string;
  /**
   * The product types AND item ids present in the cart. The code is bound
   * to a single (productType, itemId) pair, so the cart must include a
   * line item that matches both for the code to be applicable.
   */
  cartLines: Array<{ productType: CashbackProductType; itemId: string }>;
  amountCents: number;
}

export type CashbackValidationResult =
  | {
      valid: true;
      code: ICashbackCode;
      /** Index of the cart line that matches the code's bound item. */
      matchedLineIndex: number;
    }
  | { valid: false; error: string };

export async function validateCashbackCode(
  input: CashbackValidationInput
): Promise<CashbackValidationResult> {
  const code = await CashbackCode.findOne({
    code: input.code.toUpperCase(),
  });
  if (!code) return { valid: false, error: "Invalid code" };

  if (code.status !== "active") {
    return { valid: false, error: "Code is not active" };
  }

  const now = new Date();
  if (code.validFrom > now) {
    return { valid: false, error: "Code is not yet valid" };
  }
  if (code.validUntil && code.validUntil < now) {
    return { valid: false, error: "Code has expired" };
  }

  if (String(code.creatorId) === input.buyerId) {
    return { valid: false, error: "You can't use your own cashback code" };
  }

  // ── Cart must include the bound (productType, itemId).
  const matchedLineIndex = input.cartLines.findIndex(
    (li) =>
      li.productType === code.productType &&
      String(li.itemId) === String(code.itemId)
  );
  if (matchedLineIndex === -1) {
    return {
      valid: false,
      error: "This code doesn't apply to any item in your cart",
    };
  }

  // ── Buyer must be the creator's direct downline.
  const buyer = await User.findById(input.buyerId)
    .select("referredBy")
    .lean();
  if (!buyer) return { valid: false, error: "Buyer not found" };
  const buyerRefId = (buyer as any).referredBy
    ? String((buyer as any).referredBy)
    : null;
  if (!buyerRefId || buyerRefId !== String(code.creatorId)) {
    return {
      valid: false,
      error:
        "This cashback code is only valid for direct referrals of the code creator.",
    };
  }

  // ── Optional buyer whitelist.
  if (code.allowedBuyerIds && code.allowedBuyerIds.length > 0) {
    const inWhitelist = code.allowedBuyerIds.some(
      (id) => String(id) === input.buyerId
    );
    if (!inWhitelist) {
      return {
        valid: false,
        error: "This code is not valid for your account.",
      };
    }
  }

  // ── Usage caps.
  if (
    code.maxUsageCount != null &&
    code.currentUsageCount >= code.maxUsageCount
  ) {
    return { valid: false, error: "Code usage limit reached" };
  }
  if (code.maxUsagePerUser != null) {
    const used = await CashbackDistribution.countDocuments({
      codeId: code._id,
      buyerId: new Types.ObjectId(input.buyerId),
      status: "completed",
    });
    if (used >= code.maxUsagePerUser) {
      return { valid: false, error: "You've already used this code" };
    }
  }

  // ── Min order floor.
  if (
    code.minOrderAmountCents != null &&
    input.amountCents < code.minOrderAmountCents
  ) {
    return { valid: false, error: "Order doesn't meet the minimum amount" };
  }

  return { valid: true, code, matchedLineIndex };
}

// ──────────────────────────────────────────────────────────────────────
// Unified coupon-OR-cashback validator
// ──────────────────────────────────────────────────────────────────────

export type CodeApplication =
  | { type: "coupon"; validation: PlatformCouponValidationResult }
  | {
      type: "cashback";
      code: ICashbackCode;
      matchedLineIndex: number;
    }
  | { type: "invalid"; error: string };

export interface CouponOrCashbackInput {
  code: string;
  userId: string;
  productType: string;
  amountCents: number;
  invoiceCurrency?: string;
  cartLines?: Array<{ productType: CashbackProductType; itemId: string }>;
  orgId?: string;
  itemId?: string;
}

export async function validateCouponOrCashback(
  input: CouponOrCashbackInput
): Promise<CodeApplication> {
  // 1. PlatformCoupon path.
  const couponValidation = await validatePlatformCoupon({
    code: input.code,
    productType: input.productType as any,
    userId: input.userId,
    amountCents: input.amountCents,
    invoiceCurrency: input.invoiceCurrency,
    orgId: input.orgId,
    itemId: input.itemId,
  });
  if (couponValidation.valid && couponValidation.coupon) {
    return { type: "coupon", validation: couponValidation };
  }
  const { PlatformCoupon } = await import("../models/platformCoupon.model");
  const couponExists = await PlatformCoupon.exists({
    code: input.code.toUpperCase(),
  });
  if (couponExists) {
    return {
      type: "invalid",
      error: couponValidation.error || "Coupon not applicable",
    };
  }

  // 2. CashbackCode path.
  const cashback = await validateCashbackCode({
    code: input.code,
    buyerId: input.userId,
    cartLines: input.cartLines || [],
    amountCents: input.amountCents,
  });
  if (cashback.valid) {
    return {
      type: "cashback",
      code: cashback.code,
      matchedLineIndex: cashback.matchedLineIndex,
    };
  }
  return { type: "invalid", error: cashback.error };
}

// ──────────────────────────────────────────────────────────────────────
// Execute — post-paid hook
// ──────────────────────────────────────────────────────────────────────

/**
 * Post-distribution cashback execution. Finds THE cart line that matches
 * `code.productType + code.itemId`, reads the level-1 percentage off the
 * CommissionDistribution for that line, caps the configured rate against
 * it, and atomically transfers AffiliateWallet[creator] → StoreWallet[buyer,
 * sellerOrg]. One CashbackDistribution row per call (since one code = one
 * product). NEVER throws.
 */
export async function executeCashback(invoice: any): Promise<void> {
  try {
    if (!invoice?.cashbackCodeId) return;

    const alreadyFired = await CashbackDistribution.exists({
      invoiceId: invoice._id,
    });
    if (alreadyFired) return;

    const code = await CashbackCode.findById(invoice.cashbackCodeId);
    if (!code) return;

    const buyerId = invoice.userId;
    const sellerOrgId = code.orgId; // The bound item's org (derived at create).
    const subscriptionRootId = invoice.parentInvoiceId || invoice._id;

    const skipBase = {
      codeId: code._id,
      invoiceId: invoice._id,
      invoiceLineItemIndex: 0,
      subscriptionRootId,
      creatorId: code.creatorId,
      buyerId,
      sellerOrgId,
      productType: code.productType,
      itemId: code.itemId,
      saleAmountCents: 0,
      saleCurrency: invoice.itemCurrency || "USD",
      level1RatePct: 0,
      configuredRatePct: code.ratePct,
      appliedRatePct: 0,
      cashbackAmount: 0,
      cycleNumber: 1,
    };

    // ── Code status check.
    if (code.status !== "active") {
      await CashbackDistribution.create({
        ...skipBase,
        status: "skipped",
        failureReason: "code_inactive_at_execution",
      });
      return;
    }

    // ── Buyer still direct downline + (if set) whitelisted.
    const buyer = await User.findById(buyerId)
      .select("referredBy")
      .lean();
    const buyerRefId = (buyer as any)?.referredBy
      ? String((buyer as any).referredBy)
      : null;
    if (!buyerRefId || buyerRefId !== String(code.creatorId)) {
      await CashbackDistribution.create({
        ...skipBase,
        status: "skipped",
        failureReason: "buyer_referredby_changed",
      });
      return;
    }
    if (code.allowedBuyerIds && code.allowedBuyerIds.length > 0) {
      const allowed = code.allowedBuyerIds.some(
        (id) => String(id) === String(buyerId)
      );
      if (!allowed) {
        await CashbackDistribution.create({
          ...skipBase,
          status: "skipped",
          failureReason: "buyer_not_in_whitelist",
        });
        return;
      }
    }

    // ── Creator still eligible.
    const creatorUser = await User.findById(code.creatorId)
      .select("email")
      .lean();
    const elig = await isEligibleCreator(
      String(code.creatorId),
      (creatorUser as any)?.email
    );
    if (!elig.eligible) {
      await CashbackDistribution.create({
        ...skipBase,
        status: "skipped",
        failureReason: `creator_ineligible:${elig.reason}`,
      });
      return;
    }

    // ── Find the cart line matching the code.
    const lineIndex = (invoice.lineItems || []).findIndex((li: any) => {
      const lineProductType = mapItemTypeToCashbackType(String(li.itemType));
      return (
        lineProductType === code.productType &&
        String(li.itemId) === String(code.itemId)
      );
    });
    if (lineIndex === -1) {
      await CashbackDistribution.create({
        ...skipBase,
        status: "skipped",
        failureReason: "matching_line_not_found",
      });
      return;
    }
    const line = invoice.lineItems[lineIndex];
    skipBase.invoiceLineItemIndex = lineIndex;
    skipBase.saleAmountCents = line.totalPrice || 0;
    skipBase.saleCurrency =
      line.originalCurrency || invoice.itemCurrency || "USD";

    // ── Cycle check.
    const firedSoFar = await CashbackDistribution.countDocuments({
      codeId: code._id,
      buyerId,
      subscriptionRootId,
      status: "completed",
    });
    const cycleNumber = firedSoFar + 1;
    if (cycleNumber > (code.cycleCount ?? 1)) {
      await CashbackDistribution.create({
        ...skipBase,
        cycleNumber,
        status: "skipped",
        failureReason: "cycle_count_exhausted",
      });
      return;
    }

    // ── CommissionDistribution lookup. For ecommerce there's one CD per
    //    line, matched via itemId; for everything else there's one CD per
    //    invoice. Either way, we want the CD whose itemId equals the line's.
    const cds = await CommissionDistribution.find({
      "metadata.invoiceId": String(invoice._id),
    }).lean();
    let cd = (cds as any[]).find(
      (c) => String(c.itemId) === String(line.itemId)
    );
    if (!cd && cds.length === 1) cd = cds[0];
    if (!cd) {
      await CashbackDistribution.create({
        ...skipBase,
        cycleNumber,
        status: "skipped",
        failureReason: "no_commission_distribution_for_line",
      });
      return;
    }

    // ── Level-1 recipient AND it MUST be the creator. Otherwise the
    //    commission flowed up someone else's chain — paying cashback from
    //    a wallet that never received the matching commission is wrong.
    const level1 = (cd.commissions || []).find((r: any) => r.level === 1);
    if (!level1) {
      await CashbackDistribution.create({
        ...skipBase,
        cycleNumber,
        status: "skipped",
        failureReason: "no_level1_in_commission_distribution",
      });
      return;
    }
    if (String(level1.userId) !== String(code.creatorId)) {
      await CashbackDistribution.create({
        ...skipBase,
        cycleNumber,
        status: "skipped",
        failureReason: "level1_is_not_creator",
      });
      return;
    }

    // Cashback = a slice of the CREATOR's level-1 commission on this sale
    // — matches the info banner on the FE ("Allocate a slice of your level-1
    // commission to your direct downline"). `code.ratePct` is therefore a
    // percentage OF the commission the creator earned, NOT a percentage of
    // the sale amount. The natural ceiling is 100% (you can't give the
    // buyer more than you received); anything beyond that would require
    // the founder to top up the difference from other earnings.
    //
    // Prior implementation multiplied `saleAmount × min(ratePct, level1Rate)`
    // which meant any `ratePct` ≥ `level1Rate` (a common case — e.g. 50.5%
    // code vs 45% level-1) paid out 100% of the commission. The founder saw
    // -$0.73 rebated for a +$0.73 commission on a code configured for 50.5%.
    const level1RatePct = Number(level1.percentage) || 0;
    const level1Amount = Number(level1.amount) || 0;
    const appliedRatePct = Math.min(Number(code.ratePct) || 0, 100);
    const cashbackAmount = round2(level1Amount * (appliedRatePct / 100));

    if (cashbackAmount <= 0) {
      await CashbackDistribution.create({
        ...skipBase,
        cycleNumber,
        level1RatePct,
        appliedRatePct,
        status: "skipped",
        failureReason: "cashback_amount_zero",
      });
      return;
    }

    // ── Atomic transfer.
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const affWallet = await AffiliateWallet.findOne({
        userId: code.creatorId,
      }).session(session);
      if (!affWallet) throw new Error("creator_affiliate_wallet_missing");
      const affBefore = affWallet.balance || 0;
      if (affBefore < cashbackAmount) {
        throw new Error("creator_wallet_insufficient");
      }
      const affAfter = round2(affBefore - cashbackAmount);
      affWallet.balance = affAfter;
      (affWallet as any).lastTransactionAt = new Date();
      await affWallet.save({ session });

      let storeWallet = await StoreWallet.findOne({
        userId: buyerId,
        orgId: sellerOrgId,
      }).session(session);
      if (!storeWallet) {
        const created = await StoreWallet.create(
          [{ userId: buyerId, orgId: sellerOrgId, balance: 0, currency: "USD" }],
          { session }
        );
        storeWallet = created[0];
      }
      const storeBefore = storeWallet.balance || 0;
      const storeAfter = round2(storeBefore + cashbackAmount);
      storeWallet.balance = storeAfter;
      (storeWallet as any).lastTransactionAt = new Date();
      await storeWallet.save({ session });

      const txDesc = `Cashback (${code.code}) — invoice ${invoice.invoiceNumber || invoice._id}`;
      const [affTx] = await WalletTransaction.create(
        [
          {
            affiliateWalletId: affWallet._id,
            walletType: "affiliate",
            userId: code.creatorId,
            type: "debit",
            amount: cashbackAmount,
            currency: "USD",
            balanceBefore: affBefore,
            balanceAfter: affAfter,
            description: txDesc,
            relatedUserId: buyerId,
            metadata: {
              source: "cashback",
              cashbackCodeId: code._id,
              invoiceId: invoice._id,
            },
            status: "completed",
          },
        ],
        { session }
      );
      const [storeTx] = await WalletTransaction.create(
        [
          {
            storeWalletId: storeWallet._id,
            walletType: "store",
            userId: buyerId,
            orgId: sellerOrgId,
            type: "credit",
            amount: cashbackAmount,
            currency: "USD",
            balanceBefore: storeBefore,
            balanceAfter: storeAfter,
            description: txDesc,
            relatedUserId: code.creatorId,
            relatedTransactionId: affTx._id,
            metadata: {
              source: "cashback",
              cashbackCodeId: code._id,
              invoiceId: invoice._id,
            },
            status: "completed",
          },
        ],
        { session }
      );
      affTx.relatedTransactionId = storeTx._id;
      await affTx.save({ session });

      await CashbackDistribution.create(
        [
          {
            ...skipBase,
            saleCurrency: cd.currency || invoice.itemCurrency || "USD",
            level1RatePct,
            appliedRatePct,
            cashbackAmount,
            cycleNumber,
            affiliateTxId: affTx._id,
            storeTxId: storeTx._id,
            status: "completed",
          },
        ],
        { session }
      );

      await session.commitTransaction();
      await CashbackCode.updateOne(
        { _id: code._id },
        { $inc: { currentUsageCount: 1 } }
      );
    } catch (e: any) {
      await session.abortTransaction();
      await CashbackDistribution.create({
        ...skipBase,
        cycleNumber,
        level1RatePct,
        appliedRatePct,
        cashbackAmount,
        status: "failed",
        failureReason: String(e?.message || "unknown_error").slice(0, 500),
      });
    } finally {
      session.endSession();
    }
  } catch (outerErr) {
    console.error("[cashback] executeCashback fatal error:", outerErr);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Preview — "if the buyer bought this now, what cashback would fire?"
//
// Powers GET /cashback-codes/eligible-for-buyer. Runs the same eligibility
// filters as executeCashback (creator-is-upline, whitelist, validity, usage
// caps, cycle count) but instead of moving money it just computes the
// hypothetical cashback amount using the comb plan's L1 rate on the item's
// current price.
//
// The math is intentionally identical to executeCashback so previews can
// never over- or under-promise:
//     level1Amount = saleAmountUsd × (level1RatePct / 100)
//     cashback     = level1Amount × (min(code.ratePct, 100) / 100)
// ──────────────────────────────────────────────────────────────────────

export interface EligibleCashbackMatch {
  codeId: string;
  code: string;
  name: string;
  description?: string;
  ratePct: number;
  appliedRatePct: number;
  level1RatePct: number | null;
  level1AmountUsd: number | null;
  cashbackAmountUsd: number | null;
  creator: {
    _id: string;
    name: string | null;
    email: string | null;
    profilePicture: string | null;
  };
  /** Cashback codes are always minted by the buyer's direct upline, so level is always 1. */
  level: 1;
  validFrom: Date;
  validUntil: Date | null;
  cycleCount: number;
  cyclesUsedByBuyer: number;
  maxUsagePerUser: number | null;
  maxUsageCount: number | null;
  currentUsageCount: number;
  minOrderAmountCents: number | null;
}

export interface EligibleCashbackForItem {
  productId: string;
  productType: CashbackProductType;
  found: boolean;
  productTitle: string | null;
  productPrice: number | null;
  productCurrency: string | null;
  productImage?: string;
  matches: EligibleCashbackMatch[];
}

export interface GetEligibleCashbacksForBuyerInput {
  buyerId: string;
  productType: CashbackProductType;
  productIds: string[];
}

export async function getEligibleCashbacksForBuyer(
  input: GetEligibleCashbacksForBuyerInput
): Promise<{
  items: EligibleCashbackForItem[];
  upline: {
    userId: string;
    name: string | null;
    email: string | null;
    profilePicture: string | null;
  } | null;
}> {
  const { buyerId, productType, productIds } = input;

  // 1. Buyer's direct upline. Cashback codes only fire from L1, so no upline
  //    means no possible matches for any product — short-circuit.
  const buyer = await User.findById(buyerId)
    .select("referredBy")
    .lean();
  const uplineId = (buyer as any)?.referredBy
    ? String((buyer as any).referredBy)
    : null;

  let uplineProfile: {
    userId: string;
    name: string | null;
    email: string | null;
    profilePicture: string | null;
  } | null = null;
  if (uplineId) {
    const u = await User.findById(uplineId)
      .select("name email profilePicture")
      .lean();
    if (u) {
      uplineProfile = {
        userId: String((u as any)._id),
        name: (u as any).name || null,
        email: (u as any).email || null,
        profilePicture: (u as any).profilePicture || null,
      };
    }
  }

  const emptyItems: EligibleCashbackForItem[] = [];
  for (const pid of productIds) {
    emptyItems.push({
      productId: pid,
      productType,
      found: false,
      productTitle: null,
      productPrice: null,
      productCurrency: null,
      matches: [],
    });
  }

  if (!uplineId) {
    // Still resolve item metadata so the FE can render even when the buyer
    // has no upline (empty state is nicer than 4xx).
    for (let i = 0; i < productIds.length; i++) {
      const resolved = await resolveEligibleItem(productType, productIds[i]);
      if (resolved) {
        emptyItems[i] = {
          productId: productIds[i],
          productType,
          found: true,
          productTitle: resolved.title,
          productPrice: resolved.price,
          productCurrency: resolved.currency,
          productImage: resolved.image,
          matches: [],
        };
      }
    }
    return { items: emptyItems, upline: null };
  }

  const now = new Date();

  const results: EligibleCashbackForItem[] = [];

  // 2. Per product: resolve item → compute L1 amount → scan matching codes.
  for (const rawId of productIds) {
    if (!Types.ObjectId.isValid(rawId)) {
      results.push({
        productId: rawId,
        productType,
        found: false,
        productTitle: null,
        productPrice: null,
        productCurrency: null,
        matches: [],
      });
      continue;
    }
    const resolved = await resolveEligibleItem(productType, rawId);
    if (!resolved) {
      results.push({
        productId: rawId,
        productType,
        found: false,
        productTitle: null,
        productPrice: null,
        productCurrency: null,
        matches: [],
      });
      continue;
    }

    // 3. Level-1 rate for this item. `resolveCombPlanForSale` doesn't cover
    //    ecommerce (that flow computes commission per-line), so we skip the
    //    L1 lookup for that type and surface a null amount.
    let level1RatePct: number | null = null;
    let level1AmountUsd: number | null = null;
    if (
      productType !== "ecommerce" &&
      (resolved.price ?? 0) > 0
    ) {
      const { resolveCombPlanForSale } = await import("./commission");
      const { convertToUsd } = await import("../utils/exchangeRate");
      const combPlan = await resolveCombPlanForSale(
        productType as
          | "course"
          | "product"
          | "channel"
          | "workshop"
          | "service"
          | "call",
        rawId
      );
      const l1 = combPlan?.levels?.find((l: any) => l.level === 1);
      if (l1 && l1.percentage > 0) {
        const { usdAmount } = await convertToUsd(
          resolved.price,
          resolved.currency
        );
        level1RatePct = l1.percentage;
        level1AmountUsd = round2((usdAmount * l1.percentage) / 100);
      }
    }

    // 4. Candidate codes for this (productType, itemId) from the buyer's
    //    upline only.
    const candidates = await CashbackCode.find({
      productType,
      itemId: new Types.ObjectId(rawId),
      creatorId: new Types.ObjectId(uplineId),
      status: "active",
      validFrom: { $lte: now },
      $or: [
        { validUntil: null },
        { validUntil: { $exists: false } },
        { validUntil: { $gte: now } },
      ],
    }).lean();

    const matches: EligibleCashbackMatch[] = [];

    for (const code of candidates as any[]) {
      // Whitelist gate.
      if (
        Array.isArray(code.allowedBuyerIds) &&
        code.allowedBuyerIds.length > 0
      ) {
        const inWhitelist = code.allowedBuyerIds.some(
          (id: any) => String(id) === buyerId
        );
        if (!inWhitelist) continue;
      }

      // Global usage cap already hit → drop.
      if (
        code.maxUsageCount != null &&
        code.currentUsageCount >= code.maxUsageCount
      ) {
        continue;
      }

      // Per-buyer usage cap — count only completed distributions.
      const usedByBuyer = await CashbackDistribution.countDocuments({
        codeId: code._id,
        buyerId: new Types.ObjectId(buyerId),
        status: "completed",
      });
      if (
        code.maxUsagePerUser != null &&
        usedByBuyer >= code.maxUsagePerUser
      ) {
        continue;
      }
      if (usedByBuyer >= (code.cycleCount ?? 1)) {
        // Subscription-cycle cap — a buyer can only earn N cycles total
        // per code irrespective of maxUsagePerUser.
        continue;
      }

      const appliedRatePct = Math.min(Number(code.ratePct) || 0, 100);
      const cashbackAmountUsd =
        level1AmountUsd != null
          ? round2(level1AmountUsd * (appliedRatePct / 100))
          : null;

      matches.push({
        codeId: String(code._id),
        code: code.code,
        name: code.name,
        description: code.description,
        ratePct: code.ratePct,
        appliedRatePct,
        level1RatePct,
        level1AmountUsd,
        cashbackAmountUsd,
        creator: uplineProfile
          ? {
              _id: uplineProfile.userId,
              name: uplineProfile.name,
              email: uplineProfile.email,
              profilePicture: uplineProfile.profilePicture,
            }
          : {
              _id: uplineId,
              name: null,
              email: null,
              profilePicture: null,
            },
        level: 1,
        validFrom: code.validFrom,
        validUntil: code.validUntil ?? null,
        cycleCount: code.cycleCount ?? 1,
        cyclesUsedByBuyer: usedByBuyer,
        maxUsagePerUser: code.maxUsagePerUser ?? null,
        maxUsageCount: code.maxUsageCount ?? null,
        currentUsageCount: code.currentUsageCount || 0,
        minOrderAmountCents: code.minOrderAmountCents ?? null,
      });
    }

    // Sort best-cashback first so the FE can just render top-N.
    matches.sort(
      (a, b) => (b.cashbackAmountUsd ?? 0) - (a.cashbackAmountUsd ?? 0)
    );

    results.push({
      productId: rawId,
      productType,
      found: true,
      productTitle: resolved.title,
      productPrice: resolved.price,
      productCurrency: resolved.currency,
      productImage: resolved.image,
      matches,
    });
  }

  return { items: results, upline: uplineProfile };
}

// ──────────────────────────────────────────────────────────────────────
// CRUD helpers
// ──────────────────────────────────────────────────────────────────────

export interface CreateCashbackCodeInput {
  code: string;
  name: string;
  description?: string;
  creatorId: string;
  productType: CashbackProductType;
  itemId: string;
  ratePct: number;
  allowedBuyerIds?: string[];
  cycleCount?: number;
  validFrom?: Date;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmountCents?: number;
}

export async function createCashbackCode(
  input: CreateCashbackCodeInput
): Promise<ICashbackCode> {
  // 1. Coupon-namespace collision check.
  const { PlatformCoupon } = await import("../models/platformCoupon.model");
  const couponClash = await PlatformCoupon.exists({
    code: input.code.toUpperCase(),
  });
  if (couponClash) {
    throw new Error("code_already_used_by_platform_coupon");
  }

  // 2. Resolve the bound item to (a) prove it exists and (b) derive its org.
  const item = await resolveEligibleItem(input.productType, input.itemId);
  if (!item) {
    throw new Error("bound_item_not_found_or_inactive");
  }

  // 2b. Cap the cashback rate at the affiliate's OWN level-1 commission — the
  //     offer converts their direct commission, so it can't exceed it. No
  //     commission plan → nothing to convert → reject.
  const pctMap = await _loadLevel1PctForItems([
    { productType: input.productType, itemId: item.itemId },
  ]);
  const l1Pct = pctMap.get(`${input.productType}:${item.itemId}`);
  if (l1Pct == null) {
    throw new Error("no_commission_plan");
  }
  if (input.ratePct > l1Pct) {
    throw new Error("rate_exceeds_commission");
  }

  // 3. Optional whitelist: enforce it's a subset of the creator's directs.
  if (input.allowedBuyerIds && input.allowedBuyerIds.length > 0) {
    const { valid, invalid } = await filterToDirectDownline(
      input.creatorId,
      input.allowedBuyerIds
    );
    if (invalid.length > 0) {
      throw new Error(
        `allowedBuyerIds contains users not in your direct downline: ${invalid.join(",")}`
      );
    }
    input.allowedBuyerIds = valid;
  }

  return CashbackCode.create({
    code: input.code,
    name: input.name,
    description: input.description,
    creatorId: new Types.ObjectId(input.creatorId),
    productType: input.productType,
    itemId: new Types.ObjectId(item.itemId),
    orgId: new Types.ObjectId(item.orgId),
    ratePct: input.ratePct,
    allowedBuyerIds: (input.allowedBuyerIds || []).map(
      (i) => new Types.ObjectId(i)
    ),
    cycleCount: input.cycleCount ?? 1,
    validFrom: input.validFrom ?? new Date(),
    validUntil: input.validUntil,
    maxUsageCount: input.maxUsageCount,
    maxUsagePerUser: input.maxUsagePerUser,
    minOrderAmountCents: input.minOrderAmountCents,
    status: "active",
    currentUsageCount: 0,
  });
}

export interface UpdateCashbackCodeInput {
  name?: string;
  description?: string;
  ratePct?: number;
  allowedBuyerIds?: string[];
  cycleCount?: number;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmountCents?: number;
}

export async function updateCashbackCode(
  id: string,
  creatorId: string,
  input: UpdateCashbackCodeInput
): Promise<ICashbackCode | null> {
  // If ratePct is being changed, cap it at the bound item's L1 commission
  // (same rule as create). Immutable productType/itemId → read from the code.
  if (input.ratePct != null) {
    const existing = await CashbackCode.findOne(
      { _id: id, creatorId: new Types.ObjectId(creatorId) },
      { productType: 1, itemId: 1 },
    ).lean();
    if (existing) {
      const pt = (existing as any).productType as CashbackProductType;
      const iid = String((existing as any).itemId);
      const pctMap = await _loadLevel1PctForItems([
        { productType: pt, itemId: iid },
      ]);
      const l1Pct = pctMap.get(`${pt}:${iid}`);
      if (l1Pct == null) throw new Error("no_commission_plan");
      if (input.ratePct > l1Pct) throw new Error("rate_exceeds_commission");
    }
  }
  // If allowedBuyerIds is being updated, re-validate subset.
  if (input.allowedBuyerIds && input.allowedBuyerIds.length > 0) {
    const { valid, invalid } = await filterToDirectDownline(
      creatorId,
      input.allowedBuyerIds
    );
    if (invalid.length > 0) {
      throw new Error(
        `allowedBuyerIds contains users not in your direct downline: ${invalid.join(",")}`
      );
    }
    input.allowedBuyerIds = valid;
  }
  const set: any = { ...input };
  if (input.allowedBuyerIds) {
    set.allowedBuyerIds = input.allowedBuyerIds.map(
      (i) => new Types.ObjectId(i)
    );
  }
  return CashbackCode.findOneAndUpdate(
    { _id: id, creatorId: new Types.ObjectId(creatorId) },
    { $set: set },
    { new: true }
  );
}

export async function setCashbackCodeStatus(
  id: string,
  creatorId: string,
  status: "active" | "inactive"
): Promise<ICashbackCode | null> {
  return CashbackCode.findOneAndUpdate(
    { _id: id, creatorId: new Types.ObjectId(creatorId) },
    { $set: { status } },
    { new: true }
  );
}

export async function listCashbackCodesForCreator(params: {
  creatorId: string;
  status?: string;
  productType?: string;
  /** Narrow to the offers minted for a single product — powers the drawer's
   *  "Existing Offers For This Product" list. */
  itemId?: string;
  limit?: number;
  skip?: number;
}): Promise<{ codes: ICashbackCode[]; total: number }> {
  const q: any = { creatorId: new Types.ObjectId(params.creatorId) };
  if (params.status) q.status = params.status;
  if (params.productType) q.productType = params.productType;
  if (params.itemId && Types.ObjectId.isValid(params.itemId))
    q.itemId = new Types.ObjectId(params.itemId);
  const [codes, total] = await Promise.all([
    CashbackCode.find(q)
      .sort({ createdAt: -1 })
      .skip(params.skip || 0)
      .limit(Math.min(params.limit || 50, 200))
      .lean<ICashbackCode[]>(),
    CashbackCode.countDocuments(q),
  ]);
  return { codes, total };
}

export async function getCashbackCodeById(
  id: string,
  creatorId: string
): Promise<ICashbackCode | null> {
  return CashbackCode.findOne({
    _id: id,
    creatorId: new Types.ObjectId(creatorId),
  });
}

/**
 * Detail view: the code enriched with the bound product's name and the owning
 * org's name (both resolved on the fly). Best-effort — a missing/renamed item
 * or org just leaves the corresponding name undefined; the code is still
 * returned so the details panel renders.
 */
export async function getCashbackCodeDetail(
  id: string,
  creatorId: string
): Promise<(ICashbackCode & { itemName?: string; orgName?: string }) | null> {
  const code = await CashbackCode.findOne({
    _id: id,
    creatorId: new Types.ObjectId(creatorId),
  }).lean();
  if (!code) return null;

  let itemName: string | undefined;
  try {
    const item = await resolveEligibleItem(
      (code as any).productType,
      String((code as any).itemId)
    );
    itemName = item?.title;
  } catch {
    /* best-effort */
  }

  let orgName: string | undefined;
  try {
    const { Organization } = await import("../models/organization.model");
    const org = await Organization.findById((code as any).orgId)
      .select("name")
      .lean();
    orgName = (org as any)?.name;
  } catch {
    /* best-effort */
  }

  return { ...(code as any), itemName, orgName };
}

export async function listDistributionsForCode(params: {
  codeId: string;
  creatorId: string;
  limit?: number;
  skip?: number;
}): Promise<{ distributions: any[]; total: number; totals: any }> {
  const code = await CashbackCode.findOne({
    _id: params.codeId,
    creatorId: new Types.ObjectId(params.creatorId),
  }).lean();
  if (!code) return { distributions: [], total: 0, totals: null };

  const q = { codeId: new Types.ObjectId(params.codeId) };
  const [rows, total, totalsAgg] = await Promise.all([
    CashbackDistribution.find(q)
      .sort({ createdAt: -1 })
      .skip(params.skip || 0)
      .limit(Math.min(params.limit || 50, 200))
      .lean(),
    CashbackDistribution.countDocuments(q),
    CashbackDistribution.aggregate([
      { $match: q },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$cashbackAmount" },
        },
      },
    ]),
  ]);

  const totals = {
    completedCount: 0,
    completedAmount: 0,
    skippedCount: 0,
    failedCount: 0,
  };
  for (const t of totalsAgg as any[]) {
    if (t._id === "completed") {
      totals.completedCount = t.count;
      totals.completedAmount = round2(t.amount);
    } else if (t._id === "skipped") totals.skippedCount = t.count;
    else if (t._id === "failed") totals.failedCount = t.count;
  }

  return { distributions: rows, total, totals };
}

/**
 * Aggregate summary across all codes for one creator — drives the summary
 * strip on the creator's "Cashback Codes" wallet tab. Three numbers in one
 * round-trip so the FE doesn't have to walk every code's distributions.
 */
export async function getCashbackSummaryForCreator(
  creatorId: string
): Promise<{
  totalPaidOutUsd: number;
  activeCodesCount: number;
  totalCodesCount: number;
}> {
  const creatorObjId = new Types.ObjectId(creatorId);
  const [paidOutAgg, activeCodesCount, totalCodesCount] = await Promise.all([
    CashbackDistribution.aggregate([
      { $match: { creatorId: creatorObjId, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$cashbackAmount" } } },
    ]),
    CashbackCode.countDocuments({ creatorId: creatorObjId, status: "active" }),
    CashbackCode.countDocuments({ creatorId: creatorObjId }),
  ]);
  return {
    totalPaidOutUsd: round2((paidOutAgg as any[])[0]?.total || 0),
    activeCodesCount,
    totalCodesCount,
  };
}

export async function listDistributionsReceivedByUser(params: {
  buyerId: string;
  limit?: number;
  skip?: number;
}): Promise<{ distributions: any[]; total: number; totalReceived: number }> {
  const q = {
    buyerId: new Types.ObjectId(params.buyerId),
    status: "completed",
  };
  const [rows, total, sumAgg] = await Promise.all([
    CashbackDistribution.find(q)
      .sort({ createdAt: -1 })
      .skip(params.skip || 0)
      .limit(Math.min(params.limit || 50, 200))
      .lean(),
    CashbackDistribution.countDocuments(q),
    CashbackDistribution.aggregate([
      { $match: q },
      { $group: { _id: null, total: { $sum: "$cashbackAmount" } } },
    ]),
  ]);
  const totalReceived = round2((sumAgg as any[])[0]?.total || 0);
  return { distributions: rows, total, totalReceived };
}

// ──────────────────────────────────────────────────────────────────────
// Public teaser lookup — "does affiliate X offer cashback on item Y?"
// Powers the storefront "invited by X" box. No auth: resolves the `?ref`
// affiliateId → creator, then finds the active, in-window code bound to that
// exact (productType, itemId). buyerId is optional — when supplied we also
// return whether THAT buyer would actually qualify (so the FE can show a
// definite vs "up to" message). Returns null when there's nothing to show.
// ──────────────────────────────────────────────────────────────────────

export interface AffiliateCashbackTeaser {
  ratePct: number;
  code: string;
  codeName: string;
  codeId: string;
  /** Only present when buyerId was supplied: would this buyer actually qualify? */
  eligibleForBuyer?: boolean;
}

export async function getAffiliateCashbackForItem(params: {
  affiliateId: string;
  productType: CashbackProductType;
  itemId: string;
  buyerId?: string;
}): Promise<AffiliateCashbackTeaser | null> {
  // 1. Resolve the affiliate code → creator user.
  const creator = await User.findOne({ affiliateId: params.affiliateId })
    .select("_id")
    .lean();
  if (!creator) return null;

  // 2. Active, in-window code bound to this exact item.
  const now = new Date();
  const code = await CashbackCode.findOne({
    creatorId: (creator as any)._id,
    productType: params.productType,
    itemId: new Types.ObjectId(params.itemId),
    status: "active",
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $exists: false } },
      { validUntil: null },
      { validUntil: { $gte: now } },
    ],
  })
    .select(
      "_id code name ratePct allowedBuyerIds maxUsageCount currentUsageCount maxUsagePerUser creatorId"
    )
    .lean<ICashbackCode>();
  if (!code) return null;

  // 3. Global usage cap exhausted → nothing left to give.
  if (
    code.maxUsageCount != null &&
    code.currentUsageCount >= code.maxUsageCount
  ) {
    return null;
  }

  const teaser: AffiliateCashbackTeaser = {
    ratePct: code.ratePct,
    code: code.code,
    codeName: code.name,
    codeId: String(code._id),
  };

  // 4. Precise eligibility for a known buyer (mirrors the checkout gates that
  //    can be evaluated pre-cart: self, direct-downline, whitelist, per-user
  //    cap). Min-order / cart-match are inherently checkout-time only.
  if (params.buyerId && Types.ObjectId.isValid(params.buyerId)) {
    teaser.eligibleForBuyer = await isBuyerEligibleForCode(code, params.buyerId);
  }

  return teaser;
}

async function isBuyerEligibleForCode(
  code: ICashbackCode,
  buyerId: string
): Promise<boolean> {
  if (String(code.creatorId) === buyerId) return false; // no self-cashback
  const buyer = await User.findById(buyerId).select("referredBy").lean();
  const refId = (buyer as any)?.referredBy
    ? String((buyer as any).referredBy)
    : null;
  if (!refId || refId !== String(code.creatorId)) return false;
  if (code.allowedBuyerIds && code.allowedBuyerIds.length > 0) {
    if (!code.allowedBuyerIds.some((id) => String(id) === buyerId)) return false;
  }
  if (code.maxUsagePerUser != null) {
    const used = await CashbackDistribution.countDocuments({
      codeId: code._id,
      buyerId: new Types.ObjectId(buyerId),
      status: "completed",
    });
    if (used >= code.maxUsagePerUser) return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────
// Eligible items + eligible buyers — populate the create-form pickers
// ──────────────────────────────────────────────────────────────────────

/**
 * List sellable items the creator can attach a cashback code to. For HQ
 * types we list items in their default org (passed in as a query param);
 * for `ecommerce` we list StoreProducts in the same org. Per-org / per-
 * creator filtering is the FE caller's job — we return the items, the
 * caller pre-filters.
 */
/**
 * List eligible items for a product type. Scope is controlled by `orgId` /
 * `orgIds`:
 *   - `orgId` present  → only that org's catalog ("narrow to one office")
 *   - `orgIds` present → catalog across those orgs (the "all my offices" case —
 *                        the caller passes the user's own org memberships)
 *   - neither          → ALL offices platform-wide (no caller uses this today)
 * Each item carries its own org + org name. `q` filters by name
 * (case-insensitive); results are capped at `limit` (default 50, max 100).
 */
/** All cashback product types — the "all offices, all types" grid default. */
const ALL_CASHBACK_TYPES: CashbackProductType[] = [
  "channel",
  "course",
  "workshop",
  "product",
  "service",
  "call",
  "ecommerce",
];

/** Cashback productType → CombPlan itemType. CombPlan only knows six types;
 *  store products (`ecommerce`) carry their plan under `"product"` keyed by the
 *  storeproduct _id — the same convention checkout uses (invoice.ts). */
const CASHBACK_TO_COMB_ITEMTYPE: Record<
  CashbackProductType,
  "course" | "product" | "channel" | "workshop" | "service" | "call" | "event"
> = {
  product: "product",
  ecommerce: "product",
  course: "course",
  channel: "channel",
  workshop: "workshop",
  service: "service",
  call: "call",
};

/** Batch-load level-1 (direct-referrer) commission % for a set of items from
 *  their active CombPlans. Returns a map keyed by the ORIGINAL
 *  `${productType}:${itemId}` the caller passed. Items with no plan are absent.
 *  Mirrors internal-catalog.ts `_loadLevel1Pct`, adapted to cashback types. */
async function _loadLevel1PctForItems(
  refs: Array<{ productType: CashbackProductType; itemId: string }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const valid = refs.filter((r) => Types.ObjectId.isValid(r.itemId));
  if (valid.length === 0) return out;
  const { CombPlan } = await import("../models/combPlan.model");
  const rows = await CombPlan.find(
    {
      isActive: true,
      $or: valid.map((r) => ({
        itemType: CASHBACK_TO_COMB_ITEMTYPE[r.productType],
        itemId: new Types.ObjectId(r.itemId),
      })),
    },
    { itemType: 1, itemId: 1, levels: 1 },
  ).lean();
  // key: `${combItemType}:${itemId}` → L1 %
  const planByKey = new Map<string, number>();
  for (const r of rows as any[]) {
    const l1 = Array.isArray(r.levels)
      ? r.levels.find((l: any) => l?.level === 1)
      : undefined;
    if (l1 && typeof l1.percentage === "number") {
      planByKey.set(`${r.itemType}:${String(r.itemId)}`, l1.percentage);
    }
  }
  for (const r of valid) {
    const pct = planByKey.get(
      `${CASHBACK_TO_COMB_ITEMTYPE[r.productType]}:${r.itemId}`,
    );
    if (typeof pct === "number") out.set(`${r.productType}:${r.itemId}`, pct);
  }
  return out;
}

interface EligibleQueryScope {
  /** Optional office narrowing (a UI filter) — NOT a membership gate. */
  orgId?: string;
  q?: string;
  /** The commissionable universe for this type: item _ids that carry an active
   *  comb plan. This is the ONLY hard scope — cashback is an affiliate mechanic,
   *  so an item is eligible regardless of the caller's org membership, and we
   *  return ALL of them (no page limit). */
  allowedItemIds?: Types.ObjectId[];
}

/** Query the eligible catalog items for ONE product type (unenriched). Carries
 *  `_u` (updatedAt ms) so the all-types merge can order newest-first. */
async function _queryEligibleForType(
  productType: CashbackProductType,
  scope: EligibleQueryScope,
): Promise<Array<ResolvedItem & { _u: number }>> {
  let model: any;
  let orgField: string;
  let nameField: string;
  let priceField: string;
  let imageField: string;
  let imageIsArray = false;
  let activeFilter: Record<string, any>;

  switch (productType) {
    case "channel":
      ({ Channel: model } = await import("../models/channel.model"));
      orgField = "storeId";
      nameField = "title";
      priceField = "price";
      imageField = "coverImage";
      activeFilter = { isActive: { $ne: false } };
      break;
    case "course":
      ({ Course: model } = await import("../models/course.model"));
      orgField = "organizationId";
      nameField = "title";
      priceField = "price";
      imageField = "coverImage";
      activeFilter = { status: { $ne: "archived" } };
      break;
    case "workshop":
      ({ Workshop: model } = await import("../models/workshop.model"));
      orgField = "orgId";
      nameField = "title";
      priceField = "price";
      imageField = "thumbnail";
      activeFilter = { isActive: { $ne: false } };
      break;
    case "product":
      ({ Product: model } = await import("../models/product.model"));
      orgField = "organizationId";
      nameField = "name";
      priceField = "price";
      imageField = "images";
      imageIsArray = true;
      // Legacy `products` now backs DIGITAL offerings only — physical docs left
      // here are migration orphans that 404 on garage.app. See catalogVisibility.
      activeFilter = { status: { $ne: "archived" }, ...LEGACY_DIGITAL_PRODUCT_FILTER };
      break;
    case "service":
      ({ Service: model } = await import("../models/service.model"));
      orgField = "organizationId";
      nameField = "title";
      priceField = "price";
      imageField = "coverImage";
      activeFilter = { status: { $ne: "archived" } };
      break;
    case "call":
      ({ CallOffering: model } = await import("../models/callOffering.model"));
      orgField = "organizationId";
      nameField = "title";
      priceField = "pricePerCall";
      imageField = "coverImage";
      activeFilter = { status: { $ne: "archived" } };
      break;
    case "ecommerce":
      ({ StoreProduct: model } = await import("../models/storeProduct.model"));
      orgField = "orgId";
      nameField = "title";
      priceField = "price";
      imageField = "featuredImage";
      activeFilter = { status: "active" };
      break;
    default:
      return [];
  }

  const orgId =
    scope.orgId && Types.ObjectId.isValid(scope.orgId) ? scope.orgId : undefined;
  const filter: Record<string, any> = { ...activeFilter };
  // Hard scope: only items that carry an active comb plan (commissionable).
  // `allowedItemIds` bounds the query to that set, so removing the org gate does
  // NOT scan the whole catalog — an empty set correctly matches nothing.
  if (scope.allowedItemIds) {
    filter._id = { $in: scope.allowedItemIds };
  }
  // Optional office narrowing (UI filter), NOT a membership gate.
  if (orgId) filter[orgField] = new Types.ObjectId(orgId);
  if (scope.q && scope.q.trim())
    filter[nameField] = { $regex: scope.q.trim().slice(0, 80), $options: "i" };

  const selectFields = Array.from(
    new Set([
      nameField,
      priceField,
      "currency",
      imageField,
      "images",
      orgField,
      "updatedAt",
      // Recurring-billing markers (field name differs per type; absent ones just
      // come back undefined): subscriptions on channel/course/product, and
      // isRecurring on workshop. service/call/ecommerce carry none → one-time.
      "isSubscription",
      "subscriptionPeriod",
      "isRecurring",
    ]),
  ).join(" ");

  let docs = (await model
    .find(filter)
    .select(selectFields)
    .sort({ updatedAt: -1 })
    .lean()) as any[];

  // Storeproducts render on garage.app/product/:id only if their org has an
  // ACTIVE store doc — otherwise the storefront 404s. Drop the rest so no dead
  // cashback offer can be minted. (The legacy `product` type is digital and
  // resolves via /digital/product/:id, so it needs no store gate.)
  if (productType === "ecommerce" && docs.length) {
    const liveOrgs = await orgIdsWithActiveStore(
      docs.map((d) => d[orgField]).filter(Boolean),
    );
    docs = docs.filter((d) => liveOrgs.has(String(d[orgField])));
  }

  return docs.map((d) => ({
    itemId: String(d._id),
    productType,
    orgId: orgId || String(d[orgField] || ""),
    title: d[nameField],
    price: d[priceField] ?? 0,
    currency: d.currency || "USD",
    image: imageIsArray
      ? Array.isArray(d[imageField])
        ? d[imageField][0]
        : undefined
      : d[imageField] ||
        (productType === "ecommerce" && Array.isArray(d.images)
          ? d.images[0]?.url
          : undefined),
    isRecurring: !!(d.isSubscription || d.isRecurring),
    billingPeriod: d.subscriptionPeriod || undefined,
    _u: d.updatedAt ? new Date(d.updatedAt).getTime() : 0,
  }));
}

/**
 * The cashback product grid ("Cashbackable Offers"). `productType` omitted →
 * ALL types merged newest-first (the grid default). Each item is enriched with:
 *  - `orgName` + `orgIcon` (the "Sold By" chip)
 *  - `commissionPct` + `commissionAmount` (the affiliate's L1 direct commission
 *    — what they convert into cashback; `null` when the item has no CombPlan)
 *  - `myOfferCount` (existing offers the caller already made for this item)
 */
export async function listEligibleItems(params: {
  /** Optional office narrowing — NOT a membership gate. */
  orgId?: string;
  /** Omit → all cashback product types merged. */
  productType?: CashbackProductType;
  q?: string;
  /** Caller — enables the per-item `myOfferCount`. */
  creatorId?: string;
}): Promise<ResolvedItem[]> {
  const types = params.productType ? [params.productType] : ALL_CASHBACK_TYPES;

  // The commissionable universe = every item with an ACTIVE comb plan. Cashback
  // is an affiliate mechanic (anyone earns the flat L1 direct commission), so an
  // item is eligible regardless of org membership — the ONLY gate is "carries a
  // commission + is paid". Loading the comb-plan set up front lets us return ALL
  // matching items (no page limit) while querying just those, not the catalog.
  const { CombPlan } = await import("../models/combPlan.model");
  const plans = await CombPlan.find(
    { isActive: true },
    { itemType: 1, itemId: 1 },
  ).lean();
  const idsByCombType = new Map<string, Types.ObjectId[]>();
  for (const p of plans as any[]) {
    if (!p?.itemType || !p?.itemId) continue;
    const arr = idsByCombType.get(p.itemType) ?? [];
    arr.push(new Types.ObjectId(String(p.itemId)));
    idsByCombType.set(p.itemType, arr);
  }

  const perType = await Promise.all(
    types.map((t) =>
      _queryEligibleForType(t, {
        orgId: params.orgId,
        q: params.q,
        allowedItemIds: idsByCombType.get(CASHBACK_TO_COMB_ITEMTYPE[t]) ?? [],
      }),
    ),
  );
  // Full merged set (newest-first), NOT yet capped — commission must be
  // computed and non-cashbackable items dropped BEFORE the limit, else the page
  // fills with free / no-commission cards.
  const all = perType
    .flat()
    .sort((a, b) => b._u - a._u)
    .map(({ _u, ...rest }) => rest) as ResolvedItem[];
  if (all.length === 0) return all;

  // Level-1 commission % + amount from each item's active CombPlan.
  const pctMap = await _loadLevel1PctForItems(
    all.map((i) => ({ productType: i.productType, itemId: i.itemId })),
  );
  for (const it of all) {
    const pct = pctMap.get(`${it.productType}:${it.itemId}`);
    if (typeof pct === "number") {
      it.commissionPct = pct;
      it.commissionAmount =
        Math.round(((it.price || 0) * pct) / 100 * 100) / 100;
    } else {
      it.commissionPct = null;
      it.commissionAmount = null;
    }
  }

  // A product is "cashbackable" only if it is PAID (price > 0) AND carries a
  // positive direct-level (L1) commission — that commission is what gets
  // converted into cashback. Free items and items with no CombPlan have nothing
  // to convert, so they must not appear in the grid at all.
  // Return EVERY paid, commissionable item — no page limit (the set is bounded
  // by the comb-plan universe queried above, not the whole catalog).
  const items = all.filter(
    (it) =>
      (it.price || 0) > 0 &&
      typeof it.commissionPct === "number" &&
      it.commissionPct > 0,
  );
  if (items.length === 0) return items;

  // Seller-org name + icon in one batch query (only for the returned page).
  const orgIds = Array.from(new Set(items.map((i) => i.orgId).filter(Boolean)));
  if (orgIds.length) {
    const { Organization } = await import("../models/organization.model");
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select("name icon colored_icon white_icon")
      .lean();
    const byId = new Map((orgs as any[]).map((o) => [String(o._id), o]));
    for (const it of items) {
      const o = byId.get(it.orgId);
      if (o) {
        it.orgName = o.name;
        it.orgIcon = o.icon || o.colored_icon || o.white_icon || undefined;
      }
    }
  }

  // How many offers the caller already minted per item (drawer badge).
  if (params.creatorId && Types.ObjectId.isValid(params.creatorId)) {
    const rows = await CashbackCode.aggregate([
      {
        $match: {
          creatorId: new Types.ObjectId(params.creatorId),
          itemId: { $in: items.map((i) => new Types.ObjectId(i.itemId)) },
        },
      },
      { $group: { _id: "$itemId", n: { $sum: 1 } } },
    ]);
    const countById = new Map(
      (rows as any[]).map((r) => [String(r._id), r.n as number]),
    );
    for (const it of items) it.myOfferCount = countById.get(it.itemId) || 0;
  } else {
    for (const it of items) it.myOfferCount = 0;
  }

  return items;
}

/**
 * List the calling creator's direct downline so the create-form's optional
 * "user whitelist" picker can populate.
 */
export async function listEligibleBuyersForCreator(creatorId: string): Promise<
  Array<{
    _id: string;
    name?: string;
    email?: string;
    profilePicture?: string;
  }>
> {
  const docs = await User.find({
    referredBy: new Types.ObjectId(creatorId),
  })
    .select("name email profilePicture")
    .lean();
  return (docs as any[]).map((u) => ({
    _id: String(u._id),
    name: u.name,
    email: u.email,
    profilePicture: u.profilePicture,
  }));
}
