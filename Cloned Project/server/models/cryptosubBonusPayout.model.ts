// One document per (run, recipient) — the concrete "user X gets
// $qualifyingSales*150 for month Y" row. Mirrors RankQualification's
// shape but simpler (no rank / basis / tier fields; the bonus is a
// flat function of sale count).
//
// Idempotency: unique compound index on {periodKey, userId} — so a
// re-run for the same month upserts these rows instead of duplicating
// them. The wallet-side dedupeKey below is layered on top for the
// actual money.

import mongoose, { Schema, Document, Types } from "mongoose";

export const CRYPTOSUB_BONUS_PAYOUT_STATUSES = [
  "pending",
  "paid",
  "failed",
] as const;
export type CryptosubBonusPayoutStatus =
  (typeof CRYPTOSUB_BONUS_PAYOUT_STATUSES)[number];

export interface ICryptosubBonusPayout extends Document {
  runId: Types.ObjectId;
  /** "YYYY-MM" — denormalized from the run doc for cheap queries. */
  periodKey: string;
  /** The direct referrer being paid. */
  userId: Types.ObjectId;
  /** Number of NEW-activation cryptosub invoices this referrer had in the month. */
  qualifyingSales: number;
  /** `qualifyingSales * (bonusPerSaleUsdCents / 100)`. */
  bonusUsd: number;
  payoutStatus: CryptosubBonusPayoutStatus;
  /** True when the credit landed on Shorupan's platform StoreWallet (UP-lock). */
  routedToPlatform: boolean;
  walletTransactionId?: Types.ObjectId;
  paidAt?: Date;
  attempts: number;
  lastError?: string;
  /**
   * The invoice IDs that counted toward this row. Capped at 200 to
   * keep the doc small on super-affiliate months; `saleInvoiceIdsTruncated`
   * flags when clipping happened.
   */
  saleInvoiceIds: Types.ObjectId[];
  saleInvoiceIdsTruncated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_PERSISTED_INVOICE_IDS = 200;

const CryptosubBonusPayoutSchema = new Schema<ICryptosubBonusPayout>(
  {
    runId: {
      type: Schema.Types.ObjectId,
      ref: "CryptosubBonusRun",
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
    bonusUsd: { type: Number, required: true, min: 0 },
    payoutStatus: {
      type: String,
      enum: CRYPTOSUB_BONUS_PAYOUT_STATUSES as unknown as string[],
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

// One row per (period, referrer) — re-runs upsert.
CryptosubBonusPayoutSchema.index(
  { periodKey: 1, userId: 1 },
  { unique: true },
);

// Admin drill-down: list all payouts in a run, ordered by size.
CryptosubBonusPayoutSchema.index({ runId: 1, bonusUsd: -1 });

export const CryptosubBonusPayout = mongoose.model<ICryptosubBonusPayout>(
  "CryptosubBonusPayout",
  CryptosubBonusPayoutSchema,
);

export { MAX_PERSISTED_INVOICE_IDS };

/**
 * Wallet-side dedupe key. Uniquely identifies "the $X credit for user U
 * for month M". Guarded by the partial unique index on
 * WalletTransaction.metadata.dedupeKey. Same shape as the rank bonus
 * for consistency.
 */
export function cryptosubMonthlyBonusDedupeKey(
  periodKey: string,
  userId: string,
): string {
  return `cryptosub_monthly_bonus_${periodKey}_${userId}`;
}
