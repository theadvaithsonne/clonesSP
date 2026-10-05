/**
 * Backfill the next recurring child invoice for already-PAID parent
 * subscriptions.
 *
 * The on-payment trigger in fulfillInvoice (→ generateNextChildInvoice) only
 * fires for NEW payments. Subscriptions paid BEFORE that trigger shipped have
 * no next "draft" invoice yet, and the daily cron only mints it ~5 days before
 * due — so this catches them up now (e.g. to test the Subscription page's
 * "Due" row without waiting for renewal or a fresh payment).
 *
 * Idempotent: generateNextChildInvoice dedups on (parentInvoiceId,
 * recurringPaymentNumber), so re-running is safe and never double-creates.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/backfill-next-recurring-invoice.ts <customerEmail>
 *   npx tsx src/scripts/backfill-next-recurring-invoice.ts --all
 *   # add --dry to only LIST eligible parents, creating nothing:
 *   npx tsx src/scripts/backfill-next-recurring-invoice.ts <email> --dry
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { generateNextChildInvoice } from "../services/invoice";

async function run() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const all = args.includes("--all");
  const email = args.find((a) => !a.startsWith("--"));

  if (!all && !email) {
    console.error(
      "Usage: npx tsx src/scripts/backfill-next-recurring-invoice.ts <customerEmail> | --all [--dry]",
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to MongoDB${dry ? " (DRY RUN — no writes)" : ""}`);

  // Mirror generateNextChildInvoice's own eligibility so we don't scan no-ops:
  // paid chain-root recurring invoices that aren't Razorpay-managed/cancelled.
  const query: Record<string, unknown> = {
    isRecurring: true,
    status: "paid",
    parentInvoiceId: { $exists: false },
    cancelledAt: { $in: [null, undefined] },
    $or: [
      { razorpaySubscriptionId: { $exists: false } },
      { razorpaySubscriptionId: null },
      { razorpaySubscriptionId: "" },
    ],
  };
  if (email) query.customerEmail = email.trim().toLowerCase();

  const parents = await Invoice.find(query);
  console.log(`Found ${parents.length} eligible paid parent invoice(s).`);

  let created = 0;
  let skipped = 0;
  let missingDue = 0;
  for (const parent of parents) {
    const tag = `${parent.invoiceNumber} (${parent.customerEmail})`;
    if (!parent.nextDueDate) {
      console.warn(`  - SKIP ${tag}: no nextDueDate set on parent`);
      missingDue++;
      continue;
    }
    if (dry) {
      console.log(
        `  - would generate next cycle for ${tag} — due ${new Date(parent.nextDueDate).toISOString()}`,
      );
      continue;
    }
    try {
      const child = await generateNextChildInvoice(parent);
      if (child) {
        created++;
        console.log(
          `  - CREATED ${child.invoiceNumber} (cycle ${child.recurringPaymentNumber}, status ${child.status}) for ${tag}`,
        );
      } else {
        skipped++;
        console.log(`  - skip ${tag}: child already exists / ineligible`);
      }
    } catch (e) {
      console.error(`  - ERROR ${tag}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(
    `Done. created=${created} skipped=${skipped} missingNextDue=${missingDue}`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
