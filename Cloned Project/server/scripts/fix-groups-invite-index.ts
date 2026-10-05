/**
 * One-shot index fix for the `groups` collection.
 *
 * Background: the old schema declared `inviteCode: { type: String,
 * default: null }` and the index was `{ inviteCode: 1 }` with
 * `sparse: true`. A sparse index excludes documents where the field
 * is *missing*, NOT documents where the field is `null`. So every new
 * group inserted with the default `null` collided with the existing
 * groups that already had `null`, producing:
 *
 *   E11000 duplicate key error collection: roam-admin-prod.groups
 *   index: inviteCode_1
 *
 * Fix in code:
 *   - schema no longer defaults to null
 *   - index switched to a partial filter that only indexes string
 *     values of inviteCode
 *
 * Fix in the live DB (this script):
 *   1. Unset `inviteCode: null` and `inviteExpiry: null` everywhere
 *      so the data state matches the new schema (truly missing).
 *   2. Drop the old `inviteCode_1` index. Mongoose's autoIndex will
 *      recreate it with the new partialFilterExpression on the next
 *      server startup; alternatively `Group.syncIndexes()` here.
 *
 * Usage:
 *   npx tsx src/scripts/fix-groups-invite-index.ts          # dry run
 *   npx tsx src/scripts/fix-groups-invite-index.ts --apply  # write
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import { env } from "../config/env";
import { Group } from "../models/group.model";

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

  const col = db.collection("groups");

  // 1) Count how many docs are in the bad state.
  const nullCount = await col.countDocuments({
    $or: [{ inviteCode: null }, { inviteExpiry: null }],
  });
  console.log(`Docs with inviteCode/inviteExpiry == null: ${nullCount}`);

  // 2) Show existing indexes so we can confirm the old one is there.
  const indexes = await col.indexes();
  const oldIndex = indexes.find((i) => i.name === "inviteCode_1");
  console.log(
    "Existing inviteCode_1 index:",
    oldIndex ? JSON.stringify(oldIndex) : "(absent)",
  );

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to make changes.");
    await mongoose.disconnect();
    return;
  }

  // 3) Strip null values. Two passes so the $unset selectors stay
  //    targeted (covers both partial states cleanly).
  const r1 = await col.updateMany(
    { inviteCode: null },
    { $unset: { inviteCode: 1 } },
  );
  console.log(`Unset inviteCode on ${r1.modifiedCount} docs`);

  const r2 = await col.updateMany(
    { inviteExpiry: null },
    { $unset: { inviteExpiry: 1 } },
  );
  console.log(`Unset inviteExpiry on ${r2.modifiedCount} docs`);

  // 4) Drop the old sparse index so Mongoose can re-create it with the
  //    new partialFilterExpression. Wrap in try/catch — the index may
  //    already be gone if this script is run twice.
  if (oldIndex) {
    try {
      await col.dropIndex("inviteCode_1");
      console.log("Dropped inviteCode_1 index");
    } catch (e: any) {
      console.warn("Drop failed (may already be gone):", e.message);
    }
  }

  // 5) Force-recreate via Mongoose using the new schema definition.
  await Group.syncIndexes();
  console.log("Group.syncIndexes() done");

  const after = await col.indexes();
  const newIndex = after.find((i) => i.name === "inviteCode_1");
  console.log(
    "New inviteCode_1 index:",
    newIndex ? JSON.stringify(newIndex) : "(absent)",
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
