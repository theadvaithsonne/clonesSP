import { Types } from "mongoose";
import {
  PlatformCoupon,
  IPlatformCoupon,
  PlatformCouponProductType,
  PlatformCouponDiscountType,
  PlatformCouponScope,
} from "../models/platformCoupon.model";
import {
  PlatformCouponRedemption,
  IPlatformCouponRedemption,
} from "../models/platformCouponRedemption.model";

// ============ CRUD ============

export interface CreatePlatformCouponInput {
  code: string;
  name: string;
  description?: string;
  media?: string;
  productType: PlatformCouponProductType;
  discountType: PlatformCouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  currency?: "USD" | "INR";
  cycleCount?: number;
  validFrom?: Date;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmount?: number;
  createdBy: string;
  createdByType?: "garage_admin" | "founder";
  scope?: PlatformCouponScope;
  orgId?: string;
  specificItemIds?: string[];
}

export async function createPlatformCoupon(
  input: CreatePlatformCouponInput
): Promise<IPlatformCoupon> {
  const existing = await PlatformCoupon.findOne({ code: input.code.toUpperCase() });
  if (existing) throw new Error("Coupon code already exists");

  const scope: PlatformCouponScope = input.scope || "platform";

  const coupon = await PlatformCoupon.create({
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description,
    media: input.media,
    productType: input.productType,
    discountType: input.discountType,
    discountValue: input.discountValue,
    maxDiscountAmount: input.maxDiscountAmount,
    currency: input.currency || "USD",
    cycleCount: input.cycleCount,
    validFrom: input.validFrom || new Date(),
    validUntil: input.validUntil,
    maxUsageCount: input.maxUsageCount,
    maxUsagePerUser: input.maxUsagePerUser,
    minOrderAmount: input.minOrderAmount,
    createdBy: new Types.ObjectId(input.createdBy),
    createdByType: input.createdByType || "garage_admin",
    status: "active",
    scope,
    orgId: scope === "organization" && input.orgId
      ? new Types.ObjectId(input.orgId)
      : undefined,
    specificItemIds: input.specificItemIds?.map((id) => new Types.ObjectId(id)),
  });

  return coupon;
}

export interface UpdatePlatformCouponInput {
  name?: string;
  description?: string;
  /** Set to a URL to update the cover image, or "" (empty string) to clear it. */
  media?: string;
  discountValue?: number;
  maxDiscountAmount?: number;
  currency?: "USD" | "INR";
  cycleCount?: number;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmount?: number;
}

export async function updatePlatformCoupon(
  id: string,
  patch: UpdatePlatformCouponInput
): Promise<IPlatformCoupon | null> {
  const coupon = await PlatformCoupon.findById(id);
  if (!coupon) return null;

  // Block structural edits if any redemption exists
  const redemptionCount = await PlatformCouponRedemption.countDocuments({
    couponId: coupon._id,
  });
  const structuralFields: (keyof UpdatePlatformCouponInput)[] = [
    "discountValue",
    "maxDiscountAmount",
    "cycleCount",
    "currency",
  ];
  if (redemptionCount > 0) {
    for (const f of structuralFields) {
      if (patch[f] !== undefined) {
        throw new Error(
          `Cannot edit ${f} after coupon has been redeemed. Create a new coupon instead.`
        );
      }
    }
  }

  if (patch.name !== undefined) coupon.name = patch.name;
  if (patch.description !== undefined) coupon.description = patch.description;
  if (patch.media !== undefined) coupon.media = patch.media || undefined;
  if (patch.discountValue !== undefined) coupon.discountValue = patch.discountValue;
  if (patch.maxDiscountAmount !== undefined)
    coupon.maxDiscountAmount = patch.maxDiscountAmount;
  if (patch.currency !== undefined) coupon.currency = patch.currency;
  if (patch.cycleCount !== undefined) coupon.cycleCount = patch.cycleCount;
  if (patch.validUntil !== undefined) coupon.validUntil = patch.validUntil;
  if (patch.maxUsageCount !== undefined) coupon.maxUsageCount = patch.maxUsageCount;
  if (patch.maxUsagePerUser !== undefined)
    coupon.maxUsagePerUser = patch.maxUsagePerUser;
  if (patch.minOrderAmount !== undefined) coupon.minOrderAmount = patch.minOrderAmount;

  await coupon.save();
  return coupon;
}

