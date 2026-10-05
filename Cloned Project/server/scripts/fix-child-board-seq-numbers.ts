/**
 * Fix child boards of "6-1001" to correct even/odd sequence rule:
 *   Left  = even sequence → "6-1002 L"
 *   Right = odd  sequence → "6-1003 R"
 *
 * Run: npx tsx src/scripts/fix-child-board-seq-numbers.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";
import { Bat246Config } from "../bat246/models/bat246Config.model";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(mongoUri);
  console.log("Connected\n");

  const parent = await Bat246Board.findOne({ trackingNumber: "6-1001" }).lean();
  if (!parent) throw new Error('Parent board "6-1001" not found');

  const children = await Bat246Board.find({ parentBoardId: parent._id }).lean();
  if (children.length === 0) throw new Error("No child boards found for 6-1001");

  console.log(`Parent: 6-1001 (_id: ${parent._id})`);
  children.forEach(c => console.log(`  Current: ${(c as any).trackingNumber} (side: ${(c as any).side})`));

  for (const child of children) {
    const side = (child as any).side as string;
    // Left = even (1002), Right = odd (1003)
    let newTn: string;
    if (side === "left")       newTn = "6-1002 L";
    else if (side === "right") newTn = "6-1003 R";
    else {
      console.warn(`  [WARN] Unexpected side "${side}" on board ${child._id}`);
      continue;
    }
    console.log(`  Fixing ${child._id}: "${(child as any).trackingNumber}" → "${newTn}"`);
    await Bat246Board.updateOne({ _id: child._id }, { $set: { trackingNumber: newTn, familyNumber: 6 } });
  }

  // Ensure familySequences.6 is at least 1003
  await Bat246Config.updateOne({}, { $max: { "familySequences.6": 1003 } }, { upsert: true });
  const cfg = await Bat246Config.findOne({}).lean();
  console.log(`\nfamilySequences.6 = ${(cfg as any)?.familySequences?.["6"]}`);

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
