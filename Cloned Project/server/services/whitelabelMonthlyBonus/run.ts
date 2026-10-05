// Orchestrator for the monthly whitelabel volume bonus.
//
// Two entry points:
//   • `whitelabelMonthlyBonusTick()` — called hourly by the in-process
//     cron in index.ts. No-op if the last-closed period is already paid.
//   • `executeWhitelabelMonthlyBonusRun(periodKey, opts)` — admin +
//     cron backstop entry point. Guarded by cronLease.
//
// Money only moves when WHITELABEL_MONTHLY_BONUS_ENABLED === "true".
// Default OFF — lets us deploy code, verify dry-runs, then flip live.
//
// Mirrors the rank-bonus orchestrator's status transitions:
//   computing → computed → (paying → paid) | failed
// A dry-run stops at "computed" and never enters "paying".

import { Types } from "mongoose";
import { acquireLease, releaseLease } from "../cronLease";
import {
  WhitelabelBonusRun,
  IWhitelabelBonusRun,
  periodKeyFor,
  previousPeriodKeyFor,
  periodBoundsFor,
  emptyTotals,
} from "../../models/whitelabelBonusRun.model";
import { WhitelabelBonusPayout } from "../../models/whitelabelBonusPayout.model";
import { qualifyForPeriod } from "./qualify";
import { payRunPayouts } from "./payout";
import { WHITELABEL_ADDON } from "../../config/whitelabelAddon";

const JOB_NAME = "whitelabel-monthly-bonus";
const LEASE_TTL_MS = 30 * 60 * 1000;

export function payoutsEnabled(): boolean {
  return process.env.WHITELABEL_MONTHLY_BONUS_ENABLED === "true";
}

export interface RunOptions {
  dryRun?: boolean;
  triggeredBy?: string; // "cron" | admin email
}

export interface RunOutcome {
  run: IWhitelabelBonusRun;
  qualifiedReferrers: number;
  paidUsd: number;
  routedToPlatformUsd: number;
  failed: number;
  skipped?: "already_paid" | "not_yet_eligible" | "lease_held" | "disabled";
}

/**
 * Execute or preview the run for a given period. Idempotent: refuses
 * to move money on a period that's already `status:"paid"` unless the
 * caller asks for a dry run (which never touches wallets anyway).
 */
