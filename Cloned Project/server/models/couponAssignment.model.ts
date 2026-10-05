import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A CouponAssignment is a *reward* given to a specific user.
 * When present, the coupon appears in that user's "Rewards" tab.
 *
 * Supports both coupon systems via `couponSource`:
 *   - "platform" → refers to a PlatformCoupon
 *   - "legacy"   → refers to a legacy Coupon
 *
 * Status lifecycle: "active" → "used" (after the user redeems it) or
 * "revoked" (if the assigner removes it before use).
 */
export type CouponAssignmentSource = "platform" | "legacy";
export type CouponAssignmentStatus = "active" | "used" | "revoked" | "expired";

export interface ICouponAssignment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  couponId: Types.ObjectId;
  couponSource: CouponAssignmentSource;
  // Snapshotted code for audit even if coupon is renamed/removed
  couponCode: string;
  status: CouponAssignmentStatus;
  // Who assigned this reward
  assignedBy: Types.ObjectId;
  assignedByType: "garage_admin" | "founder" | "system" | "user";
  assignerOrgId?: Types.ObjectId; // for founder assignments
  // For peer transfers: the user who gifted this assignment
  giftedFromUserId?: Types.ObjectId;
  // For peer transfers: the prior assignment that was revoked to create this one
  parentAssignmentId?: Types.ObjectId;
  // Optional personal note from sender (peer gifts)
  giftMessage?: string;
  // Optional reason/note shown to user
  reason?: string;
  // Number of times this user can still redeem the underlying coupon via this
  // assignment. Defaults to 1 for direct admin/founder/peer gifts. Rule fires
  // can grant > 1 (e.g. "buy 3 of X → get 5 uses of COUPON"). Decremented per
  // redemption; status flips to "used" only when this reaches 0.
  availableUses: number;
  // Optional self-expiry (independent of the coupon's own validUntil)
  expiresAt?: Date;
  // Linked redemption (set when the user uses this reward)
  redemptionRef?: Types.ObjectId;
  redeemedAt?: Date;
  revokedAt?: Date;
  // When set, this assignment has an outstanding *paid* gift offer pending
  // recipient approval. The coupon is locked from redemption + re-gifting
  // until the offer resolves (approve/reject/cancel clears the field).
  pendingGiftId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponAssignmentSchema = new Schema<ICouponAssignment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    couponId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    couponSource: {
      type: String,
      enum: ["platform", "legacy"],
      required: true,
    },
    couponCode: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "used", "revoked", "expired"],
      default: "active",
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedByType: {
      type: String,
      enum: ["garage_admin", "founder", "system", "user"],
      required: true,
    },
    assignerOrgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
    },
    giftedFromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    parentAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "CouponAssignment",
    },
    giftMessage: { type: String, maxlength: 280 },
    reason: { type: String, maxlength: 500 },
    availableUses: { type: Number, default: 1, min: 0 },
    expiresAt: { type: Date },
    redemptionRef: { type: Schema.Types.ObjectId },
    redeemedAt: { type: Date },
    revokedAt: { type: Date },
    pendingGiftId: {
      type: Schema.Types.ObjectId,
      ref: "PendingCouponGift",
    },
  },
  { timestamps: true }
);

// One assignment per user+coupon (prevents duplicate assignments)
CouponAssignmentSchema.index(
  { userId: 1, couponId: 1, couponSource: 1 },
  { unique: true }
);
// Fast lookup for user's active rewards
CouponAssignmentSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const CouponAssignment = mongoose.model<ICouponAssignment>(
  "CouponAssignment",
  CouponAssignmentSchema
);
