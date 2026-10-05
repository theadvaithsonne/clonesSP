// src/services/rankBonus/payout.ts
//
// Pays the qualifications produced by qualify.ts.
//
// ONE TRANSACTION PER RECIPIENT, never one for the whole run. With hundreds of
// payees a single spanning transaction means one bad row rolls back everyone;
// per-recipient means a failure pays the other N-1 and reports `failed: 1`.
// This mirrors services/contentPayoutSweeper.ts.
//
// Idempotency is two-layered, because a rank bonus has no natural "already paid"
// delta the way a content payout does (earned − paidOut). A blind re-run WOULD
// pay $40 twice. So:
//   1. a cheap findOne on metadata.dedupeKey, to short-circuit without work
//   2. the partial unique index on WalletTransaction.metadata.dedupeKey as the
//      real backstop against a race — E11000 is treated as SUCCESS, not failure
//
// Amounts are DOLLARS (float). creditAffiliateOrPlatform takes 40, not 4000.

import mongoose, { Types } from "mongoose";
import { creditAffiliateOrPlatform } from "../wallet";
import { WalletTransaction } from "../../models/walletTransaction.model";
import {
  RankQualification,
  rankBonusDedupeKey,
} from "../../models/rankQualification.model";
import { User } from "../../models/user.model";

export interface PayoutSummary {
  attempted: number;
  paid: number;
  alreadyPaid: number;
  failed: number;
  paidUsd: number;
  routedToPlatformUsd: number;
  errors: Array<{ userId: string; error: string }>;
}

/**
 * Credit every pending qualification for a run.
 *
 * Safe to call repeatedly: rows already `paid` are skipped, and any row whose
 * wallet credit landed but whose bookkeeping did not is reconciled from the
 * dedupeKey rather than paid again.
 */
export async function payRunQualifications(
  runId: Types.ObjectId,
  periodKey: string
): Promise<PayoutSummary> {
  const summary: PayoutSummary = {
    attempted: 0,
    paid: 0,
    alreadyPaid: 0,
    failed: 0,
    paidUsd: 0,
    routedToPlatformUsd: 0,
    errors: [],
  };

  const rows = await RankQualification.find({
    runId,
    payoutStatus: { $in: ["pending", "failed"] },
  })
    .select({ _id: 1, userId: 1, rank: 1, bonusUsd: 1 })
    .lean();

  for (const row of rows) {
    summary.attempted++;
    const userId = row.userId.toString();
    const dedupeKey = rankBonusDedupeKey(periodKey, userId);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Layer 1 — cheap short-circuit. Covers the ordinary re-run.
      const existing = await WalletTransaction.findOne({
        "metadata.dedupeKey": dedupeKey,
      })
        .select({ _id: 1, "metadata.routedToPlatform": 1 })
        .session(session)
        .lean();

      if (existing) {
        await RankQualification.updateOne(
          { _id: row._id },
          {
            $set: {
              payoutStatus: "paid",
              walletTransactionId: existing._id,
              paidAt: new Date(),
            },
            $unset: { lastError: "" },
          },
          { session }
        );
        await session.commitTransaction();
        summary.alreadyPaid++;
        continue;
      }

      const result = await creditAffiliateOrPlatform({
        recipientUserId: userId,
        amount: row.bonusUsd, // DOLLARS
        currency: "USD",
        description: `${row.rank} rank bonus — ${periodKey}`,
        note: `NetworkChain rank bonus for ${periodKey}. Rank: ${row.rank}.`,
        metadata: {
          dedupeKey,
          kind: "networkchain_rank_bonus",
          periodKey,
          rank: row.rank,
          runId: runId.toString(),
          // Signal to the commission-earned push notifier that the
          // amount is in whole dollars, not cents. Rank bonuses are
          // the only caller that ships whole units to
          // creditAffiliateOrPlatform (see comment at top of this file).
          unit: "whole",
        },
        session,
      });

      await RankQualification.updateOne(
        { _id: row._id },
        {
          $set: {
            payoutStatus: "paid",
            walletTransactionId: result.transaction._id,
            routedToPlatform: result.routedToPlatform,
            paidAt: new Date(),
          },
          $inc: { attempts: 1 },
          $unset: { lastError: "" },
        },
        { session }
      );

      await session.commitTransaction();
      summary.paid++;
      summary.paidUsd += row.bonusUsd;
      if (result.routedToPlatform) summary.routedToPlatformUsd += row.bonusUsd;
    } catch (err: any) {
      await session.abortTransaction().catch(() => {});

      // Layer 2 — the unique index fired. Another replica or an earlier attempt
      // already credited this person. That is success, not failure; treating it
      // as an error would strand the row as permanently `failed`.
      if (err?.code === 11000) {
        const tx = await WalletTransaction.findOne({
          "metadata.dedupeKey": dedupeKey,
        })
          .select({ _id: 1 })
          .lean();
        await RankQualification.updateOne(
          { _id: row._id },
          {
            $set: {
              payoutStatus: "paid",
              ...(tx ? { walletTransactionId: tx._id } : {}),
              paidAt: new Date(),
            },
            $unset: { lastError: "" },
          }
        );
        summary.alreadyPaid++;
        continue;
      }

      const message = err?.message || String(err);
      await RankQualification.updateOne(
        { _id: row._id },
        {
          $set: { payoutStatus: "failed", lastError: message },
          $inc: { attempts: 1 },
        }
      ).catch(() => {});
      summary.failed++;
      summary.errors.push({ userId, error: message });
      console.error(
        `[RankBonus] payout failed for ${userId} (${periodKey}):`,
        err
      );
    } finally {
      session.endSession();
    }
  }

  return summary;
}

/**
 * Stamp each qualifier's rank onto their User doc, and clear it for everyone
 * who held a rank last period but did not qualify this one.
 *
 * Written from the run, not computed live, so what a user sees is exactly what
 * they were paid for — never a mid-month projection they might then miss.
 */
export async function applyRanksToUsers(
  runId: Types.ObjectId,
  periodKey: string
): Promise<{ set: number; cleared: number }> {
  const rows = await RankQualification.find({ runId })
    .select({ userId: 1, rank: 1 })
    .lean();

  const now = new Date();
  const qualifiedIds = rows.map((r) => r.userId);

  const ops = rows.map((r) => ({
    updateOne: {
      filter: { _id: r.userId },
      update: {
        $set: {
          "ncRank.current": r.rank,
          "ncRank.periodKey": periodKey,
          "ncRank.updatedAt": now,
        },
      },
    },
  }));

  if (ops.length) await User.bulkWrite(ops, { ordered: false });

  // Anyone previously ranked who did not qualify this period drops to none.
  const cleared = await User.updateMany(
    {
      _id: { $nin: qualifiedIds },
      "ncRank.current": { $ne: null },
    },
    {
      $set: {
        "ncRank.current": null,
        "ncRank.periodKey": periodKey,
        "ncRank.updatedAt": now,
      },
    }
  );

  return { set: ops.length, cleared: cleared.modifiedCount || 0 };
}
