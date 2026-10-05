/**
 * Give 2 green cards (salesCredits = 2) to every occupied slot in:
 *   Home Plate, 3rd Base, 2nd Base A/B, 1st Base (all 4 sub-slots)
 *
 * AT BAT and Dugout are intentionally NOT touched.
 *
 * Run: npx ts-node src/scripts/give-green-cards.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;
  const boards = db.collection("bat246boards");

  // ── Single-slot positions ─────────────────────────────────────────────────────
  const singleSlots = ["homePlate", "thirdBase", "secondBaseA", "secondBaseB"];

  for (const field of singleSlots) {
    const result = await boards.updateMany(
      { [`${field}.playerId`]: { $exists: true, $ne: null } },
      { $set: { [`${field}.salesCredits`]: 2 } }
    );
    console.log(`${field.padEnd(14)} — updated ${result.modifiedCount} board(s)`);
  }

  // ── firstBase (array of 4 sub-slots) ─────────────────────────────────────────
  const fbResult = await boards.updateMany(
    { "firstBase.playerId": { $exists: true, $ne: null } },
    { $set: { "firstBase.$[elem].salesCredits": 2 } },
    { arrayFilters: [{ "elem.playerId": { $exists: true, $ne: null } }] }
  );
  console.log(`firstBase      — updated ${fbResult.modifiedCount} board(s) (occupied sub-slots only)`);

  console.log("\nDone.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
