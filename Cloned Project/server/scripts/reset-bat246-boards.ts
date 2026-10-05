/**
 * Reset script — wipes ALL BAT246 board data and player board stats.
 *
 * DELETES:
 *   bat246boards             — all boards (active, split, splitting, completed)
 *   bat246playerboards       — all player↔board memberships
 *   bat246movements          — all movement history
 *   bat246pendingplacements  — all pending placements
 *   bat246positionreservations
 *   bat246placementnotifications
 *   bat246topten
 *   bat246freeentries
 *   bat246snapbackloans
 *   bat246recruitment
 *   bat246salescredits
 *
 * RESETS (not deleted):
 *   bat246Config             — boardCounter=0, familyCounter=0, familySequences={}
 *   bat246Players            — minorLeague + majorLeague stats zeroed, freeEntries zeroed
 *                              (player profile, userId link, membership kept intact)
 *
 * NEVER TOUCHED:
 *   bat246players userId / email / nickname / role / membership fields
 *   Users collection
 *   bat246distributors
 *
 * Run: npx ts-node src/scripts/reset-bat246-boards.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const ZERO_LEAGUE = {
  totalEntries: 0,
  timesAllStar: 0,
  totalBCs: 0,
  goldBCs: 0,
  lbLevel: "none",
  lbStats: { triple: 0, homeRun: 0, grandSlam: 0 },
  cardsEarned: { gold: 0, black: 0, brown: 0, gray: 0, green: 0, noCard: 0 },
  totalEarnings: 0,
  matchingBonuses: 0,
  crossedHp: false,
  crossedHpAt: null,
  lbEarnings: { triple: 0, homeRun: 0, grandSlam: 0 },
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  console.log(`URI: ${uri.replace(/\/\/.*@/, "//***:***@")}`);
  await mongoose.connect(uri);
  console.log("Connected.\n");

  // Raw collection handles — no model validation needed for mass deletes
  const db = mongoose.connection.db!;

  const col = (name: string) => db.collection(name);

  // ── 1. Count before ────────────────────────────────────────────────────────
  const [
    boardCount,
    pbCount,
    mvCount,
    ppCount,
    prCount,
    pnCount,
    ttCount,
    feCount,
    slCount,
    rcCount,
    scCount,
    playerCount,
  ] = await Promise.all([
    col("bat246boards").countDocuments(),
    col("bat246playerboards").countDocuments(),
    col("bat246movements").countDocuments(),
    col("bat246pendingplacements").countDocuments(),
    col("bat246positionreservations").countDocuments(),
    col("bat246placementnotifications").countDocuments(),
    col("bat246topten").countDocuments(),
    col("bat246freeentries").countDocuments(),
    col("bat246snapbackloans").countDocuments(),
    col("bat246recruitments").countDocuments(),
    col("bat246salescredits").countDocuments(),
    col("bat246players").countDocuments(),
  ]);

  console.log("── Before reset ──────────────────────────────────────────────");
  console.log(`  Boards:               ${boardCount}`);
  console.log(`  PlayerBoards:         ${pbCount}`);
  console.log(`  Movements:            ${mvCount}`);
  console.log(`  PendingPlacements:    ${ppCount}`);
  console.log(`  PositionReservations: ${prCount}`);
  console.log(`  PlacementNotifs:      ${pnCount}`);
  console.log(`  TopTen:               ${ttCount}`);
  console.log(`  FreeEntries:          ${feCount}`);
  console.log(`  SnapBackLoans:        ${slCount}`);
  console.log(`  Recruitments:         ${rcCount}`);
  console.log(`  SalesCredits:         ${scCount}`);
  console.log(`  Players (kept):       ${playerCount}`);
  console.log("");

  // ── 2. Delete all board-related collections ────────────────────────────────
  const [
    dBoards,
    dPB,
    dMV,
    dPP,
    dPR,
    dPN,
    dTT,
    dFE,
    dSL,
    dRC,
    dSC,
  ] = await Promise.all([
    col("bat246boards").deleteMany({}),
    col("bat246playerboards").deleteMany({}),
    col("bat246movements").deleteMany({}),
    col("bat246pendingplacements").deleteMany({}),
    col("bat246positionreservations").deleteMany({}),
    col("bat246placementnotifications").deleteMany({}),
    col("bat246topten").deleteMany({}),
    col("bat246freeentries").deleteMany({}),
    col("bat246snapbackloans").deleteMany({}),
    col("bat246recruitments").deleteMany({}),
    col("bat246salescredits").deleteMany({}),
  ]);

  console.log("── Deleted ───────────────────────────────────────────────────");
  console.log(`  Boards:               ${dBoards.deletedCount}`);
  console.log(`  PlayerBoards:         ${dPB.deletedCount}`);
  console.log(`  Movements:            ${dMV.deletedCount}`);
  console.log(`  PendingPlacements:    ${dPP.deletedCount}`);
  console.log(`  PositionReservations: ${dPR.deletedCount}`);
  console.log(`  PlacementNotifs:      ${dPN.deletedCount}`);
  console.log(`  TopTen:               ${dTT.deletedCount}`);
  console.log(`  FreeEntries:          ${dFE.deletedCount}`);
  console.log(`  SnapBackLoans:        ${dSL.deletedCount}`);
  console.log(`  Recruitments:         ${dRC.deletedCount}`);
  console.log(`  SalesCredits:         ${dSC.deletedCount}`);
  console.log("");

  // ── 3. Reset bat246Config counters ────────────────────────────────────────
  const configResult = await col("bat246configs").updateMany(
    {},
    { $set: { boardCounter: 0, familyCounter: 0, familySequences: {} } }
  );
  console.log(`Config reset: ${configResult.modifiedCount} doc(s) — boardCounter=0, familyCounter=0, familySequences={}`);

  // ── 4. Reset player league stats (keep profile/membership) ───────────────
  const playerReset = await col("bat246players").updateMany(
    {},
    {
      $set: {
        minorLeague: ZERO_LEAGUE,
        majorLeague: ZERO_LEAGUE,
        freeEntriesEarned: 0,
        freeEntriesUsed: 0,
      },
    }
  );
  console.log(`Players stats reset: ${playerReset.modifiedCount} player(s)`);
  console.log("  (userId, email, nickname, role, membership — untouched)");
  console.log("");

  console.log("── Reset complete ────────────────────────────────────────────");
  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
