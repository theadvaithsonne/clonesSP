/**
 * One-time data correction for board "1-101 R":
 *
 * Bug: When 1stA used the Approve button to place their 3rd referral into a
 * slot that belongs to 1stB's pair (e.g. AB3/AB4), the OLD code also awarded
 * 1stB a Green Card — even though 1stB had nothing to do with that referral.
 *
 * Fix: For every 1st Base slot on this board that received a spurious Green
 * Card (i.e. a Green Credit with countsForLB=false / saleAmount=0 for an AT
 * BAT slot whose player was referred by a DIFFERENT 1st Base player):
 *   1. Delete that Bat246SalesCredit record.
 *   2. Decrement firstBase[i].salesCredits by 1.
 *   3. Recompute warpStatus = min(newSalesCredits, 2).
 *   4. Set firstBase[i].cardType = "NoCard" (signals they can never earn
 *      both Green Cards now because their pair slot is already claimed).
 *   5. Decrement Bat246Player.minorLeague.cardsEarned.green by 1.
 *
 * Run: npx ts-node src/scripts/fix-1101R-wrong-green-cards.ts
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";
import { Bat246SalesCredit } from "../bat246/models/bat246SalesCredit.model";
import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";

const BOARD_TRACKING_NO = "1-101 R";

const FB_POSITIONS = ["1stA", "1stB", "1stC", "1stD"];

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  console.log("Connected to database\n");

  // ── 1. Load the board ────────────────────────────────────────────────────────
  const board = await Bat246Board.findOne({ trackingNumber: BOARD_TRACKING_NO }).lean() as any;
  if (!board) throw new Error(`Board "${BOARD_TRACKING_NO}" not found`);

  console.log(`Board found: ${board._id}  status=${board.status}\n`);

  const firstBase: any[] = board.firstBase ?? [];
  const atBat: any[] = board.atBat ?? [];

  // ── 2. Print current state ───────────────────────────────────────────────────
  console.log("=== Current 1st Base state ===");
  for (let i = 0; i < 4; i++) {
    const fb = firstBase[i];
    const ab0 = atBat[i * 2];
    const ab1 = atBat[i * 2 + 1];
    console.log(`  ${FB_POSITIONS[i]}: playerId=${fb?.playerId ?? "empty"}  salesCredits=${fb?.salesCredits ?? 0}  warpStatus=${fb?.warpStatus ?? 0}  cardType=${fb?.cardType ?? "none"}`);
    console.log(`    AB${i * 2}: ${ab0?.playerId ?? "empty"}  AB${i * 2 + 1}: ${ab1?.playerId ?? "empty"}`);
  }
  console.log();

  // ── 3. For each 1st Base slot, check every filled AT BAT slot in their pair ──
  let totalFixed = 0;

  for (let fbIdx = 0; fbIdx < 4; fbIdx++) {
    const fb = firstBase[fbIdx];
    if (!fb?.playerId) continue;

    const fbPlayerId = fb.playerId.toString();

    for (const abOffset of [0, 1]) {
      const abIdx = fbIdx * 2 + abOffset;
      const abSlot = atBat[abIdx];
      if (!abSlot?.playerId) continue;

      // Resolve AT BAT player → userId → Distributor → bat246RefUserId → Bat246Player
      const abPlayer = await Bat246Player.findById(abSlot.playerId).select("userId").lean() as any;
      if (!abPlayer?.userId) continue;

      const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(abPlayer.userId) })
        .select("bat246RefUserId")
        .lean() as any;
      if (!dist?.bat246RefUserId) continue;

      const referrerPlayer = await Bat246Player.findOne({ userId: new Types.ObjectId(dist.bat246RefUserId) })
        .select("_id")
        .lean() as any;
      if (!referrerPlayer) continue;

      const referrerId = referrerPlayer._id.toString();

      if (referrerId === fbPlayerId) {
        // This AT BAT player WAS referred by the covering 1st Base — Green Card is legitimate.
        console.log(`  AB${abIdx}: referred by covering ${FB_POSITIONS[fbIdx]} — Green Card is correct, skipping.`);
        continue;
      }

      // AB slot was filled by someone referred by a DIFFERENT player.
      // Check that the referrer is also a 1st Base player on this same board
      // (confirms it was another 1stBase Approve, not some other flow).
      const referrerIsFirstBase = firstBase.some(
        (s: any) => s?.playerId?.toString() === referrerId
      );

      console.log(`  AB${abIdx}: referred by ${referrerId} (${referrerIsFirstBase ? "ANOTHER 1stBase player" : "non-1stBase"}) — covering is ${FB_POSITIONS[fbIdx]}`);

      if (!referrerIsFirstBase) {
        console.log(`    → Not a 1stBase-Approve case, skipping.`);
        continue;
      }

      // ── Confirmed wrong Green Card: referrer is a DIFFERENT 1st Base player ──

      // Find the spurious Bat246SalesCredit for this 1st Base player on this board
      // countsForLB=false / saleAmount=0 marks it as coming from a manual placement
      // (Approve), not a real purchase.
      const spuriousCredits = await Bat246SalesCredit.find({
        boardId: board._id,
        playerId: fb.playerId,
        cardType: "Green",
        countsForLB: false,
        saleAmount: 0,
      }).lean() as any[];

      if (spuriousCredits.length === 0) {
        console.log(`    ⚠ No matching Bat246SalesCredit found for ${FB_POSITIONS[fbIdx]} — already corrected? Skipping credit delete.`);
      } else {
        // If multiple spurious credits, delete only the most recent one (the bad one).
        const toDelete = spuriousCredits.sort(
          (a: any, b: any) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
        )[0];

        console.log(`    Deleting SalesCredit _id=${toDelete._id} earnedAt=${toDelete.earnedAt}`);
        await Bat246SalesCredit.deleteOne({ _id: toDelete._id });

        // Decrement green card counter on player doc
        await Bat246Player.updateOne(
          { _id: fb.playerId },
          { $inc: { "minorLeague.cardsEarned.green": -1 } }
        );
        console.log(`    Decremented minorLeague.cardsEarned.green for ${FB_POSITIONS[fbIdx]}`);
      }

      // ── Update firstBase slot: decrement salesCredits, recompute warpStatus, set NoCard ──
      const currentSalesCredits: number = fb.salesCredits ?? 0;
      const newSalesCredits = Math.max(0, currentSalesCredits - 1);
      const newWarpStatus = Math.min(newSalesCredits, 2);

      const updateFields: Record<string, any> = {
        [`firstBase.${fbIdx}.salesCredits`]: newSalesCredits,
        [`firstBase.${fbIdx}.warpStatus`]: newWarpStatus,
      };

      // Set NoCard only if no card is already set (don't overwrite Gold/etc.)
      if (!fb.cardType) {
        updateFields[`firstBase.${fbIdx}.cardType`] = "NoCard";
        console.log(`    Setting firstBase[${fbIdx}].cardType = "NoCard"`);
      } else {
        console.log(`    firstBase[${fbIdx}].cardType already set to "${fb.cardType}", not overwriting.`);
      }

      await Bat246Board.updateOne({ _id: board._id }, { $set: updateFields });

      console.log(`    ✓ ${FB_POSITIONS[fbIdx]} corrected: salesCredits ${currentSalesCredits} → ${newSalesCredits}, warpStatus → ${newWarpStatus}`);
      totalFixed++;
    }
  }

  // ── 4. Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Done. ${totalFixed} wrong Green Card(s) corrected on board "${BOARD_TRACKING_NO}" ===`);

  // ── 5. Print updated state ───────────────────────────────────────────────────
  const updated = await Bat246Board.findOne({ trackingNumber: BOARD_TRACKING_NO }).lean() as any;
  const updatedFb: any[] = updated?.firstBase ?? [];
  console.log("\n=== Updated 1st Base state ===");
  for (let i = 0; i < 4; i++) {
    const fb = updatedFb[i];
    console.log(`  ${FB_POSITIONS[i]}: salesCredits=${fb?.salesCredits ?? 0}  warpStatus=${fb?.warpStatus ?? 0}  cardType=${fb?.cardType ?? "none"}`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
