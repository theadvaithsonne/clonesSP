// One document per monthly founder Pro-sub volume-bonus run. Mirrors
// WhitelabelBonusRun in shape (status flow, totals, unique periodKey)
// so admin UIs stay familiar. Sibling models — not shared with the
// whitelabel/cryptosub bonuses because qualifier logic + amount function
// differ (tiered instead of flat).
//
// Amounts are DOLLARS (float).

import mongoose, { Schema, Document } from "mongoose";

export const FOUNDER_SUB_BONUS_RUN_STATUSES = [
  "computing",
  "computed",
  "paying",
  "paid",
  "failed",
] as const;
export type FounderSubBonusRunStatus =
  (typeof FOUNDER_SUB_BONUS_RUN_STATUSES)[number];

export interface IFounderSubBonusRunTotals {
  /** Distinct direct-referrers with ≥1 qualifying sale (any count). */
  evaluatedReferrers: number;
  /** Referrers who cleared the lower threshold and get paid. */
  qualifiedReferrers: number;
  /** Sum of qualifying sales across all paid referrers. */
  qualifyingSales: number;
  /** What the run owes, before any payment is attempted. */
  bonusUsd: number;
  paidUsd: number;
  routedToPlatformUsd: number;
  failed: number;
}

export interface IFounderSubBonusRun extends Document {
  periodKey: string;
  status: FounderSubBonusRunStatus;
  dryRun: boolean;
  snapshotAt: Date;
  startedAt: Date;
  computedAt?: Date;
  paidAt?: Date;
  totals: IFounderSubBonusRunTotals;
  error?: string;
  triggeredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TotalsSchema = new Schema<IFounderSubBonusRunTotals>(
  {
    evaluatedReferrers: { type: Number, default: 0 },
    qualifiedReferrers: { type: Number, default: 0 },
    qualifyingSales: { type: Number, default: 0 },
    bonusUsd: { type: Number, default: 0 },
    paidUsd: { type: Number, default: 0 },
    routedToPlatformUsd: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false },
);

const FounderSubBonusRunSchema = new Schema<IFounderSubBonusRun>(
  {
    periodKey: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}$/,
    },
    status: {
      type: String,
      enum: FOUNDER_SUB_BONUS_RUN_STATUSES as unknown as string[],
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
  { timestamps: true },
);

FounderSubBonusRunSchema.index({ createdAt: -1 });

export const FounderSubBonusRun = mongoose.model<IFounderSubBonusRun>(
  "FounderSubBonusRun",
  FounderSubBonusRunSchema,
);

/** "YYYY-MM" for the month containing `d`. */
export function periodKeyFor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousPeriodKeyFor(d: Date): string {
  return periodKeyFor(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)),
  );
}

export function periodBoundsFor(periodKey: string): {
  start: Date;
  endExclusive: Date;
} {
  const [y, m] = periodKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const endExclusive = new Date(Date.UTC(y, m, 1));
  return { start, endExclusive };
}

export function emptyTotals(): IFounderSubBonusRunTotals {
  return {
    evaluatedReferrers: 0,
    qualifiedReferrers: 0,
    qualifyingSales: 0,
    bonusUsd: 0,
    paidUsd: 0,
    routedToPlatformUsd: 0,
    failed: 0,
  };
}
