import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { UnilevelPlusPlan } from "../models/unilevelPlusPlan.model";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  const plans: any[] = await UnilevelPlusPlan.find({ isActive: true }).lean();
  for (const p of plans) {
    console.log(JSON.stringify({
      _id: String(p._id),
      name: p.name,
      companyPercentage: p.companyPercentage,
      directBonusPercentage: p.directBonusPercentage,
      levelBonusPercentage: p.levelBonusPercentage,
      infinityTier1Percentage: p.infinityTier1Percentage,
      infinityTier2Percentage: p.infinityTier2Percentage,
      managerBonusPercentage: p.managerBonusPercentage,
      maxLevels: p.maxLevels,
      pointValue: p.pointValue,
      legMultipliers: p.legMultipliers,
    }, null, 2));
  }
  await mongoose.disconnect();
}
run().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(()=>{}); process.exit(1); });
