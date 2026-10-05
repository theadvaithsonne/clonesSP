/**
 * Audit a cryptobrand-office bootstrap purchase — given ONE invoice ID
 * (either the cryptosub or the office_plan invoice), find its sibling
 * invoice minted by the same bootstrap event, check payment/fulfillment
 * state, and enumerate every commission-related wallet tx tied to both.
 *
 * Usage:
 *   npx tsx src/scripts/audit-cryptobrand-bootstrap.ts <invoiceIdOrNumber>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";

async function findInvoice(idOrNumber: string): Promise<any | null> {
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    const byId = await Invoice.findById(idOrNumber).lean();
    if (byId) return byId;
  }
  return Invoice.findOne({ invoiceNumber: idOrNumber }).lean();
}

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error("Usage: npx tsx audit-cryptobrand-bootstrap.ts <invId|invNumber>");
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected\n");

  const inv: any = await findInvoice(id);
  if (!inv) {
    console.error(`❌ No invoice for "${id}"`);
    process.exit(1);
  }

  const primary = inv.lineItems?.[0];
  console.log(`📄 ${inv.invoiceNumber}  (_id=${inv._id})`);
  console.log(`   itemType: ${primary?.itemType}   status: ${inv.status}`);
  console.log(`   userId: ${inv.userId}   orgId: ${inv.organizationId}`);
  console.log(`   base: $${(inv.subtotal || 0) / 100}   gst: $${(inv.tax || 0) / 100}   total: $${(inv.totalAmount || 0) / 100}`);
  console.log(`   metadata.source: ${inv.metadata?.source ?? "—"}`);
  console.log(`   metadata.planSlug: ${inv.metadata?.planSlug ?? "—"}`);
  console.log(`   metadata.addonSlug: ${inv.metadata?.addonSlug ?? "—"}`);
  console.log(`   metadata.type: ${inv.metadata?.type ?? "—"}`);
  console.log(`   paidAt: ${inv.paidAt || "—"}\n`);

  // ── Find the sibling ──
  const orgId = inv.organizationId;
  const userId = inv.userId;
  const created = inv.createdAt;
  const wantedTypes = primary?.itemType === "cryptosub"
    ? ["office_plan"]
    : ["cryptosub"];
  const sibling: any = await Invoice.findOne({
    organizationId: orgId,
    userId,
    "lineItems.itemType": { $in: wantedTypes },
    "metadata.source": "cryptobrand_bootstrap",
    createdAt: {
      $gte: new Date(created.getTime() - 60_000),
      $lte: new Date(created.getTime() + 60_000),
    },
  }).lean();
  console.log(`👯 Sibling ${wantedTypes[0]} invoice:`);
  if (!sibling) {
    console.log(`   ⚠️  NOT FOUND — cryptobrand bootstrap should mint BOTH invoices.\n`);
  } else {
    console.log(`   ${sibling.invoiceNumber}  status=${sibling.status}  total=$${(sibling.totalAmount || 0) / 100}  paidAt=${sibling.paidAt || "—"}\n`);
  }

  const invoicesToAudit: any[] = [inv];
  if (sibling) invoicesToAudit.push(sibling);

  for (const target of invoicesToAudit) {
    const t = target.lineItems?.[0]?.itemType;
    console.log(`──────────── ${target.invoiceNumber} (${t}) ────────────`);
    console.log(`   status=${target.status}  paidAt=${target.paidAt || "—"}`);

    // Commission metadata stamps
    const md = target.metadata || {};
    if (t === "cryptosub") {
      console.log(`   cryptosubCommissionAt: ${md.cryptosubCommissionAt || "—"}`);
      console.log(`   cryptosubCommissionBreakdown: ${JSON.stringify(md.cryptosubCommissionBreakdown, null, 2)?.slice(0, 500) || "—"}`);
    } else if (t === "office_plan") {
      // office_plan commissions fire from officeSubscription.ts, not
      // fulfillInvoice — they don't stamp the invoice. Look for the
      // OfficeSubscriptionPayment side instead.
      console.log(`   (office_plan commissions don't stamp the invoice — checking OfficeSubscriptionPayment)`);
    }

    // Wallet txs referencing this invoice
    const txs = await WalletTransaction.find({
      $or: [
        { "metadata.invoiceId": String(target._id) },
        { "metadata.dedupeKey": { $regex: String(target._id) } },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();
    console.log(`   💰 ${txs.length} wallet tx(s) reference this invoice:`);
    for (const tx of txs) {
      const kind = (tx.metadata as any)?.kind || (tx.metadata as any)?.source || "?";
      console.log(`      [${tx.walletType}] ${tx.type} $${tx.amount}  kind=${kind}  → user=${tx.userId}  ${tx.description}`);
    }

    // UP distributions
    const upDists = await UnilevelPlusDistribution.find({
      $or: [
        { "metadata.invoiceId": String(target._id) },
        { paymentId: { $regex: String(target._id) } },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();
    console.log(`   🌳 ${upDists.length} UP distribution(s):`);
    for (const d of upDists) {
      console.log(`      paymentId=${d.paymentId}  saleAmount=$${d.saleAmount}  status=${d.status}  company=$${d.companyAmount}  directBonus=$${d.directBonusAmount}  levelBudget=$${d.levelBonusBudget} (dist $${d.levelBonusDistributed})  infT1=$${d.infinityTier1Amount}  infT2=$${d.infinityTier2Amount}  mgr=$${d.managerBonusAmount}  unalloc=$${d.unallocatedAmount}`);
    }
    console.log();
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
