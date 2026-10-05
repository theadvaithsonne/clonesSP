// src/models/callPurchase.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

// Intake answer interface - buyer's responses to intake questions
export interface IIntakeAnswer {
  questionId: Types.ObjectId;
  question: string; // Store question text for history
  answerType: "text" | "file";
  textAnswer?: string;
  fileUrl?: string;
  fileName?: string;
}

// Call Purchase interface
export interface ICallPurchase extends Document {
  _id: Types.ObjectId;
  callOfferingId: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;

  // Quantity tracking
  quantityPurchased: number;
  quantityUsed: number;
  quantityScheduled: number; // Calls that have been scheduled
  quantityRemaining: number; // Computed: purchased - used

  // Intake form responses
  intakeAnswers: IIntakeAnswer[];

  // Payment
  isPaid: boolean;
  totalAmount: number;
  currency: string;
  paymentId?: string; // Razorpay payment ID
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  invoiceShortUrl?: string; // Public URL for Razorpay invoice

  // Purchase details
  purchasedAt: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const IntakeAnswerSchema = new Schema<IIntakeAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    question: { type: String, required: true },
    answerType: {
      type: String,
      enum: ["text", "file"],
      required: true,
    },
    textAnswer: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
  },
  { _id: false }
);

const CallPurchaseSchema = new Schema<ICallPurchase>(
  {
    callOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "CallOffering",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Quantity tracking
    quantityPurchased: { type: Number, required: true, min: 1 },
    quantityUsed: { type: Number, default: 0, min: 0 },
    quantityScheduled: { type: Number, default: 0, min: 0 },
    quantityRemaining: { type: Number, default: 0, min: 0 },

    // Intake form responses
    intakeAnswers: [IntakeAnswerSchema],

    // Payment
    isPaid: { type: Boolean, default: false },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    paymentId: { type: String },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    invoiceShortUrl: { type: String },

    // Purchase details
    purchasedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// NOT unique - user can buy multiple times (unlike course enrollment)
CallPurchaseSchema.index({ callOfferingId: 1, userId: 1 });

// Index for user's purchases in org
CallPurchaseSchema.index({ userId: 1, organizationId: 1, purchasedAt: -1 });

// Index for call offering stats
CallPurchaseSchema.index({ callOfferingId: 1, paymentStatus: 1 });

// Index for admin orders view
CallPurchaseSchema.index({ organizationId: 1, createdAt: -1 });

// Pre-save hook to calculate quantityRemaining
CallPurchaseSchema.pre("save", function (next) {
  this.quantityRemaining = this.quantityPurchased - this.quantityUsed;
  next();
});

export const CallPurchase = mongoose.model<ICallPurchase>(
  "CallPurchase",
  CallPurchaseSchema
);
