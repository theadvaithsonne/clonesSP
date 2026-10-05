/**
 * One-time test cleanup for board "1-101 R":
 * Removes all dugout entries EXCEPT "brown card test" and "black card test".
 *
 * Run: npx ts-node src/scripts/trim-1101R-dugout.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";

const BOARD_TRACKING_NO = "1-101 R";
const KEEP_NAMES = ["brown card test", "black card test"];

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  console.log("Connected to database\n");

  const board = await Bat246Board.findOne({ trackingNumber: BOARD_TRACKING_NO }).lean() as any;
  if (!board) throw new Error(`Board "${BOARD_TRACKING_NO}" not found`);

  console.log(`Board found: ${board._id}  status=${board.status}`);

  const dugout: any[] = board.dugout ?? [];
  console.log(`\nDugout before (${dugout.length} entries):`);
  dugout.forEach((d: any, i: number) => console.log(`  [${i}] ${d?.playerName ?? "—"}  (${d?.playerEmail ?? ""})`));

  const kept = dugout.filter((d: any) => {
    const name = (d?.playerName ?? "").toLowerCase().trim();
    return KEEP_NAMES.some((k) => name.includes(k));
  });

  const removed = dugout.length - kept.length;

  console.log(`\nKeeping ${kept.length} entries, removing ${removed}:`);
  kept.forEach((d: any) => console.log(`  ✓ ${d?.playerName}`));

  await Bat246Board.updateOne({ _id: board._id }, { $set: { dugout: kept } });

  console.log(`\n✓ Dugout trimmed. ${removed} entr${removed === 1 ? "y" : "ies"} removed.`);

  // Print final state
  const updated = await Bat246Board.findOne({ _id: board._id }).lean() as any;
  const finalDugout: any[] = updated?.dugout ?? [];
  console.log(`\nDugout after (${finalDugout.length} entries):`);
  finalDugout.forEach((d: any, i: number) => console.log(`  [${i}] ${d?.playerName ?? "—"}`));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
