import mongoose, { Schema, Document, Types } from "mongoose";

export type OfficeUpgradeStatus =
  | "completed" // Upgrade successful - credit added, subscription created
  | "failed"; // Something went wrong

export interface ICreditCalculation {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  upgradeDate: Date;
  totalDaysInCycle: number;
  daysRemaining: number;
  creditAmount: number; // paise (base amount credited to wallet, excluding GST)
}

export interface IOfficeUpgradeHistory extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  founderId: Types.ObjectId;

  // Previous subscription details
  previousSubscriptionId: Types.ObjectId;
  previousRazorpaySubscriptionId: string;
  previousPlanSlug: string;

  // New subscription details
  newSubscriptionId: Types.ObjectId;
  newRazorpaySubscriptionId: string;
  newPlanSlug: string;

  // Credit calculation snapshot
  creditCalculation: ICreditCalculation;

  // Wallet transaction reference
  walletTransactionId: Types.ObjectId;

  status: OfficeUpgradeStatus;
  completedAt: Date;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

const CreditCalculationSchema = new Schema(
  {
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    upgradeDate: { type: Date, required: true },
    totalDaysInCycle: { type: Number, required: true },
    daysRemaining: { type: Number, required: true },
    creditAmount: { type: Number, required: true }, // paise
  },
  { _id: false }
);

const OfficeUpgradeHistorySchema = new Schema<IOfficeUpgradeHistory>(
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
    previousSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "OfficeSubscription",
      required: true,
    },
    previousRazorpaySubscriptionId: {
      type: String,
      required: true,
    },
    previousPlanSlug: {
      type: String,
      required: true,
    },
    newSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "OfficeSubscription",
      required: true,
    },
    newRazorpaySubscriptionId: {
      type: String,
      required: true,
    },
    newPlanSlug: {
      type: String,
      required: true,
    },
    creditCalculation: {
      type: CreditCalculationSchema,
      required: true,
    },
    walletTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "StoreWallet",
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
      index: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OfficeUpgradeHistorySchema.index({ orgId: 1, status: 1 });
OfficeUpgradeHistorySchema.index({ createdAt: -1 });

export const OfficeUpgradeHistory = mongoose.model<IOfficeUpgradeHistory>(
  "OfficeUpgradeHistory",
  OfficeUpgradeHistorySchema
);
