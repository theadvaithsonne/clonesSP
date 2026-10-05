import mongoose, { Schema, Document, Types } from "mongoose";

export type OfficeAddonSubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "paused"
  | "expired";

export type OfficeAddonPaymentMethod = "card" | "upi" | "emandate" | "nach" | "wallet";

export interface IOfficeAddonSubscription extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  founderId: Types.ObjectId; // The founder who subscribed
  addonId: Types.ObjectId; // Reference to OfficeAddon
  // Razorpay fields are optional because some addons (e.g. the invoice-
  // driven whitelabel purchase flow) bypass Razorpay subscriptions
  // entirely. `metadata.source` distinguishes: "razorpay" (legacy) vs
  // "invoice" (new self-serve invoice-based path).
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  razorpayCustomerId?: string;
  status: OfficeAddonSubscriptionStatus;
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
  paymentMethod?: OfficeAddonPaymentMethod;
  offerId?: string; // If any offer/discount applied
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeAddonSubscriptionSchema = new Schema<IOfficeAddonSubscription>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    founderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addonId: {
      type: Schema.Types.ObjectId,
      ref: "OfficeAddon",
      required: true,
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      // Sparse-unique — the invoice-driven whitelabel path omits this
      // entirely. A sparse index skips documents where the field is
      // absent, so multiple invoice-based subs can coexist.
      unique: true,
      sparse: true,
      index: true,
    },
    razorpayPlanId: {
      type: String,
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

// Compound unique index: one subscription per org + addon type
OfficeAddonSubscriptionSchema.index({ orgId: 1, addonId: 1 }, { unique: true });

// Index for finding active subscriptions
OfficeAddonSubscriptionSchema.index({ orgId: 1, status: 1 });

// Index for finding subscriptions expiring soon
OfficeAddonSubscriptionSchema.index({ currentEnd: 1, status: 1 });

// Index for finding subscriptions by founder
OfficeAddonSubscriptionSchema.index({ founderId: 1, status: 1 });

export const OfficeAddonSubscription = mongoose.model<IOfficeAddonSubscription>(
  "OfficeAddonSubscription",
  OfficeAddonSubscriptionSchema
);
