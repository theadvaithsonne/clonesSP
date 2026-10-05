// Payout step for the monthly founder Pro-sub volume bonus.
//
// Mirrors whitelabelMonthlyBonus/payout.ts:
//   • ONE mongoose transaction per recipient — one bad row doesn't
//     roll back the other N-1.
//   • Idempotency two-layered: cheap findOne on dedupeKey + partial
//     unique index on WalletTransaction.metadata.dedupeKey (E11000 =
//     already paid).
//   • Amounts in DOLLARS (float).

import mongoose, { Types } from "mongoose";
import { creditAffiliateOrPlatform } from "../wallet";
import { WalletTransaction } from "../../models/walletTransaction.model";
import {
  FounderSubBonusPayout,
  founderSubMonthlyBonusDedupeKey,
} from "../../models/founderSubBonusPayout.model";

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

  const rows = await FounderSubBonusPayout.find({
    runId,
    payoutStatus: { $in: ["pending", "failed"] },
  })
    .select({
      _id: 1,
      userId: 1,
      qualifyingSales: 1,
      countedSales: 1,
      tier: 1,
      bonusUsd: 1,
    })
    .lean();

  for (const row of rows) {
    summary.attempted += 1;
    const userId = row.userId.toString();
    const dedupeKey = founderSubMonthlyBonusDedupeKey(periodKey, userId);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const existing = await WalletTransaction.findOne({
        "metadata.dedupeKey": dedupeKey,
      })
        .select({ _id: 1, "metadata.routedToPlatform": 1 })
        .session(session)
        .lean();

      if (existing) {
        await FounderSubBonusPayout.updateOne(
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

      const perSaleUsd = row.tier === "upper" ? 48 : 24;
      const result = await creditAffiliateOrPlatform({
        recipientUserId: userId,
        amount: row.bonusUsd,
        currency: "USD",
        description: `Office Pro monthly bonus (${row.qualifyingSales} sales)`,
        note: `Founder Pro-sub volume bonus for ${periodKey}. ${row.qualifyingSales} qualifying sales — tier "${row.tier}" pays $${perSaleUsd}/sale × ${row.countedSales} = $${row.bonusUsd.toFixed(2)}.`,
        metadata: {
          dedupeKey,
          kind: "founder_sub_monthly_bonus",
          periodKey,
          runId: runId.toString(),
          qualifyingSales: row.qualifyingSales,
          countedSales: row.countedSales,
          tier: row.tier,
          perSaleUsd,
          unit: "whole",
        },
        session,
      });

      await FounderSubBonusPayout.updateOne(
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

      if (err?.code === 11000) {
        const tx = await WalletTransaction.findOne({
          "metadata.dedupeKey": dedupeKey,
        })
          .select({ _id: 1 })
          .lean();
        await FounderSubBonusPayout.updateOne(
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
      await FounderSubBonusPayout.updateOne(
        { _id: row._id },
        {
          $set: { payoutStatus: "failed", lastError: message },
          $inc: { attempts: 1 },
        },
      ).catch(() => {});
      summary.failed += 1;
      summary.errors.push({ userId, error: message });
      console.error(
        `[FounderSubMonthlyBonus] payout failed for ${userId} (${periodKey}):`,
        err,
      );
    } finally {
      session.endSession();
    }
  }

  return summary;
}
