/**
 * Repair downline rows whose `leg` column renders blank.
 *
 * `leg` is not stored — the downline table derives it by walking the row's
 * `ancestors` to the entry just below the root, then looking that id up among
 * the root's live directs (`referredBy: root`). It renders blank whenever that
 * lookup misses, which happens two ways, and they need opposite fixes:
 *
 *   ORPHANED  the upline in the middle of the chain has been DELETED, so
 *             `ancestors` (and `referredBy`) point at a user record that no
 *             longer exists. There is nothing to reattach to, so these move to
 *             an explicit target — by default the root itself.
 *
 *   DRIFTED   the row's `referredBy` names a user who DOES exist, but the
 *             denormalised tree (`ancestors`/`depth`) puts them somewhere else.
 *             The referrer is the source of truth, so the fix is to make the
 *             tree agree with it — no target needed, and no judgement call.
 *
 * Detection is dynamic, not a hardcoded list: re-running it finds whatever is
 * broken now, and a row that has since been fixed is simply not reported.
 *
 * Writes go through `reparentUnderNewReferrer` + `refreshTypeFlags`, the same
 * path the admin Move Upline endpoint uses, so ancestors, depth, legNumber and
 * the directsCount/downlineCount on BOTH the old and new chains stay in step.
 * Nothing here writes to Mongo directly.
 *
 * Commissions are NOT touched — same as the admin endpoint, this only affects
 * future earnings. Use move-unilevel-commission.ts to re-point a distribution
 * that has already been paid.
 *
 * Safe by default: prints what it WOULD change and exits. Pass --confirm to write.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/repair-broken-legs.ts
 *   npx tsx src/scripts/repair-broken-legs.ts --confirm
 *   npx tsx src/scripts/repair-broken-legs.ts --root someone@x.com --orphan-target other@x.com
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import {
  reparentUnderNewReferrer,
  refreshTypeFlags,
} from "../services/downlineTree";

const DEFAULT_ROOT = "shorupan@gmail.com";

type Kind = "ORPHANED" | "DRIFTED";

interface Broken {
  user: any;
  kind: Kind;
  /** Who they will end up under. */
  target: any;
  /** Why the leg lookup missed, for the report. */
  reason: string;
}

const label = (u: any) =>
  u ? `${(u.name || "(no name)").slice(0, 22)} <${u.email || "no-email"}>` : "(none)";

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1]?.trim().toLowerCase() : undefined;
}

