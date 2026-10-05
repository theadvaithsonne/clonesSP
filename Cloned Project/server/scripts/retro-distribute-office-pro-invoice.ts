/**
 * Retro-fire the Pro-plan commission for an office_plan Pro invoice
 * that was paid but never distributed (cryptobrand-bootstrap wallet/
 * crypto path pre-fix).
 *
 * Idempotent — calls the same distributeProOfficeCommissionForInvoice
 * that fulfillInvoice("office_plan") now calls at runtime. Re-runs no-op
 * via metadata.officeProCommissionAt + wallet dedupeKey guards.
 *
 * Usage:
 *   npx tsx src/scripts/retro-distribute-office-pro-invoice.ts <invIdOrNumber>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error(
      "Usage: npx tsx retro-distribute-office-pro-invoice.ts <invIdOrNumber>",
    );
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected\n");

  const inv: any = mongoose.Types.ObjectId.isValid(id)
    ? await Invoice.findById(id)
    : await Invoice.findOne({ invoiceNumber: id });
  if (!inv) {
    console.error(`❌ No invoice for "${id}"`);
    process.exit(1);
  }

  console.log(`📄 ${inv.invoiceNumber}  status=${inv.status}`);
  console.log(
    `   base=$${(inv.subtotal || 0) / 100}  gst=$${(inv.tax || 0) / 100}  total=$${(inv.totalAmount || 0) / 100}`,
  );

  if (inv.status !== "paid") {
    console.error(`❌ Invoice is not paid (status=${inv.status})`);
    process.exit(1);
  }

  const { distributeProOfficeCommissionForInvoice } = await import(
    "../services/officeProInvoiceCommission"
  );
  const result = await distributeProOfficeCommissionForInvoice(inv);
  console.log(`\nResult: ${result.status}`);
  if (result.breakdown) {
    console.log(JSON.stringify(result.breakdown, null, 2));
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