export async function deactivatePlatformCoupon(
  id: string
): Promise<IPlatformCoupon | null> {
  return PlatformCoupon.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
}

export async function activatePlatformCoupon(
  id: string
): Promise<IPlatformCoupon | null> {
  return PlatformCoupon.findByIdAndUpdate(id, { status: "active" }, { new: true });
}

export async function listPlatformCoupons(options: {
  productType?: PlatformCouponProductType;
  status?: string;
  limit?: number;
  skip?: number;
  scope?: PlatformCouponScope;
  orgId?: string;
}): Promise<{ coupons: IPlatformCoupon[]; total: number }> {
  const query: any = {};
  if (options.productType) query.productType = options.productType;
  if (options.status) query.status = options.status;
  if (options.scope) query.scope = options.scope;
  if (options.orgId) query.orgId = new Types.ObjectId(options.orgId);
  const limit = Math.min(options.limit ?? 50, 200);
  const skip = Math.max(options.skip ?? 0, 0);
  const [coupons, total] = await Promise.all([
    PlatformCoupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PlatformCoupon.countDocuments(query),
  ]);
  return { coupons, total };
}

export async function getPlatformCouponByCode(
  code: string
): Promise<IPlatformCoupon | null> {
  return PlatformCoupon.findOne({ code: code.toUpperCase() });
}

export async function getPlatformCouponById(
  id: string
): Promise<IPlatformCoupon | null> {
  return PlatformCoupon.findById(id);
}

// ============ Discount calculation ============

/**
 * Convert a smallest-unit amount (cents or paise) between currencies using
 * live exchange rates. Returns the converted smallest-unit integer.
 */
async function convertSmallestUnit(
  amountSmallest: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amountSmallest;
  const { convertUsdToInr, convertInrToUsd } = await import(
    "../utils/exchangeRate"
  );
  const amountMajor = amountSmallest / 100;
  if (fromCurrency === "USD" && toCurrency === "INR") {
    const { inrAmount } = await convertUsdToInr(amountMajor);
    return Math.round(inrAmount * 100);
  }
  if (fromCurrency === "INR" && toCurrency === "USD") {
    const { usdAmount } = await convertInrToUsd(amountMajor);
    return Math.round(usdAmount * 100);
  }
  throw new Error(
    `Unsupported currency conversion: ${fromCurrency} → ${toCurrency}`
  );
}