async function run() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const rootEmail = argValue(args, "--root") || DEFAULT_ROOT;
  const orphanTargetEmail = argValue(args, "--orphan-target");

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})`);
  console.log(confirm ? "⚠️  --confirm set: WILL WRITE\n" : "🔎 Dry run — no writes\n");

  const root = await User.findOne({ email: rootEmail }).select("name email _id").lean<any>();
  if (!root) {
    console.error(`❌ No user with email ${rootEmail}`);
    process.exit(1);
  }
  const rootId = root._id as Types.ObjectId;
  const rootKey = String(rootId);

  // Default orphan target is the root. Called out explicitly because the root
  // has no upline of its own to inherit — it IS the top of the tree — so
  // "reattach to the top" has to mean the root itself.
  const orphanTarget = orphanTargetEmail
    ? await User.findOne({ email: orphanTargetEmail }).select("name email _id").lean<any>()
    : root;
  if (!orphanTarget) {
    console.error(`❌ No user with email ${orphanTargetEmail}`);
    process.exit(1);
  }

  console.log(`Root          : ${label(root)}`);
  console.log(`Orphan target : ${label(orphanTarget)}\n`);

  // Mirror the table's own derivation exactly, or this repairs the wrong rows.
  const subtree = await User.find({ ancestors: rootId })
    .select("name email referredBy ancestors depth legNumber downlineCount directsCount")
    .lean<any[]>();
  const directIds = new Set(
    (await User.find({ referredBy: rootId }).select("_id").lean<any[]>()).map((u) =>
      String(u._id),
    ),
  );

  const legAncestorOf = (ancestors: any[] | undefined, selfId: any): string => {
    const anc = (ancestors || []).map((a) => String(a));
    const ri = anc.indexOf(rootKey);
    return ri >= 0 && anc[ri + 1] ? anc[ri + 1] : String(selfId);
  };

  const candidates = subtree.filter(
    (u) => !directIds.has(legAncestorOf(u.ancestors, u._id)),
  );

  // Resolve every referrer in one query rather than per row.
  const referrerIds = candidates
    .map((u) => u.referredBy)
    .filter(Boolean)
    .map((r: any) => new Types.ObjectId(String(r)));
  const referrers = new Map<string, any>(
    (
      await User.find({ _id: { $in: referrerIds } })
        .select("name email _id depth")
        .lean<any[]>()
    ).map((u) => [String(u._id), u]),
  );

  const broken: Broken[] = [];
  const skipped: { user: any; why: string }[] = [];

  for (const u of candidates) {
    // A member with descendants would need the whole subtree re-stamped;
    // reparentUnderNewReferrer refuses those, so surface them rather than
    // pretending they were handled.
    if (Number(u.downlineCount || 0) > 0) {
      skipped.push({ user: u, why: `${u.downlineCount} descendants — run backfill-downline-tree` });
      continue;
    }
    const referrer = u.referredBy ? referrers.get(String(u.referredBy)) : null;
    if (referrer) {
      broken.push({
        user: u,
        kind: "DRIFTED",
        target: referrer,
        reason: "tree places them elsewhere; referredBy is the source of truth",
      });
    } else {
      broken.push({
        user: u,
        kind: "ORPHANED",
        target: orphanTarget,
        reason: u.referredBy
          ? `referredBy ${String(u.referredBy).slice(-6)} no longer exists`
          : "no referredBy at all",
      });
    }
  }

  console.log(`Subtree rows        : ${subtree.length}`);
  console.log(`Rows with blank leg : ${candidates.length}`);
  console.log(`  repairable        : ${broken.length}`);
  console.log(`  skipped           : ${skipped.length}\n`);

  if (!broken.length && !skipped.length) {
    console.log("✅ Nothing to repair.");
    await mongoose.disconnect();
    process.exit(0);
  }

  for (const b of broken) {
    console.log(`${b.kind === "ORPHANED" ? "🔗" : "🧭"} ${b.kind}  ${label(b.user)}`);
    console.log(`     depth ${b.user.depth}, legNumber ${b.user.legNumber ?? "-"}`);
    console.log(`     why  : ${b.reason}`);
    console.log(`     move : -> ${label(b.target)}`);
  }
  for (const s of skipped) {
    console.log(`⏭️  SKIPPED ${label(s.user)} — ${s.why}`);
  }

  if (!confirm) {
    console.log(`\n🔎 Dry run. Re-run with --confirm to apply ${broken.length} change(s).`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("\n── Applying ──────────────────────────────────────────────");
  let ok = 0;
  let failed = 0;
  for (const b of broken) {
    try {
      // reparentUnderNewReferrer reads the NEW parent off referredBy, so the
      // pointer moves first and the tree is rebuilt from it.
      await User.updateOne({ _id: b.user._id }, { $set: { referredBy: b.target._id } });
      await reparentUnderNewReferrer(b.user._id);
      await refreshTypeFlags(b.user._id);

      const after = await User.findById(b.user._id)
        .select("referredBy ancestors depth legNumber")
        .lean<any>();
      const anc = (after?.ancestors || []).map((a: any) => String(a));
      const last = anc[anc.length - 1];
      const inSync = last && String(last) === String(after?.referredBy);
      const legNowResolves = anc.indexOf(rootKey) >= 0 || String(after?._id) === rootKey;

      console.log(
        `${inSync ? "✅" : "⚠️ "} ${label(b.user)} -> depth ${b.user.depth}->${after?.depth}, ` +
          `leg ${b.user.legNumber ?? "-"}->${after?.legNumber ?? "-"}, ` +
          `${inSync ? "tree in sync" : "STILL STALE"}${legNowResolves ? "" : ", NOT under root ⚠️"}`,
      );
      inSync ? ok++ : failed++;
    } catch (err) {
      failed++;
      console.error(`❌ ${label(b.user)}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. ${ok} repaired, ${failed} failed, ${skipped.length} skipped.`);
  console.log(
    "Note: root directsCount/downlineCount are separately stale and are NOT " +
      "corrected here — run backfill-downline-tree for the counters.",
  );
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
