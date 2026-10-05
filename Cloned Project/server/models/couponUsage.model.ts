import mongoose, { Schema, Document, Types } from "mongoose";

export type CouponUsageTransactionType = "one_time" | "subscription";
export type CouponUsageStatus = "pending" | "applied" | "refunded" | "failed";

export interface ICouponUsage extends Document {
  _id: Types.ObjectId;
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId?: Types.ObjectId;

  // Transaction details
  transactionType: CouponUsageTransactionType;
  transactionId: string; // Razorpay order ID or subscription ID
  itemType: string;
  itemId: Types.ObjectId;

  // Amount details (in paise)
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;

  // For subscriptions
  subscriptionId?: Types.ObjectId;
  paymentNumber?: number;

  // Status
  status: CouponUsageStatus;

  // Timestamps
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const couponUsageSchema = new Schema<ICouponUsage>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
    },

    // Transaction details
    transactionType: {
      type: String,
      enum: ["one_time", "subscription"],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
    },
    itemType: {
      type: String,
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    // Amount details
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Subscription-specific
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
    paymentNumber: {
      type: Number,
      min: 1,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "applied", "refunded", "failed"],
      default: "pending",
    },

    appliedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
couponUsageSchema.index({ couponId: 1, userId: 1 });
couponUsageSchema.index({ userId: 1, itemType: 1, itemId: 1 });
couponUsageSchema.index({ transactionId: 1 });
couponUsageSchema.index({ status: 1 });
couponUsageSchema.index({ createdAt: -1 });

export const CouponUsage = mongoose.model<ICouponUsage>("CouponUsage", couponUsageSchema);
