/**
 * Reconstructs the correct salesCredits for firstBase slots by counting
 * how many AT BAT players have that firstBase player as their referrer.
 * Prints the reconstructed values, then asks for confirmation before applying.
 *
 * Run: npx ts-node src/scripts/reconstruct-firstbase-credits.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const boards = db.collection("bat246boards");

  const docs = await boards.find({}).toArray();

  for (const board of docs) {
    console.log(`\nBoard ${board.boardNumber} (${board.trackingNumber})`);

    const atBatSlots: any[] = board.atBat || [];

    for (let i = 0; i < 4; i++) {
      const fb = (board.firstBase || [])[i];
      if (!fb || !fb.playerId) {
        console.log(`  fb[${i}] empty`);
        continue;
      }

      // Count AT BAT slots that list this firstBase player as referrer
      const refCount = atBatSlots.filter(
        (ab) => ab && ab.referredBy && ab.referredBy.toString() === fb.playerId.toString()
      ).length;

      console.log(`  fb[${i}] player=${fb.playerId} current salesCredits=${fb.salesCredits} → reconstructed=${refCount}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone. Re-run with APPLY=1 to apply the reconstructed values.");
}

async function apply() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const boards = db.collection("bat246boards");

  const docs = await boards.find({}).toArray();
  let totalUpdated = 0;

  for (const board of docs) {
    const atBatSlots: any[] = board.atBat || [];
    const updateSet: Record<string, number> = {};

    for (let i = 0; i < 4; i++) {
      const fb = (board.firstBase || [])[i];
      if (!fb || !fb.playerId) continue;

      const refCount = atBatSlots.filter(
        (ab) => ab && ab.referredBy && ab.referredBy.toString() === fb.playerId.toString()
      ).length;

      updateSet[`firstBase.${i}.salesCredits`] = refCount;
    }

    if (Object.keys(updateSet).length > 0) {
      await boards.updateOne({ _id: board._id }, { $set: updateSet });
      totalUpdated++;
      console.log(`Board ${board.boardNumber} updated:`, updateSet);
    }
  }

  await mongoose.disconnect();
  console.log(`\nApplied to ${totalUpdated} board(s).`);
}

if (process.env.APPLY === "1") {
  apply().catch(e => { console.error(e); process.exit(1); });
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}
