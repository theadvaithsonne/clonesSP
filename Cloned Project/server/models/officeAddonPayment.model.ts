import mongoose, { Schema, Document, Types } from "mongoose";

export type OfficeAddonPaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "refunded"
  | "failed";

export interface IOfficeAddonPayment extends Document {
  _id: Types.ObjectId;
  subscriptionId: Types.ObjectId; // Reference to OfficeAddonSubscription
  addonId: Types.ObjectId; // Reference to OfficeAddon
  orgId: Types.ObjectId;
  founderId: Types.ObjectId;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpayOrderId?: string;
  razorpayInvoiceId?: string;
  invoiceShortUrl?: string; // Public link for viewing/downloading invoice
  amount: number; // In paise
  currency: string;
  status: OfficeAddonPaymentStatus;
  paymentNumber: number; // 1, 2, 3... for billing cycles
  method?: string; // upi, card, wallet, bank, etc.
  cardId?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  fee?: number; // Razorpay fee in paise
  tax?: number; // Tax on Razorpay fee in paise
  paidAt?: Date;
  // Commission tracking
  commissionDistributed: boolean;
  commissionDistributionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeAddonPaymentSchema = new Schema<IOfficeAddonPayment>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "OfficeAddonSubscription",
      required: true,
      index: true,
    },
    addonId: {
      type: Schema.Types.ObjectId,
      ref: "OfficeAddon",
      required: true,
      index: true,
    },
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
    razorpayPaymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayInvoiceId: {
      type: String,
      index: true,
    },
    invoiceShortUrl: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "authorized", "captured", "refunded", "failed"],
      default: "created",
      index: true,
    },
    paymentNumber: {
      type: Number,
      required: true,
    },
    method: {
      type: String,
    },
    cardId: {
      type: String,
    },
    bank: {
      type: String,
    },
    wallet: {
      type: String,
    },
    vpa: {
      type: String,
    },
    fee: {
      type: Number,
    },
    tax: {
      type: Number,
    },
    paidAt: {
      type: Date,
    },
    commissionDistributed: {
      type: Boolean,
      default: false,
    },
    commissionDistributionId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one payment record per subscription + payment number
OfficeAddonPaymentSchema.index(
  { razorpaySubscriptionId: 1, paymentNumber: 1 },
  { unique: true }
);

// Index for finding payments by subscription
OfficeAddonPaymentSchema.index({ subscriptionId: 1, createdAt: -1 });

// Index for finding payments by org
OfficeAddonPaymentSchema.index({ orgId: 1, createdAt: -1 });

// Index for finding undistributed commissions
OfficeAddonPaymentSchema.index({ commissionDistributed: 1, status: 1 });

export const OfficeAddonPayment = mongoose.model<IOfficeAddonPayment>(
  "OfficeAddonPayment",
  OfficeAddonPaymentSchema
);
