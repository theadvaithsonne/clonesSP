// src/services/jobRewards.ts
//
// Referral rewards for Garage Jobs, built entirely on the EXISTING money flows:
//
//   • GaragePay store wallet  — debitStoreWallet / creditStoreWallet (USD)
//   • Unilevel Plus tree      — distributeUnilevelPlusCommission, called exactly
//                               the way founder comb plans call it in
//                               services/commission.ts (buyer = the customer,
//                               sweepUnspent "return", source
//                               "comb_plan_unilevel_plus")
//
// Nothing in wallet.ts or unilevelPlusCommission.ts is modified. The only new
// state is the posting's `reward.heldAmount` and the JobReward ledger.
//
// Flow
//   publish (funding "hold")   debit amount × openings from the payer, keep it
//                              as `reward.heldAmount`
//   hire with a referral       earmark one reward from the hold (or, for
//                              "on_hire", nothing yet) → JobReward in_guarantee
//   guarantee ends (sweeper)   charge "on_hire" rewards, distribute through the
//                              tree, credit the unearned part back to the payer
//   left early                 cancel; a held reward goes back to the payer
//   job closed / filled        whatever is still held goes back to the payer

import { Types } from "mongoose";
import { JobPosting, IJobPosting } from "../models/jobPosting.model";
import { IJobApplication } from "../models/jobApplication.model";
import { JobReward, IJobReward } from "../models/jobReward.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import { debitStoreWallet, creditStoreWallet, getStoreWalletBalance } from "./wallet";
import {
  getActiveUnilevelPlusPlan,
  distributeUnilevelPlusCommission,
} from "./unilevelPlusCommission";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class InsufficientFundsError extends Error {
  constructor(public balance: number, public required: number) {
    super("Insufficient GaragePay balance");
  }
}

// ── Plan preview ─────────────────────────────────────────────────────────

export interface RewardSplitPreview {
  total: number;
  buckets: Array<{ key: string; label: string; percentage: number; amount: number }>;
  /** Share the tree never pays (company share etc.) — returned to the founder. */
  returnedPercentage: number;
  /** What the referring affiliate sees as "Earn $X". */
  directAmount: number;
}

/** How a reward of `amount` splits under the live Unilevel Plus plan. */
export async function rewardSplitPreview(amount: number): Promise<RewardSplitPreview | null> {
  const plan: any = await getActiveUnilevelPlusPlan();
  if (!plan) return null;
  const pct = (n: unknown) => (typeof n === "number" && n > 0 ? n : 0);
  const buckets = [
    { key: "direct", label: "Referring affiliate (direct)", percentage: pct(plan.directBonusPercentage) },
    { key: "level", label: "Level bonus", percentage: pct(plan.levelBonusPercentage) },
    { key: "infinity1", label: "Infinity Tier 1", percentage: pct(plan.infinityTier1Percentage) },
    { key: "infinity2", label: "Infinity Tier 2", percentage: pct(plan.infinityTier2Percentage) },
    { key: "pool", label: "Global pool", percentage: pct(plan.managerBonusPercentage) },
  ]
    .filter((b) => b.percentage > 0)
    .map((b) => ({ ...b, amount: round2((amount * b.percentage) / 100) }));
  return {
    total: round2(amount),
    buckets,
    returnedPercentage: pct(plan.companyPercentage),
    directAmount: buckets.find((b) => b.key === "direct")?.amount || 0,
  };
}

// ── Holds ────────────────────────────────────────────────────────────────

/** Amount a posting reserves at publish: reward × openings. */
export function holdAmountFor(job: Pick<IJobPosting, "reward" | "openings">): number {
  if (!job.reward?.enabled || job.reward.funding !== "hold") return 0;
  return round2((job.reward.amount || 0) * Math.max(1, job.openings || 1));
}

/**
 * Reserve the posting's rewards from the payer's GaragePay wallet. Runs once
 * per posting: the dedupe key makes a second attempt fail inside the wallet
 * transaction instead of charging twice.
 */