export async function executeWhitelabelMonthlyBonusRun(
  periodKey: string,
  opts: RunOptions = {},
): Promise<RunOutcome> {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error(
      `Invalid periodKey: "${periodKey}" (expected "YYYY-MM")`,
    );
  }

  // Floor — deploy-day safety.
  const floor = WHITELABEL_ADDON.monthlyVolumeBonus.firstEligiblePeriod;
  if (periodKey < floor) {
    throw new Error(
      `Period ${periodKey} is before firstEligiblePeriod ${floor}`,
    );
  }

  // Refuse to settle a still-open month. `periodKey` must be strictly
  // in the past (bounds' endExclusive ≤ now).
  const { endExclusive } = periodBoundsFor(periodKey);
  if (endExclusive > new Date() && !opts.dryRun) {
    throw new Error(
      `Period ${periodKey} has not closed yet — cannot settle in real-run mode`,
    );
  }

  const dryRun = !!opts.dryRun;
  const triggeredBy = opts.triggeredBy || "cron";

  // Refuse a paid, non-dry re-run outright (before taking the lease).
  const existingPaid = await WhitelabelBonusRun.findOne({
    periodKey,
    status: "paid",
    dryRun: false,
  }).lean();
  if (existingPaid && !dryRun) {
    const err: any = new Error(
      `Run for period ${periodKey} is already paid — refuse to re-execute`,
    );
    err.statusCode = 409;
    throw err;
  }

  const leaseId = await acquireLease(JOB_NAME, LEASE_TTL_MS);
  if (!leaseId) {
    const err: any = new Error(
      `Another whitelabel-monthly-bonus run holds the lease — try again in ~30 min`,
    );
    err.statusCode = 423;
    throw err;
  }

  try {
    const now = new Date();
    const run = await WhitelabelBonusRun.findOneAndUpdate(
      { periodKey },
      {
        $set: {
          status: "computing",
          dryRun,
          snapshotAt: endExclusive,
          startedAt: now,
          triggeredBy,
          error: undefined,
        },
        $setOnInsert: { totals: emptyTotals() },
      },
      { upsert: true, new: true },
    );

    // ── Compute qualifiers + upsert Payout rows. ────────────────────
    const { qualifiers, totalsSeed } = await qualifyForPeriod(periodKey);

    // Fresh run may be a re-run of a prior computed doc; wipe old rows
    // for this run before writing new ones so removed qualifiers don't
    // linger. Keep the doc's `attempts` history via findOneAndUpdate
    // (upsert) instead of insert.
    await WhitelabelBonusPayout.deleteMany({
      runId: run._id,
      payoutStatus: { $in: ["pending", "failed"] },
    });

    for (const q of qualifiers) {
      await WhitelabelBonusPayout.findOneAndUpdate(
        { periodKey, userId: new Types.ObjectId(q.userId) },
        {
          $set: {
            runId: run._id,
            qualifyingSales: q.qualifyingSales,
            bonusUsd: q.bonusUsd,
            saleInvoiceIds: q.saleInvoiceIds,
            saleInvoiceIdsTruncated: q.saleInvoiceIdsTruncated,
          },
          $setOnInsert: {
            payoutStatus: "pending",
            attempts: 0,
            routedToPlatform: false,
          },
        },
        { upsert: true, new: true },
      );
    }

    run.status = "computed";
    run.computedAt = new Date();
    run.totals = {
      ...emptyTotals(),
      ...totalsSeed,
    };
    await run.save();

    if (dryRun || !payoutsEnabled()) {
      // Preview or gated-off — leave payouts as `pending`, don't move money.
      return {
        run,
        qualifiedReferrers: totalsSeed.qualifiedReferrers,
        paidUsd: 0,
        routedToPlatformUsd: 0,
        failed: 0,
        skipped: dryRun ? undefined : "disabled",
      };
    }

    // ── Pay. ─────────────────────────────────────────────────────────
    run.status = "paying";
    await run.save();

    const summary = await payRunPayouts(run._id as Types.ObjectId, periodKey);

    run.status = summary.failed > 0 && summary.paid === 0 ? "failed" : "paid";
    run.paidAt = new Date();
    run.totals = {
      ...run.totals,
      paidUsd: Math.round(summary.paidUsd * 100) / 100,
      routedToPlatformUsd:
        Math.round(summary.routedToPlatformUsd * 100) / 100,
      failed: summary.failed,
    };
    await run.save();

    return {
      run,
      qualifiedReferrers: totalsSeed.qualifiedReferrers,
      paidUsd: summary.paidUsd,
      routedToPlatformUsd: summary.routedToPlatformUsd,
      failed: summary.failed,
    };
  } catch (err: any) {
    await WhitelabelBonusRun.updateOne(
      { periodKey },
      {
        $set: {
          status: "failed",
          error: err?.message || String(err),
        },
      },
    ).catch(() => {});
    throw err;
  } finally {
    await releaseLease(JOB_NAME, leaseId).catch(() => {});
  }
}

/**
 * Hourly cron entry. Settles the last-closed month; no-op if that
 * period is already `paid`.
 */
export async function whitelabelMonthlyBonusTick(): Promise<
  RunOutcome | { skipped: RunOutcome["skipped"] }
> {
  const now = new Date();
  const periodKey = previousPeriodKeyFor(now);

  const floor = WHITELABEL_ADDON.monthlyVolumeBonus.firstEligiblePeriod;
  if (periodKey < floor) {
    return { skipped: "not_yet_eligible" };
  }

  const existing = await WhitelabelBonusRun.findOne({
    periodKey,
    status: "paid",
    dryRun: false,
  })
    .select({ _id: 1 })
    .lean();
  if (existing) return { skipped: "already_paid" };

  return executeWhitelabelMonthlyBonusRun(periodKey, {
    dryRun: false,
    triggeredBy: "cron",
  });
}

/** Convenience for the admin `/current` endpoint. */
export function currentPeriodKeys(): {
  accruing: string;
  settling: string;
} {
  const now = new Date();
  return {
    accruing: periodKeyFor(now),
    settling: previousPeriodKeyFor(now),
  };
}
