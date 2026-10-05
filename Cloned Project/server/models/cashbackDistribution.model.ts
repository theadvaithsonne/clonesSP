// Cashback distribution ledger — one row per invoice line item that a
// cashback code touched, regardless of whether the cashback actually paid
// out (status="completed"), was skipped because the line type wasn't in the
// code's rates / the line had no level-1 commission (status="skipped"), or
// hit a runtime failure like insufficient creator-wallet balance
// (status="failed"). Mirrors the per-line shape of CommissionDistribution so
// we can drill cashback by product, by buyer, by creator.

import mongoose, { Schema, Document, Types } from "mongoose";
import {
  CASHBACK_PRODUCT_TYPES,
  CashbackProductType,
} from "./cashbackCode.model";

export type CashbackDistributionStatus = "completed" | "skipped" | "failed";

export interface ICashbackDistribution extends Document {
  _id: Types.ObjectId;
  codeId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  invoiceLineItemIndex: number;
  /**
   * Root invoice of a subscription (parentInvoiceId for renewals, self for the
   * first invoice). Used to enforce `code.cycleCount` per buyer-subscription.
   * For one-time items it's just `invoiceId`.
   */
  subscriptionRootId: Types.ObjectId;
  creatorId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerOrgId: Types.ObjectId;
  productType: CashbackProductType;
  itemId?: Types.ObjectId;
  /** Line subtotal in the line's original currency, smallest unit. */
  saleAmountCents: number;
  /** Currency on the line that the cashback amount is denominated in. */
  saleCurrency: string;
  /** Actual level-1 commission percentage that ran on this line (from CD). */
  level1RatePct: number;
  /** The cashback code's configured `ratePct` (one per code). */
  configuredRatePct: number;
  /** What got applied: min(configured, level1). */
  appliedRatePct: number;
  /** Cashback in float USD — wallet currency. */
  cashbackAmount: number;
  /** Cycle number for subscription lines (1 = first cycle). 1 for one-time. */
  cycleNumber: number;
  affiliateTxId?: Types.ObjectId;
  storeTxId?: Types.ObjectId;
  status: CashbackDistributionStatus;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashbackDistributionSchema = new Schema<ICashbackDistribution>(
  {
    codeId: {
      type: Schema.Types.ObjectId,
      ref: "CashbackCode",
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    invoiceLineItemIndex: { type: Number, required: true, min: 0 },
    subscriptionRootId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sellerOrgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    productType: {
      type: String,
      enum: CASHBACK_PRODUCT_TYPES,
      required: true,
    },
    itemId: { type: Schema.Types.ObjectId },
    saleAmountCents: { type: Number, required: true, min: 0 },
    saleCurrency: { type: String, default: "USD" },
    level1RatePct: { type: Number, required: true, min: 0 },
    configuredRatePct: { type: Number, required: true, min: 0 },
    appliedRatePct: { type: Number, required: true, min: 0 },
    cashbackAmount: { type: Number, required: true, min: 0 },
    cycleNumber: { type: Number, required: true, min: 1, default: 1 },
    affiliateTxId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
    storeTxId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
    status: {
      type: String,
      enum: ["completed", "skipped", "failed"],
      required: true,
    },
    failureReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Cycle-count enforcement query: count completed rows per (code, buyer, subscriptionRoot).
CashbackDistributionSchema.index({
  codeId: 1,
  buyerId: 1,
  subscriptionRootId: 1,
});
// Creator dashboard.
CashbackDistributionSchema.index({ creatorId: 1, createdAt: -1 });
// Buyer-side history.
CashbackDistributionSchema.index({ buyerId: 1, createdAt: -1 });

export const CashbackDistribution = mongoose.model<ICashbackDistribution>(
  "CashbackDistribution",
  CashbackDistributionSchema
);
