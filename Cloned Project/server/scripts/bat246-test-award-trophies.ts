/**
 * TEST ONLY — manually award trophies on board 6-1000:
 *   - Home Plate player: all remaining trophies
 *   - 3rd Base player: H trophy
 * Uses the same idempotent awardTrophy (already-owned tiers are skipped).
 *
 * Run: npx ts-node src/scripts/bat246-test-award-trophies.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";
import { awardTrophy, TrophyTier } from "../bat246/services/bat246Trophy.service";

const BOARD_ID = "6a43e588a423c9f21b9564ac"; // board 6-1000

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);

  const board = await Bat246Board.findById(BOARD_ID).select("trackingNumber homePlate thirdBase").lean() as any;
  if (!board) throw new Error("Board not found");
  console.log(`Board ${board.trackingNumber}`);

  const targets: { playerId: any; label: string; tiers: TrophyTier[] }[] = [];
  if (board.homePlate?.playerId) targets.push({ playerId: board.homePlate.playerId, label: `Home Plate (${board.homePlate.playerName})`, tiers: ["G", "H", "T"] });
  if (board.thirdBase?.playerId) targets.push({ playerId: board.thirdBase.playerId, label: `3rd Base (${board.thirdBase.playerName})`, tiers: ["H"] });

  for (const t of targets) {
    for (const tier of t.tiers) {
      const awarded = await awardTrophy(t.playerId, tier, BOARD_ID, board.trackingNumber);
      console.log(`  ${t.label} — ${tier}: ${awarded ? "AWARDED" : "already had it"}`);
    }
  }

  const ids = targets.map((t) => t.playerId);
  const players = await Bat246Player.find({ _id: { $in: ids } }).select("nickname trophies").lean() as any[];
  console.log("\nFinal state:");
  for (const p of players) {
    const owned = (["G", "H", "T"] as const).filter((t) => p.trophies?.[t]).join(", ") || "none";
    console.log(`  ${p.nickname}: ${owned}`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
