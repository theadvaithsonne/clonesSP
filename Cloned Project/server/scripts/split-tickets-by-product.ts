/**
 * One-shot data move: the shared `roam-admin-prod.tickets` collection
 * has been used by both Garage and NetworkChain (same Mongo cluster
 * + DB across the two products). We split into two dedicated
 * collections going forward:
 *   - `tickets_garage`          ← all current `tickets` docs (verified
 *                                  to be 100% Garage at run time)
 *   - `tickets_networkchain`    ← stays empty, NC code now writes here
 *
 * The Ticket model in both repos has been re-pointed via mongoose's
 * 3rd `collectionName` arg, so post-deploy both backends write to the
 * right place.
 *
 * Usage:
 *   npx tsx src/scripts/split-tickets-by-product.ts          # dry run
 *   npx tsx src/scripts/split-tickets-by-product.ts --apply  # write
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import { env } from "../config/env";

dotenv.config();

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!env.MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No db handle");
    process.exit(1);
  }

  const src = db.collection("tickets");
  const dst = db.collection("tickets_garage");

  const total = await src.countDocuments({});
  console.log(`Source 'tickets': ${total} docs`);

  // Surface a quick split summary so we can sanity-check before the
  // move. Anything NC-flavored (email domain match) is flagged so the
  // operator can intervene; we don't actually move NC tickets to
  // tickets_garage because that'd be wrong.
  const ncHits = await src.countDocuments({
    userEmail: { $regex: /@networkchains|@networkchain/i },
  });
  if (ncHits > 0) {
    console.warn(
      `⚠ Found ${ncHits} doc(s) whose email looks NetworkChain-ish.`,
    );
    console.warn(
      "  These are NOT moved to tickets_garage. Inspect manually:",
    );
    const samples = await src
      .find({ userEmail: { $regex: /@networkchains|@networkchain/i } })
      .project({ _id: 1, title: 1, userEmail: 1 })
      .limit(10)
      .toArray();
    console.warn(JSON.stringify(samples, null, 2));
  }

  // Move everything that isn't obviously NC.
  const movable = await src
    .find({ userEmail: { $not: /@networkchains|@networkchain/i } })
    .toArray();
  console.log(`Movable (non-NC): ${movable.length}`);

  if (movable.length === 0) {
    console.log("Nothing to move.");
    await mongoose.disconnect();
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const doc of movable) {
    const exists = await dst.findOne({ _id: doc._id });
    if (exists) {
      skipped++;
      continue;
    }
    if (APPLY) {
      await dst.insertOne(doc);
    }
    inserted++;
  }

  console.log("\n── Result ──");
  console.log(`Inserted into tickets_garage: ${inserted}`);
  console.log(`Skipped (already in dst)    : ${skipped}`);
  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write.");
  } else {
    console.log(
      "\nDone. Verify via Mongo shell, then drop the legacy collection when ready:",
    );
    console.log("  db.tickets.drop()");
    console.log(
      "(Skipping auto-drop here so you have a safety net for a few days.)",
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
