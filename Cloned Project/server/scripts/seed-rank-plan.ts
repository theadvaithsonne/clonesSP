/**
 * Seed the NetworkChain rank bonus plan.
 *
 * Usage:
 *   npx tsx -r dotenv/config src/scripts/seed-rank-plan.ts <thirdPartyClientId> [--dry-run]
 *   npx tsx -r dotenv/config src/scripts/seed-rank-plan.ts --show     (read-only)
 *
 * Inserts a NEW version and deactivates the previous one — plans are never
 * edited in place, so a past RankRun's `planVersion` always resolves to the
 * numbers that actually paid.
 *
 * Amounts are DOLLARS. Bronze stacks with every rank, so a Silver is paid
 * 40 + 200 = $240, a Platinum 40 + 10,000 = $10,040.
 */
import mongoose from "mongoose";
import { RankPlan, RANK_KEYS, payoutFor } from "../models/rankPlan.model";

const TIERS = [
  { key: "Bronze" as const, bonusUsd: 40, requiredActiveDirects: 5 },
  { key: "Silver" as const, bonusUsd: 200, requiredLegs: 4 },
  { key: "Gold" as const, bonusUsd: 300, requiredLegs: 5 },
  { key: "Diamond" as const, bonusUsd: 1000, requiredLegs: 6 },
  { key: "Platinum" as const, bonusUsd: 10000, requiredLegs: 10 },
];

async function main() {
  const args = process.argv.slice(2);
  const clientId = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const show = args.includes("--show");

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(`DB: ${uri.replace(/\/\/[^@]*@/, "//***@")}\n`);

  if (show) {
    const plans = await RankPlan.find({}).sort({ version: -1 }).lean();
    if (!plans.length) console.log("No RankPlan configured.");
    for (const p of plans) {
      console.log(
        `v${p.version}${p.isActive ? "  ACTIVE" : ""}  client=${p.thirdPartyClientId}  bronzeStacks=${p.bronzeStacks}`
      );
      for (const t of p.tiers) {
        const req =
          t.key === "Bronze"
            ? `${t.requiredActiveDirects} active directs`
            : `1 ${RANK_KEYS[RANK_KEYS.indexOf(t.key as any) - 1]} from ${t.requiredLegs} legs`;
        console.log(`    ${t.key.padEnd(9)} $${String(t.bonusUsd).padEnd(6)} ${req}`);
      }
      console.log("");
    }
    await mongoose.disconnect();
    return;
  }

  if (!clientId) {
    console.error(
      "Usage: npx tsx -r dotenv/config src/scripts/seed-rank-plan.ts <thirdPartyClientId> [--dry-run]\n" +
        "       npx tsx -r dotenv/config src/scripts/seed-rank-plan.ts --show"
    );
    process.exit(1);
  }

  const latest = await RankPlan.findOne({}).sort({ version: -1 }).lean();
  const version = (latest?.version || 0) + 1;

  console.log(`New plan version: v${version}${latest ? ` (replaces v${latest.version})` : ""}`);
  console.log("  rank       bonus    total paid   requirement");
  const draft: any = { version, isActive: true, thirdPartyClientId: clientId, tiers: TIERS, bronzeStacks: true };
  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i];
    const total = i === 0 ? t.bonusUsd : t.bonusUsd + TIERS[0].bonusUsd;
    const req =
      i === 0
        ? `${(t as any).requiredActiveDirects} active directs (+ self active)`
        : `1 ${TIERS[i - 1].key} from ${(t as any).requiredLegs} legs`;
    console.log(
      `  ${t.key.padEnd(10)} $${String(t.bonusUsd).padEnd(7)} $${String(total).padEnd(11)} ${req}`
    );
  }

  const doc = new RankPlan(draft);
  const err = doc.validateSync();
  if (err) throw new Error(`Validation failed: ${err.message}`);
  console.log("\nValidation: OK");

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    await mongoose.disconnect();
    return;
  }

  // Deactivate first — the partial unique index allows only one active plan.
  await RankPlan.updateMany({ isActive: true }, { $set: { isActive: false } });
  await doc.save();

  console.log(`\nSaved v${version} as the active plan.`);
  console.log(
    "Payouts remain OFF until RANK_BONUS_PAYOUTS_ENABLED=true is set in the environment."
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
