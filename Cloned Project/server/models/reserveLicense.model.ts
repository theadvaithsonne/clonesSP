import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReserveLicense extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  invoiceNumber: string;
  planId: Types.ObjectId;
  distributionId: Types.ObjectId;
  purchasePaymentId: string;
  status: "available" | "assigned" | "expired";
  assignedTo?: Types.ObjectId;
  assignedAt?: Date;
  purchaseId?: Types.ObjectId;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReserveLicenseSchema = new Schema<IReserveLicense>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "UnilevelPlusPlan",
      required: true,
    },
    distributionId: {
      type: Schema.Types.ObjectId,
      ref: "UnilevelPlusDistribution",
      required: true,
    },
    purchasePaymentId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["available", "assigned", "expired"],
      default: "available",
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: {
      type: Date,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "UnilevelPlusPurchase",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// User's available licenses
ReserveLicenseSchema.index({ userId: 1, status: 1 });

// Licenses assigned to a specific user
ReserveLicenseSchema.index({ assignedTo: 1 });

export const ReserveLicense = mongoose.model<IReserveLicense>(
  "ReserveLicense",
  ReserveLicenseSchema
);
