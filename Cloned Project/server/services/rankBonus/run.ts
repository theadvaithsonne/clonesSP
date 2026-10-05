// src/services/rankBonus/run.ts
//
// Orchestrates one monthly rank-bonus run: snapshot → qualify → persist → pay.
//
// Money only moves when RANK_BONUS_PAYOUTS_ENABLED === "true". Default is OFF,
// so the job ships in report-only mode: it computes and stores everything,
// showing the real bill and the real qualifier list, and pays $0 until someone
// deliberately flips the env var and redeploys. There is no reversal machinery
// anywhere in this codebase, so that gate is the only protection against a
// qualification bug paying out before anyone sees it.

import mongoose, { Types } from "mongoose";
import { acquireLease, releaseLease } from "../cronLease";
import { RankPlan, payoutFor, RankKey } from "../../models/rankPlan.model";
import {
  RankRun,
  periodKeyFor,
  previousPeriodKeyFor,
  emptyTotals,
  IRankRun,
} from "../../models/rankRun.model";
import { RankQualification } from "../../models/rankQualification.model";
import { User } from "../../models/user.model";
import { getActivePaidSubscribers } from "./activeSubscribers";
import { qualifyTree } from "./qualify";
import { payRunQualifications, applyRanksToUsers } from "./payout";

const JOB_NAME = "networkchain-rank-bonus";
const LEASE_TTL_MS = 30 * 60 * 1000; // generous: the tree pass is minutes, not seconds

export function payoutsEnabled(): boolean {
  return process.env.RANK_BONUS_PAYOUTS_ENABLED === "true";
}

export interface RunOptions {
  /**
   * Defaults to the month that has just closed — the one a run is normally
   * settling. Pass the current month explicitly to preview a month in progress;
   * that is what the admin "Preview" button does.
   */
  periodKey?: string;
  /** Force report-only even when the env var is on. */
  forceDryRun?: boolean;
  triggeredBy?: string;
}

export interface RunOutcome {
  status: "completed" | "skipped_locked" | "already_paid" | "failed";
  run?: IRankRun;
  message?: string;
}

/**
 * Execute a rank-bonus run. Safe to call repeatedly for the same period:
 * `periodKey` is unique on RankRun, qualifications upsert on (periodKey,
 * userId), and each wallet credit is guarded by its dedupeKey.
 */
