// Payout step for the monthly whitelabel volume bonus.
//
// Mirrors rankBonus/payout.ts:
//   • ONE mongoose transaction per recipient — one bad row doesn't
//     roll back the other N-1.
//   • Idempotency is two-layered: cheap findOne on the dedupeKey
//     (short-circuits an ordinary re-run) + the partial unique index
//     on WalletTransaction.metadata.dedupeKey as a race backstop
//     (E11000 → treat as SUCCESS).
//   • Amounts are DOLLARS (float). `unit: "whole"` in metadata so the
//     commission-earned push notifier formats "$1,500.00" not "$15.00".
//
// Runs in-process; the caller (run.ts) has already acquired the
// cronLease and switched the run.status to "paying".

import mongoose, { Types } from "mongoose";
import { creditAffiliateOrPlatform } from "../wallet";
import { WalletTransaction } from "../../models/walletTransaction.model";
import {
  WhitelabelBonusPayout,
  whitelabelMonthlyBonusDedupeKey,
} from "../../models/whitelabelBonusPayout.model";

export interface PayoutSummary {
  attempted: number;
  paid: number;
  alreadyPaid: number;
  failed: number;
  paidUsd: number;
  routedToPlatformUsd: number;
  errors: Array<{ userId: string; error: string }>;
}

export async function payRunPayouts(
  runId: Types.ObjectId,
  periodKey: string,
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

  const rows = await WhitelabelBonusPayout.find({
    runId,
    payoutStatus: { $in: ["pending", "failed"] },
  })
    .select({ _id: 1, userId: 1, qualifyingSales: 1, bonusUsd: 1 })
    .lean();

  for (const row of rows) {
    summary.attempted += 1;
    const userId = row.userId.toString();
    const dedupeKey = whitelabelMonthlyBonusDedupeKey(periodKey, userId);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Layer 1 — short-circuit ordinary re-runs.
      const existing = await WalletTransaction.findOne({
        "metadata.dedupeKey": dedupeKey,
      })
        .select({ _id: 1, "metadata.routedToPlatform": 1 })
        .session(session)
        .lean();

      if (existing) {
        await WhitelabelBonusPayout.updateOne(
          { _id: row._id },
          {
            $set: {
              payoutStatus: "paid",
              walletTransactionId: existing._id,
              paidAt: new Date(),
            },
            $unset: { lastError: "" },
          },
          { session },
        );
        await session.commitTransaction();
        summary.alreadyPaid += 1;
        continue;
      }

      const result = await creditAffiliateOrPlatform({
        recipientUserId: userId,
        amount: row.bonusUsd, // DOLLARS
        currency: "USD",
        description: `Whitelabel monthly bonus (${row.qualifyingSales} sales)`,
        note: `Whitelabel volume bonus for ${periodKey}. ${row.qualifyingSales} qualifying sales × $150.`,
        metadata: {
          dedupeKey,
          kind: "whitelabel_monthly_bonus",
          periodKey,
          runId: runId.toString(),
          qualifyingSales: row.qualifyingSales,
          // Whole-dollar signal for the push notifier — same as rank bonus.
          unit: "whole",
        },
        session,
      });

      await WhitelabelBonusPayout.updateOne(
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
        { session },
      );

      await session.commitTransaction();
      summary.paid += 1;
      summary.paidUsd += row.bonusUsd;
      if (result.routedToPlatform)
        summary.routedToPlatformUsd += row.bonusUsd;
    } catch (err: any) {
      await session.abortTransaction().catch(() => {});

      // Layer 2 — the partial-unique index on dedupeKey fired. Another
      // replica or earlier attempt already credited this person; treat
      // as success, not failure.
      if (err?.code === 11000) {
        const tx = await WalletTransaction.findOne({
          "metadata.dedupeKey": dedupeKey,
        })
          .select({ _id: 1 })
          .lean();
        await WhitelabelBonusPayout.updateOne(
          { _id: row._id },
          {
            $set: {
              payoutStatus: "paid",
              ...(tx ? { walletTransactionId: tx._id } : {}),
              paidAt: new Date(),
            },
            $unset: { lastError: "" },
          },
        );
        summary.alreadyPaid += 1;
        continue;
      }

      const message = err?.message || String(err);
      await WhitelabelBonusPayout.updateOne(
        { _id: row._id },
        {
          $set: { payoutStatus: "failed", lastError: message },
          $inc: { attempts: 1 },
        },
      ).catch(() => {});
      summary.failed += 1;
      summary.errors.push({ userId, error: message });
      console.error(
        `[WhitelabelMonthlyBonus] payout failed for ${userId} (${periodKey}):`,
        err,
      );
    } finally {
      session.endSession();
    }
  }

  return summary;
}
