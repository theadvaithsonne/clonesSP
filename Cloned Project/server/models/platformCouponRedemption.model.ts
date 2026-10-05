import mongoose, { Schema, Document, Types } from "mongoose";
import type {
  PlatformCouponProductType,
  PlatformCouponDiscountType,
} from "./platformCoupon.model";

export type PlatformCouponRedemptionStatus = "active" | "exhausted" | "cancelled";

export interface IPlatformCouponRedemption extends Document {
  _id: Types.ObjectId;
  couponId: Types.ObjectId;
  couponCode: string;
  userId: Types.ObjectId;
  productType: PlatformCouponProductType;
  parentInvoiceId?: Types.ObjectId; // subscription products
  invoiceId?: Types.ObjectId; // one-time products (unilevel_plus)
  cycleCount: number; // snapshot; 1 for unilevel_plus
  cyclesApplied: number;
  discountType: PlatformCouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  currency: "USD" | "INR";
  status: PlatformCouponRedemptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformCouponRedemptionSchema = new Schema<IPlatformCouponRedemption>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "PlatformCoupon",
      required: true,
      index: true,
    },
    couponCode: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productType: {
      type: String,
      enum: [
        "office_plan",
        "unilevel_plus",
        "third_party_subscription",
        "channel",
        "course",
        "workshop",
        "product",
        "service",
        "call",
        "franchise_program",
        "franchise_territory",
      ],
      required: true,
    },
    parentInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    cycleCount: { type: Number, required: true, default: 1, min: 1 },
    cyclesApplied: { type: Number, required: true, default: 0, min: 0 },
    discountType: { type: String, enum: ["fixed", "percent"], required: true },
    discountValue: { type: Number, required: true },
    maxDiscountAmount: { type: Number },
    currency: { type: String, enum: ["USD", "INR"], default: "USD", required: true },
    status: {
      type: String,
      enum: ["active", "exhausted", "cancelled"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

// One redemption per invoice (one-time products)
PlatformCouponRedemptionSchema.index(
  { invoiceId: 1 },
  { unique: true, sparse: true }
);
// Per-user usage lookup
PlatformCouponRedemptionSchema.index({ userId: 1, couponId: 1 });

export const PlatformCouponRedemption =
  mongoose.model<IPlatformCouponRedemption>(
    "PlatformCouponRedemption",
    PlatformCouponRedemptionSchema
  );
