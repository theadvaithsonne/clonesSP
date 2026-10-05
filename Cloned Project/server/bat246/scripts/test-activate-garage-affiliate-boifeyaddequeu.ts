/**
 * TESTING ONLY — temporary. Manually flips isGarageAffiliate: true for
 * boifeyaddequeu-4758@yopmail.com (just joined the Bat246 office today,
 * has NOT actually paid the $25 Garage Affiliate fee) so the "$25 Garage
 * Affiliate" step can be exercised in the UI without a real purchase.
 *
 * Before this ran, the Bat246Distributor doc had no isGarageAffiliate
 * field at all (not even `false`) — every other qualification flag is
 * also absent, so this alone does NOT complete qualification (isQualified
 * stays false, no distributorId/placement-notification side effects fire).
 *
 * MUST BE REVERTED once testing is done — use the companion script:
 *   src/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts
 *
 * Run: npx ts-node src/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts
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
  const { Bat246Distributor } = await import("../models/bat246Distributor.model");

  const user = await User.findOne({ email: USER_EMAIL }).select("_id email").lean() as any;
  if (!user) throw new Error("User not found");
  const userId = new Types.ObjectId(user._id);

  const before = await Bat246Distributor.findOne({ userId }).lean() as any;
  if (!before) throw new Error("No Bat246Distributor record for this user");
  console.log("Before:", before);

  if (before.isGarageAffiliate) {
    console.log("isGarageAffiliate is already true — nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const isNowQualified = !!(before.isOfficeMember && before.hasBat246Membership && before.hasPurchasedProduct);
  const wasQualified = !!before.isQualified;
  const upd: any = { isGarageAffiliate: true };
  if (isNowQualified && !wasQualified) {
    upd.isQualified = true;
    upd.qualifiedAt = new Date();
  }

  await Bat246Distributor.updateOne({ userId }, { $set: upd });

  if (isNowQualified && !wasQualified) {
    // Mirrors the real purchase-success side effects — only relevant if
    // the other 3 flags somehow already happened to be true.
    const { assignDistributorId } = await import("../services/bat246DistributorId.util");
    const { maybeCreatePlacementNotification } = await import("../services/bat246.service");
    await assignDistributorId(user._id.toString()).catch((e: any) => console.error("assignDistributorId failed:", e.message));
    await maybeCreatePlacementNotification(user._id.toString()).catch(() => {});
  }

  const after = await Bat246Distributor.findOne({ userId }).lean();
  console.log("After:", after);
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
