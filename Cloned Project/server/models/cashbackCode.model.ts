// Cashback code — an affiliate-issued rebate code that lives in the same
// checkout input as a PlatformCoupon. Each code is bound to ONE specific
// product (channel/course/workshop/product/service/call/ecommerce_item),
// carries a single `ratePct`, and optionally restricts which of the
// creator's direct downline are allowed to apply it.
//
// When a direct downline (matching `allowedBuyerIds` if set) applies the
// code at checkout and pays full, fulfillInvoice runs the post-distribute
// `executeCashback` hook: it confirms the cart contains the bound product,
// caps the configured rate against the actual level-1 commission rate on
// that line, and atomically moves money from AffiliateWallet[creator] →
// StoreWallet[buyer, sellerOrg]. See the plan / FOUNDER_COUPONS_API doc for
// the full lifecycle.

import mongoose, { Schema, Document, Types } from "mongoose";

export type CashbackCodeStatus = "active" | "inactive" | "expired";

/**
 * Product-type keys a code can be bound to. Mirrors the founder coupon
 * productType taxonomy minus the platform-level types (office_plan,
 * unilevel_plus, third_party_subscription) — those go through
 * UnilevelPlusDistribution, not the standard commission flow.
 *
 * NOTE: the invoice line itemType `ecommerce_item` maps to the cashback
 * key `ecommerce`. See `mapItemTypeToCashbackType` in the service.
 */
export const CASHBACK_PRODUCT_TYPES = [
  "product",
  "channel",
  "course",
  "workshop",
  "service",
  "call",
  "ecommerce",
] as const;
export type CashbackProductType = (typeof CASHBACK_PRODUCT_TYPES)[number];

export interface ICashbackCode extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  creatorId: Types.ObjectId;
  status: CashbackCodeStatus;

  // ── The bound product ───────────────────────────────────────────────
  productType: CashbackProductType;
  itemId: Types.ObjectId;
  /**
   * Seller org for the bound item — derived at create time from the item
   * lookup. Used during execution to credit the right StoreWallet.
   */
  orgId: Types.ObjectId;

  // ── Rate ────────────────────────────────────────────────────────────
  /**
   * Configured cashback as percent of sale (0 < pct ≤ 100). At execute
   * time the actual applied rate is `min(ratePct, level1RatePct)` so the
   * creator never goes negative on the line.
   */
  ratePct: number;

  // ── Buyer restriction (optional) ────────────────────────────────────
  /**
   * Optional whitelist. When non-empty, only buyers whose `_id` appears
   * here can apply the code. Validated at create time to ensure every
   * entry is one of the creator's direct downline.
   *
   * Empty / undefined → all direct downline can apply (subject to the
   * baseline direct-downline gate that always applies).
   */
  allowedBuyerIds: Types.ObjectId[];

  // ── Lifecycle ───────────────────────────────────────────────────────
  cycleCount: number;
  validFrom: Date;
  validUntil?: Date;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  /** Floor on invoice subtotal (smallest unit, USD). */
  minOrderAmountCents?: number;

  createdAt: Date;
  updatedAt: Date;
}

const CashbackCodeSchema = new Schema<ICashbackCode>(
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
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
      index: true,
    },

    productType: {
      type: String,
      enum: CASHBACK_PRODUCT_TYPES,
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    ratePct: { type: Number, required: true, min: 0.01, max: 100 },

    allowedBuyerIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    cycleCount: { type: Number, default: 1, min: 1 },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    maxUsageCount: { type: Number, min: 1 },
    maxUsagePerUser: { type: Number, min: 1 },
    currentUsageCount: { type: Number, default: 0, min: 0 },
    minOrderAmountCents: { type: Number, min: 0 },
  },
  { timestamps: true }
);

CashbackCodeSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
CashbackCodeSchema.index({ productType: 1, itemId: 1, status: 1 });

export const CashbackCode = mongoose.model<ICashbackCode>(
  "CashbackCode",
  CashbackCodeSchema
);
