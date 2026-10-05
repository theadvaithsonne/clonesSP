/**
 * TESTING ONLY — temporary. Companion to
 * test-activate-garage-affiliate-boifeyaddequeu.ts.
 *
 * That script only flipped Bat246Distributor.isGarageAffiliate directly,
 * which drives the "$25 Garage Affiliate" progress-step checkmark — but the
 * separate "You're missing out on all affiliate earnings" banner reads
 * GET /wallet/affiliate/balance -> hasPurchasedUnilevelPlus, which checks
 * for a real, active UnilevelPlusPurchase doc (src/services/wallet.ts:906).
 * This script creates that doc too, purely so the banner also disappears
 * for this test user — clearly marked as a test record (paymentId prefix
 * "TEST-", metadata.test: true) so the companion revert script can find
 * and remove it precisely.
 *
 * Run: npx ts-node src/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const USER_EMAIL = "boifeyaddequeu-4758@yopmail.com";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(mongoUri);
  const { User } = await import("../../models/user.model");
  const { UnilevelPlusPurchase } = await import("../../models/unilevelPlusPurchase.model");
  const { UnilevelPlusPlan } = await import("../../models/unilevelPlusPlan.model");

  const user = await User.findOne({ email: USER_EMAIL }).select("_id email").lean() as any;
  if (!user) throw new Error("User not found");
  const userId = new Types.ObjectId(user._id);

  const existing = await UnilevelPlusPurchase.findOne({ userId }).lean();
  if (existing) {
    console.log("UnilevelPlusPurchase already exists for this user — leaving it alone:", existing);
    await mongoose.disconnect();
    return;
  }

  const plan = await UnilevelPlusPlan.findOne().sort({ createdAt: 1 }).lean() as any;
  if (!plan) throw new Error("No UnilevelPlusPlan found in DB to reference");
  console.log("Using plan:", { _id: plan._id, name: (plan as any).name, price: (plan as any).price });

  const created = await UnilevelPlusPurchase.create({
    userId,
    planId: plan._id,
    paymentId: `TEST-${userId.toString()}-${Date.now()}`,
    amount: 25,
    currency: "USD",
    status: "active",
    purchasedAt: new Date(),
    metadata: { test: true, createdBy: "test-create-up-purchase-boifeyaddequeu.ts" },
  });

  console.log("Created test UnilevelPlusPurchase:", created.toObject());
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
