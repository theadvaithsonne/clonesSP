/**
 * Dump the full invoice + related state so we can see exactly why
 * fulfillInvoice didn't do what we expected.
 *
 * Usage: npx tsx src/scripts/inspect-invoice.ts <invoiceId>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { WalletTransaction } from "../models/walletTransaction.model";

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error("Usage: npx tsx src/scripts/inspect-invoice.ts <invoiceId>");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);

  const inv: any = await Invoice.findById(id).lean();
  if (!inv) {
    console.error(`❌ No invoice ${id}`);
    process.exit(1);
  }

  console.log("═══ INVOICE ═══");
  console.log(`_id: ${inv._id}`);
  console.log(`invoiceNumber: ${inv.invoiceNumber}`);
  console.log(`status: ${inv.status}`);
  console.log(`paidAt: ${inv.paidAt}`);
  console.log(`userId (buyer): ${inv.userId}`);
  console.log(`sellerId: ${inv.sellerId}`);
  console.log(`organizationId: ${inv.organizationId}`);
  console.log(`isRecurring: ${inv.isRecurring}`);
  console.log(`recurringPeriod: ${inv.recurringPeriod}`);
  console.log(`recurringPaymentNumber: ${inv.recurringPaymentNumber}`);
  console.log(`subtotal: ${inv.subtotal}  tax: ${inv.tax}  totalAmount: ${inv.totalAmount}`);
  console.log(`itemCurrency: ${inv.itemCurrency}  paymentCurrency: ${inv.paymentCurrency}`);
  console.log(`paymentPlatform: ${inv.paymentPlatform}  paymentMethodCategory: ${inv.paymentMethodCategory}`);
  console.log(`commissionDistributed: ${inv.commissionDistributed}`);
  console.log("");

  console.log("═══ LINE ITEMS ═══");
  for (const li of inv.lineItems || []) {
    console.log(`  itemType: ${li.itemType}`);
    console.log(`  itemId:   ${li.itemId}`);
    console.log(`  itemName: ${li.itemName}`);
    console.log(`  quantity: ${li.quantity}  unitPrice: ${li.unitPrice}  originalCurrency: ${li.originalCurrency}`);
    console.log("");
  }

  console.log("═══ METADATA ═══");
  console.log(JSON.stringify(inv.metadata, null, 2));
  console.log("");

  const txs = await WalletTransaction.find({
    "metadata.invoiceId": String(inv._id),
  })
    .sort({ createdAt: 1 })
    .lean<any[]>();
  console.log(`═══ WALLET TRANSACTIONS with metadata.invoiceId = ${inv._id} (${txs.length}) ═══`);
  for (const t of txs) {
    console.log(
      `  ${t.createdAt?.toISOString?.()}  user=${t.userId} walletType=${t.walletType} type=${t.type} amount=${t.amount} ${t.currency}`,
    );
    console.log(`      description: ${t.description}`);
    console.log(`      metadata.kind: ${t.metadata?.kind}  dedupeKey: ${t.metadata?.dedupeKey}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
