// src/models/rankQualification.model.ts
//
// One row per qualifying user per period. This is both the audit record ("why
// did this person get $240 in August?") and the payout work queue.
//
// `(periodKey, userId)` is unique — a re-run updates the existing row rather
// than creating a second one. The money itself is guarded separately by
// `metadata.dedupeKey` on the WalletTransaction, so a crash between writing
// this row and crediting the wallet is recoverable from either side.
//
// Amounts are DOLLARS (float), matching the wallet layer.

import mongoose, { Schema, Document, Types } from "mongoose";
import { RANK_KEYS } from "./rankPlan.model";

export const RANK_PAYOUT_STATUSES = [
  "pending",
  "paid",
  "skipped_dry_run",
  "failed",
] as const;
export type RankPayoutStatus = (typeof RANK_PAYOUT_STATUSES)[number];

/** Why this user reached this rank. Enough to answer a support query without a re-run. */
export interface IRankBasis {
  /** The holder's own subscription was active at snapshot time. Always true for a qualifier. */
  selfActive: boolean;
  /** Direct referrals holding an active paid subscription. */
  activeDirects: number;
  /**
   * How many distinct legs contained at least one holder of each rank.
   * e.g. { Bronze: 5, Silver: 2 } — five legs had a Bronze-or-better, two had a
   * Silver-or-better. This is what promoted (or failed to promote) them.
   */
  legsWithRank: Record<string, number>;
  /** Total direct referrals, active or not. Context for "why only 4 active?". */
  totalDirects: number;
}

export interface IRankQualification extends Document {
  runId: Types.ObjectId;
  periodKey: string;
  userId: Types.ObjectId;
  rank: string;
  /** Total owed, including the stacked Bronze. Silver = 240, not 200. */
  bonusUsd: number;
  basis: IRankBasis;
  payoutStatus: RankPayoutStatus;
  /** True when the earner holds no active UP licence, so the money went to the platform. */
  routedToPlatform: boolean;
  /** Proof of payment. Absent means no money moved for this row. */
  walletTransactionId?: Types.ObjectId;
  paidAt?: Date;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BasisSchema = new Schema<IRankBasis>(
  {
    selfActive: { type: Boolean, required: true },
    activeDirects: { type: Number, required: true },
    legsWithRank: { type: Schema.Types.Mixed, default: () => ({}) },
    totalDirects: { type: Number, default: 0 },
  },
  { _id: false }
);

const RankQualificationSchema = new Schema<IRankQualification>(
  {
    runId: { type: Schema.Types.ObjectId, ref: "RankRun", required: true, index: true },
    periodKey: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rank: {
      type: String,
      enum: RANK_KEYS as unknown as string[],
      required: true,
      index: true,
    },
    bonusUsd: { type: Number, required: true, min: 0 },
    basis: { type: BasisSchema, required: true },
    payoutStatus: {
      type: String,
      enum: RANK_PAYOUT_STATUSES as unknown as string[],
      default: "pending",
      index: true,
    },
    routedToPlatform: { type: Boolean, default: false },
    walletTransactionId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    paidAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true }
);

// One qualification per person per month. A re-run upserts onto this.
RankQualificationSchema.index({ periodKey: 1, userId: 1 }, { unique: true });
// The payout loop's work query.
RankQualificationSchema.index({ runId: 1, payoutStatus: 1 });

export const RankQualification = mongoose.model<IRankQualification>(
  "RankQualification",
  RankQualificationSchema
);

/**
 * Idempotency key for the wallet credit. One per person per month, so a replay
 * of any kind — retry, re-run, concurrent replica — collides on the partial
 * unique index at models/walletTransaction.model.ts and is rejected by the DB
 * rather than by application logic.
 */
export function rankBonusDedupeKey(periodKey: string, userId: string): string {
  return `rankbonus_${periodKey}_${userId}`;
}
