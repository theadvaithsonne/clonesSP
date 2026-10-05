/**
 * Manually run split phase 2 for boards that completed phase 1 but whose
 * phase 2 async step failed (e.g. connection closed before it finished).
 *
 * Run: npx ts-node src/bat246/scripts/runSplitPhase2.ts
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { Bat246Movement } from "../models/bat246Movement.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

const PARENT_ID = "6a0d4e4d1e0e732df906ca1a";
const LEFT_ID   = "6a14694bd47c2c0cd1be7ea2";
const RIGHT_ID  = "6a14694bd47c2c0cd1be7ea4";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const now = new Date();

  const [leftBoard, rightBoard] = await Promise.all([
    Bat246Board.findById(LEFT_ID).lean(),
    Bat246Board.findById(RIGHT_ID).lean(),
  ]) as [any, any];

  if (!leftBoard || !rightBoard) throw new Error("Child boards not found");

  console.log(`Left board:  ${leftBoard.trackingNumber}`);
  console.log(`Right board: ${rightBoard.trackingNumber}\n`);

  const allSlotMoves: Array<{
    playerId: Types.ObjectId;
    playerName: string;
    toPos: string;
    toBoardId: Types.ObjectId;
  }> = [];

  const collectMoves = (board: any, boardId: Types.ObjectId) => {
    const slots: Array<{ slot: any; pos: string }> = [
      { slot: board.homePlate,   pos: "homePlate" },
      { slot: board.thirdBase,   pos: "thirdBase" },
      { slot: board.secondBaseA, pos: "secondBaseA" },
      { slot: board.secondBaseB, pos: "secondBaseB" },
      ...(board.firstBase ?? []).map((s: any, i: number) => ({ slot: s, pos: `firstBase.${["A","B","C","D"][i]}` })),
      ...(board.atBat ?? []).map((s: any, i: number) => ({ slot: s, pos: `atBat.${i}` })),
      ...(board.dugout ?? []).map((s: any, i: number) => ({ slot: s, pos: `dugout.${i}` })),
      ...(board.onDeckCircle ?? []).map((s: any, i: number) => ({ slot: s, pos: `onDeckCircle.${i}` })),
    ];
    for (const { slot, pos } of slots) {
      if (slot?.playerId) {
        allSlotMoves.push({ playerId: slot.playerId, playerName: slot.playerName ?? "", toPos: pos, toBoardId: boardId });
      }
    }
  };

  collectMoves(leftBoard,  new Types.ObjectId(LEFT_ID));
  collectMoves(rightBoard, new Types.ObjectId(RIGHT_ID));

  console.log(`Total slot moves to record: ${allSlotMoves.length}`);

  // a. Write movement records (skip if already exist)
  const existingMovements = await Bat246Movement.countDocuments({ fromBoardId: new Types.ObjectId(PARENT_ID), reason: "split" });
  if (existingMovements > 0) {
    console.log(`  Movement records already exist (${existingMovements}), skipping insert`);
  } else {
    await Bat246Movement.insertMany(
      allSlotMoves.map(m => ({
        fromBoardId: new Types.ObjectId(PARENT_ID),
        toBoardId: m.toBoardId,
        playerId: m.playerId,
        playerName: m.playerName,
        fromPosition: "split",
        toPosition: m.toPos,
        reason: "split",
        timestamp: now,
      }))
    );
    console.log(`  Inserted ${allSlotMoves.length} movement records`);
  }

  // b. Mark parent PlayerBoard entries as left
  const parentResult = await Bat246PlayerBoard.updateMany(
    { boardId: new Types.ObjectId(PARENT_ID), status: "active" },
    { $set: { status: "left", leftAt: now } }
  );
  console.log(`  Marked ${parentResult.modifiedCount} parent PlayerBoard entries as 'left'`);

  // c. Upsert child board PlayerBoard memberships
  let upserted = 0;
  for (const m of allSlotMoves) {
    const res = await Bat246PlayerBoard.updateOne(
      { playerId: m.playerId, boardId: m.toBoardId },
      { $setOnInsert: { playerId: m.playerId, boardId: m.toBoardId, position: m.toPos, status: "active", joinedAt: now } },
      { upsert: true }
    );
    if (res.upsertedCount > 0) upserted++;
  }
  console.log(`  Upserted ${upserted} new PlayerBoard memberships`);

  // d. Increment player entry counts
  const allPlayerIds = [...new Set(allSlotMoves.map(m => m.playerId.toString()))];
  for (const pid of allPlayerIds) {
    await Bat246Player.findByIdAndUpdate(pid, { $inc: { "minorLeague.totalEntries": 1 } });
  }
  console.log(`  Updated entry counts for ${allPlayerIds.length} players`);

  console.log("\n✅ Phase 2 complete.");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
