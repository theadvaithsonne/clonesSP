// Orchestrator for the monthly founder Pro-sub volume bonus.
// Mirrors whitelabelMonthlyBonus/run.ts.

import { Types } from "mongoose";
import { acquireLease, releaseLease } from "../cronLease";
import {
  FounderSubBonusRun,
  IFounderSubBonusRun,
  periodKeyFor,
  previousPeriodKeyFor,
  periodBoundsFor,
  emptyTotals,
} from "../../models/founderSubBonusRun.model";
import { FounderSubBonusPayout } from "../../models/founderSubBonusPayout.model";
import { qualifyForPeriod } from "./qualify";
import { payRunPayouts } from "./payout";
import { FOUNDER_SUB_BONUS } from "../../config/founderSubBonus";

const JOB_NAME = "founder-sub-monthly-bonus";
const LEASE_TTL_MS = 30 * 60 * 1000;

export function payoutsEnabled(): boolean {
  return process.env[FOUNDER_SUB_BONUS.enabledEnvVar] === "true";
}

export interface RunOptions {
  dryRun?: boolean;
  triggeredBy?: string;
}

export interface RunOutcome {
  run: IFounderSubBonusRun;
  qualifiedReferrers: number;
  paidUsd: number;
  routedToPlatformUsd: number;
  failed: number;
  skipped?: "already_paid" | "not_yet_eligible" | "lease_held" | "disabled";
}

export async function executeFounderSubMonthlyBonusRun(
  periodKey: string,
  opts: RunOptions = {},
): Promise<RunOutcome> {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error(
      `Invalid periodKey: "${periodKey}" (expected "YYYY-MM")`,
    );
  }

  const floor = FOUNDER_SUB_BONUS.firstEligiblePeriod;
  if (periodKey < floor) {
    throw new Error(
      `Period ${periodKey} is before firstEligiblePeriod ${floor}`,
    );
  }

  const { endExclusive } = periodBoundsFor(periodKey);
  if (endExclusive > new Date() && !opts.dryRun) {
    throw new Error(
      `Period ${periodKey} has not closed yet — cannot settle in real-run mode`,
    );
  }

  const dryRun = !!opts.dryRun;
  const triggeredBy = opts.triggeredBy || "cron";

  const existingPaid = await FounderSubBonusRun.findOne({
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
      `Another ${JOB_NAME} run holds the lease — try again in ~30 min`,
    );
    err.statusCode = 423;
    throw err;
  }

  try {
    const now = new Date();
    const run = await FounderSubBonusRun.findOneAndUpdate(
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

    const { qualifiers, totalsSeed } = await qualifyForPeriod(periodKey);

    await FounderSubBonusPayout.deleteMany({
      runId: run._id,
      payoutStatus: { $in: ["pending", "failed"] },
    });

    for (const q of qualifiers) {
      await FounderSubBonusPayout.findOneAndUpdate(
        { periodKey, userId: new Types.ObjectId(q.userId) },
        {
          $set: {
            runId: run._id,
            qualifyingSales: q.qualifyingSales,
            tier: q.tier,
            countedSales: q.countedSales,
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
    run.totals = { ...emptyTotals(), ...totalsSeed };
    await run.save();

    if (dryRun || !payoutsEnabled()) {
      return {
        run,
        qualifiedReferrers: totalsSeed.qualifiedReferrers,
        paidUsd: 0,
        routedToPlatformUsd: 0,
        failed: 0,
        skipped: dryRun ? undefined : "disabled",
      };
    }

    run.status = "paying";
    await run.save();

    const summary = await payRunPayouts(
      run._id as Types.ObjectId,
      periodKey,
    );

    run.status =
      summary.failed > 0 && summary.paid === 0 ? "failed" : "paid";
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
    await FounderSubBonusRun.updateOne(
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
 * Hourly cron entry. Settles the last-closed month; no-op if already paid.
 */
export async function founderSubMonthlyBonusTick(): Promise<
  RunOutcome | { skipped: RunOutcome["skipped"] }
> {
  const now = new Date();
  const periodKey = previousPeriodKeyFor(now);

  const floor = FOUNDER_SUB_BONUS.firstEligiblePeriod;
  if (periodKey < floor) return { skipped: "not_yet_eligible" };

  const existing = await FounderSubBonusRun.findOne({
    periodKey,
    status: "paid",
    dryRun: false,
  })
    .select({ _id: 1 })
    .lean();
  if (existing) return { skipped: "already_paid" };

  return executeFounderSubMonthlyBonusRun(periodKey, {
    dryRun: false,
    triggeredBy: "cron",
  });
}

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
