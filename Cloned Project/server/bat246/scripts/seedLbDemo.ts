/**
 * Seeds G/H/T leaderboard demo data on boards 1-100, 1-101 L, 1-102 R.
 * Takes existing players from each board's slots, stamps them with qualifying
 * card counts + crossedHp, then writes all 3 LB rows on each board.
 *
 * Run: npx ts-node src/bat246/scripts/seedLbDemo.ts
 * Safe to re-run — only updates those 3 boards and their slot players.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

// Per-tier demo config: cards to give each holder + lifetime earnings for progress bar
const TIER_CONFIG = {
  G: {
    tier: "G" as const,
    totalBCs: 7,
    cards: { gold: 1, black: 3, brown: 1, green: 2, gray: 0 },
    lbField: "grandSlam",
    lbEarnings: 45_000,   // 15% of $300k cap
    earningsOnBoard: 4_500,
    crossedDaysAgo: 30,
    country: { res: "CA", ori: "LK" },
  },
  H: {
    tier: "H" as const,
    totalBCs: 5,
    cards: { gold: 1, black: 2, brown: 0, green: 2, gray: 0 },
    lbField: "homeRun",
    lbEarnings: 35_000,   // 35% of $100k cap
    earningsOnBoard: 2_800,
    crossedDaysAgo: 15,
    country: { res: "US", ori: "US" },
  },
  T: {
    tier: "T" as const,
    totalBCs: 3,
    cards: { gold: 1, black: 0, brown: 0, green: 2, gray: 0 },
    lbField: "triple",
    lbEarnings: 12_000,   // 24% of $50k cap
    earningsOnBoard: 1_200,
    crossedDaysAgo: 5,
    country: { res: "AU", ori: "NG" },
  },
} as const;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const TRACKING_NOS = ["1-100", "1-101 L", "1-102 R"];
  const boards = await Bat246Board.find({ trackingNumber: { $in: TRACKING_NOS } }).lean();

  if (boards.length === 0) {
    console.error("No boards found for:", TRACKING_NOS.join(", "));
    console.error("Check tracking numbers in your DB.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const now = new Date();

  for (const board of boards) {
    const b = board as any;

    // Collect up to 3 distinct occupied player slots (HP > 3B > 2BA > 2BB > 1B > AB)
    const candidates: Array<{ playerId: string; playerName: string }> = [];
    const seen = new Set<string>();

    const slotList = [
      b.homePlate,
      b.thirdBase,
      b.secondBaseA,
      b.secondBaseB,
      ...(b.firstBase ?? []),
      ...(b.atBat ?? []),
    ];

    for (const slot of slotList) {
      if (candidates.length >= 3) break;
      if (slot?.playerId && !seen.has(slot.playerId.toString())) {
        seen.add(slot.playerId.toString());
        candidates.push({
          playerId: slot.playerId.toString(),
          playerName: slot.playerName ?? slot.playerEmail ?? "Player",
        });
      }
    }

    if (candidates.length < 3) {
      console.warn(`Board ${b.trackingNumber}: only ${candidates.length} players found — need 3. Skipping.`);
      continue;
    }

    const tiers = (["G", "H", "T"] as const);
    const lbRows: any[] = [];

    for (let i = 0; i < 3; i++) {
      const cfg = TIER_CONFIG[tiers[i]];
      const pid = candidates[i].playerId;
      const crossedAt = new Date(now.getTime() - cfg.crossedDaysAgo * 24 * 60 * 60 * 1000);

      await Bat246Player.findByIdAndUpdate(pid, {
        $set: {
          "minorLeague.crossedHp":           true,
          "minorLeague.crossedHpAt":         crossedAt,
          "minorLeague.totalBCs":            cfg.totalBCs,
          "minorLeague.cardsEarned.gold":    cfg.cards.gold,
          "minorLeague.cardsEarned.black":   cfg.cards.black,
          "minorLeague.cardsEarned.brown":   cfg.cards.brown,
          "minorLeague.cardsEarned.green":   cfg.cards.green,
          "minorLeague.cardsEarned.gray":    cfg.cards.gray,
          [`minorLeague.lbEarnings.${cfg.lbField}`]: cfg.lbEarnings,
          countryResidence: cfg.country.res,
          countryOrigin:    cfg.country.ori,
        },
      });

      lbRows.push({
        tier: cfg.tier,
        playerId: new mongoose.Types.ObjectId(pid),
        qualifiedAt: crossedAt,
        earningsOnBoard: cfg.earningsOnBoard,
      });

      console.log(`  ${cfg.tier}: ${candidates[i].playerName} (${pid}) — $${cfg.lbEarnings.toLocaleString()} earned`);
    }

    await Bat246Board.findByIdAndUpdate(b._id, { $set: { leaderBoard: lbRows } });
    console.log(`Board ${b.trackingNumber} leaderBoard updated.`);
  }

  console.log("\nDone. Refresh the board pages to see G/H/T bars.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