export async function calculateDiscount(
  coupon: Pick<
    IPlatformCoupon,
    "discountType" | "discountValue" | "maxDiscountAmount" | "currency"
  >,
  amountCents: number,
  invoiceCurrency: string = "USD"
): Promise<{ discount: number; finalAmount: number }> {
  if (amountCents <= 0) return { discount: 0, finalAmount: 0 };

  const couponCurrency = coupon.currency || "USD";
  let discount = 0;

  if (coupon.discountType === "fixed") {
    // Convert fixed discount from coupon currency to invoice currency.
    const discountInInvoiceCur =
      couponCurrency === invoiceCurrency
        ? coupon.discountValue
        : await convertSmallestUnit(
            coupon.discountValue,
            couponCurrency,
            invoiceCurrency
          );
    discount = Math.min(discountInInvoiceCur, amountCents);
  } else {
    // Percent — currency-agnostic on the base calculation.
    const raw = Math.round((amountCents * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount) {
      // Convert the cap from coupon currency to invoice currency.
      const capInInvoiceCur =
        couponCurrency === invoiceCurrency
          ? coupon.maxDiscountAmount
          : await convertSmallestUnit(
              coupon.maxDiscountAmount,
              couponCurrency,
              invoiceCurrency
            );
      discount = Math.min(raw, capInInvoiceCur);
    } else {
      discount = raw;
    }
    discount = Math.min(discount, amountCents);
  }

  const finalAmount = Math.max(0, amountCents - discount);
  return { discount, finalAmount };
}

// ============ Validation ============

export interface ValidatePlatformCouponInput {
  code: string;
  productType: PlatformCouponProductType;
  userId: string;
  amountCents: number;
  /** The org of the item being purchased (used to match org-scoped coupons) */
  orgId?: string;
  /** Specific item being purchased (for specificItemIds gating) */
  itemId?: string;
  /** Currency of the invoice amount — used to convert coupon fixed/cap/min values */
  invoiceCurrency?: string;
}

export interface PlatformCouponValidationResult {
  valid: boolean;
  coupon?: IPlatformCoupon;
  discount?: number;
  finalAmount?: number;
  willBeFree?: boolean;
  error?: string;
}

export async function validatePlatformCoupon(
  input: ValidatePlatformCouponInput
): Promise<PlatformCouponValidationResult> {
  const coupon = await getPlatformCouponByCode(input.code);
  if (!coupon) return { valid: false, error: "Invalid coupon code" };

  if (coupon.status !== "active")
    return { valid: false, error: "Coupon is not active" };

  const now = new Date();
  if (coupon.validFrom > now)
    return { valid: false, error: "Coupon is not yet valid" };
  if (coupon.validUntil && coupon.validUntil < now)
    return { valid: false, error: "Coupon has expired" };

  if (coupon.productType !== input.productType) {
    const friendly: Record<string, string> = {
      office_plan: "office subscriptions",
      unilevel_plus: "Unilevel Plus",
      third_party_subscription: "third-party subscriptions",
      channel: "channels",
      course: "courses",
      workshop: "workshops",
      product: "products",
      service: "services",
      call: "calls",
      ecommerce: "storefront items",
      franchise_program: "the franchise program enrollment",
      franchise_territory: "franchise territory purchases",
    };
    return {
      valid: false,
      error: `This coupon is not valid for this item — it only applies to ${friendly[coupon.productType] || coupon.productType}.`,
    };
  }

  // Scope check: org-scoped coupons must match the item's org
  if (coupon.scope === "organization") {
    if (!input.orgId) {
      return { valid: false, error: "Coupon is not valid for this item" };
    }
    if (coupon.orgId?.toString() !== input.orgId) {
      return { valid: false, error: "Coupon is not valid for this item" };
    }
  }

  // Specific item targeting (optional)
  if (coupon.specificItemIds && coupon.specificItemIds.length > 0) {
    if (!input.itemId) {
      return { valid: false, error: "Coupon is not valid for this item" };
    }
    const matches = coupon.specificItemIds.some(
      (id) => id.toString() === input.itemId
    );
    if (!matches) {
      return { valid: false, error: "Coupon is not valid for this item" };
    }
  }

  const invoiceCurrency = input.invoiceCurrency || "USD";
  const couponCurrency = coupon.currency || "USD";

  if (coupon.minOrderAmount != null) {
    // Convert minOrderAmount from coupon currency into invoice currency for comparison
    const minInInvoiceCur =
      couponCurrency === invoiceCurrency
        ? coupon.minOrderAmount
        : await convertSmallestUnit(
            coupon.minOrderAmount,
            couponCurrency,
            invoiceCurrency
          );
    if (input.amountCents < minInInvoiceCur) {
      const currencySymbol = invoiceCurrency === "INR" ? "₹" : "$";
      return {
        valid: false,
        error: `Minimum order amount is ${currencySymbol}${(minInInvoiceCur / 100).toFixed(2)}`,
      };
    }
  }

  if (
    coupon.maxUsageCount != null &&
    coupon.currentUsageCount >= coupon.maxUsageCount
  ) {
    return { valid: false, error: "Coupon usage limit reached" };
  }

  // Per-user limit only enforceable when user is known (guests skip here; re-checked at invoice creation)
  // Bypass: if the user holds an active assignment for this coupon with
  // availableUses > 0 (e.g. granted by a purchase-based rule with N uses), the
  // per-user redemption cap doesn't apply — the assignment's counter governs.
  if (coupon.maxUsagePerUser != null && input.userId) {
    try {
      const { CouponAssignment } = await import("../models/couponAssignment.model");
      const assignment = await CouponAssignment.findOne({
        userId: new Types.ObjectId(input.userId),
        couponId: coupon._id,
        couponSource: "platform",
        status: "active",
      })
        .select("availableUses")
        .lean();
      const availableUses = assignment
        ? typeof assignment.availableUses === "number"
          ? assignment.availableUses
          : 1
        : 0;

      if (availableUses === 0) {
        const userUsage = await PlatformCouponRedemption.countDocuments({
          couponId: coupon._id,
          userId: new Types.ObjectId(input.userId),
          status: { $in: ["active", "exhausted"] },
        });
        if (userUsage >= coupon.maxUsagePerUser) {
          return { valid: false, error: "You have already used this coupon" };
        }
      }
      // else: active assignment with remaining uses → allow this redemption
    } catch {
      // userId may not be a valid ObjectId from a guest — skip silently
    }
  }

  const { discount, finalAmount } = await calculateDiscount(
    coupon,
    input.amountCents,
    invoiceCurrency
  );
  return {
    valid: true,
    coupon,
    discount,
    finalAmount,
    willBeFree: finalAmount === 0,
  };
}

// ============ Redemption ============

/**
 * Where a redemption must be filed so the right code can find it again.
 *
 * There is exactly ONE reader that makes a discount span future cycles:
 * `generateNextChildInvoice`, and it looks the redemption up by
 * `parentInvoiceId: <chain root>`. Anything filed under `invoiceId` applies to
 * that single invoice and nothing else.
 *
 * That made a multi-cycle coupon silently worthless when it was applied to a
 * RENEWAL rather than to a new subscription. The old rule keyed off the shape
 * of the invoice alone — "is this a chain root?" — so redeeming a 3-cycle
 * coupon against cycle 4 of an existing chain filed it under that child's own
 * id, where the generator never looks. The `cycleCount: 3` was stored
 * faithfully and then read by nobody: the member paid for three cycles and got
 * the one invoice they were standing on. Hit khanthecoach@gmail.com on
 * 28 Sep 2026.
 *
 * The rule therefore has to consider the COUPON, not just the invoice:
 * anything spanning more than one cycle belongs on the chain root, wherever in
 * the chain it was redeemed.
 *
 * Centralised here because three call sites were each re-deriving it by hand
 * (routes/invoice.ts, and createInvoice + the ecommerce path in
 * services/invoice.ts) — which is how they drifted apart in the first place.
 */
export function redemptionScopeFor(
  coupon: Pick<IPlatformCoupon, "cycleCount">,
  invoice: {
    _id: any;
    isRecurring?: boolean;
    parentInvoiceId?: any;
  }
): { parentInvoiceId: string } | { invoiceId: string } {
  const id = String(invoice._id);
  const rootId = invoice.parentInvoiceId
    ? String(invoice.parentInvoiceId)
    : id;

  // Spans several cycles → must sit on the chain root, or the generator
  // cannot see it. True whether it was redeemed at cycle 1 or cycle 40.
  if ((coupon.cycleCount ?? 1) > 1) return { parentInvoiceId: rootId };

  // Single-cycle on a brand-new subscription: the invoice IS the root.
  if (invoice.isRecurring && !invoice.parentInvoiceId) {
    return { parentInvoiceId: id };
  }

  // One-time purchase, or a single-cycle discount on one renewal. Deliberately
  // scoped to this invoice so it cannot leak onto later cycles.
  return { invoiceId: id };
}

export interface RedeemPlatformCouponInput {
  coupon: IPlatformCoupon;
  userId: string;
  productType: PlatformCouponProductType;
  invoiceId?: string; // one-time
  parentInvoiceId?: string; // subscription
}

export async function redeemPlatformCoupon(
  input: RedeemPlatformCouponInput
): Promise<IPlatformCouponRedemption> {
  const { coupon, userId, productType, invoiceId, parentInvoiceId } = input;

  if (!invoiceId && !parentInvoiceId) {
    throw new Error("invoiceId or parentInvoiceId required");
  }

  const keyField = parentInvoiceId ? "parentInvoiceId" : "invoiceId";
  const keyValue = new Types.ObjectId(parentInvoiceId ?? invoiceId!);

  // Upsert keyed on parentInvoiceId/invoiceId for idempotency
  const redemption = await PlatformCouponRedemption.findOneAndUpdate(
    { [keyField]: keyValue },
    {
      $setOnInsert: {
        couponId: coupon._id,
        couponCode: coupon.code,
        userId: new Types.ObjectId(userId),
        productType,
        [keyField]: keyValue,
        cycleCount: coupon.cycleCount ?? 1,
        cyclesApplied: 0,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        currency: coupon.currency || "USD",
        status: "active",
      },
    },
    { upsert: true, new: true, rawResult: true }
  );

  const doc = (redemption as any).value as IPlatformCouponRedemption;
  const wasInserted =
    (redemption as any).lastErrorObject?.updatedExisting === false;

  if (wasInserted) {
    await PlatformCoupon.updateOne(
      { _id: coupon._id },
      { $inc: { currentUsageCount: 1 } }
    );
  }

  return doc;
}

export async function getRedemptionForParent(
  parentInvoiceId: string | Types.ObjectId
): Promise<IPlatformCouponRedemption | null> {
  return PlatformCouponRedemption.findOne({
    parentInvoiceId:
      typeof parentInvoiceId === "string"
        ? new Types.ObjectId(parentInvoiceId)
        : parentInvoiceId,
    status: "active",
  });
}

export async function getRedemptionForInvoice(
  invoiceId: string | Types.ObjectId
): Promise<IPlatformCouponRedemption | null> {
  const oid =
    typeof invoiceId === "string" ? new Types.ObjectId(invoiceId) : invoiceId;
  return PlatformCouponRedemption.findOne({
    $or: [{ invoiceId: oid }, { parentInvoiceId: oid }],
  });
}

/**
 * Apply a redemption snapshot to a child invoice's subtotal.
 * Caller saves.
 */
export async function applyRedemptionToChild(
  redemption: IPlatformCouponRedemption,
  subtotalCents: number,
  invoiceCurrency: string = "USD"
): Promise<{ discount: number; totalAmount: number }> {
  const { discount, finalAmount } = await calculateDiscount(
    {
      discountType: redemption.discountType,
      discountValue: redemption.discountValue,
      maxDiscountAmount: redemption.maxDiscountAmount,
      currency: redemption.currency || "USD",
    },
    subtotalCents,
    invoiceCurrency
  );
  return { discount, totalAmount: finalAmount };
}

export async function listRedemptionsForCoupon(
  couponId: string
): Promise<any[]> {
  return PlatformCouponRedemption.find({
    couponId: new Types.ObjectId(couponId),
  })
    .sort({ createdAt: -1 })
    .populate("userId", "email name profilePicture")
    .populate(
      "invoiceId",
      "invoiceNumber totalAmount discount itemCurrency paidAt status"
    )
    .populate(
      "parentInvoiceId",
      "invoiceNumber totalAmount discount itemCurrency paidAt status"
    )
    .lean();
}
