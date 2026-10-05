/**
 * One-off: recompute typeFlags for users who RECEIVED a reserve-license
 * assignment before services/itemReserveLicense.ts started calling
 * refreshTypeFlags.
 *
 * Those users hold an active UnilevelPlusPurchase (paymentId "assigned_…")
 * but kept typeFlags.oneNetworkActivated === false, so they read as
 * un-activated prospects in the admin users list and the downline Type column.
 *
 * Recomputes from source via computeTypeFlags — it derives all three flags from
 * live purchase/subscription state, so it can only ever set what is already
 * true. Nothing is invented.
 *
 * Safe by default: prints what it WOULD change and exits. Pass --confirm to write.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/backfill-assignee-type-flags.ts
 *   npx tsx src/scripts/backfill-assignee-type-flags.ts --confirm
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { computeTypeFlags } from "../services/downlineTypeFlags";

async function run() {
  const confirm = process.argv.slice(2).includes("--confirm");

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})\n`);

  // Everyone whose seat came from an assignment rather than their own payment.
  const assigned = await UnilevelPlusPurchase.find(
    { status: "active", paymentId: { $regex: "^assigned_" } },
    { userId: 1, paymentId: 1 },
  ).lean<any[]>();

  const userIds = [...new Set(assigned.map((d) => String(d.userId)))];
  console.log(`Assigned-licence holders: ${userIds.length}`);

  const stale: Array<{ id: string; email?: string; name?: string; from: any; to: any }> = [];

  for (const id of userIds) {
    const u = await User.findById(id).select("email name typeFlags").lean<any>();
    if (!u) continue;
    const fresh = await computeTypeFlags(id);
    const cur = u.typeFlags || {};
    const differs =
      !!cur.oneNetworkActivated !== !!fresh.oneNetworkActivated ||
      !!cur.networkChainsSub !== !!fresh.networkChainsSub ||
      !!cur.founderSub !== !!fresh.founderSub;
    if (differs) {
      stale.push({
        id,
        email: u.email,
        name: u.name,
        from: {
          oneNetworkActivated: !!cur.oneNetworkActivated,
          networkChainsSub: !!cur.networkChainsSub,
          founderSub: !!cur.founderSub,
        },
        to: fresh,
      });
    }
  }

  if (stale.length === 0) {
    console.log(`\n✅ All assignees already have correct typeFlags. Nothing to do.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`\nOut of date: ${stale.length}`);
  for (const s of stale) {
    console.log(`  ${s.name || "(no name)"} <${s.email}>  ${s.id}`);
    console.log(`     from ${JSON.stringify(s.from)}`);
    console.log(`     to   ${JSON.stringify(s.to)}`);
  }

  if (!confirm) {
    console.log(`\n🔍 DRY RUN — nothing written. Re-run with --confirm to apply.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  let updated = 0;
  for (const s of stale) {
    await User.updateOne({ _id: s.id }, { $set: { typeFlags: s.to } });
    updated++;
  }
  console.log(`\n✅ Updated ${updated} user(s).`);
  console.log(
    `\nℹ️  Note: this only corrects typeFlags. It does NOT add anyone to the\n` +
      `   One Time Affiliates list — that list filters on real purchase spend\n` +
      `   (paymentId not starting with "assigned_"), which is a separate rule.`,
  );

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
