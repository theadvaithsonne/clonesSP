// One document per (run, recipient) for the founder Pro-sub monthly
// volume bonus. Mirrors WhitelabelBonusPayout. Adds a `tier` field to
// record which side of the tiered payout function fired ($24 vs $48
// per sale) for auditability.
//
// Idempotency: unique compound index on {periodKey, userId} — re-run
// upserts. Wallet-side dedupeKey layered on top for the actual money.

import mongoose, { Schema, Document, Types } from "mongoose";

export const FOUNDER_SUB_BONUS_PAYOUT_STATUSES = [
  "pending",
  "paid",
  "failed",
] as const;
export type FounderSubBonusPayoutStatus =
  (typeof FOUNDER_SUB_BONUS_PAYOUT_STATUSES)[number];

export type FounderSubBonusTier = "lower" | "upper";

export interface IFounderSubBonusPayout extends Document {
  runId: Types.ObjectId;
  periodKey: string;
  userId: Types.ObjectId;
  qualifyingSales: number;
  /** "lower" ($24/sale) or "upper" ($48/sale, capped). */
  tier: FounderSubBonusTier;
  /** Sales actually counted toward the bonus (upper tier caps at 100). */
  countedSales: number;
  bonusUsd: number;
  payoutStatus: FounderSubBonusPayoutStatus;
  routedToPlatform: boolean;
  walletTransactionId?: Types.ObjectId;
  paidAt?: Date;
  attempts: number;
  lastError?: string;
  saleInvoiceIds: Types.ObjectId[];
  saleInvoiceIdsTruncated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_PERSISTED_INVOICE_IDS = 200;

const FounderSubBonusPayoutSchema = new Schema<IFounderSubBonusPayout>(
  {
    runId: {
      type: Schema.Types.ObjectId,
      ref: "FounderSubBonusRun",
      required: true,
      index: true,
    },
    periodKey: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}$/,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    qualifyingSales: { type: Number, required: true, min: 0 },
    tier: {
      type: String,
      enum: ["lower", "upper"],
      required: true,
    },
    countedSales: { type: Number, required: true, min: 0 },
    bonusUsd: { type: Number, required: true, min: 0 },
    payoutStatus: {
      type: String,
      enum: FOUNDER_SUB_BONUS_PAYOUT_STATUSES as unknown as string[],
      default: "pending",
      index: true,
    },
    routedToPlatform: { type: Boolean, default: false },
    walletTransactionId: { type: Schema.Types.ObjectId },
    paidAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    saleInvoiceIds: [{ type: Schema.Types.ObjectId }],
    saleInvoiceIdsTruncated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FounderSubBonusPayoutSchema.index(
  { periodKey: 1, userId: 1 },
  { unique: true },
);
FounderSubBonusPayoutSchema.index({ runId: 1, bonusUsd: -1 });

export const FounderSubBonusPayout = mongoose.model<IFounderSubBonusPayout>(
  "FounderSubBonusPayout",
  FounderSubBonusPayoutSchema,
);

export { MAX_PERSISTED_INVOICE_IDS };

/**
 * Wallet-side dedupe key — one credit per (period, recipient) permitted.
 */
export function founderSubMonthlyBonusDedupeKey(
  periodKey: string,
  userId: string,
): string {
  return `founder_sub_monthly_bonus_${periodKey}_${userId}`;
}
