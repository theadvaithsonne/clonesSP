/**
 * Backfill support chats for every user who completed their profile before
 * support chats existed (services/supportChat.ts).
 *
 * New users get theirs from routes/profile.ts; this covers everyone already
 * past that point. Safe to re-run: ensureSupportGroup creates a missing chat
 * and otherwise only adds members that are missing (a newly added admin, a
 * changed upline or agent) and re-derives the chat's name, so a second run is
 * a membership top-up — and the way to rename existing chats after the name
 * format changes.
 *
 * Also creates the two Group indexes the feature relies on — the unique
 * "one support chat per user" index must exist BEFORE groups are created in
 * bulk, or a racing profile save could produce a duplicate.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-support-chats.ts          # dry run (counts only)
 *   npx tsx src/scripts/backfill-support-chats.ts --apply  # write
 *   node dist/scripts/backfill-support-chats.js --apply    # on the prod box
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import { env } from "../config/env";
import { User } from "../models/user.model";
import { Group } from "../models/group.model";
import { activeStaffUserIds, ensureSupportGroup } from "../services/supportChat";

dotenv.config();

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected — ${APPLY ? "APPLY" : "DRY RUN"}`);

  const staff = await activeStaffUserIds();
  console.log(`Active staff with app accounts: ${staff.length}`);

  const users = (await User.find({ profileComplete: true }).select("_id").lean()) as {
    _id: mongoose.Types.ObjectId;
  }[];
  const existing = new Set(
    (
      (await Group.find({ kind: "support" }).select("supportUserId").lean()) as any[]
    ).map((g) => String(g.supportUserId))
  );
  const missing = users.filter((u) => !existing.has(String(u._id)));
  console.log(
    `Completed profiles: ${users.length} · with a support chat: ${existing.size} · missing: ${missing.length}`
  );

  if (!APPLY) {
    console.log("Dry run — re-run with --apply to create indexes and chats.");
    await mongoose.disconnect();
    return;
  }

  const coll = Group.collection;
  await coll.createIndex(
    { supportUserId: 1 },
    { unique: true, partialFilterExpression: { kind: "support" } }
  );
  await coll.createIndex({ kind: 1, supportActivityAt: -1 });
  console.log("Indexes ensured.");

  // Every user, not just the missing ones: existing chats get a membership
  // top-up too. Sequential on purpose — ~1k users, and it keeps the load on
  // the production database flat.
  let ok = 0;
  let failed = 0;
  for (const [i, u] of users.entries()) {
    const id = await ensureSupportGroup(u._id);
    if (id) ok++;
    else failed++;
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${users.length}…`);
  }
  console.log(`Done — ok: ${ok}, failed: ${failed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
