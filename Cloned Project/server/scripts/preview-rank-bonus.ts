/**
 * READ-ONLY preview of what a rank-bonus run would produce.
 *
 * Usage:
 *   npx tsx -r dotenv/config src/scripts/preview-rank-bonus.ts <thirdPartyClientId>
 *
 * Writes NOTHING — no RankRun, no RankQualification, no wallet movement. Runs
 * the same active-paid predicate and the same qualification pass the real job
 * uses, and reports the qualifier list and the bill.
 *
 * This is the gate described in NETWORKCHAIN_RANK_BONUS_PLAN.md §6.4: look at
 * the real numbers before any money moves. There is no reversal machinery in
 * this codebase, so a wrong payout cannot be undone.
 */
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { RANK_KEYS } from "../models/rankPlan.model";
import { getActivePaidSubscribers } from "../services/rankBonus/activeSubscribers";
import { qualifyTree } from "../services/rankBonus/qualify";

// Preview against the intended plan without requiring it to be seeded yet.
const PLAN: any = {
  bronzeStacks: true,
  tiers: [
    { key: "Bronze", bonusUsd: 40, requiredActiveDirects: 5 },
    { key: "Silver", bonusUsd: 200, requiredLegs: 4 },
    { key: "Gold", bonusUsd: 300, requiredLegs: 5 },
    { key: "Diamond", bonusUsd: 1000, requiredLegs: 6 },
    { key: "Platinum", bonusUsd: 10000, requiredLegs: 10 },
  ],
};
const payFor = (k: string) =>
  k === "Bronze"
    ? 40
    : (PLAN.tiers.find((t: any) => t.key === k)?.bonusUsd || 0) + 40;

async function main() {
  const clientId = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!clientId) {
    console.error(
      "Usage: npx tsx -r dotenv/config src/scripts/preview-rank-bonus.ts <thirdPartyClientId>"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(`DB: ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log("READ-ONLY — nothing will be written.\n");

  const t0 = Date.now();
  const { active, coveredChains, freeOnlyCount } =
    await getActivePaidSubscribers(clientId);
  console.log("=== Active paid subscribers (snapshot: now) ===");
  console.log(`  chains currently covered      ${coveredChains}`);
  console.log(`  of those, free-month-only     ${freeOnlyCount}  (excluded)`);
  console.log(`  ACTIVE PAID SUBSCRIBERS       ${active.size}`);

  const users = await User.find({}).select({ _id: 1, referredBy: 1 }).lean();
  console.log(`\n=== Tree ===`);
  console.log(`  users loaded                  ${users.length.toLocaleString()}`);

  const r = qualifyTree({ users, active, plan: PLAN });
  console.log(`  unreachable (cycles/orphans)  ${r.orphaned}`);

  console.log(`\n=== Qualifiers ===`);
  let bill = 0;
  console.log("  rank        people      each       total");
  for (const k of RANK_KEYS) {
    const n = r.byRank[k] || 0;
    const each = payFor(k);
    bill += n * each;
    console.log(
      `  ${k.padEnd(11)} ${String(n).padStart(6)}   $${String(each).padStart(6)}   $${String(n * each).toLocaleString().padStart(9)}`
    );
  }
  console.log(`  ${"TOTAL".padEnd(11)} ${String(r.qualified.length).padStart(6)}${" ".repeat(13)}$${bill.toLocaleString()}`);

  console.log(`\n=== Sanity checks ===`);
  const ceiling = Math.floor(active.size / 5);
  const ok = r.qualified.length <= ceiling;
  console.log(
    `  structural ceiling (active/5) ${ceiling}   qualifiers ${r.qualified.length}   ${ok ? "OK" : "BREACH — predicate is over-counting"}`
  );
  if (active.size > 0) {
    console.log(
      `  Bronze per 100 subscribers    ${((r.byRank.Bronze / active.size) * 100).toFixed(1)}   (expect ~4; investigate above 15)`
    );
    console.log(
      `  bonus cost per subscriber     $${(bill / active.size).toFixed(2)}`
    );
  }
  console.log(`  elapsed                       ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (r.qualified.length) {
    console.log(`\n=== Top earners ===`);
    const top = [...r.qualified]
      .sort((a, b) => payFor(b.rank) - payFor(a.rank))
      .slice(0, 15);
    const ids = top.map((q) => new mongoose.Types.ObjectId(q.userId));
    const named = await User.find({ _id: { $in: ids } })
      .select({ _id: 1, name: 1, email: 1 })
      .lean();
    const byId = new Map(named.map((u) => [u._id.toString(), u]));
    for (const q of top) {
      const u: any = byId.get(q.userId);
      console.log(
        `  ${q.rank.padEnd(9)} $${String(payFor(q.rank)).padStart(6)}  ` +
          `${(u?.email || q.userId).padEnd(34)} ` +
          `${q.activeDirects}/${q.totalDirects} active directs`
      );
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
