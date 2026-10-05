/**
 * One-time fix: promote dugout players to AT BAT on all active boards
 * where the Protection Period has already expired.
 *
 * Run: npx ts-node src/bat246/scripts/fixDugoutPromotion.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../models/bat246Board.model";
import { promoteDugoutAfterPP } from "../services/bat246Entry.service";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const boards = await Bat246Board.find({ status: "active" }).lean() as any[];
  const now = new Date();
  let fixed = 0;

  for (const board of boards) {
    const ppExpired = board.protectionPeriodEnd && now > new Date(board.protectionPeriodEnd);
    const dugoutCount = (board.dugout ?? []).filter(Boolean).length;
    const emptyAtBat = (board.atBat ?? []).filter((s: any) => !s).length;

    if (ppExpired && dugoutCount > 0 && emptyAtBat > 0) {
      console.log(`Board ${board._id} (${board.trackingNumber}) — dugout: ${dugoutCount}, empty AT BAT: ${emptyAtBat}`);
      const result = await promoteDugoutAfterPP(board._id.toString());
      console.log(`  → moved: ${result.moved}, splitTriggered: ${result.splitTriggered}\n`);
      fixed++;
    }
  }

  console.log(`Done. Boards fixed: ${fixed}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
