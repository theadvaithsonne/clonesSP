/**
 * Fix active boards' trackingNumber to match their root board's family prefix.
 *
 * Problem: boards split from "6-1001" got "1-101 L" / "1-102 R" because
 * familyNumber was still 1 when the split ran. This script corrects them.
 *
 * Logic for each active child board:
 *   1. Walk parentBoardId chain up to root (no parentBoardId).
 *   2. Parse root's trackingNumber prefix (e.g. "6" from "6-1001").
 *   3. If the child's prefix differs, replace it while keeping sequence + side suffix.
 *      e.g. "1-101 L" → "6-101 L"
 *   4. Also sync familyNumber to match the prefix integer.
 *
 * Run: npx tsx src/scripts/fix-active-board-tracking-numbers.ts
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

  // Load all boards so we can walk the parent chain in memory.
  const allBoards = await Bat246Board.find({}, { _id: 1, trackingNumber: 1, familyNumber: 1, parentBoardId: 1, status: 1 }).lean();
  const boardMap = new Map(allBoards.map(b => [b._id.toString(), b]));

  /** Walk up to root (board with no parentBoardId). */
  function findRoot(boardId: string): any | null {
    const visited = new Set<string>();
    let cur: any = boardMap.get(boardId);
    while (cur) {
      if (visited.has(cur._id.toString())) return null; // cycle guard
      visited.add(cur._id.toString());
      if (!cur.parentBoardId) return cur;
      cur = boardMap.get(cur.parentBoardId.toString());
    }
    return null;
  }

  const activeBoards = allBoards.filter(b => b.status === "active" && b.parentBoardId);

  console.log(`Active child boards found: ${activeBoards.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const board of activeBoards) {
    const root = findRoot(board._id.toString());
    if (!root) {
      console.warn(`  [WARN] Could not find root for board ${board._id} (${board.trackingNumber})`);
      skipped++;
      continue;
    }

    const rootTn: string = (root as any).trackingNumber ?? "";
    const rootPrefixMatch = rootTn.match(/^(\d+)-/);
    if (!rootPrefixMatch) {
      console.warn(`  [WARN] Root board ${root._id} has unparseable trackingNumber: "${rootTn}"`);
      skipped++;
      continue;
    }
    const rootPrefix = rootPrefixMatch[1]; // e.g. "6"
    const rootPrefixNum = parseInt(rootPrefix, 10);

    const childTn: string = (board as any).trackingNumber ?? "";
    const childPrefixMatch = childTn.match(/^(\d+)-(.+)$/);
    if (!childPrefixMatch) {
      console.warn(`  [WARN] Board ${board._id} has unparseable trackingNumber: "${childTn}"`);
      skipped++;
      continue;
    }
    const childPrefix = childPrefixMatch[1]; // e.g. "1"
    const rest        = childPrefixMatch[2]; // e.g. "101 L"

    if (childPrefix === rootPrefix && (board as any).familyNumber === rootPrefixNum) {
      // Already correct
      continue;
    }

    const newTn = `${rootPrefix}-${rest}`;
    console.log(`  Fixing board ${board._id}: "${childTn}" → "${newTn}" (familyNumber: ${(board as any).familyNumber} → ${rootPrefixNum})`);

    await Bat246Board.updateOne(
      { _id: board._id },
      { $set: { trackingNumber: newTn, familyNumber: rootPrefixNum } }
    );
    fixed++;
  }

  console.log(`\nDone. Fixed: ${fixed}, Skipped/warned: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
