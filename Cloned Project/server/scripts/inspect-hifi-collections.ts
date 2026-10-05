/**
 * One-shot: sample the hifi_* collections in roam-admin-prod so we know
 * the exact field shape before wiring the invoice-payment integration.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected\n");
  const db = mongoose.connection.db!;

  const targets = [
    "hifi_products",
    "hifi_investment_applications",
    "hifi_investment_subscriptions",
    "hifi_investment_kyc",
    "hifi_payout_runs",
    "hifi_activities",
  ];

  for (const name of targets) {
    const col = db.collection(name);
    const count = await col.countDocuments({});
    console.log(`════ ${name} (${count} docs) ════`);
    if (count === 0) {
      console.log("  (empty)\n");
      continue;
    }
    const samples = await col.find({}).limit(2).toArray();
    for (const s of samples) {
      console.log(JSON.stringify(s, null, 2));
      console.log("---");
    }
    console.log();
  }
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
