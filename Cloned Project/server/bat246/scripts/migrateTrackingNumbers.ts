/**
 * One-time migration: rename tracking numbers to the new {family}-{sequence} format.
 *
 * Old → New
 *   1-2000    →  1-100      (family 1, original)
 *   1-2002 L  →  1-101 L    (family 1, first left split)
 *   1-2003 R  →  1-102 R    (family 1, first right split)
 *   1-2004    →  2-100      (family 2, separate new board)
 *
 * Also sets familyNumber on each board and corrects the config counters.
 * Run: npx ts-node src/bat246/scripts/migrateTrackingNumbers.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Config } from "../models/bat246Config.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

const MIGRATIONS: Array<{
  oldTracking: string;
  newTracking: string;
  familyNumber: number;
}> = [
  { oldTracking: "1-2000",   newTracking: "1-100",     familyNumber: 1 },
  { oldTracking: "1-2002 L", newTracking: "1-101 L",   familyNumber: 1 },
  { oldTracking: "1-2003 R", newTracking: "1-102 R",   familyNumber: 1 },
  { oldTracking: "1-2004",   newTracking: "2-100",      familyNumber: 2 },
];

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  for (const { oldTracking, newTracking, familyNumber } of MIGRATIONS) {
    const result = await Bat246Board.updateOne(
      { trackingNumber: oldTracking },
      { $set: { trackingNumber: newTracking, familyNumber } }
    );
    if (result.matchedCount === 0) {
      console.log(`  SKIP  ${oldTracking} (not found)`);
    } else {
      console.log(`  OK    ${oldTracking} → ${newTracking}  (family ${familyNumber})`);
    }
  }

  // Fix config counters
  //   familyCounter   = 2  (families 1 and 2 exist)
  //   familySequences = { "1": 102, "2": 100 }
  //     family 1 last used sequence 102 (101 L + 102 R consumed)
  //     family 2 last used sequence 100 (just the original)
  await Bat246Config.updateOne(
    {},
    {
      $set: {
        familyCounter: 2,
        familySequences: { "1": 102, "2": 100 },
      },
    },
    { upsert: true }
  );
  console.log("  OK    config → familyCounter=2, familySequences={1:102, 2:100}");

  await mongoose.disconnect();
  console.log("\nMigration complete.");
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
