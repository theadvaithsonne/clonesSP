import mongoose, { Schema, Document, Types } from "mongoose";

export type OfficePaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "refunded"
  | "failed";

export interface IOfficeSubscriptionPayment extends Document {
  _id: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  orgId: Types.ObjectId;
  founderId: Types.ObjectId;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpayOrderId?: string;
  razorpayInvoiceId?: string;
  invoiceShortUrl?: string; // Public URL for viewing/downloading invoice
  amount: number; // In paise
  currency: string;
  status: OfficePaymentStatus;
  paymentNumber: number; // 1, 2, 3... (which billing cycle)
  method?: string;
  cardId?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  fee?: number;
  tax?: number;
  notes?: Record<string, any>;
  commissionDistributed: boolean;
  commissionDistributionId?: Types.ObjectId;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeSubscriptionPaymentSchema = new Schema<IOfficeSubscriptionPayment>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "OfficeSubscription",
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
    },
    razorpayInvoiceId: {
      type: String,
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
    notes: {
      type: Schema.Types.Mixed,
    },
    commissionDistributed: {
      type: Boolean,
      default: false,
    },
    commissionDistributionId: {
      type: Schema.Types.ObjectId,
      ref: "CommissionDistribution",
    },
    paidAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index for subscription + payment number (prevent duplicate recordings)
OfficeSubscriptionPaymentSchema.index(
  { subscriptionId: 1, paymentNumber: 1 },
  { unique: true }
);

// Index for finding payments by status
OfficeSubscriptionPaymentSchema.index({ status: 1, createdAt: -1 });

// Index for commission distribution queries
OfficeSubscriptionPaymentSchema.index({ commissionDistributed: 1, status: 1 });

export const OfficeSubscriptionPayment = mongoose.model<IOfficeSubscriptionPayment>(
  "OfficeSubscriptionPayment",
  OfficeSubscriptionPaymentSchema
);
