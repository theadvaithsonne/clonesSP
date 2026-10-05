import mongoose, { Schema, Document, Types } from "mongoose";

export type OfficeSubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "paused"
  | "expired"
  | "trial";

export type OfficePaymentMethod = "card" | "upi" | "emandate" | "nach" | "wallet";

export interface IOfficeSubscription extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  founderId: Types.ObjectId; // The founder who subscribed
  planId: Types.ObjectId;
  razorpaySubscriptionId?: string; // Optional for trials (no Razorpay during trial)
  razorpayPlanId: string;
  razorpayCustomerId?: string;
  status: OfficeSubscriptionStatus;
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
  paymentMethod?: OfficePaymentMethod;
  offerId?: string; // If any offer/discount applied
  metadata?: Record<string, any>;
  // Trial fields
  isTrial: boolean;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  trialExpired?: boolean;
  convertedFromTrial?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeSubscriptionSchema = new Schema<IOfficeSubscription>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true, // One subscription per organization
      index: true,
    },
    founderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "OfficePlan",
      required: true,
    },
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true, // Allow nulls for trials while maintaining uniqueness
      index: true,
    },
    razorpayPlanId: {
      type: String,
      required: false,
    },
    razorpayCustomerId: {
      type: String,
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
        "trial",
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
    // Trial fields
    isTrial: {
      type: Boolean,
      default: false,
      index: true,
    },
    trialStartedAt: {
      type: Date,
    },
    trialEndsAt: {
      type: Date,
      index: true,
    },
    trialExpired: {
      type: Boolean,
      default: false,
    },
    convertedFromTrial: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active subscriptions
OfficeSubscriptionSchema.index({ orgId: 1, status: 1 });

// Index for finding subscriptions expiring soon
OfficeSubscriptionSchema.index({ currentEnd: 1, status: 1 });

// Index for finding subscriptions by founder
OfficeSubscriptionSchema.index({ founderId: 1, status: 1 });

export const OfficeSubscription = mongoose.model<IOfficeSubscription>(
  "OfficeSubscription",
  OfficeSubscriptionSchema
);