export async function holdJobRewards(job: IJobPosting, payerId: string): Promise<number> {
  const amount = holdAmountFor(job);
  if (amount <= 0) return 0;
  if ((job.reward.totalHeld || 0) > 0) return job.reward.heldAmount || 0;

  const balance = (await getStoreWalletBalance(payerId, String(job.orgId), "USD"))?.balance ?? 0;
  if (balance < amount) throw new InsufficientFundsError(balance, amount);

  await debitStoreWallet(
    payerId,
    String(job.orgId),
    amount,
    `Referral rewards held · ${job.title}`,
    undefined,
    `Garage Jobs: ${job.openings} × $${job.reward.amount} reserved until hires complete their guarantee`,
    "USD",
    { kind: "job_reward_hold", jobId: String(job._id), dedupeKey: `job_reward_hold:${job._id}` }
  );

  await JobPosting.updateOne(
    { _id: job._id },
    {
      $set: {
        "reward.heldAmount": amount,
        "reward.totalHeld": amount,
        "reward.payerId": new Types.ObjectId(payerId),
      },
    }
  );
  return amount;
}

/**
 * Give back whatever is still held for a posting (closed, filled, deleted).
 * The held amount is zeroed atomically FIRST so a concurrent close can't
 * refund it twice; if the credit then fails the amount is restored.
 */
export async function releaseJobHold(jobId: string | Types.ObjectId, reason: string): Promise<number> {
  const job = await JobPosting.findById(jobId).select("orgId title reward").lean<IJobPosting>();
  const held = job?.reward?.heldAmount || 0;
  const payerId = job?.reward?.payerId ? String(job.reward.payerId) : null;
  if (!job || held <= 0 || !payerId) return 0;

  const claimed = await JobPosting.findOneAndUpdate(
    { _id: job._id, "reward.heldAmount": held },
    { $set: { "reward.heldAmount": 0 } }
  );
  if (!claimed) return 0;

  try {
    await creditStoreWallet(
      payerId,
      payerId,
      String(job.orgId),
      held,
      `Referral rewards released · ${job.title}`,
      `Garage Jobs: unused reward hold returned (${reason})`
    );
    return held;
  } catch (err: any) {
    await JobPosting.updateOne({ _id: job._id }, { $inc: { "reward.heldAmount": held } });
    console.error(`[jobRewards] releasing hold for job ${job._id} failed:`, err?.message);
    throw err;
  }
}

// ── Hires ────────────────────────────────────────────────────────────────

/**
 * Open the reward ledger entry for a referred hire. For "hold" funding one
 * reward is earmarked out of the posting's hold; if the hold is already used
 * up (more hires than openings) the reward falls back to being charged at
 * payout, so a referrer is never short-changed by the founder's sizing.
 */
export async function createRewardForHire(
  job: IJobPosting,
  app: IJobApplication,
  joiningDate: Date,
  actorId: string
): Promise<IJobReward | null> {
  if (!job.reward?.enabled || !(job.reward.amount > 0) || !app.referral?.referrerId) return null;

  const amount = round2(job.reward.amount);
  let funding: "hold" | "on_hire" = "on_hire";
  if (job.reward.funding === "hold") {
    const earmarked = await JobPosting.findOneAndUpdate(
      { _id: job._id, "reward.heldAmount": { $gte: amount } },
      { $inc: { "reward.heldAmount": -amount } }
    );
    if (earmarked) funding = "hold";
  }

  const guaranteeDays = job.reward.guaranteeDays || 90;
  const guaranteeEndsAt = new Date(joiningDate.getTime() + guaranteeDays * 86400000);
  const payerId = job.reward.payerId ? String(job.reward.payerId) : actorId;

  try {
    return await JobReward.create({
      orgId: job.orgId,
      jobId: job._id,
      applicationId: app._id,
      candidateId: app.candidateId,
      payerId,
      referrerId: app.referral.referrerId,
      amount,
      funding,
      status: "in_guarantee",
      joinedAt: joiningDate,
      guaranteeDays,
      guaranteeEndsAt,
    });
  } catch (err: any) {
    // Put the earmark back if the ledger row could not be written.
    if (funding === "hold") {
      await JobPosting.updateOne({ _id: job._id }, { $inc: { "reward.heldAmount": amount } });
    }
    if (err?.code === 11000) return JobReward.findOne({ applicationId: app._id });
    throw err;
  }
}

