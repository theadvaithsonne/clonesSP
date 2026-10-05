import mongoose, { Schema, Document, Types } from "mongoose";
import { SubscriptionItemType } from "./subscriptionPlan.model";

export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "paused"
  | "expired";

export type PaymentMethod = "card" | "upi" | "emandate" | "nach" | "wallet";

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  razorpayCustomerId?: string;
  planId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  itemType: SubscriptionItemType;
  itemId: Types.ObjectId;
  sellerId: Types.ObjectId; // Content creator for commission distribution
  status: SubscriptionStatus;
  currentStart?: Date;
  currentEnd?: Date;
  chargeAt?: Date; // Next charge date
  startedAt?: Date; // When subscription first activated
  endedAt?: Date; // When subscription ended
  cancelledAt?: Date; // When cancellation was requested
  pausedAt?: Date; // When subscription was paused
  totalCount?: number; // Total billing cycles (null = infinite)
  paidCount: number; // Completed billing cycles
  remainingCount?: number;
  shortUrl?: string; // Razorpay hosted page URL for authorization
  paymentMethod?: PaymentMethod;
  offerId?: string; // If any offer/discount applied
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    razorpaySubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPlanId: {
      type: String,
      required: true,
    },
    razorpayCustomerId: {
      type: String,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ["channel", "course", "workshop", "product"],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "authenticated",
        "active",
        "pending",
        "halted",
        "cancelled",
        "completed",
        "paused",
        "expired",
      ],
      default: "created",
      index: true,
    },
    currentStart: {
      type: Date,
    },
    currentEnd: {
      type: Date,
      index: true,
    },
    chargeAt: {
      type: Date,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    pausedAt: {
      type: Date,
    },
    totalCount: {
      type: Number,
    },
    paidCount: {
      type: Number,
      default: 0,
    },
    remainingCount: {
      type: Number,
    },
    shortUrl: {
      type: String,
    },
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "emandate", "nach", "wallet"],
    },
    offerId: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding user's subscription to an item
SubscriptionSchema.index({ userId: 1, itemType: 1, itemId: 1 });

// Index for finding active subscriptions for a user
SubscriptionSchema.index({ userId: 1, status: 1 });

// Index for finding subscriptions expiring soon (for notifications)
SubscriptionSchema.index({ currentEnd: 1, status: 1 });

// Index for finding subscriptions by charge date (for monitoring)
SubscriptionSchema.index({ chargeAt: 1, status: 1 });

// Index for seller's subscriptions (for analytics)
SubscriptionSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

// Index for organization's subscriptions
SubscriptionSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  SubscriptionSchema
);
