/**
 * ONE-OFF: Deliver the office months that FOUNDERSOFFICE paid for but never activated.
 *
 * BACKGROUND
 *   Org 6a0207e0e7ce4252ed4b1d17 (Techworlds, founder techworldsdata@gmail.com)
 *   redeemed FOUNDERSOFFICE — 100% off, 12 cycles — on 2026-09-01. A recurring
 *   cascade burned all 12 cycles in 3 seconds. Every cycle:
 *     ✅ was marked `paid`
 *     ✅ fired the Office Pro commission ($888 total, since reversed)
 *     ❌ activated NOTHING — `fulfillInvoice`'s office_plan case only ran the
 *        commission and returned "payment_recorded"
 *
 *   Result: the coupon is spent (cyclesApplied 11/12, expired 2026-09-01
 *   17:34), the founder has no office, and on 2026-09-02 he was issued a
 *   fresh $113.28 invoice for the thing he had already redeemed.
 *
 * WHAT THIS DOES
 *   Replays `activateOfficeFromPaidInvoice` over the 12 paid invoices, using
 *   the SAME function fulfillInvoice now calls — not a hand-built row — so
 *   the repaired state is identical to what the fixed code would have
 *   produced. Each invoice extends one billing period, so 12 paid cycles
 *   yield 12 months.
 *
 *   Then voids the duplicate 2026-09-02 invoice (INV-MTK1UO56-Z2UB, $113.28,
 *   no coupon, status draft) so he is not billed for a period he already owns.
 *
 * IDEMPOTENT
 *   Activation records applied invoice ids on the subscription; a re-run is a
 *   no-op. Safe to run twice.
 *
 * Usage:
 *   Dry run (default):  npx tsx src/scripts/repair-foundersoffice-activation.ts
 *   Apply:              npx tsx src/scripts/repair-foundersoffice-activation.ts --apply
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const APPLY = process.argv.includes("--apply");

const PARENT_INVOICE_ID = "6a96b1da6b7f1dd3c712dc1c";
const DUPLICATE_INVOICE_NUMBER = "INV-MTK1UO56-Z2UB";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { Invoice } = await import("../models/invoice.model");
  const { OfficeSubscription } = await import(
    "../models/officeSubscription.model"
  );
  const { activateOfficeFromPaidInvoice } = await import(
    "../services/officeSubscription"
  );

  console.log(
    `\nFOUNDERSOFFICE activation repair — ${APPLY ? "APPLY" : "DRY RUN"}\n` +
      "=".repeat(74)
  );

  const parentId = new Types.ObjectId(PARENT_INVOICE_ID);
  const invoices = await Invoice.find({
    $or: [{ _id: parentId }, { parentInvoiceId: parentId }],
    status: "paid",
  }).sort({ recurringPaymentNumber: 1 });

  console.log(`Paid cycles to apply: ${invoices.length}`);

  const orgId = invoices[0]?.organizationId;
  const before: any = await OfficeSubscription.findOne({ orgId }).lean();
  console.log(
    `\nSubscription BEFORE: status=${before?.status ?? "(none)"} ` +
      `paidCount=${before?.paidCount ?? "-"} ` +
      `currentEnd=${before?.currentEnd ? new Date(before.currentEnd).toISOString().slice(0, 10) : "-"}`
  );

  if (!APPLY) {
    console.log(
      `\nWould apply ${invoices.length} cycles → expect status=active, ` +
        `paidCount=${(before?.paidCount ?? 0) + invoices.length}, ` +
        `currentEnd ≈ ${invoices.length} months out.`
    );
    console.log(`Would void ${DUPLICATE_INVOICE_NUMBER} ($113.28 duplicate).`);
    console.log("\nDRY RUN — nothing written. Re-run with --apply.\n");
    await mongoose.disconnect();
    return;
  }

  let applied = 0;
  let skipped = 0;
  for (const inv of invoices) {
    const r = await activateOfficeFromPaidInvoice(inv);
    if (r.status === "already_applied") skipped++;
    else applied++;
    console.log(`  ${inv.invoiceNumber}  → ${r.status}`);
    // Mirror what fulfillInvoice now stamps, so the invoice records which
    // subscription it fed.
    if (r.subscriptionId) {
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: {
            "metadata.officeSubscriptionId": r.subscriptionId,
            "metadata.officeActivationStatus": r.status,
            "metadata.officeActivationRepairedAt": new Date(),
          },
        }
      );
    }
  }

  // Void the duplicate bill.
  const dup = await Invoice.findOne({ invoiceNumber: DUPLICATE_INVOICE_NUMBER });
  if (dup && dup.status === "draft") {
    dup.status = "cancelled";
    (dup as any).cancelledAt = new Date();
    dup.metadata = {
      ...(dup.metadata || {}),
      cancelReason:
        "Duplicate of FOUNDERSOFFICE cycles already paid 2026-09-01; office activated by repair script",
    };
    await dup.save();
    console.log(`\nVoided ${DUPLICATE_INVOICE_NUMBER} (was draft $113.28)`);
  } else {
    console.log(
      `\n${DUPLICATE_INVOICE_NUMBER}: status=${dup?.status ?? "not found"} — left alone`
    );
  }

  const after: any = await OfficeSubscription.findOne({ orgId }).lean();
  console.log(
    `\nSubscription AFTER:  status=${after?.status} paidCount=${after?.paidCount} ` +
      `currentEnd=${after?.currentEnd ? new Date(after.currentEnd).toISOString().slice(0, 10) : "-"}`
  );
  console.log(`\napplied=${applied} already_applied=${skipped}\n`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
