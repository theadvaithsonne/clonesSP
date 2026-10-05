/**
 * Heal conference-room parent invoices that were lazy-created after signup
 * (via POST /conference-rooms → applyAddRoomsBilling) and got stuck at
 * `status: "draft"` because the previous code path never marked them paid.
 *
 * Consequence of the stuck state: `generateNextChildInvoice` early-returns
 * on unpaid parents, so the recurring cycle never fires. Founder pays the
 * one-off prorated invoice once and then never gets billed again for that
 * room. This script identifies those parents, verifies the founder actually
 * paid the corresponding prorated one-off, then flips the parent to
 * `paid` so the cron picks up cycle 2 on the next `nextDueDate`.
 *
 * Two modes:
 *   default = dry-run, `--apply` = writes.
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Invoice } from "../models/invoice.model";

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(
    `\n[heal-rooms-parents] mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`,
  );

  const stuckParents = await Invoice.find({
    "metadata.type": "office_addon_subscription",
    "metadata.lazyCreated": true,
    "metadata.syntheticAnchor": { $ne: true },
    status: "draft",
    parentInvoiceId: { $in: [null, undefined] },
    cancelledAt: { $in: [null, undefined] },
  }).lean();

  console.log(`Stuck-draft lazy parents found: ${stuckParents.length}\n`);

  const summary = {
    healed: 0,
    skippedNoPaidProrated: 0,
    errors: [] as Array<{ id: string; error: string }>,
  };

  for (const parent of stuckParents) {
    const parentId = String(parent._id);
    const proratedInvs = await Invoice.find({
      "metadata.type": "office_addon_proration",
      "metadata.parentInvoiceId": parentId,
    })
      .select("_id invoiceNumber status paidAt")
      .lean();
    const paidProrated = proratedInvs
      .filter((p) => p.status === "paid")
      .sort(
        (a, b) =>
          new Date(a.paidAt || 0).getTime() - new Date(b.paidAt || 0).getTime(),
      );

    console.log(
      `  parent=${parent.invoiceNumber} (${parentId})  quantity=${parent.lineItems?.[0]?.quantity ?? "?"}  nextDueDate=${parent.nextDueDate}`,
    );
    console.log(
      `    prorated invoices: ${proratedInvs.length} (${paidProrated.length} paid)`,
    );

    if (paidProrated.length === 0) {
      console.log(
        `    [SKIP] no paid prorated one-off — founder may have abandoned. Manual review.`,
      );
      summary.skippedNoPaidProrated++;
      continue;
    }

    if (!APPLY) continue;

    try {
      const paidAt = paidProrated[0].paidAt || new Date();
      await Invoice.updateOne(
        { _id: parent._id, status: "draft" },
        {
          $set: {
            status: "paid",
            paidAt,
            "metadata.syntheticAnchor": true,
            "metadata.healedByBackfillAt": new Date(),
          },
        },
      );
      console.log(
        `    [OK] parent flipped to paid (paidAt=${paidAt.toISOString()})`,
      );
      summary.healed++;
    } catch (err: any) {
      console.error(`    [ERR] ${err?.message || err}`);
      summary.errors.push({ id: parentId, error: err?.message || String(err) });
    }
  }

  console.log(
    `\n${"─".repeat(70)}\n[heal-rooms-parents] SUMMARY (${APPLY ? "APPLIED" : "DRY-RUN"})`,
  );
  console.log(`  Stuck-draft parents found:              ${stuckParents.length}`);
  console.log(`  Would heal (paid prorated found):       ${stuckParents.length - summary.skippedNoPaidProrated}`);
  console.log(`  Skipped (no paid prorated):             ${summary.skippedNoPaidProrated}`);
  if (APPLY) {
    console.log(`  Actually healed:                        ${summary.healed}`);
    console.log(`  Errors:                                 ${summary.errors.length}`);
    for (const e of summary.errors) {
      console.log(`    ${e.id}: ${e.error}`);
    }
  } else {
    console.log(`\n  (Dry-run — re-run with --apply to perform writes.)`);
  }
  console.log(`${"─".repeat(70)}\n`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
