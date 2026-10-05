/**
 * Golden replay: prove the term-pricing change is a no-op for existing monthly
 * subscriptions.
 *
 * READ-ONLY. For each recent third-party child invoice, re-derives what
 * `priceThirdPartyChildCycle` would produce today and diffs it against what was
 * actually billed. Expect ZERO differences except GST for buyers whose profile
 * country changed since the parent was created — and that set is the exact,
 * quantified blast radius of the child-GST recompute.
 *
 * Usage:
 *   npx tsx src/scripts/verify-third-party-term-pricing.ts [limit]
 */
import mongoose from "mongoose";
import { Invoice } from "../models/invoice.model";
import { priceThirdPartyChildCycle } from "../services/thirdPartyTerms";

async function main() {
  const limit = Number(process.argv[2]) || 100;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const children = await Invoice.find({
    "lineItems.itemType": "third_party_subscription",
    parentInvoiceId: { $exists: true },
    "metadata.kind": { $ne: "topup" },
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  console.log(`Replaying ${children.length} third-party child invoices…\n`);

  let identical = 0;
  const gstDiffs: string[] = [];
  const otherDiffs: string[] = [];
  let skipped = 0;

  for (const child of children) {
    const parent = await Invoice.findById(child.parentInvoiceId);
    if (!parent) {
      skipped++;
      continue;
    }

    const thisCycleDue = (child.metadata as any)?.periodStart
      ? new Date((child.metadata as any).periodStart)
      : child.expiresAt
        ? new Date(child.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000)
        : child.createdAt;

    let pricing;
    try {
      pricing = await priceThirdPartyChildCycle({
        parent,
        nextPaymentNumber: child.recurringPaymentNumber || 2,
        thisCycleDue,
      });
    } catch (err: any) {
      otherDiffs.push(`${child.invoiceNumber}: THREW ${err?.message}`);
      continue;
    }
    if (!pricing) {
      skipped++;
      continue;
    }

    const deltas: string[] = [];
    if (pricing.subtotal !== child.subtotal) {
      deltas.push(`subtotal ${child.subtotal} → ${pricing.subtotal}`);
    }
    if (pricing.tax !== (child.tax || 0)) {
      deltas.push(`tax ${child.tax || 0} → ${pricing.tax}`);
    }
    if (pricing.recurringPeriod !== child.recurringPeriod) {
      deltas.push(
        `period ${child.recurringPeriod} → ${pricing.recurringPeriod}`
      );
    }

    if (deltas.length === 0) {
      identical++;
    } else if (deltas.every((d) => d.startsWith("tax "))) {
      // Tax-only differences are the GST recompute — expected exactly when the
      // buyer's resolvable country changed since the parent was created.
      gstDiffs.push(`${child.invoiceNumber}: ${deltas.join(", ")}`);
    } else {
      otherDiffs.push(`${child.invoiceNumber}: ${deltas.join(", ")}`);
    }
  }

  console.log(`identical      : ${identical}`);
  console.log(`GST-only diffs : ${gstDiffs.length}  (expected: buyer region changed)`);
  console.log(`OTHER diffs    : ${otherDiffs.length}  ← must be 0`);
  console.log(`skipped        : ${skipped}\n`);

  if (gstDiffs.length) {
    console.log("GST-only differences (blast radius of the recompute):");
    gstDiffs.slice(0, 20).forEach((d) => console.log("  " + d));
    if (gstDiffs.length > 20) console.log(`  … +${gstDiffs.length - 20} more`);
    console.log(
      "\n  Set THIRD_PARTY_CHILD_GST_RECOMPUTE=off to inherit parent.tax instead.\n"
    );
  }
  if (otherDiffs.length) {
    console.log("UNEXPECTED differences — investigate before shipping:");
    otherDiffs.slice(0, 30).forEach((d) => console.log("  " + d));
  }

  await mongoose.disconnect();
  process.exit(otherDiffs.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
