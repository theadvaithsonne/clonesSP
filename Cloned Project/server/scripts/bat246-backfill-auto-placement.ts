/**
 * One-time backfill: places any already-qualified BAT246 distributor who
 * joined via a "Without Position" invite link and was never auto-placed
 * (because maybeAutoPlaceFirstBaseReferral didn't exist yet).
 *
 * For each Bat246Distributor with isQualified=true, isApproved=false,
 * bat246RefUserId set, and no active position reservation / dugout entry,
 * runs the same maybeAutoPlaceFirstBaseReferral logic used going forward.
 *
 * Run: npx ts-node src/scripts/bat246-backfill-auto-placement.ts
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";
import { Bat246PlayerBoard } from "../bat246/models/bat246PlayerBoard.model";
import { Bat246PositionReservation } from "../bat246/models/bat246PositionReservations.model";
import { User } from "../models/user.model";
import { maybeAutoPlaceFirstBaseReferral } from "../bat246/services/bat246.service";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  console.log("Connected to database\n");

  const candidates = await Bat246Distributor.find({
    isQualified: true,
    isApproved: false,
    bat246RefUserId: { $ne: null },
  }).lean();

  console.log(`Found ${candidates.length} qualified-but-unapproved distributor(s) to check\n`);

  let placed = 0;
  let skipped = 0;

  for (const dist of candidates as any[]) {
    const user = await User.findById(dist.userId).select("email").lean() as any;
    const label = user?.email ?? String(dist.userId);

    const reservation = await Bat246PositionReservation.findOne({
      reservedByUserId: dist.userId,
      status: "active",
    }).lean();
    if (reservation) {
      console.log(`  SKIP ${label} — has an active position reservation (manual flow)`);
      skipped++;
      continue;
    }

    const player = await Bat246Player.findOne({ userId: dist.userId }).select("_id").lean() as any;
    if (player) {
      const alreadyPlaced = await Bat246PlayerBoard.exists({
        playerId: player._id,
        position: { $regex: /^(dugout|atBat)\./ },
      });
      if (alreadyPlaced) {
        console.log(`  SKIP ${label} — already has a board placement`);
        skipped++;
        continue;
      }
    }

    const ok = await maybeAutoPlaceFirstBaseReferral(String(dist.userId), dist);
    if (ok) {
      console.log(`  PLACED ${label}`);
      placed++;
    } else {
      console.log(`  SKIP ${label} — referrer not 1st Base or no open AT BAT slot (salesCredits===1, normal manual flow applies)`);
      skipped++;
    }
  }

  console.log(`\nDone. Placed: ${placed}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
