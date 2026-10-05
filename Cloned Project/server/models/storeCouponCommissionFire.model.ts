// Per-fire counter for StoreCouponCommission rules that opt into
// `capType: "per_pair_capped"`. One row per successful cascade fire
// (per (rule, level, recipient, buyer, invoice)). The cap enforcement
// in `evaluateStoreCommissionsForInvoice` does a `countDocuments` on
// `{ ruleId, recipientId, buyerId }` before running each level.
//
// Perpetual rules DO NOT insert rows here — the counter is only meant
// for the enforcement query. Keeping the collection lean means the
// cap query stays cheap even at scale.
//
// Analogous to how CombPlan piggybacks on the existing
// `CommissionDistribution` collection for its cap check, except the
// coupon side has no equivalent ledger (grants merge into
// `CouponAssignment.availableUses` and lose per-fire granularity),
// so a dedicated tiny collection is the cleanest option.

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStoreCouponCommissionFire extends Document {
  _id: Types.ObjectId;
  ruleId: Types.ObjectId;
  orgId: Types.ObjectId;
  level: number;
  recipientId: Types.ObjectId;
  buyerId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  couponId: Types.ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const StoreCouponCommissionFireSchema =
  new Schema<IStoreCouponCommissionFire>(
    {
      ruleId: {
        type: Schema.Types.ObjectId,
        ref: "StoreCouponCommission",
        required: true,
        index: true,
      },
      orgId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
      },
      level: { type: Number, required: true, min: 1 },
      recipientId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      buyerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      invoiceId: {
        type: Schema.Types.ObjectId,
        ref: "Invoice",
        required: true,
      },
      couponId: {
        type: Schema.Types.ObjectId,
        ref: "PlatformCoupon",
        required: true,
      },
      quantity: { type: Number, required: true, min: 1 },
    },
    { timestamps: true },
  );

// Cap-count hot path — the enforcement query.
StoreCouponCommissionFireSchema.index({
  ruleId: 1,
  recipientId: 1,
  buyerId: 1,
});

// Race backstop — one fire per (rule, invoice, recipient). Prevents
// the cap counter from advancing twice if the outer
// `invoice.metadata.storeCommissionsFiredAt` guard is ever bypassed
// (webhook double-fire beating the marker write, manual re-run, etc.).
StoreCouponCommissionFireSchema.index(
  { ruleId: 1, invoiceId: 1, recipientId: 1 },
  { unique: true },
);

// Admin drill-down: recent fires by org.
StoreCouponCommissionFireSchema.index({ orgId: 1, createdAt: -1 });

export const StoreCouponCommissionFire = mongoose.model<IStoreCouponCommissionFire>(
  "StoreCouponCommissionFire",
  StoreCouponCommissionFireSchema,
);
