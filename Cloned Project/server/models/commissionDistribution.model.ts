import { Schema, model, Document, Types } from "mongoose";

export interface ICommissionRecipient {
  userId: Types.ObjectId;
  // Upline depth (1 = buyer's direct referrer). 0 for non-upline payees such
  // as a drop creator, who is paid a carve-out of the pool, not a level.
  level: number;
  percentage: number;
  amount: number;
  walletId?: Types.ObjectId;
  transactionId?: Types.ObjectId;
  // Distinguishes a normal upline affiliate from a non-upline payee. Defaults
  // to "upline"; "drop_creator" is the drop-attribution carve-out.
  role?: "upline" | "drop_creator";
}

export interface ICommissionDistribution extends Document {
  _id: Types.ObjectId;
  combPlanId: Types.ObjectId;
  orgId: Types.ObjectId;
  sellerId: Types.ObjectId;
  customerId: Types.ObjectId;
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: Types.ObjectId;
  itemName: string;
  saleAmount: number;
  currency: string;
  platformFeePercentage: number;
  platformFeeAmount: number;
  netAmount: number;
  sellerAmount: number;
  commissions: ICommissionRecipient[];
  totalCommissionAmount: number;
  paymentId?: string;
  status: "pending" | "completed" | "failed" | "reversed";
  failureReason?: string;
  isRecurringPayment: boolean;
  recurringPaymentNumber?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CommissionRecipientSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    level: {
      type: Number,
      required: true,
      // 0 allowed for non-upline payees (e.g. drop creator carve-out).
      min: 0,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "AffiliateWallet",
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
    role: {
      type: String,
      enum: ["upline", "drop_creator"],
      default: "upline",
    },
  },
  { _id: false }
);

const CommissionDistributionSchema = new Schema(
  {
    combPlanId: {
      type: Schema.Types.ObjectId,
      ref: "CombPlan",
      index: true,
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ["course", "product", "channel", "workshop", "service", "call", "event"],
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    saleAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    platformFeePercentage: {
      type: Number,
      required: true,
      default: 5,
    },
    platformFeeAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    sellerAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissions: {
      type: [CommissionRecipientSchema],
      default: [],
    },
    totalCommissionAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paymentId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "pending",
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    isRecurringPayment: {
      type: Boolean,
      default: false,
    },
    recurringPaymentNumber: {
      type: Number,
      min: 1,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
CommissionDistributionSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
CommissionDistributionSchema.index({ customerId: 1, createdAt: -1 });
CommissionDistributionSchema.index({ orgId: 1, itemType: 1, createdAt: -1 });
CommissionDistributionSchema.index({ "commissions.userId": 1, createdAt: -1 });
CommissionDistributionSchema.index({ itemType: 1, itemId: 1, createdAt: -1 });

// Unique index to prevent duplicate commission distributions for the same payment
// sparse: true allows multiple null paymentIds (for legacy/manual distributions)
CommissionDistributionSchema.index(
  { paymentId: 1, itemType: 1, itemId: 1 },
  { unique: true, sparse: true }
);

export const CommissionDistribution = model<ICommissionDistribution>(
  "CommissionDistribution",
  CommissionDistributionSchema
);
