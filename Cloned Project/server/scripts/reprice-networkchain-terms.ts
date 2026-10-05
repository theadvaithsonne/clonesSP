/**
 * Reprice the NetworkChain multi-month term plans.
 *
 * Prices live in Mongo on `ThirdPartyClient.productConfig.termPlans[]`, not in
 * code, so this is a data change. It edits ONLY the price fields of the terms
 * named in TARGET_PRICING — `upPortion`, `isActive`, `label` and `sortOrder`
 * are left exactly as they are, and any term not listed (notably the 1-month
 * plan) is not touched at all.
 *
 * WHY NOT seed-networkchain-term-plans.ts:
 *   That script rewrites the WHOLE array from hardcoded constants which are
 *   stale relative to production (it derives bundle values as `bundleCart − 25`,
 *   which no longer matches what is stored), and it writes `isActive: false`
 *   for 3/6/12 unless `--activate` is passed — silently making them
 *   unsellable. This script is surgical by comparison.
 *
 * BOTH PRICE FIELDS MOVE TOGETHER:
 *   - `totalAmount`              → standalone purchases AND every renewal
 *   - `bundleSubscriptionAmount` → the subscription portion when bought in the
 *                                  same cart as the $25 licence
 *   They diverge only in services/thirdPartyTerms.ts (`useBundle`). Changing
 *   just one leaves the bundle at the old price, so the licence-cart silently
 *   costs MORE than standalone — no error, just an overcharge.
 *
 * AFFILIATE COMP IS NOT AFFECTED. On multi-month terms commission is pinned to
 * the monthly list `upPortion` ($6/month) and the platform absorbs the whole
 * discount as its residual — see services/commission.ts (`scaledUp =
 * upPerMonthList`). Repricing moves margin only. The model's solvency
 * invariant (`upPortion × termMonths <= cheapest sell price`) still has to
 * hold, and is checked below before anything is written.
 *
 * Safe by default: prints old → new and exits. Pass --confirm to write.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/reprice-networkchain-terms.ts
 *   npx tsx src/scripts/reprice-networkchain-terms.ts --confirm
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";

/** The licence price the bundled cart is quoted on top of. Display only. */
const LICENCE_USD = 25;

/**
 * termMonths → the new price, applied to BOTH `totalAmount` and
 * `bundleSubscriptionAmount`. The 1-month plan is deliberately absent: it stays
 * at $36, and the model forbids a bundle price on it anyway.
 */
const TARGET_PRICING: Record<number, number> = {
  3: 99,
  6: 180,
  12: 324,
};

const money = (n: number | undefined | null) =>
  n === undefined || n === null ? "—" : `$${n}`;

async function run() {
  const confirm = process.argv.slice(2).includes("--confirm");

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})\n`);

  const clients = await ThirdPartyClient.find({ isActive: true });
  if (clients.length !== 1) {
    console.error(
      `❌ Expected exactly 1 active ThirdPartyClient, found ${clients.length}. Refusing to guess.`,
    );
    process.exit(1);
  }
  const client = clients[0];
  const pc: any = (client as any).productConfig;
  if (!pc?.termPlans?.length) {
    console.error(`❌ ${client.name} has no productConfig.termPlans to reprice.`);
    process.exit(1);
  }

  console.log(`🏷  Client: ${client.name} (${client._id})`);
  console.log(
    `   monthly list: $${pc.totalAmount}  upPortion: $${pc.upPortion}/mo (NOT changing)\n`,
  );

  // ── Plan the change ─────────────────────────────────────────────────────
  const changes: Array<{
    termMonths: number;
    fromTotal: number;
    toTotal: number;
    fromBundle: number | undefined;
    toBundle: number;
    upPortion: number;
  }> = [];

  for (const [monthsStr, price] of Object.entries(TARGET_PRICING)) {
    const months = Number(monthsStr);
    const plan = pc.termPlans.find((p: any) => p.termMonths === months);
    if (!plan) {
      console.error(`❌ No ${months}-month term plan exists — refusing to create one here.`);
      process.exit(1);
    }
    changes.push({
      termMonths: months,
      fromTotal: plan.totalAmount,
      toTotal: price,
      fromBundle: plan.bundleSubscriptionAmount,
      toBundle: price,
      upPortion: plan.upPortion,
    });
  }
  changes.sort((a, b) => a.termMonths - b.termMonths);

  console.log("── REPRICE ──");
  console.log(
    `   term     standalone        bundle-sub        cart(+$${LICENCE_USD})   comp      platform`,
  );
  for (const c of changes) {
    const compTotal = c.upPortion * c.termMonths;
    const platBefore = c.fromTotal - compTotal;
    const platAfter = c.toTotal - compTotal;
    console.log(
      `   ${String(c.termMonths).padStart(2)}mo   ` +
        `${money(c.fromTotal).padStart(5)} → ${money(c.toTotal).padEnd(6)}  ` +
        `${money(c.fromBundle).padStart(5)} → ${money(c.toBundle).padEnd(6)}  ` +
        `${money(LICENCE_USD + c.toTotal).padStart(6)}       ` +
        `$${compTotal} (same)  ${money(platBefore)} → ${money(platAfter)}`,
    );
  }

  const untouched = pc.termPlans
    .filter((p: any) => !(p.termMonths in TARGET_PRICING))
    .map((p: any) => `${p.termMonths}mo ${money(p.totalAmount)}`);
  console.log(`\n   untouched: ${untouched.join(", ") || "(none)"}`);

  // ── Solvency guard, mirroring the model validator ───────────────────────
  // upPortion × termMonths must not exceed the cheapest sell price, or the
  // platform's share goes negative and commission.ts clamps it to 0.
  let unsafe = false;
  for (const c of changes) {
    const comp = c.upPortion * c.termMonths;
    const cheapest = Math.min(c.toTotal, c.toBundle);
    if (comp > cheapest) {
      console.error(
        `❌ ${c.termMonths}mo: comp $${comp} exceeds cheapest sell $${cheapest} — platform share would go negative.`,
      );
      unsafe = true;
    }
  }
  if (unsafe) {
    console.error(`\nRefusing to write. Nothing changed.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!confirm) {
    console.log(`\n🔍 DRY RUN — nothing written. Re-run with --confirm to apply.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Apply ───────────────────────────────────────────────────────────────
  for (const c of changes) {
    const plan = pc.termPlans.find((p: any) => p.termMonths === c.termMonths);
    plan.totalAmount = c.toTotal;
    plan.bundleSubscriptionAmount = c.toBundle;
  }
  (client as any).markModified("productConfig.termPlans");

  // Run the schema validators BEFORE saving so a bad price is rejected here
  // rather than half-written.
  const invalid = (client as any).validateSync();
  if (invalid) {
    console.error(`❌ Validation failed, nothing written:`, invalid.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  await client.save();
  console.log(`\n✅ Wrote ${changes.length} term plan(s).`);

  const after = await ThirdPartyClient.findById(client._id).lean<any>();
  console.log(`\n── VERIFY (re-read from Mongo) ──`);
  for (const p of (after.productConfig.termPlans as any[]).sort(
    (a, b) => a.termMonths - b.termMonths,
  )) {
    console.log(
      `   ${String(p.termMonths).padStart(2)}mo  standalone=${money(p.totalAmount).padEnd(6)} ` +
        `bundleSub=${money(p.bundleSubscriptionAmount).padEnd(6)} ` +
        `upPortion=$${p.upPortion}/mo  isActive=${p.isActive}`,
    );
  }

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
