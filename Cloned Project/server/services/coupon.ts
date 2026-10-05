import { Types } from "mongoose";
import { Coupon, ICoupon, ApplicableItemType, CouponScope } from "../models/coupon.model";
import { CouponUsage, ICouponUsage, CouponUsageTransactionType } from "../models/couponUsage.model";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Product } from "../models/product.model";
import { OfficePlan } from "../models/officePlan.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { EventProgram } from "../models/eventProgram.model";

// Item type configuration with organization field names
const ITEM_TYPE_CONFIG: Record<ApplicableItemType, {
  orgField: string | null; // null = garage admin only (no org ownership)
}> = {
  channel: { orgField: "storeId" },
  course: { orgField: "organizationId" },
  workshop: { orgField: "orgId" },
  product: { orgField: "organizationId" },
  office_plan: { orgField: null },
  office_addon: { orgField: null },
  event_ticket: { orgField: "orgId" },
};

// Helper to find one item by type
async function findItemByType(
  itemType: ApplicableItemType,
  query: Record<string, unknown>
): Promise<unknown | null> {
  switch (itemType) {
    case "channel": return Channel.findOne(query).lean();
    case "course": return Course.findOne(query).lean();
    case "workshop": return Workshop.findOne(query).lean();
    case "product": return Product.findOne(query).lean();
    case "office_plan": return OfficePlan.findOne(query).lean();
    case "office_addon": return OfficeAddon.findOne(query).lean();
    case "event_ticket": return EventProgram.findOne(query).lean();
  }
}

// Helper to find items by type with select and limit
async function findItemsByType(
  itemType: ApplicableItemType,
  query: Record<string, unknown>,
  selectField: string
): Promise<Array<Record<string, unknown>>> {
  switch (itemType) {
    case "channel": return Channel.find(query).select(`_id ${selectField}`).limit(100).lean();
    case "course": return Course.find(query).select(`_id ${selectField}`).limit(100).lean();
    case "workshop": return Workshop.find(query).select(`_id ${selectField}`).limit(100).lean();
    case "product": return Product.find(query).select(`_id ${selectField}`).limit(100).lean();
    case "office_plan": return OfficePlan.find(query).select(`_id ${selectField}`).limit(100).lean();
    case "office_addon": return OfficeAddon.find(query).select(`_id ${selectField}`).limit(100).lean();
    case "event_ticket": return EventProgram.find(query).select(`_id ${selectField}`).limit(100).lean();
  }
}

// ============ Types ============

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  discountValue: number;
  maxDiscountAmount?: number;
  scope: CouponScope;
  orgId?: string;
  createdBy: string;
  createdByType: "garage_admin" | "founder";
  razorpayOfferId?: string;
  applicableTo: ApplicableItemType[];
  specificItemIds?: string[];
  validFrom?: Date;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmount?: number;
}

export interface UpdateCouponInput {
  name?: string;
  description?: string;
  discountValue?: number;
  maxDiscountAmount?: number;
  razorpayOfferId?: string;
  applicableTo?: ApplicableItemType[];
  specificItemIds?: string[];
  validFrom?: Date;
  validUntil?: Date;
  status?: "active" | "inactive";
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmount?: number;
}

export interface ValidateCouponParams {
  code: string;
  itemType: ApplicableItemType;
  itemId: string;
  amount: number; // In paise
  userId?: string;
  orgId?: string;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: ICoupon;
  discountAmount?: number;
  finalAmount?: number;
  error?: string;
}

export interface RecordUsageParams {
  couponId: string;
  userId: string;
  orgId?: string;
  transactionType: CouponUsageTransactionType;
  transactionId: string;
  itemType: string;
  itemId: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  subscriptionId?: string;
  paymentNumber?: number;
}

export interface ItemValidationResult {
  valid: boolean;
  invalidIds?: string[];
  error?: string;
}

// ============ Item Validation ============

/**
 * Validates that specificItemIds exist and match the specified applicableTo categories
 * For founders, also verifies items belong to their organization
 */
