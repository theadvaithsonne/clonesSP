import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A paid coupon-gift offer that requires the recipient's approval before any
 * money or coupon moves. While `status === "pending"` the sender's
 * `CouponAssignment.pendingGiftId` points here, locking the coupon from
 * being re-gifted or redeemed.
 *
 * Lifecycle: pending → approved | rejected | cancelled. There is no
 * auto-expiry (decision: pending offers stay pending until acted on or
 * cancelled by the sender).
 *
 * Distinct from the free-gift path in `couponAssignment.transferAssignment`,
 * which still runs instantly and creates no row here.
 */
export type PendingCouponGiftStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface IPendingCouponGift extends Document {
  _id: Types.ObjectId;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  fromAssignmentId: Types.ObjectId;
  couponId: Types.ObjectId;
  couponSource: "platform" | "legacy";
  // Snapshot for display + audit even if coupon is renamed/removed
  couponCode: string;
  // Org context the wallet transfer happens in (store wallets are per-org).
  orgId: Types.ObjectId;
  // USD amount the recipient pays the sender on approve (2dp number).
  priceUsd: number;
  message?: string;
  status: PendingCouponGiftStatus;
  respondedAt?: Date;
  // Audit trail of the artifacts produced at approval time.
  resolutionTxRefs?: {
    senderWalletTxId?: Types.ObjectId;
    recipientWalletTxId?: Types.ObjectId;
    recipientAssignmentId?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ResolutionTxRefsSchema = new Schema(
  {
    senderWalletTxId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    recipientWalletTxId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    recipientAssignmentId: { type: Schema.Types.ObjectId, ref: "CouponAssignment" },
  },
  { _id: false }
);

const PendingCouponGiftSchema = new Schema<IPendingCouponGift>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "CouponAssignment",
      required: true,
    },
    couponId: { type: Schema.Types.ObjectId, required: true },
    couponSource: {
      type: String,
      enum: ["platform", "legacy"],
      required: true,
    },
    couponCode: { type: String, required: true },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    priceUsd: { type: Number, required: true, min: 0.01 },
    message: { type: String, maxlength: 280 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date },
    resolutionTxRefs: ResolutionTxRefsSchema,
  },
  { timestamps: true }
);

// At most one pending offer per coupon-assignment — keeps the sender-side
// lock bulletproof under concurrency.
PendingCouponGiftSchema.index(
  { fromAssignmentId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

// Recipient inbox + sender outbox queries.
PendingCouponGiftSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
PendingCouponGiftSchema.index({ fromUserId: 1, status: 1, createdAt: -1 });

export const PendingCouponGift = mongoose.model<IPendingCouponGift>(
  "PendingCouponGift",
  PendingCouponGiftSchema
);
