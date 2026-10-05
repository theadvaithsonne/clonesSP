/**
 * Trophies Distribution sweep — awards permanent T/H/G trophies to every
 * player currently occupying a leaderboard slot on any board.
 * Idempotent: already-earned trophies are never re-awarded.
 *
 * Run: npx ts-node src/scripts/bat246-distribute-trophies.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { distributeTrophies } from "../bat246/services/bat246Trophy.service";
import { Bat246Player } from "../bat246/models/bat246Player.model";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  console.log("Connected. Running trophy distribution sweep…\n");

  const { scannedBoards, awarded } = await distributeTrophies();
  console.log(`\nScanned ${scannedBoards} board(s) with LB occupants. Newly awarded: ${awarded} trophy/trophies.`);

  // Show all trophy holders for verification
  const holders = await Bat246Player.find({
    $or: [
      { "trophies.T": { $ne: null } },
      { "trophies.H": { $ne: null } },
      { "trophies.G": { $ne: null } },
    ],
  }).select("nickname email trophies").lean() as any[];

  console.log(`\nTrophy holders (${holders.length}):`);
  for (const p of holders) {
    const owned = (["G", "H", "T"] as const).filter((t) => p.trophies?.[t]).join(", ");
    console.log(`  ${p.nickname ?? p.email}: ${owned}`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
