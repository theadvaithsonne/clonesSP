/**
 * Flip legacy `office_addon_subscription` parent invoices from `itemCurrency:
 * "INR"` (or any non-USD) to `"USD"`. Bug: the old
 * `createInitialRoomsParentInvoice` pulled currency from the Pro plan doc,
 * which is `INR` for Indian orgs — but the unit price is a USD-cents
 * constant ($5 = 500), so those invoices silently displayed as ₹5 instead
 * of $5. Fix: rooms are always priced in USD; the payment layer handles
 * conversion at checkout.
 *
 * Only touches the RECURRING PARENT (`parentInvoiceId` unset). Paid CHILD
 * invoices from prior cycles are left alone — the money already moved
 * through Razorpay at the (wrong) INR value; rewriting the stamp would
 * mislead audit.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/heal-rooms-parent-currency.ts
 *   npx ts-node --transpile-only src/scripts/heal-rooms-parent-currency.ts --apply
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Invoice } from "../models/invoice.model";

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(
    `\n[heal-rooms-currency] mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`,
  );

  const stuck = await Invoice.find({
    "metadata.type": "office_addon_subscription",
    itemCurrency: { $ne: "USD" },
    parentInvoiceId: { $in: [null, undefined] },
    cancelledAt: { $in: [null, undefined] },
  }).lean();

  console.log(`Non-USD rooms parent invoices found: ${stuck.length}\n`);

  const summary = {
    healed: 0,
    errors: [] as Array<{ id: string; error: string }>,
  };

  for (const p of stuck) {
    const id = String(p._id);
    console.log(
      `  ${p.invoiceNumber}  org=${p.organizationId}  itemCurrency=${p.itemCurrency}  totalAmount=${p.totalAmount}  qty=${p.lineItems?.[0]?.quantity}`,
    );
    if (!APPLY) continue;
    try {
      await Invoice.updateOne(
        { _id: p._id },
        {
          $set: {
            itemCurrency: "USD",
            "lineItems.0.originalCurrency": "USD",
            "metadata.currencyHealedAt": new Date(),
          },
        },
      );
      summary.healed++;
      console.log(`    [OK] flipped to USD`);
    } catch (err: any) {
      console.error(`    [ERR] ${err?.message || err}`);
      summary.errors.push({ id, error: err?.message || String(err) });
    }
  }

  console.log(
    `\n${"─".repeat(70)}\n[heal-rooms-currency] SUMMARY (${APPLY ? "APPLIED" : "DRY-RUN"})`,
  );
  console.log(`  Non-USD parents found:  ${stuck.length}`);
  if (APPLY) {
    console.log(`  Actually healed:        ${summary.healed}`);
    console.log(`  Errors:                 ${summary.errors.length}`);
    for (const e of summary.errors) {
      console.log(`    ${e.id}: ${e.error}`);
    }
  } else {
    console.log(`\n  (Dry-run — re-run with --apply.)`);
  }
  console.log(`${"─".repeat(70)}\n`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
