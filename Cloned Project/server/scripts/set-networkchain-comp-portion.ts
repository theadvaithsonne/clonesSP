/**
 * Shift the NetworkChain Unilevel Plus comp portion.
 *
 * Usage:
 *   npx tsx -r dotenv/config src/scripts/set-networkchain-comp-portion.ts <clientId> <upPortion> [--dry-run]
 *
 * e.g.  ... 69e1d6109247c7bd0693ee3b 6
 *
 * The rank bonus plan's economics require $6, not the deployed $12 — at $12 the
 * densest possible tree yields 1.7% margin; at $6 it yields 19.9%.
 *
 * THIS IS A LIVE ECONOMICS CHANGE. It halves what every current affiliate earns
 * on every NetworkChain subscription, immediately and including renewals of
 * existing subscriptions — `upPortion` is read from live config at distribution
 * time, not stamped per-subscription. Announce it before running.
 *
 * `platformPortion` moves in the opposite direction so the two still sum to
 * `totalAmount`; the model's termMonths=1 validator enforces that.
 *
 * After this, re-run seed-networkchain-term-plans.ts so termPlans[].upPortion
 * picks up the new rate — the term plans carry their own copy.
 */
import mongoose from "mongoose";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const [clientId, upPortionRaw] = positional;
  const dryRun = args.includes("--dry-run");

  if (!clientId || !upPortionRaw) {
    console.error(
      "Usage: npx tsx -r dotenv/config src/scripts/set-networkchain-comp-portion.ts <clientId> <upPortion> [--dry-run]"
    );
    process.exit(1);
  }
  const upPortion = Number(upPortionRaw);
  if (!Number.isFinite(upPortion) || upPortion < 0) {
    throw new Error(`upPortion must be a non-negative number (got ${upPortionRaw})`);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(`DB: ${uri.replace(/\/\/[^@]*@/, "//***@")}\n`);

  const client = await ThirdPartyClient.findById(clientId);
  if (!client) throw new Error(`ThirdPartyClient ${clientId} not found`);
  if (!client.productConfig) throw new Error(`Client ${clientId} has no productConfig`);

  const pc: any =
    (client.productConfig as any).toObject?.() ?? client.productConfig;
  const total = pc.totalAmount;
  const platformPortion = Math.round((total - upPortion) * 100) / 100;

  if (platformPortion < 0) {
    throw new Error(
      `upPortion $${upPortion} exceeds the monthly price $${total}`
    );
  }

  console.log(`Client: ${client.name} (${pc.productCode})`);
  console.log("                 before      after");
  console.log(`  totalAmount    $${String(total).padEnd(10)} $${total}   (unchanged)`);
  console.log(`  upPortion      $${String(pc.upPortion).padEnd(10)} $${upPortion}`);
  console.log(`  platformPortion $${String(pc.platformPortion).padEnd(9)} $${platformPortion}`);

  const termPlans = (pc.termPlans || []).map((t: any) => ({
    ...t,
    upPortion,
  }));
  if (termPlans.length) {
    console.log("\n  term plans (upPortion is per-month, so it applies to every term):");
    for (const t of termPlans) {
      const comp = Math.round(t.upPortion * t.termMonths * 100) / 100;
      const cheapest = Math.min(
        t.totalAmount,
        t.bundleSubscriptionAmount ?? t.totalAmount
      );
      console.log(
        `    ${String(t.termMonths).padStart(2)}mo  sell $${String(t.totalAmount).padEnd(5)}` +
          `  comp $${String(comp).padEnd(6)}  platform $${Math.round((cheapest - comp) * 100) / 100}`
      );
    }
  }

  client.productConfig = {
    ...pc,
    upPortion,
    platformPortion,
    ...(termPlans.length ? { termPlans } : {}),
  } as any;

  const err = client.validateSync();
  if (err) throw new Error(`Validation failed: ${err.message}`);
  console.log("\nValidation: OK (solvency invariant satisfied)");

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    await mongoose.disconnect();
    return;
  }

  await client.save();
  console.log(
    `\nSaved. Every NetworkChain distribution from now on uses $${upPortion}/month.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