/** Joining date moved before payout — the guarantee moves with it. */
export async function rescheduleReward(applicationId: Types.ObjectId, joiningDate: Date): Promise<void> {
  const reward = await JobReward.findOne({ applicationId, status: "in_guarantee" });
  if (!reward) return;
  reward.joinedAt = joiningDate;
  reward.guaranteeEndsAt = new Date(joiningDate.getTime() + reward.guaranteeDays * 86400000);
  await reward.save();
}

/**
 * The hire left early. Before payout the reward is cancelled and a held
 * reward goes back to the payer; after payout it is flagged for the manual
 * refund the terms describe.
 */
export async function cancelRewardLeftEarly(rewardId: string, reason: string): Promise<IJobReward | null> {
  const reward = await JobReward.findOneAndUpdate(
    { _id: rewardId, status: { $in: ["in_guarantee", "payment_due", "failed"] } },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason } },
    { new: true }
  );
  if (reward) {
    if (reward.funding === "hold") {
      try {
        await creditStoreWallet(
          String(reward.payerId),
          String(reward.payerId),
          String(reward.orgId),
          reward.amount,
          "Referral reward returned · hire left early",
          `Garage Jobs reward ${reward._id}`
        );
      } catch (err: any) {
        await JobReward.updateOne(
          { _id: reward._id },
          { $set: { lastError: `Refund failed: ${err?.message || err}` } }
        );
        console.error(`[jobRewards] refund for reward ${reward._id} failed:`, err?.message);
      }
    }
    return reward;
  }
  return JobReward.findOneAndUpdate(
    { _id: rewardId, status: "paid" },
    { $set: { status: "refund_due", cancelledAt: new Date(), cancelReason: reason } },
    { new: true }
  );
}

// ── Payout ───────────────────────────────────────────────────────────────

async function alreadyCharged(rewardId: string): Promise<boolean> {
  const tx = await WalletTransaction.findOne({
    "metadata.dedupeKey": `job_reward_charge:${rewardId}`,
  })
    .select("_id")
    .lean();
  return !!tx;
}

/**
 * Pay one reward whose guarantee has ended. Claims the row first
 * (→ "processing") so concurrent sweepers never pay twice; the Unilevel Plus
 * distribution is itself idempotent on `paymentId`.
 */