export async function executeRankBonusRun(
  opts: RunOptions = {}
): Promise<RunOutcome> {
  const periodKey = opts.periodKey || previousPeriodKeyFor(new Date());
  const dryRun = opts.forceDryRun === true || !payoutsEnabled();

  const lease = await acquireLease(JOB_NAME, LEASE_TTL_MS);
  if (!lease) {
    return {
      status: "skipped_locked",
      message: "Another replica holds the rank-bonus lease",
    };
  }

  try {
    const plan = await RankPlan.findOne({ isActive: true });
    if (!plan) {
      return { status: "failed", message: "No active RankPlan configured" };
    }

    // A period that already paid is never recomputed — reopening it could
    // change ranks under people who have already been credited.
    const existing = await RankRun.findOne({ periodKey });
    if (existing && existing.status === "paid" && !existing.dryRun) {
      return {
        status: "already_paid",
        run: existing,
        message: `${periodKey} already paid on ${existing.paidAt?.toISOString()}`,
      };
    }

    const snapshotAt = new Date();
    const run =
      existing ||
      (await RankRun.create({
        periodKey,
        planVersion: plan.version,
        status: "computing",
        dryRun,
        snapshotAt,
        startedAt: snapshotAt,
        totals: emptyTotals(),
        triggeredBy: opts.triggeredBy,
      }));

    if (existing) {
      existing.status = "computing";
      existing.dryRun = dryRun;
      existing.snapshotAt = snapshotAt;
      existing.startedAt = snapshotAt;
      existing.planVersion = plan.version;
      existing.error = undefined;
      await existing.save();
    }

    // ── 1. Who is active and paid, right now ──────────────────────────────
    const { active, coveredChains, freeOnlyCount } =
      await getActivePaidSubscribers(plan.thirdPartyClientId, snapshotAt);
    console.log(
      `[RankBonus] ${periodKey}: ${active.size} active paid subscribers ` +
        `(${coveredChains} covered chains, ${freeOnlyCount} free-month-only excluded)`
    );

    // ── 2. Load the tree and rank everyone ────────────────────────────────
    // Projection only — the whole-forest pass is ~40MB at 100k users, and this
    // mirrors scripts/backfill-downline-tree.ts which already does it monthly-shaped.
    const users = await User.find({})
      .select({ _id: 1, referredBy: 1 })
      .lean();

    const result = qualifyTree({ users, active, plan });
    if (result.orphaned > 0) {
      console.warn(
        `[RankBonus] ${periodKey}: ${result.orphaned} users unreachable from any root (cycles?)`
      );
    }

    // Structural invariant: a subscriber counts toward exactly one upline's
    // Bronze, so Bronzes can never exceed activeSubscribers / 5. A breach means
    // the active-paid predicate is wrong — free months leaking in, or one
    // subscriber attributed to two uplines.
    const maxBronze = Math.floor(active.size / (plan.tiers[0].requiredActiveDirects || 5));
    const rankedCount = result.qualified.length;
    if (rankedCount > maxBronze) {
      console.error(
        `[RankBonus] ${periodKey}: INVARIANT BREACH — ${rankedCount} qualifiers ` +
          `exceeds the structural ceiling of ${maxBronze} (${active.size} active / 5). ` +
          `The active-paid predicate is over-counting.`
      );
    }

    // ── 3. Persist qualifications ─────────────────────────────────────────
    let bonusUsd = 0;
    const ops = result.qualified.map((q) => {
      const amount = payoutFor(plan, q.rank as RankKey);
      bonusUsd += amount;
      return {
        updateOne: {
          filter: { periodKey, userId: new Types.ObjectId(q.userId) },
          update: {
            $set: {
              runId: run._id,
              rank: q.rank,
              bonusUsd: amount,
              basis: {
                selfActive: q.selfActive,
                activeDirects: q.activeDirects,
                totalDirects: q.totalDirects,
                legsWithRank: q.legsWithRank,
              },
            },
            $setOnInsert: {
              payoutStatus: dryRun ? "skipped_dry_run" : "pending",
              attempts: 0,
            },
          },
          upsert: true,
        },
      };
    });

    // Drop anyone who qualified on a previous attempt at this period but no
    // longer does — only ever safe because we refuse to recompute a paid run.
    await RankQualification.deleteMany({
      periodKey,
      payoutStatus: { $ne: "paid" },
      userId: {
        $nin: result.qualified.map((q) => new Types.ObjectId(q.userId)),
      },
    });

    if (ops.length) {
      for (let i = 0; i < ops.length; i += 1000) {
        await RankQualification.bulkWrite(ops.slice(i, i + 1000), {
          ordered: false,
        });
      }
    }

    bonusUsd = Math.round(bonusUsd * 100) / 100;
    run.totals = {
      ...emptyTotals(),
      activeSubscribers: active.size,
      evaluated: result.evaluated,
      qualified: result.qualified.length,
      byRank: result.byRank,
      bonusUsd,
    };
    run.status = "computed";
    run.computedAt = new Date();
    await run.save();

    console.log(
      `[RankBonus] ${periodKey}: ${result.qualified.length} qualified, ` +
        `$${bonusUsd.toLocaleString()} owed — ` +
        Object.entries(result.byRank)
          .filter(([, v]) => v)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")
    );

    // ── 4. Pay, unless this is a dry run ──────────────────────────────────
    if (dryRun) {
      console.log(
        `[RankBonus] ${periodKey}: DRY RUN — no money moved. ` +
          `Set RANK_BONUS_PAYOUTS_ENABLED=true to pay.`
      );
      run.status = "computed";
      await run.save();
      await applyRanksToUsers(run._id as Types.ObjectId, periodKey);
      return { status: "completed", run };
    }

    run.status = "paying";
    await run.save();

    const summary = await payRunQualifications(
      run._id as Types.ObjectId,
      periodKey
    );

    run.totals.paidUsd = Math.round(summary.paidUsd * 100) / 100;
    run.totals.routedToPlatformUsd =
      Math.round(summary.routedToPlatformUsd * 100) / 100;
    run.totals.failed = summary.failed;
    run.status = summary.failed > 0 ? "failed" : "paid";
    run.paidAt = new Date();
    if (summary.failed > 0) {
      run.error = `${summary.failed} payout(s) failed; re-run to retry`;
    }
    await run.save();

    await applyRanksToUsers(run._id as Types.ObjectId, periodKey);

    console.log(
      `[RankBonus] ${periodKey}: paid $${summary.paidUsd.toLocaleString()} ` +
        `to ${summary.paid} (${summary.alreadyPaid} already paid, ${summary.failed} failed, ` +
        `$${summary.routedToPlatformUsd.toLocaleString()} routed to platform)`
    );

    return { status: "completed", run };
  } catch (err: any) {
    console.error(`[RankBonus] ${periodKey} run failed:`, err);
    await RankRun.updateOne(
      { periodKey },
      { $set: { status: "failed", error: err?.message || String(err) } }
    ).catch(() => {});
    return { status: "failed", message: err?.message || String(err) };
  } finally {
    await releaseLease(JOB_NAME, lease).catch(() => {});
  }
}

