// One document per monthly whitelabel-volume-bonus run. `periodKey`
// ("2026-08") is unique so a second attempt at the same month reuses
// the existing run doc rather than creating a parallel one — the first
// line of re-run defence. The second is the dedupeKey on each
// WalletTransaction (see `whitelabelMonthlyBonusDedupeKey` in
// WhitelabelBonusPayout).
//
// Mirrors the shape of RankRun on purpose so admin queries + status
// enums stay familiar. Sibling models (not shared) because the
// qualifier logic is completely different (invoice aggregation vs
// tree traversal at snapshot).
//
// Amounts are DOLLARS (float), matching the wallet layer.

import mongoose, { Schema, Document } from "mongoose";

export const WHITELABEL_BONUS_RUN_STATUSES = [
  "computing",
  "computed",
  "paying",
  "paid",
  "failed",
] as const;
export type WhitelabelBonusRunStatus =
  (typeof WHITELABEL_BONUS_RUN_STATUSES)[number];

export interface IWhitelabelBonusRunTotals {
  /** Distinct direct-referrers who had ≥1 qualifying sale (any count). */
  evaluatedReferrers: number;
  /** Referrers who cleared the threshold and get paid. */
  qualifiedReferrers: number;
  /** Sum of qualifying sales across all paid referrers. */
  qualifyingSales: number;
  /** What the run owes, before any payment is attempted. */
  bonusUsd: number;
  /** Actually credited (AffiliateWallet or platform, but not failed). */
  paidUsd: number;
  /** Credited but routed to Shorupan's platform (earner UP-unactivated). */
  routedToPlatformUsd: number;
  failed: number;
}

export interface IWhitelabelBonusRun extends Document {
  /** "YYYY-MM" — the month this run pays for. */
  periodKey: string;
  status: WhitelabelBonusRunStatus;
  /**
   * True when WHITELABEL_MONTHLY_BONUS_ENABLED was off OR the admin
   * asked for a preview. The run computed and stored everything but
   * moved no money.
   */
  dryRun: boolean;
  /** Snapshot instant — end of the settled month (exclusive). */
  snapshotAt: Date;
  startedAt: Date;
  computedAt?: Date;
  paidAt?: Date;
  totals: IWhitelabelBonusRunTotals;
  error?: string;
  triggeredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TotalsSchema = new Schema<IWhitelabelBonusRunTotals>(
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

const WhitelabelBonusRunSchema = new Schema<IWhitelabelBonusRun>(
  {
    periodKey: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}$/,
    },
    status: {
      type: String,
      enum: WHITELABEL_BONUS_RUN_STATUSES as unknown as string[],
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

WhitelabelBonusRunSchema.index({ createdAt: -1 });

export const WhitelabelBonusRun = mongoose.model<IWhitelabelBonusRun>(
  "WhitelabelBonusRun",
  WhitelabelBonusRunSchema,
);

/** "2026-08" for the month containing `d`. */
export function periodKeyFor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The month BEFORE the one containing `d` — the period a run executed
 * on `d` settles. A month is only payable once it has closed: a job
 * that fires on 1 September pays for August.
 */
export function previousPeriodKeyFor(d: Date): string {
  return periodKeyFor(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)),
  );
}

/** [startInclusive, endExclusive) UTC bounds for a `YYYY-MM` key. */
export function periodBoundsFor(periodKey: string): {
  start: Date;
  endExclusive: Date;
} {
  const [y, m] = periodKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const endExclusive = new Date(Date.UTC(y, m, 1));
  return { start, endExclusive };
}

/** Empty totals — kept alongside the constructor so admin API shape is stable. */
export function emptyTotals(): IWhitelabelBonusRunTotals {
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
