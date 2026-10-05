import mongoose, { Schema, Document, Types } from "mongoose";

export type PlatformCouponProductType =
  | "office_plan"
  | "unilevel_plus"
  | "third_party_subscription"
  | "channel"
  | "course"
  | "workshop"
  | "product"
  | "service"
  | "call"
  | "ecommerce"
  // Founder franchise program ($650/yr opt-in). Admin-only; discounts the
  // franchise_program enroll invoice.
  | "franchise_program"
  // Franchise territory purchase. Admin-only; discounts ONLY the $650 platform
  // floor of a territory sale — the founder/reseller markup is never touched.
  | "franchise_territory";

// Product types where EVERY item is billed as a subscription — cycleCount
// is always required for these. Trimmed to only always-recurring types.
//
// Historically this list also included `channel` and `workshop` — but both
// have per-item `isSubscription` flags: a channel or workshop can be one-time
// OR recurring. The founder-side route at routes/founderPlatformCoupons.ts
// (`isItemRecurring`) already does the correct per-item check, and the
// admin-side route at routes/platformCoupons.ts:52-63 explicitly lists only
// the always-subscription types. The model's blanket rule was rejecting
// perfectly-valid one-time workshop / channel coupons — see founder report
// "Unable to create coupon for webinars" (per-session workshops are one-time
// billed even though the workshop itself is recurring).
export const SUBSCRIPTION_PRODUCT_TYPES: PlatformCouponProductType[] = [
  "office_plan",
  "third_party_subscription",
  "franchise_program", // yearly $650 program subscription
  "franchise_territory", // yearly territory subscription
];

export function isSubscriptionProductType(t: PlatformCouponProductType): boolean {
  return SUBSCRIPTION_PRODUCT_TYPES.includes(t);
}

// Product types where EVERY item is one-time — cycleCount is nonsensical
// and stripped by the model's pre-validate.
//
// `service`, `call`, `ecommerce` never carry `isSubscription` — the route
// helper at routes/founderPlatformCoupons.ts:60-65 hard-returns false for
// them. Safe to strip.
//
// `product` — despite having an `isSubscription` field on the model, a
// digital product with recurring billing still uses `cycleCount` at the
// coupon layer to cap how many billing cycles the discount applies to.
// So product is treated as MIXED (per-item), not always-one-time — moved
// out of this list. Same treatment as workshop / channel / course.
export const ALWAYS_ONE_TIME_PRODUCT_TYPES: PlatformCouponProductType[] = [
  "service",
  "call",
  "ecommerce",
];

export function isAlwaysOneTimeProductType(
  t: PlatformCouponProductType,
): boolean {
  return ALWAYS_ONE_TIME_PRODUCT_TYPES.includes(t);
}

export type PlatformCouponDiscountType = "fixed" | "percent";

export type PlatformCouponStatus = "active" | "inactive" | "expired";

export type PlatformCouponScope = "platform" | "organization";

export interface IPlatformCoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  /** Optional banner / cover image URL shown alongside the coupon on
   *  founder + buyer-facing surfaces. Free-form URL — caller uploads to
   *  their own CDN / S3 and stores the link. */
  media?: string;
  productType: PlatformCouponProductType;
  discountType: PlatformCouponDiscountType;
  discountValue: number; // smallest unit in `currency` if fixed, 1-100 if percent
  maxDiscountAmount?: number; // smallest unit in `currency`; caps percent discount
  currency: "USD" | "INR"; // the currency discountValue / maxDiscountAmount / minOrderAmount are denominated in
  cycleCount?: number; // required for subscription types; N/A for one-time
  status: PlatformCouponStatus;
  validFrom: Date;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  minOrderAmount?: number;
  createdBy: Types.ObjectId;
  createdByType: "garage_admin" | "founder";
  // Scope: platform-wide (admin) vs organization (founder)
  scope: PlatformCouponScope;
  orgId?: Types.ObjectId; // required when scope === "organization"
  // Optional: specific item targeting within the productType (e.g. a specific channelId)
  specificItemIds?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const PlatformCouponSchema = new Schema<IPlatformCoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[A-Z0-9_-]+$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    media: { type: String, trim: true, maxlength: 2048 },
    productType: {
      type: String,
      enum: [
        "office_plan",
        "unilevel_plus",
        "third_party_subscription",
        "channel",
        "course",
        "workshop",
        "product",
        "service",
        "call",
        "ecommerce",
        "franchise_program",
        "franchise_territory",
      ],
      required: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ["fixed", "percent"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 1 },
    currency: {
      type: String,
      enum: ["USD", "INR"],
      default: "USD",
      required: true,
    },
    maxDiscountAmount: { type: Number, min: 0 },
    cycleCount: { type: Number, min: 1 },
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
      index: true,
    },
    validFrom: { type: Date, required: true, default: Date.now },
    validUntil: { type: Date },
    maxUsageCount: { type: Number, min: 1 },
    maxUsagePerUser: { type: Number, min: 1 },
    currentUsageCount: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    createdByType: {
      type: String,
      enum: ["garage_admin", "founder"],
      required: true,
    },
    scope: {
      type: String,
      enum: ["platform", "organization"],
      default: "platform",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    specificItemIds: {
      type: [Schema.Types.ObjectId],
      default: undefined,
    },
  },
  { timestamps: true }
);

// Validation
PlatformCouponSchema.pre("validate", function (next) {
  // Three cases for cycleCount:
  //   1. Always-subscription (office_plan, etc.) → REQUIRE cycleCount.
  //   2. Always-one-time (product, service, call, ecommerce) → STRIP
  //      any cycleCount that leaked through (it's meaningless).
  //   3. Mixed types (workshop, channel, course) → HONOR whatever the
  //      caller passed. The route layer already did the per-item check
  //      via `isItemRecurring` (founder route) or its explicit type
  //      list (admin route). Coercing here would silently drop a
  //      legitimate cycleCount on a subscription workshop/channel/course.
  const pt = this.productType as PlatformCouponProductType;
  if (isSubscriptionProductType(pt)) {
    if (this.cycleCount == null || this.cycleCount < 1) {
      return next(
        new Error("cycleCount is required for subscription-type coupons")
      );
    }
  } else if (isAlwaysOneTimeProductType(pt)) {
    if (this.cycleCount != null) this.cycleCount = undefined;
  }
  // else: mixed type (workshop / channel / course) — pass through.
  if (this.discountType === "percent" && this.discountValue > 100) {
    return next(new Error("percent discount must be 1-100"));
  }
  // Scope: organization requires orgId
  if (this.scope === "organization" && !this.orgId) {
    return next(new Error("orgId is required for organization-scoped coupons"));
  }
  if (this.scope === "platform" && this.orgId) {
    this.orgId = undefined;
  }
  next();
});

PlatformCouponSchema.index({ productType: 1, status: 1 });
PlatformCouponSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
PlatformCouponSchema.index({ scope: 1, orgId: 1, status: 1 });

export const PlatformCoupon = mongoose.model<IPlatformCoupon>(
  "PlatformCoupon",
  PlatformCouponSchema
);
