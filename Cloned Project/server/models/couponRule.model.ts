import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A CouponRule is a purchase-based automation that grants users coupon
 * assignments based on their purchase activity.
 *
 *   "If user buys [triggerQuantity] of [triggerItem], grant them
 *    [rewardQuantity] uses of [rewardCoupon]."
 *
 *   Recurrence:
 *     "once"  → fire once when threshold first crossed
 *     "every" → fire every additional threshold crossing
 *
 * Scope:
 *   "organization" → tied to an org (founder rule). Triggers only on
 *                    purchases that flow through that org's checkouts.
 *   "platform"     → garage-admin rule. Triggers on any user's purchase of
 *                    the configured platform-level item (office_plan,
 *                    unilevel_plus, third_party_subscription).
 *
 * Rules apply only to purchases made AFTER `effectiveFrom` (which is set to
 * `createdAt`). Existing customers are never retroactively rewarded.
 *
 * Back-compat: rule rows created before the `scope` field existed have
 * `scope: undefined` and an `orgId` set; service code treats those as
 * `"organization"` scope.
 */
export type CouponRuleType = "purchase_based";
export type CouponRuleRecurrence = "once" | "every";
export type CouponRuleScope = "platform" | "organization";

/**
 * Founder-scope types: items owned by an organization.
 * Admin-scope types: platform-level items (office plans, unilevel plus,
 * third-party subscriptions).
 */
export type CouponRuleProductType =
  | "channel"
  | "course"
  | "workshop"
  | "product"
  | "service"
  | "call"
  | "office_plan"
  | "unilevel_plus"
  | "third_party_subscription"
  | "ecommerce";

export interface ICouponRule extends Document {
  _id: Types.ObjectId;
  scope: CouponRuleScope;
  orgId?: Types.ObjectId;
  name: string;
  type: CouponRuleType;
  triggerProductType: CouponRuleProductType;
  /**
   * Specific item that triggers the rule. When omitted (null/undefined) the
   * rule is a "wildcard" — it fires on ANY purchase of `triggerProductType`,
   * regardless of which specific record. Used today for admin rules over
   * `third_party_subscription` (where partner records may not exist yet) and
   * available for the other admin types too.
   */
  triggerItemId?: Types.ObjectId;
  triggerQuantity: number;
  rewardCouponId: Types.ObjectId;
  rewardQuantity: number;
  recurrence: CouponRuleRecurrence;
  isActive: boolean;
  effectiveFrom: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponRuleSchema = new Schema<ICouponRule>(
  {
    scope: {
      type: String,
      enum: ["platform", "organization"],
      default: "organization",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      // Required for "organization" scope. Enforced at service layer rather
      // than via Mongoose required validator (since required can't be a
      // function of another field cleanly here).
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    type: {
      type: String,
      enum: ["purchase_based"],
      default: "purchase_based",
      required: true,
    },
    triggerProductType: {
      type: String,
      enum: [
        "channel",
        "course",
        "workshop",
        "product",
        "service",
        "call",
        "office_plan",
        "unilevel_plus",
        "third_party_subscription",
        "ecommerce",
      ],
      required: true,
    },
    // Optional: when missing, the rule is a wildcard over `triggerProductType`.
    triggerItemId: { type: Schema.Types.ObjectId, index: true },
    triggerQuantity: { type: Number, required: true, min: 1, default: 1 },
    rewardCouponId: {
      type: Schema.Types.ObjectId,
      ref: "PlatformCoupon",
      required: true,
    },
    rewardQuantity: { type: Number, required: true, min: 1, default: 1 },
    recurrence: {
      type: String,
      enum: ["once", "every"],
      default: "once",
      required: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date, required: true, default: () => new Date() },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Fast lookups
CouponRuleSchema.index({ orgId: 1, isActive: 1 });
CouponRuleSchema.index({ scope: 1, isActive: 1 });
CouponRuleSchema.index({ triggerItemId: 1, isActive: 1 });

export const CouponRule = mongoose.model<ICouponRule>(
  "CouponRule",
  CouponRuleSchema
);
