/**
 * One-time fix: copy inviteProductId from parent board to the two child boards
 * that were created before the split service was patched to propagate it.
 *
 * Run: npx ts-node src/bat246/scripts/fixChildBoardInviteProductId.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../models/bat246Board.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

const PARENT_ID = "6a0d4e4d1e0e732df906ca1a";
const LEFT_ID   = "6a14694bd47c2c0cd1be7ea2";
const RIGHT_ID  = "6a14694bd47c2c0cd1be7ea4";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const parent = await Bat246Board.findById(PARENT_ID).lean() as any;
  if (!parent) throw new Error(`Parent board ${PARENT_ID} not found`);

  const inviteProductId = parent.inviteProductId ?? null;
  console.log(`Parent board:     ${parent.trackingNumber}`);
  console.log(`inviteProductId:  ${inviteProductId ?? "(null — nothing to copy)"}\n`);

  if (!inviteProductId) {
    console.log("⚠️  Parent has no inviteProductId set. Aborting — nothing to propagate.");
    await mongoose.disconnect();
    return;
  }

  const [left, right] = await Promise.all([
    Bat246Board.findById(LEFT_ID).lean() as any,
    Bat246Board.findById(RIGHT_ID).lean() as any,
  ]);

  if (!left || !right) throw new Error("One or both child boards not found");

  console.log(`Left  board (${left.trackingNumber}):  current inviteProductId = ${(left as any).inviteProductId ?? "null"}`);
  console.log(`Right board (${right.trackingNumber}): current inviteProductId = ${(right as any).inviteProductId ?? "null"}\n`);

  const result = await Bat246Board.updateMany(
    { _id: { $in: [new mongoose.Types.ObjectId(LEFT_ID), new mongoose.Types.ObjectId(RIGHT_ID)] } },
    { $set: { inviteProductId } }
  );

  console.log(`Updated ${result.modifiedCount} child board(s) with inviteProductId: ${inviteProductId}`);
  console.log("\n✅ Done.");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
