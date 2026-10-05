import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";
const CORRECT_ORG_ID = "6a0d34e677323d1b81c6469b";
const COUPON_CODE = "BAT246FREE";

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const result = await db.collection("coupons").updateOne(
    { code: COUPON_CODE },
    { $set: { orgId: new mongoose.Types.ObjectId(CORRECT_ORG_ID) } }
  );

  console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  console.log(`Coupon "${COUPON_CODE}" orgId corrected to ${CORRECT_ORG_ID}`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
