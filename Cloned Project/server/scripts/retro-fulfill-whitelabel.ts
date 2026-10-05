/**
 * Retro-run the whitelabel_addon fulfillment on a specific invoice
 * that was PAID but never had its switch case fire (e.g. deployed BE
 * was stale at payment time). Calls the two side-effects our normal
 * fulfillInvoice switch case would call, both idempotent:
 *   1. activateWhitelabelFromInvoice — upserts OfficeAddonSubscription
 *      so hasActiveAddon flips true. Marked via
 *      `invoice.metadata.whitelabelActivatedAt`; short-circuits if set.
 *   2. chargeReferralCommission — 3-bucket split (L1 flat $150 +
 *      L1..L6 cascade $144 + platform residual $6). Idempotent via
 *      per-bucket dedupeKeys on each WalletTransaction.
 *
 * Safe to run against production. Multiple runs on the same invoice
 * are no-ops (the second run's metadata short-circuit fires first;
 * even without that, the wallet-side dedupeKey's partial unique index
 * blocks any double-credit).
 *
 * Usage:
 *   npx tsx src/scripts/retro-fulfill-whitelabel.ts <invoiceId>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error(
      "Usage: npx tsx src/scripts/retro-fulfill-whitelabel.ts <invoiceId>",
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected\n`);

  const invoice: any = await Invoice.findById(id);
  if (!invoice) {
    console.error(`❌ No invoice ${id}`);
    process.exit(1);
  }

  const primary = invoice.lineItems?.[0];
  if (!primary) {
    console.error(`❌ Invoice ${id} has no lineItems`);
    process.exit(1);
  }
  if (primary.itemType !== "whitelabel_addon") {
    console.error(
      `❌ Invoice ${id} has itemType "${primary.itemType}" — refusing (this script only touches whitelabel_addon).`,
    );
    process.exit(1);
  }
  if (invoice.status !== "paid") {
    console.error(
      `❌ Invoice ${id} status is "${invoice.status}" — refusing (must be "paid").`,
    );
    process.exit(1);
  }

  console.log(`📄 ${invoice.invoiceNumber}  status=${invoice.status}`);
  console.log(`   buyer userId: ${invoice.userId}`);
  console.log(`   orgId: ${invoice.organizationId}`);
  console.log(
    `   metadata.whitelabelActivatedAt = ${invoice.metadata?.whitelabelActivatedAt || "(never fired)"}`,
  );
  console.log(
    `   metadata.whitelabelCommissionAt = ${invoice.metadata?.whitelabelCommissionAt || "(never fired)"}`,
  );
  console.log("");

  console.log("── Step 1: activateWhitelabelFromInvoice ──");
  try {
    const { activateWhitelabelFromInvoice } = await import(
      "../services/whitelabelAddonPurchase"
    );
    await activateWhitelabelFromInvoice(invoice);
    console.log("   ✅ Activation ran (or was already stamped — either way safe).");
  } catch (err: any) {
    console.error("   ❌ Activation failed:", err?.message || err);
  }

  console.log("\n── Step 2: chargeReferralCommission ──");
  try {
    const { chargeReferralCommission } = await import(
      "../services/whitelabelAddonPurchase"
    );
    const result = await chargeReferralCommission(invoice);
    console.log(
      `   ✅ Commission ran. distributed=${result.distributed}`,
    );
    if (result.breakdown) {
      console.log(`   breakdown:`, JSON.stringify(result.breakdown, null, 4));
    }
  } catch (err: any) {
    console.error("   ❌ Commission failed:", err?.message || err);
  }

  // Fresh-read to prove the markers stuck.
  const fresh: any = await Invoice.findById(id).lean();
  console.log("\n── After ──");
  console.log(
    `   metadata.whitelabelActivatedAt = ${fresh?.metadata?.whitelabelActivatedAt || "(still absent)"}`,
  );
  console.log(
    `   metadata.whitelabelCommissionAt = ${fresh?.metadata?.whitelabelCommissionAt || "(still absent)"}`,
  );
  if (fresh?.metadata?.whitelabelCommissionBreakdown) {
    console.log(
      `   breakdown:`,
      JSON.stringify(fresh.metadata.whitelabelCommissionBreakdown, null, 4),
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
