/**
 * Reverts BOTH temporary test scripts for boifeyaddequeu-4758@yopmail.com:
 *   - test-activate-garage-affiliate-boifeyaddequeu.ts
 *   - test-create-up-purchase-boifeyaddequeu.ts
 *
 * 1) Unsets isGarageAffiliate entirely (the field didn't exist before the
 *    test activation — not even as `false`), and if that test run happened
 *    to also flip isQualified/qualifiedAt (only possible if the other 3
 *    qualification flags were independently true), unsets those too so the
 *    record goes back to exactly its pre-test shape.
 * 2) Deletes the test UnilevelPlusPurchase doc — identified precisely by
 *    its "TEST-" paymentId prefix / metadata.test:true, so this only ever
 *    removes the record this test created, never a real purchase.
 *
 * Does NOT touch a distributorId/placement-notification if one was created —
 * that only would have happened if this user had genuinely completed all 4
 * steps, which was not the case when the test script ran (confirmed: no
 * other flags were set on this record beforehand).
 *
 * Run: npx ts-node src/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts
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
  const { UnilevelPlusPurchase } = await import("../../models/unilevelPlusPurchase.model");

  const user = await User.findOne({ email: USER_EMAIL }).select("_id email").lean() as any;
  if (!user) throw new Error("User not found");
  const userId = new Types.ObjectId(user._id);

  const before = await Bat246Distributor.findOne({ userId }).lean() as any;
  console.log("Before revert:", before);
  if (!before) throw new Error("No Bat246Distributor record for this user");

  const unset: any = { isGarageAffiliate: "" };
  // Only unset isQualified/qualifiedAt if hasPurchasedProduct/hasBat246Membership
  // are still not both true — i.e. the qualification really was only true
  // because of the test flag, not a real independent qualification since.
  if (!(before.hasBat246Membership && before.hasPurchasedProduct)) {
    if (before.isQualified) unset.isQualified = "";
    if (before.qualifiedAt) unset.qualifiedAt = "";
  }

  await Bat246Distributor.updateOne({ userId }, { $unset: unset });

  const after = await Bat246Distributor.findOne({ userId }).lean();
  console.log("After revert (Bat246Distributor):", after);

  const purchaseDeleteResult = await UnilevelPlusPurchase.deleteOne({
    userId,
    "metadata.test": true,
    paymentId: { $regex: /^TEST-/ },
  });
  console.log("Test UnilevelPlusPurchase deleted:", purchaseDeleteResult.deletedCount);

  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
