/**
 * Seed multi-month term plans onto a third-party client.
 *
 * Usage:
 *   npx tsx src/scripts/seed-networkchain-term-plans.ts <clientId> [--activate]
 *
 * Without --activate, only the 1-month term is sellable. That is the intended
 * initial state: 3/6/12 stay `isActive: false` until NetworkChain confirms their
 * webhook handler reads `termMonths` / `periodEnd`. Until then a 12-month buyer
 * would be granted one month of access on their side.
 *
 * Idempotent — rewrites the whole termPlans array from the client's own monthly
 * scalars, so re-running after a price change keeps everything consistent.
 */
import mongoose from "mongoose";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";

/**
 * Sell prices, in dollars, for the whole term.
 *
 * `standalone` — buying the term on its own (or on renewal).
 * `bundleCart` — the TOTAL cart when bought together with the $25 licence, so
 *                the subscription portion is `bundleCart − 25`.
 *
 * Both are below the $36/month list rate; comp still runs on list ($12/month),
 * and the platform absorbs the difference.
 */
const TERM_PRICING: Array<{
  termMonths: number;
  standalone: number;
  bundleCart?: number;
}> = [
  { termMonths: 1, standalone: 36 }, // no bundled monthly tier
  { termMonths: 3, standalone: 100, bundleCart: 100 }, // sub portion $75
  { termMonths: 6, standalone: 200, bundleCart: 216 }, // sub portion $191
  { termMonths: 12, standalone: 396, bundleCart: 421 }, // sub portion $396
];

async function main() {
  const [clientIdArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const activate = process.argv.includes("--activate");
  const dryRun = process.argv.includes("--dry-run");
  const list = process.argv.includes("--list");

  if (!clientIdArg && !list) {
    console.error(
      "Usage: npx tsx src/scripts/seed-networkchain-term-plans.ts <clientId> [--activate] [--dry-run]\n" +
        "       npx tsx src/scripts/seed-networkchain-term-plans.ts --list    (read-only: show invoice-enabled clients)"
    );
    process.exit(1);
  }
  const clientId = clientIdArg;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(`DB: ${uri.replace(/\/\/[^@]*@/, "//***@")}\n`);

  // Read-only discovery: which clients could be seeded, and what they have now.
  if (list) {
    const all = await ThirdPartyClient.find({
      "productConfig.productCode": { $exists: true },
    }).lean();
    for (const c of all) {
      const pc: any = c.productConfig;
      const plans = pc?.termPlans as any[] | undefined;
      console.log(
        `${String(c._id)}  ${c.name}  (${pc?.productCode})  active=${c.isActive}\n` +
          `   monthly $${pc?.totalAmount} = $${pc?.upPortion} UP + $${pc?.platformPortion} platform\n` +
          `   termPlans: ${
            plans?.length
              ? plans
                  .map(
                    (p) =>
                      `${p.termMonths}mo $${p.totalAmount}${
                        p.bundleSubscriptionAmount != null
                          ? `/bundle $${p.bundleSubscriptionAmount}`
                          : ""
                      }${p.isActive === false ? " (inactive)" : ""}`
                  )
                  .join(", ")
              : "— none —"
          }\n`
      );
    }
    await mongoose.disconnect();
    return;
  }

  const client = await ThirdPartyClient.findById(clientId);
  if (!client) throw new Error(`ThirdPartyClient ${clientId} not found`);
  if (!client.productConfig) {
    throw new Error(`ThirdPartyClient ${clientId} has no productConfig`);
  }

  const pc = client.productConfig;
  console.log(
    `Client: ${client.name} (${pc.productCode})\n` +
      `Monthly: $${pc.totalAmount} = $${pc.upPortion} UP + $${pc.platformPortion} platform\n`
  );

  // `upPortion` is PER MONTH and identical across terms — it is the commission
  // basis (list value), NOT a share of the sell price. The model validator
  // enforces upPortion × termMonths <= the cheapest sell price, so the platform
  // residual can never go negative.
  // The licence price the bundled CART includes. `bundleCart` above is what the
  // buyer pays in one go; the stored field is the SUBSCRIPTION PORTION
  // (cart − licence), because that's what the solvency validator compares comp
  // against. Storing the cart total instead would let an insolvent bundle pass
  // validation by up to the licence price.
  const licenceUsd = 25;

  // `upPortion` is PER MONTH and identical across terms — it is the commission
  // basis (list value), NOT a share of the sell price.
  const termPlans = TERM_PRICING.map((t) => {
    const subPortion =
      t.bundleCart != null
        ? Math.round((t.bundleCart - licenceUsd) * 100) / 100
        : undefined;
    if (t.bundleCart != null && subPortion! <= 0) {
      throw new Error(
        `${t.termMonths}mo bundleCart $${t.bundleCart} must exceed the $${licenceUsd} licence`
      );
    }
    return {
      termMonths: t.termMonths,
      totalAmount: t.standalone,
      ...(subPortion != null ? { bundleSubscriptionAmount: subPortion } : {}),
      upPortion: pc.upPortion,
      // 1 month is always sellable; the rest are gated on the partner shipping
      // their side of the contract (honouring termMonths / periodEnd).
      isActive: t.termMonths === 1 ? true : activate,
      label: t.termMonths === 1 ? "Monthly" : `${t.termMonths} months`,
      sortOrder: t.termMonths,
    };
  });

  console.log(
    "  term   standalone   bundled cart   sub portion   comp    platform   status"
  );
  for (const p of termPlans) {
    const comp = Math.round(p.upPortion * p.termMonths * 100) / 100;
    const subPortion = (p as any).bundleSubscriptionAmount as number | undefined;
    const cart =
      subPortion != null ? Math.round((subPortion + licenceUsd) * 100) / 100 : null;
    // Platform keeps whatever the cheapest sell price leaves after comp.
    const cheapest = Math.min(p.totalAmount, subPortion ?? p.totalAmount);
    const platform = Math.round((cheapest - comp) * 100) / 100;
    console.log(
      `  ${String(p.termMonths).padStart(2)}mo   ` +
        `$${String(p.totalAmount).padEnd(10)} ` +
        `${cart != null ? "$" + String(cart).padEnd(12) : "—".padEnd(13)} ` +
        `${subPortion != null ? "$" + String(subPortion).padEnd(11) : "—".padEnd(12)} ` +
        `$${String(comp).padEnd(6)} $${String(platform).padEnd(9)} ` +
        `${p.isActive ? "ACTIVE" : "inactive"}`
    );
  }

  const existing = (pc as any).termPlans as any[] | undefined;
  console.log(
    `\nCurrent termPlans on the doc: ${
      existing?.length ? JSON.stringify(existing) : "— none —"
    }`
  );

  client.productConfig = {
    ...((client.productConfig as any)?.toObject?.() ?? client.productConfig),
    termPlans,
  } as any;

  // Validate either way — a dry run should still prove the config is legal.
  const validationError = client.validateSync();
  if (validationError) {
    throw new Error(`Validation failed: ${validationError.message}`);
  }
  console.log("Validation: OK (solvency invariant satisfied)");

  if (dryRun) {
    console.log(
      "\n--dry-run: nothing written. Re-run without --dry-run to persist."
    );
    await mongoose.disconnect();
    return;
  }

  await client.save(); // schema validator runs again here
  console.log(
    `\nSaved.${activate ? "" : "\nRe-run with --activate once the partner honours termMonths."}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