export async function validateSpecificItemIds(
  specificItemIds: string[],
  applicableTo: ApplicableItemType[],
  orgId?: string,
  isFounder: boolean = false
): Promise<ItemValidationResult> {
  if (!specificItemIds || specificItemIds.length === 0) {
    return { valid: true };
  }

  const invalidIds: string[] = [];

  for (const itemId of specificItemIds) {
    let found = false;

    // Check if this item exists in any of the allowed categories
    for (const itemType of applicableTo) {
      const config = ITEM_TYPE_CONFIG[itemType];
      if (!config) continue;

      // For founders, skip item types without org ownership (office_plan, office_addon)
      if (isFounder && config.orgField === null) continue;

      try {
        // Build query
        const query: Record<string, unknown> = { _id: new Types.ObjectId(itemId) };

        // For founders, also check organization ownership
        if (isFounder && config.orgField && orgId) {
          query[config.orgField] = new Types.ObjectId(orgId);
        }

        const item = await findItemByType(itemType, query);
        if (item) {
          found = true;
          break;
        }
      } catch {
        // Invalid ObjectId format - continue to next item type
        continue;
      }
    }

    if (!found) {
      invalidIds.push(itemId);
    }
  }

  if (invalidIds.length > 0) {
    return {
      valid: false,
      invalidIds,
      error: isFounder
        ? `Some items do not exist or do not belong to your organization: ${invalidIds.join(", ")}`
        : `Some items do not exist or do not match the selected categories: ${invalidIds.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Lists available items by category for coupon targeting UI
 */
export async function listItemsByCategory(
  itemTypes: ApplicableItemType[],
  orgId?: string,
  isFounder: boolean = false
): Promise<Record<ApplicableItemType, Array<{ _id: string; name: string }>>> {
  const result: Record<ApplicableItemType, Array<{ _id: string; name: string }>> = {
    channel: [],
    course: [],
    workshop: [],
    product: [],
    office_plan: [],
    office_addon: [],
    event_ticket: [],
  };

  for (const itemType of itemTypes) {
    const config = ITEM_TYPE_CONFIG[itemType];
    if (!config) continue;

    // For founders, skip global items (office_plan, office_addon)
    if (isFounder && config.orgField === null) {
      continue;
    }

    // Build query
    const query: Record<string, unknown> = {};

    // For org-owned items, filter by organization
    if (config.orgField && orgId) {
      query[config.orgField] = new Types.ObjectId(orgId);
    }

    // Soft-deleted events must not appear in the coupon targeting picker.
    if (itemType === "event_ticket") {
      query.deletedAt = null;
    }

    // Get name field (varies by model)
    const nameField = itemType === "channel" ? "title" : "name";

    const items = await findItemsByType(itemType, query, nameField);

    result[itemType] = items.map((item: Record<string, unknown>) => ({
      _id: (item._id as Types.ObjectId).toString(),
      name: (item[nameField] as string) || (item.title as string) || "Unnamed",
    }));
  }

  return result;
}

// ============ Coupon CRUD ============

export async function createCoupon(input: CreateCouponInput): Promise<ICoupon> {
  const code = input.code.toUpperCase().trim();

  // Check for duplicate code
  const existing = await Coupon.findOne({ code });
  if (existing) {
    throw new Error("Coupon code already exists");
  }

  // Validate specificItemIds if provided
  if (input.specificItemIds && input.specificItemIds.length > 0) {
    const isFounder = input.createdByType === "founder";
    const validationResult = await validateSpecificItemIds(
      input.specificItemIds,
      input.applicableTo,
      input.orgId,
      isFounder
    );

    if (!validationResult.valid) {
      throw new Error(validationResult.error || "Invalid specific item IDs");
    }
  }

  const coupon = new Coupon({
    code,
    name: input.name,
    description: input.description,
    discountValue: input.discountValue,
    maxDiscountAmount: input.maxDiscountAmount,
    scope: input.scope,
    orgId: input.orgId ? new Types.ObjectId(input.orgId) : undefined,
    createdBy: new Types.ObjectId(input.createdBy),
    createdByType: input.createdByType,
    razorpayOfferId: input.razorpayOfferId,
    applicableTo: input.applicableTo,
    specificItemIds: input.specificItemIds?.map((id) => new Types.ObjectId(id)),
    validFrom: input.validFrom || new Date(),
    validUntil: input.validUntil,
    maxUsageCount: input.maxUsageCount,
    maxUsagePerUser: input.maxUsagePerUser,
    minOrderAmount: input.minOrderAmount,
    status: "active",
    currentUsageCount: 0,
  });

  await coupon.save();
  return coupon;
}

export async function updateCoupon(
  couponId: string,
  input: UpdateCouponInput,
  orgId?: string,
  isFounder: boolean = false
): Promise<ICoupon | null> {
  // If updating specificItemIds, validate them
  if (input.specificItemIds && input.specificItemIds.length > 0) {
    // Get existing coupon to know the applicableTo types
    const existingCoupon = await Coupon.findById(couponId);
    if (!existingCoupon) {
      throw new Error("Coupon not found");
    }

    const applicableTo = input.applicableTo || existingCoupon.applicableTo;
    const validationResult = await validateSpecificItemIds(
      input.specificItemIds,
      applicableTo,
      orgId,
      isFounder
    );

    if (!validationResult.valid) {
      throw new Error(validationResult.error || "Invalid specific item IDs");
    }
  }

  const updateData: Record<string, unknown> = { ...input };

  if (input.specificItemIds) {
    updateData.specificItemIds = input.specificItemIds.map((id) => new Types.ObjectId(id));
  }

  const coupon = await Coupon.findByIdAndUpdate(couponId, updateData, { new: true });
  return coupon;
}

export async function deactivateCoupon(couponId: string): Promise<ICoupon | null> {
  const coupon = await Coupon.findByIdAndUpdate(
    couponId,
    { status: "inactive" },
    { new: true }
  );
  return coupon;
}

export async function getCouponById(couponId: string): Promise<ICoupon | null> {
  return Coupon.findById(couponId);
}

export async function getCouponByCode(code: string): Promise<ICoupon | null> {
  return Coupon.findOne({ code: code.toUpperCase().trim() });
}

export async function listCoupons(params: {
  scope?: CouponScope;
  orgId?: string;
  status?: string;
  createdBy?: string;
  skip?: number;
  limit?: number;
}): Promise<{ coupons: ICoupon[]; total: number }> {
  const query: any = {};

  if (params.scope) query.scope = params.scope;
  if (params.orgId) query.orgId = new Types.ObjectId(params.orgId);
  if (params.status) query.status = params.status;
  if (params.createdBy) query.createdBy = new Types.ObjectId(params.createdBy);

  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(params.skip || 0)
      .limit(params.limit || 50)
      .lean(),
    Coupon.countDocuments(query),
  ]);

  return { coupons: coupons as ICoupon[], total };
}

// ============ Coupon Validation ============

export async function validateCoupon(
  params: ValidateCouponParams
): Promise<CouponValidationResult> {
  const { code, itemType, itemId, amount, userId, orgId } = params;

  // Find coupon
  const coupon = await getCouponByCode(code);
  if (!coupon) {
    return { valid: false, error: "Invalid coupon code" };
  }

  // Check status
  if (coupon.status !== "active") {
    return { valid: false, error: "Coupon is not active" };
  }

  // Check validity dates
  const now = new Date();
  if (coupon.validFrom > now) {
    return { valid: false, error: "Coupon is not yet valid" };
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    return { valid: false, error: "Coupon has expired" };
  }

  // Check scope
  if (coupon.scope === "organization") {
    if (!orgId || coupon.orgId?.toString() !== orgId) {
      return { valid: false, error: "Coupon is not valid for this organization" };
    }
  }

  // Check item type applicability
  if (!coupon.applicableTo.includes(itemType)) {
    return { valid: false, error: "Coupon is not applicable to this item type" };
  }

  // Check specific item IDs (if specified)
  if (coupon.specificItemIds && coupon.specificItemIds.length > 0) {
    const isSpecificItem = coupon.specificItemIds.some(
      (id) => id.toString() === itemId
    );
    if (!isSpecificItem) {
      return { valid: false, error: "Coupon is not applicable to this item" };
    }
  }

  // Check minimum order amount
  if (coupon.minOrderAmount && amount < coupon.minOrderAmount) {
    return {
      valid: false,
      error: `Minimum order amount is ₹${(coupon.minOrderAmount / 100).toFixed(2)}`,
    };
  }

  // Check total usage limit
  if (coupon.maxUsageCount && coupon.currentUsageCount >= coupon.maxUsageCount) {
    return { valid: false, error: "Coupon usage limit reached" };
  }

  // Check per-user usage limit
  if (userId && coupon.maxUsagePerUser) {
    const userUsageCount = await CouponUsage.countDocuments({
      couponId: coupon._id,
      userId: new Types.ObjectId(userId),
      status: { $in: ["pending", "applied"] },
    });

    if (userUsageCount >= coupon.maxUsagePerUser) {
      return {
        valid: false,
        error: `You have already used this coupon (max ${coupon.maxUsagePerUser} use${coupon.maxUsagePerUser > 1 ? 's' : ''} per user)`
      };
    }
  }

  // Calculate discount
  const { discountAmount, finalAmount } = calculateDiscount(coupon, amount);

  return {
    valid: true,
    coupon,
    discountAmount,
    finalAmount,
  };
}

// ============ Discount Calculation ============

export function calculateDiscount(
  coupon: ICoupon,
  amount: number // In paise
): { discountAmount: number; finalAmount: number } {
  // Calculate percentage discount
  let discountAmount = Math.round((amount * coupon.discountValue) / 100);

  // Apply max discount cap if specified
  if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
    discountAmount = coupon.maxDiscountAmount;
  }

  // Ensure discount doesn't exceed amount
  if (discountAmount > amount) {
    discountAmount = amount;
  }

  const finalAmount = amount - discountAmount;

  return { discountAmount, finalAmount };
}

// ============ Usage Tracking ============

export async function recordCouponUsage(params: RecordUsageParams): Promise<ICouponUsage> {
  const usage = new CouponUsage({
    couponId: new Types.ObjectId(params.couponId),
    userId: new Types.ObjectId(params.userId),
    orgId: params.orgId ? new Types.ObjectId(params.orgId) : undefined,
    transactionType: params.transactionType,
    transactionId: params.transactionId,
    itemType: params.itemType,
    itemId: new Types.ObjectId(params.itemId),
    originalAmount: params.originalAmount,
    discountAmount: params.discountAmount,
    finalAmount: params.finalAmount,
    subscriptionId: params.subscriptionId
      ? new Types.ObjectId(params.subscriptionId)
      : undefined,
    paymentNumber: params.paymentNumber,
    status: "pending",
  });

  await usage.save();

  return usage;
}

export async function markUsageApplied(usageId: string): Promise<ICouponUsage | null> {
  const usage = await CouponUsage.findByIdAndUpdate(
    usageId,
    {
      status: "applied",
      appliedAt: new Date(),
    },
    { new: true }
  );

  if (usage) {
    // Increment coupon usage count
    await Coupon.findByIdAndUpdate(usage.couponId, {
      $inc: { currentUsageCount: 1 },
    });
  }

  return usage;
}

export async function markUsageFailed(usageId: string): Promise<ICouponUsage | null> {
  return CouponUsage.findByIdAndUpdate(
    usageId,
    { status: "failed" },
    { new: true }
  );
}

export async function getUserUsageCount(
  couponId: string,
  userId: string
): Promise<number> {
  return CouponUsage.countDocuments({
    couponId: new Types.ObjectId(couponId),
    userId: new Types.ObjectId(userId),
    status: { $in: ["pending", "applied"] },
  });
}

// ============ Analytics ============

export async function getCouponAnalytics(couponId: string): Promise<{
  totalUsage: number;
  totalDiscountGiven: number;
  uniqueUsers: number;
  usageByItemType: Record<string, number>;
}> {
  const couponObjectId = new Types.ObjectId(couponId);

  const [totalUsage, totalDiscountAgg, uniqueUsersAgg, usageByTypeAgg] = await Promise.all([
    CouponUsage.countDocuments({
      couponId: couponObjectId,
      status: "applied",
    }),
    CouponUsage.aggregate([
      { $match: { couponId: couponObjectId, status: "applied" } },
      { $group: { _id: null, total: { $sum: "$discountAmount" } } },
    ]),
    CouponUsage.aggregate([
      { $match: { couponId: couponObjectId, status: "applied" } },
      { $group: { _id: "$userId" } },
      { $count: "count" },
    ]),
    CouponUsage.aggregate([
      { $match: { couponId: couponObjectId, status: "applied" } },
      { $group: { _id: "$itemType", count: { $sum: 1 } } },
    ]),
  ]);

  const usageByItemType: Record<string, number> = {};
  usageByTypeAgg.forEach((item: { _id: string; count: number }) => {
    usageByItemType[item._id] = item.count;
  });

  return {
    totalUsage,
    totalDiscountGiven: totalDiscountAgg[0]?.total || 0,
    uniqueUsers: uniqueUsersAgg[0]?.count || 0,
    usageByItemType,
  };
}
