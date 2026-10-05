/**
 * Move a member under a new upline, keeping the denormalised tree in step.
 *
 * Does what the fixed /garage-admin/users/:id/move-upline now does:
 *   1. repoint `referredBy`
 *   2. `reparentUnderNewReferrer` — ancestors, depth, legNumber, and the
 *      directsCount/downlineCount on BOTH the old and new chains
 *   3. `refreshTypeFlags`
 *
 * Also repairs members already left stale by the old endpoint, which wrote
 * only `referredBy`: pass --repair-only to fix the tree without moving anyone.
 *
 * Commissions are NOT touched. This only affects FUTURE earnings, same as the
 * admin endpoint. To re-point an already-paid distribution, run
 * move-unilevel-commission.ts afterwards.
 *
 * Safe by default: prints what it WOULD change and exits. Pass --confirm to write.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/move-upline.ts <member-email> <new-upline-email> [--confirm]
 *   npx tsx src/scripts/move-upline.ts <member-email> --repair-only [--confirm]
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import {
  reparentUnderNewReferrer,
  refreshTypeFlags,
} from "../services/downlineTree";

const label = (u: any) => (u ? `${u.name || "(no name)"} <${u.email}>` : "(none)");

async function describe(id: any) {
  const u = await User.findById(id)
    .select("name email referredBy ancestors depth legNumber directsCount downlineCount")
    .lean<any>();
  if (!u) return null;
  const up = u.referredBy
    ? await User.findById(u.referredBy).select("name email depth ancestors").lean<any>()
    : null;
  return { u, up };
}

async function run() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const repairOnly = args.includes("--repair-only");
  const positional = args.filter((a) => !a.startsWith("--"));
  const memberEmail = positional[0]?.trim().toLowerCase();
  const uplineEmail = positional[1]?.trim().toLowerCase();

  if (!memberEmail || (!repairOnly && !uplineEmail)) {
    console.error(
      "Usage:\n" +
        "  npx tsx src/scripts/move-upline.ts <member-email> <new-upline-email> [--confirm]\n" +
        "  npx tsx src/scripts/move-upline.ts <member-email> --repair-only [--confirm]",
    );
    process.exit(1);
  }

  // autoIndex:false is mandatory here: user.model declares a unique partial
  // index on `phone` that production was never built with, and letting
  // mongoose sync indexes on connect would try to create it against live
  // data. This script only reads and updates documents; it must never
  // touch the index definitions.
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false });
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})\n`);

  const member = await User.findOne({ email: memberEmail })
    .select("name email referredBy ancestors depth legNumber directsCount downlineCount")
    .lean<any>();
  if (!member) {
    console.error(`❌ No user with email ${memberEmail}`);
    process.exit(1);
  }

  let target: any = null;
  if (!repairOnly) {
    target = await User.findOne({ email: uplineEmail })
      .select("name email depth ancestors")
      .lean<any>();
    if (!target) {
      console.error(`❌ No user with email ${uplineEmail}`);
      process.exit(1);
    }
    if (String(target._id) === String(member._id)) {
      console.error(`❌ A member can't be their own upline.`);
      process.exit(1);
    }
    // Cycle guard, same rule the endpoint enforces: the new upline must not
    // sit inside the member's own downline.
    const targetFull = await User.findById(target._id).select("ancestors").lean<any>();
    const inDownline = (targetFull?.ancestors || []).some(
      (a: any) => String(a) === String(member._id),
    );
    if (inDownline) {
      console.error(
        `❌ ${label(target)} is in ${label(member)}'s own downline — that would create a loop.`,
      );
      process.exit(1);
    }
    if (member.referredBy && String(member.referredBy) === String(target._id)) {
      console.log(`ℹ️  ${label(target)} is already the upline. Checking tree consistency…`);
    }
  }

  const before = await describe(member._id);
  const currentUpline = before?.up || null;

  console.log(`👤 Member : ${label(member)}  ${member._id}`);
  console.log(`   depth=${member.depth} legNumber=${member.legNumber} ancestors=${(member.ancestors || []).length} directs=${member.directsCount} downline=${member.downlineCount}`);
  console.log(`   current upline: ${label(currentUpline)}`);

  // Is the denormalised tree consistent with referredBy right now?
  const lastAncestor = (member.ancestors || [])[(member.ancestors || []).length - 1];
  const treeStale =
    !!member.referredBy &&
    (!lastAncestor || String(lastAncestor) !== String(member.referredBy));
  console.log(`   denormalised tree: ${treeStale ? "STALE ⚠️" : "in sync ✅"}`);

  if (repairOnly) {
    if (!treeStale) {
      console.log(`\n✅ Nothing to repair.`);
      await mongoose.disconnect();
      process.exit(0);
    }
    const parent = await User.findById(member.referredBy).select("name email depth ancestors").lean<any>();
    console.log(`\n── REPAIR ──`);
    console.log(`   ancestors: ${(member.ancestors || []).length} -> ${(parent?.ancestors || []).length + 1}`);
    console.log(`   depth    : ${member.depth} -> ${(parent?.depth ?? 0) + 1}`);
  } else {
    console.log(`\n── MOVE ──`);
    console.log(`   ${label(currentUpline)}  ->  ${label(target)}`);
    console.log(`   depth    : ${member.depth} -> ${(target.depth ?? 0) + 1}`);
    console.log(`   ancestors: ${(member.ancestors || []).length} -> ${(target.ancestors || []).length + 1}`);
  }

  if ((member.downlineCount || 0) > 0) {
    console.log(
      `\n⚠️  This member has ${member.downlineCount} descendant(s). reparentUnderNewReferrer\n` +
        `   declines to move a subtree — it will log and skip, leaving the tree stale.\n` +
        `   Run backfill-downline-tree.ts afterwards to reconcile.`,
    );
  }

  console.log(
    `\nℹ️  Commissions are NOT touched. Run move-unilevel-commission.ts after this\n` +
      `   to re-point an already-paid distribution.`,
  );

  if (!confirm) {
    console.log(`\n🔍 DRY RUN — nothing written. Re-run with --confirm to apply.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!repairOnly) {
    await User.findByIdAndUpdate(member._id, { referredBy: target._id });
    console.log(`\n✅ referredBy updated`);
  }

  await reparentUnderNewReferrer(member._id);
  await refreshTypeFlags(member._id);

  const after = await describe(member._id);
  console.log(`✅ tree resynced`);
  console.log(`   upline   : ${label(after?.up)}`);
  console.log(`   depth    : ${before?.u.depth} -> ${after?.u.depth}`);
  console.log(`   ancestors: ${(before?.u.ancestors || []).length} -> ${(after?.u.ancestors || []).length}`);
  console.log(`   legNumber: ${before?.u.legNumber} -> ${after?.u.legNumber}`);

  const lastNow = (after?.u.ancestors || [])[(after?.u.ancestors || []).length - 1];
  const ok =
    after?.u.referredBy && lastNow && String(lastNow) === String(after.u.referredBy);
  console.log(`   consistency: ${ok ? "IN SYNC ✅" : "STILL STALE ⚠️ — check the log above"}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
