// src/models/rankRun.model.ts
//
// One document per monthly rank-bonus run. `periodKey` ("2026-08") is unique,
// so a second attempt at the same month reuses the existing run rather than
// creating a parallel one — the first line of re-run defence. The second is the
// dedupeKey on each WalletTransaction.
//
// Amounts are DOLLARS (float), matching the wallet layer.

import mongoose, { Schema, Document, Types } from "mongoose";
import { RANK_KEYS } from "./rankPlan.model";

export const RANK_RUN_STATUSES = [
  "computing",
  "computed",
  "paying",
  "paid",
  "failed",
] as const;
export type RankRunStatus = (typeof RANK_RUN_STATUSES)[number];

export interface IRankRunTotals {
  /** Users with an active PAID subscription at snapshot time. */
  activeSubscribers: number;
  /** Users examined (the whole tree). */
  evaluated: number;
  qualified: number;
  /** Headcount per rank — keys are RANK_KEYS. */
  byRank: Record<string, number>;
  /** What the run owes, before any payment is attempted. */
  bonusUsd: number;
  /** Actually credited to affiliate wallets. */
  paidUsd: number;
  /** Credited but routed to the platform (earner has no active UP licence). */
  routedToPlatformUsd: number;
  failed: number;
}

export interface IRankRun extends Document {
  /** "YYYY-MM" — the month this run pays for. */
  periodKey: string;
  planVersion: number;
  status: RankRunStatus;
  /**
   * True when RANK_BONUS_PAYOUTS_ENABLED was off. The run computed and stored
   * everything but moved no money. Recorded per-run so a dry month is
   * self-evident later.
   */
  dryRun: boolean;
  /** Snapshot instant. Eligibility is "active at this moment", not over a window. */
  snapshotAt: Date;
  startedAt: Date;
  computedAt?: Date;
  paidAt?: Date;
  totals: IRankRunTotals;
  error?: string;
  triggeredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TotalsSchema = new Schema<IRankRunTotals>(
  {
    activeSubscribers: { type: Number, default: 0 },
    evaluated: { type: Number, default: 0 },
    qualified: { type: Number, default: 0 },
    byRank: { type: Schema.Types.Mixed, default: () => ({}) },
    bonusUsd: { type: Number, default: 0 },
    paidUsd: { type: Number, default: 0 },
    routedToPlatformUsd: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false }
);

const RankRunSchema = new Schema<IRankRun>(
  {
    periodKey: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}$/,
    },
    planVersion: { type: Number, required: true },
    status: {
      type: String,
      enum: RANK_RUN_STATUSES as unknown as string[],
      default: "computing",
      index: true,
    },
    dryRun: { type: Boolean, required: true },
    snapshotAt: { type: Date, required: true },
    startedAt: { type: Date, required: true },
    computedAt: { type: Date },
    paidAt: { type: Date },
    totals: { type: TotalsSchema, default: () => ({}) },
    error: { type: String },
    triggeredBy: { type: String },
  },
  { timestamps: true }
);

RankRunSchema.index({ createdAt: -1 });

export const RankRun = mongoose.model<IRankRun>("RankRun", RankRunSchema);

/** "2026-08" for the month containing `d`. */
export function periodKeyFor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The month BEFORE the one containing `d` — the period a run executed on `d`
 * settles. A month is only payable once it has closed, so the job that fires on
 * 1 September pays for August.
 *
 * Date.UTC normalises month -1, so January correctly rolls back to December of
 * the previous year.
 */
export function previousPeriodKeyFor(d: Date): string {
  return periodKeyFor(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  );
}

/** Empty totals with every rank key present, so the admin API shape is stable. */
export function emptyTotals(): IRankRunTotals {
  const byRank: Record<string, number> = {};
  for (const k of RANK_KEYS) byRank[k] = 0;
  return {
    activeSubscribers: 0,
    evaluated: 0,
    qualified: 0,
    byRank,
    bonusUsd: 0,
    paidUsd: 0,
    routedToPlatformUsd: 0,
    failed: 0,
  };
}
