/**
 * Set protectionPeriodEnd to 1 minute from now for board trackingNumber="6-1001"
 * Run: npx tsx src/scripts/set-pp-1min.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(mongoUri);
  console.log("Connected\n");

  const oneMinuteFromNow = new Date(Date.now() + 60 * 1000);

  const result = await Bat246Board.updateOne(
    { trackingNumber: "6-1001" },
    { $set: { protectionPeriodEnd: oneMinuteFromNow } }
  );

  if (result.matchedCount === 0) throw new Error('Board "6-1001" not found');

  console.log(`✓ protectionPeriodEnd set to: ${oneMinuteFromNow.toISOString()}`);
  console.log(`  (~1 minute from now)`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
