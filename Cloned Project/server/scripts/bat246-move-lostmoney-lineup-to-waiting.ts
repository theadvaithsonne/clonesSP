/**
 * One-off: moves everyone currently in the Lost Money "No Wait Lineup"
 * grid back into the "90 Days Waiting Period" grid.
 *
 * Matches the same ACTIVE_LINEUP_FILTER used by GET /paid/admin and by
 * bat246LostMoneyAutoPay.service.ts — i.e. every row that's either a
 * legacy row (movedToLineupAt never set) or was previously moved into the
 * lineup (movedToLineupAt is a real Date). After this script runs, ALL of
 * them will have movedToLineupAt explicitly set to null, which is exactly
 * what the "90 Days Waiting Period" grid queries for.
 *
 * Does NOT touch totalPaid, roundAccumulated, approvedAmount, or order —
 * only changes which grid a row shows in / pauses it from future auto-pay
 * rounds. Nothing already paid out is undone or reversed.
 *
 * Run: npx ts-node src/scripts/bat246-move-lostmoney-lineup-to-waiting.ts
 * Optional: pass one or more Paid List row ids to only move those specific
 * rows instead of everyone currently active, e.g.:
 *   npx ts-node src/scripts/bat246-move-lostmoney-lineup-to-waiting.ts 66f0...  66f1...
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246LostMoneyPaid } from "../bat246/models/bat246LostMoneyPaid.model";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);

  const idsArg = process.argv.slice(2).filter(Boolean);
  const activeFilter = { $or: [{ movedToLineupAt: { $exists: false } }, { movedToLineupAt: { $ne: null } } ] };
  const filter = idsArg.length > 0 ? { _id: { $in: idsArg }, ...activeFilter } : activeFilter;

  const rows = await Bat246LostMoneyPaid.find(filter).select("name email approvedAmount totalPaid").lean();

  if (rows.length === 0) {
    console.log("Nothing to move — no rows currently in the No Wait Lineup" + (idsArg.length ? " matching the given ids." : "."));
    await mongoose.disconnect();
    return;
  }

  console.log(`Moving ${rows.length} row(s) from No Wait Lineup → 90 Days Waiting Period:`);
  for (const r of rows as any[]) {
    console.log(`  - ${r.name}${r.email ? ` <${r.email}>` : ""} — approved $${r.approvedAmount}, paid $${r.totalPaid}`);
  }

  const result = await Bat246LostMoneyPaid.updateMany(filter, { $set: { movedToLineupAt: null } });
  console.log(`\nDone — matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
