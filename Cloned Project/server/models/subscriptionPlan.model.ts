import mongoose, { Schema, Document, Types } from "mongoose";

export type SubscriptionItemType = "channel" | "course" | "workshop" | "product";
export type SubscriptionPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

export interface ISubscriptionPlan extends Document {
  _id: Types.ObjectId;
  razorpayPlanId: string;
  itemType: SubscriptionItemType;
  itemId: Types.ObjectId;
  orgId: Types.ObjectId;
  sellerId: Types.ObjectId; // Content creator/seller
  name: string;
  description?: string;
  amount: number; // In paise (INR)
  currency: string;
  period: SubscriptionPeriod;
  interval: number; // 1 for monthly, 3 for quarterly, etc.
  trialDays?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    razorpayPlanId: {
      type: String,
      required: true,
      unique: true,
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
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 100, // Minimum 1 INR (100 paise)
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "USD",
    },
    period: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      required: true,
    },
    interval: {
      type: Number,
      default: 1,
      min: 1,
    },
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding plan by item
SubscriptionPlanSchema.index({ itemType: 1, itemId: 1, isActive: 1 });

// Index for organization's plans
SubscriptionPlanSchema.index({ orgId: 1, isActive: 1 });

// Index for seller's plans
SubscriptionPlanSchema.index({ sellerId: 1, isActive: 1 });

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>(
  "SubscriptionPlan",
  SubscriptionPlanSchema
);