/**
 * Hourly tick. Settles the month that has just CLOSED.
 *
 * A month can't be paid before it ends, so the run that fires in September pays
 * for August. In steady state that lands within an hour of midnight on the 1st;
 * the tick is not gated on the date, so a restart or an outage spanning the 1st
 * still catches the month rather than losing it.
 *
 * It only ever looks at ONE period — last month — so it cannot silently reach
 * back through history. The `firstEligiblePeriod` floor stops it settling months
 * that ended before the plan existed, which is what would otherwise happen on
 * the very first deploy.
 *
 * Repeated firing is harmless: `periodKey` is unique on RankRun, qualifications
 * upsert on (periodKey, userId), and each wallet credit is dedupeKey-guarded.
 */
export async function rankBonusTick(): Promise<void> {
  const periodKey = previousPeriodKeyFor(new Date());

  const floor = await firstEligiblePeriod();
  // "YYYY-MM" is lexicographically ordered, so a string compare is a date compare.
  if (periodKey < floor) return;

  const existing = await RankRun.findOne({ periodKey })
    .select({ status: 1, dryRun: 1 })
    .lean();

  if (existing && shouldSkipTick(existing)) return;

  await executeRankBonusRun({ periodKey, triggeredBy: "cron" });
}

/**
 * The earliest period the cron may settle.
 *
 * Defaults to the month the plan was first configured — deploying mid-August
 * must not settle July, a month during which the bonus did not exist and for
 * which a run-time snapshot would be meaningless anyway.
 *
 * RANK_BONUS_FIRST_PERIOD ("YYYY-MM") overrides it, for the case where the plan
 * is seeded well ahead of go-live.
 */
export async function firstEligiblePeriod(): Promise<string> {
  const override = process.env.RANK_BONUS_FIRST_PERIOD;
  if (override && /^\d{4}-\d{2}$/.test(override)) return override;

  // The FIRST plan ever created, not the active one — publishing v2 later must
  // not move the floor forward and re-open settled history.
  const first = await RankPlan.findOne({})
    .sort({ createdAt: 1 })
    .select({ createdAt: 1 })
    .lean();

  return periodKeyFor(first?.createdAt ?? new Date());
}

/**
 * Whether the tick should leave an existing run for this period alone.
 *
 * The one non-obvious case is a dry-run row: if payouts get switched on during
 * a month that was already computed dry, the tick re-runs it so flipping
 * RANK_BONUS_PAYOUTS_ENABLED doesn't silently strand the month it was flipped
 * in. `computing`/`paying`/`failed` all fall through to a retry — safe, because
 * every write in the pay path is idempotent and the lease prevents overlap.
 */
export function shouldSkipTick(existing: {
  status: string;
  dryRun: boolean;
}): boolean {
  // Settled for real. Never recomputed — ranks could shift under people who
  // have already been credited.
  if (existing.status === "paid" && !existing.dryRun) return true;

  if (existing.status === "computed") {
    // Re-run only when doing so would now actually pay.
    return !(existing.dryRun && payoutsEnabled());
  }

  return false;
}