export async function payoutReward(rewardId: string, now = new Date()): Promise<IJobReward | null> {
  const reward = await JobReward.findOneAndUpdate(
    {
      _id: rewardId,
      status: { $in: ["in_guarantee", "payment_due", "failed"] },
      guaranteeEndsAt: { $lte: now },
      attempts: { $lt: 10 },
    },
    { $set: { status: "processing" }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!reward) return null;

  const id = String(reward._id);
  const payerId = String(reward.payerId);
  const orgId = String(reward.orgId);
  let chargedNow = false;

  try {
    // "On hire" rewards are charged now; a held reward was paid for at publish.
    if (reward.funding === "on_hire" && !(await alreadyCharged(id))) {
      const balance = (await getStoreWalletBalance(payerId, orgId, "USD"))?.balance ?? 0;
      if (balance < reward.amount) {
        await JobReward.updateOne(
          { _id: reward._id },
          {
            $set: {
              status: "payment_due",
              lastError: `GaragePay balance $${round2(balance)} is below the $${reward.amount} reward.`,
            },
          }
        );
        return JobReward.findById(reward._id);
      }
      await debitStoreWallet(
        payerId,
        orgId,
        reward.amount,
        "Referral reward paid",
        String(reward.referrerId),
        `Garage Jobs reward ${id}`,
        "USD",
        { kind: "job_reward_charge", rewardId: id, dedupeKey: `job_reward_charge:${id}` }
      );
      chargedNow = true;
    }

    const plan: any = await getActiveUnilevelPlusPlan();
    if (!plan) throw new Error("No active Unilevel Plus plan");

    const result = await distributeUnilevelPlusCommission({
      buyerId: String(reward.candidateId),
      planId: String(plan._id),
      saleAmount: reward.amount,
      currency: "USD",
      paymentId: `job_reward_${id}_up`,
      sweepUnspent: "return",
      metadata: {
        source: "comb_plan_unilevel_plus",
        itemType: "job",
        itemId: String(reward.jobId),
        orgId,
        rewardId: id,
        saleAmount: reward.amount,
        unilevelPlusPercentage: 100,
      },
    });

    const unspent = round2(Math.max(0, Math.min(reward.amount, result.unspentAmount || 0)));
    const paid = round2(reward.amount - unspent);

    if (unspent > 0) {
      await creditStoreWallet(
        payerId,
        payerId,
        orgId,
        unspent,
        "Unearned referral reward returned",
        `Garage Jobs reward ${id}: part of the split no one qualified for`
      );
    }

    await JobReward.updateOne(
      { _id: reward._id },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          paidAmount: paid,
          returnedAmount: unspent,
          distributionId: String(result.distribution?._id || ""),
          lastError: undefined,
        },
      }
    );
    return JobReward.findById(reward._id);
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error(`[jobRewards] payout ${id} failed:`, message);
    if (chargedNow) {
      // Never keep money for a payout that didn't happen.
      await creditStoreWallet(
        payerId,
        payerId,
        orgId,
        reward.amount,
        "Referral reward charge reversed",
        `Garage Jobs reward ${id}: payout failed`
      ).catch((e: any) => console.error(`[jobRewards] reversing charge ${id} failed:`, e?.message));
    }
    await JobReward.updateOne({ _id: reward._id }, { $set: { status: "failed", lastError: message } });
    return JobReward.findById(reward._id);
  }
}

/** Sweeper entry point: pay every reward whose guarantee has ended. */
export async function sweepJobRewards(now = new Date()): Promise<number> {
  const due = await JobReward.find({
    status: { $in: ["in_guarantee", "payment_due", "failed"] },
    guaranteeEndsAt: { $lte: now },
    attempts: { $lt: 10 },
  })
    .select("_id")
    .limit(50)
    .lean();
  let paid = 0;
  for (const r of due) {
    const result = await payoutReward(String(r._id), now);
    if (result?.status === "paid") paid++;
  }
  return paid;
}

// ── Split detail for a paid reward ───────────────────────────────────────

export async function paidRewardSplit(distributionId?: string) {
  if (!distributionId || !Types.ObjectId.isValid(distributionId)) return null;
  const d: any = await UnilevelPlusDistribution.findById(distributionId).lean();
  if (!d) return null;
  const credited = (r: any) => r.creditedAmount ?? r.amount ?? 0;
  return {
    saleAmount: d.saleAmount,
    direct: d.directBonusRecipientId
      ? {
          userId: String(d.directBonusRecipientId),
          amount: round2(d.directBonusCreditedAmount ?? d.directBonusAmount ?? 0),
        }
      : null,
    level: {
      recipients: (d.levelBonusRecipients || []).length,
      amount: round2((d.levelBonusRecipients || []).reduce((s: number, r: any) => s + credited(r), 0)),
    },
    infinity1: {
      recipients: (d.infinityTier1Recipients || []).length,
      amount: round2(d.infinityTier1Distributed || 0),
    },
    infinity2: {
      recipients: (d.infinityTier2Recipients || []).length,
      amount: round2(d.infinityTier2Distributed || 0),
    },
    status: d.status,
  };
}
