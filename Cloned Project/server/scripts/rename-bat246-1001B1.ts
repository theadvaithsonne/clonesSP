/**
 * One-off fix: renames the placeholder Bat246 player/distributor whose
 * displayed name is literally "Bat246-1" (distributorId "1001B1") to a
 * random 10-character alphanumeric name, so it stops showing as test data
 * on the Home Plate slot of board 6-1000 (Entry 1).
 *
 * Schema notes:
 * - distributorId "1001B1" lives on bat246Distributors (Bat246Distributor model),
 *   linked to bat246Players via userId/playerId.
 * - The name shown as "playerName" on board slots is denormalized from
 *   Bat246Player.nickname at entry time (see bat246Entry.service.ts:
 *   `playerName: player.nickname || userEmail`).
 * - So the actual field to rename is Bat246Player.nickname.
 *
 * Only this one field on this one bat246Players document is modified.
 *
 * Run: npx ts-node src/scripts/rename-bat246-1001B1.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";

function randomAlphanumeric(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  console.log("Connected.\n");

  // 1. Locate via distributorId "1001B1" first.
  const dist = await Bat246Distributor.findOne({ distributorId: "1001B1" }).lean() as any;

  let player: any = null;

  if (dist) {
    console.log(`Found distributor: distributorId=${dist.distributorId}, firstName=${dist.firstName}, lastName=${dist.lastName}, userId=${dist.userId}, playerId=${dist.playerId}`);
    if (dist.playerId) {
      player = await Bat246Player.findById(dist.playerId);
    }
    if (!player && dist.userId) {
      player = await Bat246Player.findOne({ userId: dist.userId });
    }
  } else {
    console.log('Distributor with distributorId "1001B1" not found — falling back to nickname match.');
  }

  // 2. Fallback: match by nickname "Bat246-1" directly.
  if (!player) {
    player = await Bat246Player.findOne({ nickname: "Bat246-1" });
  }

  if (!player) {
    console.log('No bat246Players document found for distributorId "1001B1" or nickname "Bat246-1". Nothing updated.');
    await mongoose.disconnect();
    return;
  }

  const oldNickname = player.nickname;
  const newNickname = randomAlphanumeric(10);

  console.log(`\nTarget player document: _id=${player._id}, playerIdNo=${player.playerIdNo}, email=${player.email}`);
  console.log(`Field to update: nickname`);
  console.log(`Old value: ${oldNickname}`);

  player.nickname = newNickname;
  const saved = await player.save();

  console.log(`New value: ${saved.nickname}`);
  console.log(saved.nickname === newNickname ? "\nDB write confirmed: nickname updated successfully." : "\nWARNING: saved value does not match expected new value.");

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
