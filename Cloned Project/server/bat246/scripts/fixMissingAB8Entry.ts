/**
 * One-time fix: battestuser13@yopmail.com purchased via AB7's generic invite
 * but was never placed on board 6a0d4e4d1e0e732df906ca1a because the checkout
 * page was not forwarding the bat246GenRef URL param to the backend.
 *
 * This script:
 *  1. Finds battestuser13 and resolves their Bat246Player record
 *  2. Confirms AB8 (index 7) is still empty
 *  3. Places them at AB8
 *  4. Awards a Gold card to the AB7 player (referrer)
 *
 * Run: npx ts-node src/bat246/scripts/fixMissingAB8Entry.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { User } from "../../models/user.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";
const BOARD_ID = "6a0d4e4d1e0e732df906ca1a";
const TARGET_EMAIL = "battestuser13@yopmail.com";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const board = await Bat246Board.findById(BOARD_ID);
  if (!board) throw new Error(`Board ${BOARD_ID} not found`);
  const boardObj = board.toObject() as any;

  const atBat: any[] = boardObj.atBat;
  console.log("Current AT BAT state:");
  atBat.forEach((s, i) => console.log(`  AB${i + 1}: ${s ? s.playerEmail || s.playerName : "EMPTY"}`));

  // Find AB8 (index 7)
  const AB8_INDEX = 7;
  if (atBat[AB8_INDEX]) {
    console.log(`\nAB8 is already filled with: ${atBat[AB8_INDEX].playerEmail}. Aborting.`);
    await mongoose.disconnect();
    return;
  }

  // Find AB7 (index 6) — must have a player (the referrer)
  const AB7_INDEX = 6;
  const ab7Slot = atBat[AB7_INDEX];
  if (!ab7Slot?.playerId) {
    throw new Error("AB7 is empty — cannot determine referrer for Gold card");
  }
  console.log(`\nAB7 referrer: ${ab7Slot.playerEmail || ab7Slot.playerName} (playerId: ${ab7Slot.playerId})`);

  // Resolve battestuser13
  const user = await User.findOne({ email: TARGET_EMAIL }).lean() as any;
  if (!user) throw new Error(`User ${TARGET_EMAIL} not found — run addTestUsers10to19 first`);

  let player = await Bat246Player.findOne({ userId: user._id });
  if (!player) {
    const count = await Bat246Player.countDocuments();
    player = await Bat246Player.create({
      userId: user._id,
      playerIdNo: `${2000 + count}HI`,
      nickname: user.name || TARGET_EMAIL,
      email: TARGET_EMAIL,
      memberSince: new Date(),
    });
    console.log(`Created Bat246Player for ${TARGET_EMAIL}: ${player._id}`);
  } else {
    console.log(`Found existing Bat246Player for ${TARGET_EMAIL}: ${player._id}`);
  }

  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);

  const newSlot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || TARGET_EMAIL,
    playerEmail: TARGET_EMAIL,
    enteredAt: now,
    joinedBoardAt: now,
    referredBy: ab7Slot.playerId,
    referredByName: ab7Slot.playerName,
    countryResidence: null,
    countryOrigin: null,
  };

  // Build update: place at AB8 + award Gold card to AB7 if they don't have one yet
  const update: any = {
    $set: { [`atBat.${AB8_INDEX}`]: newSlot },
  };

  if (!ab7Slot.cardType) {
    update.$set[`atBat.${AB7_INDEX}.cardType`] = "Gold";
    console.log("Awarding Gold card to AB7 (first referral)");
  } else {
    console.log(`AB7 already has cardType: ${ab7Slot.cardType}`);
  }

  await Bat246Board.updateOne({ _id: board._id }, update);

  await Bat246PlayerBoard.updateOne(
    { playerId: player._id, boardId: board._id },
    { $set: { position: `atBat.${AB8_INDEX}`, status: "active" } },
    { upsert: true }
  );

  await Bat246Player.updateOne(
    { _id: player._id },
    { $inc: { "minorLeague.totalEntries": 1 } }
  );

  console.log(`\n✅ Placed ${TARGET_EMAIL} at AB8 (index ${AB8_INDEX})`);
  console.log(`   Entry #: ${entryNo}`);
  console.log(`   Referred by: ${ab7Slot.playerName} (AB7)`);

  // Check if all 8 AT BAT slots are now filled
  const refreshed = await Bat246Board.findById(BOARD_ID).lean() as any;
  const filled = (refreshed.atBat ?? []).filter(Boolean).length;
  console.log(`\nAT BAT after fix: ${filled}/8 filled`);
  if (filled >= 8) {
    console.log("⚠️  All 8 AT BAT slots filled — split should trigger. Run the split manually if needed.");
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
