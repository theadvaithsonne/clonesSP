/**
 * Diagnostic: given a buyer's email, report everything about their
 * whitelabel purchases + commission flow — invoices, addon subscription
 * source, commission breakdown metadata, wallet transactions.
 *
 * Usage:
 *   npx tsx src/scripts/diagnose-whitelabel-commission.ts <email>
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";

async function run() {
  const [emailRaw] = process.argv.slice(2);
  if (!emailRaw) {
    console.error("Usage: npx tsx src/scripts/diagnose-whitelabel-commission.ts <email>");
    process.exit(1);
  }
  const email = emailRaw.trim().toLowerCase();

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected\n`);

  const buyer: any = await User.findOne({ email }).lean();
  if (!buyer) {
    console.error(`❌ No user ${email}`);
    process.exit(1);
  }
  console.log(`👤 Buyer: ${buyer.name || "(no name)"} <${buyer.email}> ${buyer._id}`);
  console.log(`   referredBy: ${buyer.referredBy || "(none)"}\n`);

  if (buyer.referredBy) {
    const upline: any = await User.findById(buyer.referredBy)
      .select("_id email name")
      .lean();
    if (upline) {
      console.log(`⬆️  L1 (referredBy): ${upline.name || "(no name)"} <${upline.email}> ${upline._id}\n`);
    }
  }

  // Look for any whitelabel_addon invoices for this buyer.
  const invoices: any[] = await Invoice.find({
    userId: buyer._id,
    "lineItems.itemType": "whitelabel_addon",
  })
    .sort({ createdAt: -1 })
    .lean();
  console.log(`📄 Whitelabel invoices: ${invoices.length}`);
  for (const inv of invoices) {
    console.log(`  • ${inv.invoiceNumber} (${inv._id})`);
    console.log(`      status=${inv.status}  totalAmount=${inv.totalAmount}  paidAt=${inv.paidAt || "(unpaid)"}`);
    console.log(`      metadata.whitelabelCommissionAt = ${inv.metadata?.whitelabelCommissionAt || "(never fired)"}`);
    console.log(`      metadata.whitelabelActivatedAt  = ${inv.metadata?.whitelabelActivatedAt || "(never fired)"}`);
    if (inv.metadata?.whitelabelCommissionBreakdown) {
      console.log(`      breakdown:`, JSON.stringify(inv.metadata.whitelabelCommissionBreakdown, null, 6));
    }
  }
  console.log("");

  // Look at their addon subscription for whitelabel across every org.
  const wlAddon = await OfficeAddon.findOne({ slug: WHITELABEL_ADDON.slug })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!wlAddon) {
    console.error(`❌ OfficeAddon "${WHITELABEL_ADDON.slug}" not seeded`);
    process.exit(1);
  }
  const subs: any[] = await OfficeAddonSubscription.find({
    founderId: buyer._id,
    addonId: wlAddon._id,
  }).lean();
  console.log(`🏢 Whitelabel subscriptions where founderId = buyer: ${subs.length}`);
  for (const s of subs) {
    console.log(`  • orgId=${s.orgId}  status=${s.status}`);
    console.log(`      currentEnd=${s.currentEnd?.toISOString?.() || "(none)"}`);
    console.log(`      metadata.source = ${s.metadata?.source || "(none)"}`);
    console.log(`      metadata.lastInvoiceNumber = ${s.metadata?.lastInvoiceNumber || "(none)"}`);
    console.log(`      metadata.grantedAt = ${s.metadata?.grantedAt || "(none)"}`);
    if (s.metadata?.source === "manual_admin_grant") {
      console.log(`      🚨 THIS SUBSCRIPTION WAS MANUALLY GRANTED — no invoice, no commission ran.`);
    }
  }
  console.log("");

  // Look for wallet transactions tagged whitelabel* for the buyer's upline.
  if (buyer.referredBy) {
    const uplineTxs: any[] = await WalletTransaction.find({
      userId: buyer.referredBy,
      "metadata.kind": {
        $in: [
          "whitelabel_addon",
          "whitelabel_addon_direct",
          "whitelabel_addon_cascade",
          "whitelabel_monthly_bonus",
        ],
      },
    })
      .sort({ createdAt: -1 })
      .lean();
    console.log(
      `💳 Wallet transactions on L1 (${buyer.referredBy}) tagged as whitelabel: ${uplineTxs.length}`,
    );
    for (const t of uplineTxs) {
      console.log(
        `  • ${t.createdAt?.toISOString?.()}  kind=${t.metadata?.kind}  amount=${t.amount} ${t.currency}  dedupeKey=${t.metadata?.dedupeKey || "(none)"}`,
      );
    }
    console.log("");
  }

  // Also: any wallet transactions for Shorupan tagged whitelabel_addon_platform.
  const shorupan: any = await User.findOne({ email: "shorupan@gmail.com" })
    .select("_id")
    .lean();
  if (shorupan) {
    const platformTxs: any[] = await WalletTransaction.find({
      userId: shorupan._id,
      "metadata.kind": {
        $in: ["whitelabel_addon_platform", "whitelabel_monthly_bonus"],
      },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    console.log(
      `🏛  Recent platform-residual wallet transactions on Shorupan: ${platformTxs.length}`,
    );
    for (const t of platformTxs) {
      console.log(
        `  • ${t.createdAt?.toISOString?.()}  kind=${t.metadata?.kind}  amount=${t.amount} ${t.currency}  invoiceNumber=${t.metadata?.invoiceNumber || "(none)"}`,
      );
    }
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
