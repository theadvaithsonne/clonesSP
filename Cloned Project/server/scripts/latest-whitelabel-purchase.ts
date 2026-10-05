import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const inv: any = await Invoice.findOne({
    "lineItems.itemType": "whitelabel_addon",
    status: "paid",
  })
    .sort({ paidAt: -1 })
    .lean();
  if (!inv) {
    console.log("No paid whitelabel_addon invoice");
    process.exit(0);
  }

  console.log(`\n═══ Most recent PAID whitelabel_addon invoice ═══`);
  console.log(`_id: ${inv._id}`);
  console.log(`invoiceNumber: ${inv.invoiceNumber}`);
  console.log(`paidAt: ${inv.paidAt}`);
  console.log(`userId (buyer): ${inv.userId}`);
  console.log(`organizationId: ${inv.organizationId}`);
  console.log(`totalAmount: ${inv.totalAmount}  tax: ${inv.tax}`);
  console.log(`paymentPlatform: ${inv.paymentPlatform}`);
  console.log(``);
  console.log(`metadata.whitelabelActivatedAt        = ${inv.metadata?.whitelabelActivatedAt || "(never fired)"}`);
  console.log(`metadata.whitelabelCommissionAt       = ${inv.metadata?.whitelabelCommissionAt || "(never fired)"}`);
  console.log(`metadata.whitelabelCommissionSkipped  = ${inv.metadata?.whitelabelCommissionSkipped || "(none)"}`);
  console.log(`metadata.whitelabelCommissionBreakdown= ${JSON.stringify(inv.metadata?.whitelabelCommissionBreakdown, null, 2) || "(none)"}`);
  console.log(``);

  // All wallet txs referencing this invoice
  const txs = await WalletTransaction.find({
    $or: [
      { "metadata.invoiceId": String(inv._id) },
      { "metadata.dedupeKey": { $regex: new RegExp(`whitelabel_.*${inv._id}`) } },
    ],
  }).sort({ createdAt: 1 }).lean<any[]>();

  console.log(`═══ WALLET TRANSACTIONS related to this invoice (${txs.length}) ═══`);
  const userIds = [...new Set(txs.map((t) => String(t.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).select("_id email name").lean<any[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  for (const t of txs) {
    const u = byId.get(String(t.userId));
    console.log(`  ${t.createdAt.toISOString()}  ${u?.email || t.userId}  wallet=${t.walletType} type=${t.type}  $${t.amount}`);
    console.log(`      kind=${t.metadata?.kind}  dedupeKey=${t.metadata?.dedupeKey || "(none)"}  bucket=${t.metadata?.bucket || "-"}  level=${t.metadata?.level || "-"}`);
    console.log(`      description: ${t.description}`);
  }
  console.log("");

  // OfficeAddonSubscription for this org
  const wlAddon: any = await OfficeAddon.findOne({ slug: WHITELABEL_ADDON.slug }).select("_id").lean();
  const sub: any = await OfficeAddonSubscription.findOne({
    orgId: inv.organizationId,
    addonId: wlAddon?._id,
  }).lean();
  console.log(`═══ OfficeAddonSubscription for this org ═══`);
  if (sub) {
    console.log(`_id: ${sub._id}  status: ${sub.status}  currentEnd: ${sub.currentEnd?.toISOString?.()}`);
    console.log(`metadata.source: ${sub.metadata?.source}`);
    console.log(`metadata.lastInvoiceNumber: ${sub.metadata?.lastInvoiceNumber}`);
    console.log(`razorpaySubscriptionId: ${sub.razorpaySubscriptionId || "(none — invoice-based)"}`);
    console.log(`paidCount: ${sub.paidCount}`);
  } else {
    console.log("  (none)");
  }

  // Buyer's referral chain
  const buyer: any = await User.findById(inv.userId).select("email name referredBy").lean();
  console.log("");
  console.log(`═══ BUYER + upline ═══`);
  console.log(`buyer: ${buyer?.email}  referredBy: ${buyer?.referredBy}`);
  if (buyer?.referredBy) {
    const l1: any = await User.findById(buyer.referredBy).select("email name referredBy").lean();
    console.log(`L1: ${l1?.email}  referredBy: ${l1?.referredBy}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
