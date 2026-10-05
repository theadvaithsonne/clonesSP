import mongoose, { Schema, Document, Types } from "mongoose";

export type SubscriptionPaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded";

export interface ISubscriptionPayment extends Document {
  _id: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpayOrderId?: string;
  razorpayInvoiceId?: string;
  invoiceShortUrl?: string; // Public URL for viewing/downloading invoice
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  sellerId: Types.ObjectId;
  amount: number; // In paise
  currency: string;
  status: SubscriptionPaymentStatus;
  paymentNumber: number; // Which billing cycle (1, 2, 3, ...)
  method?: string; // card, upi, netbanking, etc.
  cardId?: string; // If paid by card
  bank?: string; // If paid via netbanking
  wallet?: string; // If paid via wallet
  vpa?: string; // UPI ID if paid via UPI
  fee?: number; // Razorpay fee in paise
  tax?: number; // Tax on fee in paise
  errorCode?: string;
  errorDescription?: string;
  errorSource?: string;
  errorStep?: string;
  errorReason?: string;
  notes?: Record<string, any>;
  commissionDistributed: boolean; // Whether commission has been distributed
  commissionDistributionId?: Types.ObjectId; // Reference to CommissionDistribution
  paidAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPaymentSchema = new Schema<ISubscriptionPayment>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
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
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "authorized", "captured", "failed", "refunded"],
      default: "created",
      index: true,
    },
    paymentNumber: {
      type: Number,
      required: true,
      min: 1,
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
    errorCode: {
      type: String,
    },
    errorDescription: {
      type: String,
    },
    errorSource: {
      type: String,
    },
    errorStep: {
      type: String,
    },
    errorReason: {
      type: String,
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
    },
    refundedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for subscription payments in order
SubscriptionPaymentSchema.index({ subscriptionId: 1, paymentNumber: 1 });

// Index for user's payment history
SubscriptionPaymentSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Index for seller's received payments
SubscriptionPaymentSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

// Index for organization's payments
SubscriptionPaymentSchema.index({ orgId: 1, status: 1, createdAt: -1 });

// Index for finding payments pending commission distribution
SubscriptionPaymentSchema.index({
  status: 1,
  commissionDistributed: 1,
});

export const SubscriptionPayment = mongoose.model<ISubscriptionPayment>(
  "SubscriptionPayment",
  SubscriptionPaymentSchema
);
