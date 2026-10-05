/**
 * Trigger split on a board that already has all 8 AT BAT slots filled.
 * Run: npx ts-node src/bat246/scripts/triggerSplit.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { splitBoardPhase1 } from "../services/bat246Split.service";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";
const BOARD_ID = "6a0d4e4d1e0e732df906ca1a";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  console.log(`Triggering split for board ${BOARD_ID}...`);
  const result = await splitBoardPhase1(BOARD_ID);
  console.log("Phase 1 complete:", JSON.stringify(result, null, 2));

  // Wait for phase 2 (async, fires internally via setTimeout/setImmediate)
  console.log("\nWaiting 5s for phase 2 to complete...");
  await new Promise(res => setTimeout(res, 5000));

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
