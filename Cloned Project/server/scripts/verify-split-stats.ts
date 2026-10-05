/**
 * Forward check for the NetworkChain split: a distribution row carrying
 * `creditedAmount` must be reported by getUPCommissionStats at the CREDITED
 * figure, not the plan figure.
 *
 * Uses a synthetic distribution against throwaway ObjectIds and deletes it in
 * a finally block. It deliberately does NOT call the commission service, which
 * moves real money and sends push notifications on commit.
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI!);
  const { UnilevelPlusDistribution } = await import(
    "../models/unilevelPlusDistribution.model"
  );
  const { getUPCommissionStats } = await import(
    "../services/unilevelPlusCommission"
  );

  const earner = new Types.ObjectId();   // fake: appears in no other row
  const upline = new Types.ObjectId();
  const paymentId = `TEST_SPLIT_${Date.now()}`;
  let id: any = null;

  try {
    const doc = await UnilevelPlusDistribution.create({
      planId: new Types.ObjectId(),
      buyerId: new Types.ObjectId(),
      saleAmount: 25,
      currency: "USD",
      paymentId,
      companyAmount: 1,
      // Direct: plan $9.00, split → keeps $4.50
      directBonusAmount: 9,
      directBonusRecipientId: earner,
      directBonusCreditedAmount: 4.5,
      directBonusForfeitedAmount: 4.5,
      directBonusForfeitedToUserId: upline,
      levelBonusBudget: 7.2,
      levelBonusDistributed: 7.2,
      levelBonusRecipients: [
        // split row: plan 0.60 → credited 0.30
        { userId: earner, level: 2, legNumber: 1, legMultiplier: 1, points: 1,
          amount: 0.6, creditedAmount: 0.3, forfeitedAmount: 0.3,
          forfeitedToUserId: upline, directChildId: new Types.ObjectId() },
        // un-split row: credited === plan
        { userId: earner, level: 3, legNumber: 2, legMultiplier: 1, points: 1,
          amount: 0.4, creditedAmount: 0.4, directChildId: new Types.ObjectId() },
      ],
      infinityTier1Amount: 1.2,
      infinityTier1Recipients: [
        { userId: earner, tier: 1, amount: 1.2, creditedAmount: 0.6,
          forfeitedAmount: 0.6, forfeitedToUserId: upline, directReferralCount: 4 },
      ],
      infinityTier1Distributed: 1.2,
      infinityTier2Amount: 6,
      infinityTier2Recipients: [
        // odd cent: plan 0.05 → floor(0.025)=0.02 forfeited, 0.03 kept
        { userId: earner, tier: 2, amount: 0.05, creditedAmount: 0.03,
          forfeitedAmount: 0.02, forfeitedToUserId: upline, directReferralCount: 10 },
      ],
      infinityTier2Distributed: 0.05,
      managerBonusAmount: 0.6,
      unallocatedAmount: 0,
      status: "completed",
    });
    id = doc._id;

    // Round-trip through the DB to prove the sub-schemas actually persist the
    // new fields (a missing schema path is silently dropped by Mongoose).
    const back: any = await UnilevelPlusDistribution.findById(id).lean();
    const persisted = {
      direct: back.directBonusCreditedAmount,
      level0: back.levelBonusRecipients[0].creditedAmount,
      level0Forfeit: back.levelBonusRecipients[0].forfeitedAmount,
      level0To: String(back.levelBonusRecipients[0].forfeitedToUserId),
      t1: back.infinityTier1Recipients[0].creditedAmount,
      t2: back.infinityTier2Recipients[0].creditedAmount,
    };
    console.log("persisted:", persisted);

    const s = await getUPCommissionStats(String(earner));
    // forfeited: 4.50 direct + 0.30 level + 0.60 t1 + 0.02 t2 = 5.42
    const expect = { direct: 4.5, level: 0.7, t1: 0.6, t2: 0.03, forfeited: 5.42 };
    const got = {
      direct: s.totalDirectBonusEarned,
      level: Math.round(s.totalLevelBonusEarned * 100) / 100,
      t1: s.totalInfinityT1Earned,
      t2: s.totalInfinityT2Earned,
      forfeited: s.totalForfeited,
    };
    console.log("expected:", expect);
    console.log("got:     ", got);
    console.log("byLevel: ", s.earningsByLevel, " byLeg:", s.earningsByLeg);

    const ok =
      got.direct === expect.direct && got.level === expect.level &&
      got.t1 === expect.t1 && got.t2 === expect.t2 &&
      got.forfeited === expect.forfeited &&
      persisted.level0To === String(upline);

    // Plan-figure totals would have been 9 / 1.0 / 1.2 / 0.05
    console.log(ok ? "\nPASS — stats report credited, not plan" : "\nFAIL");
    process.exitCode = ok ? 0 : 1;
  } finally {
    if (id) {
      await UnilevelPlusDistribution.deleteOne({ _id: id });
      console.log("cleaned up synthetic row", String(id));
    }
    await mongoose.disconnect();
  }
})();
